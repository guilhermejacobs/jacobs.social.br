import { get, readJson, writeJson, mergeItems, toIso, truncate, decodeEntities } from '../lib.mjs';

const FILE = 'data/omelete.json';
const SKIP = /^\/(autor|autores|tag|tags|busca|search|assine|login|cadastro|newsletter|sobre|contato|termos|politica|privacidade|_next|api|static|assets|images|feed)(\/|$)/i;

// Omelete has no public API, so: collect article links from the author page, then read each
// new article's metadata (title, image, date, author). Only articles whose author matches
// `authorMatch` are kept, which filters out "most read" boxes and other people's articles.
export async function fetchOmelete(config) {
  if (!config.authorUrl) return 'pulado: defina "omelete.authorUrl" no site.config.json';
  const stored = await readJson(FILE, { ignored: [], items: [] });
  const seen = new Set([...stored.items.map((i) => i.url), ...stored.ignored]);

  const html = await (await get(config.authorUrl)).text();
  const links = extractArticleLinks(html, config.authorUrl).filter((u) => !seen.has(u));

  const items = [];
  const ignored = [];
  const authorRe = new RegExp(config.authorMatch, 'i');
  for (const url of links.slice(0, config.maxNewPerRun)) {
    try {
      const meta = readArticleMeta(await (await get(url)).text());
      if (!meta.title || !authorRe.test(meta.author ?? '')) {
        ignored.push(url);
        continue;
      }
      items.push({
        id: `om-${new URL(url).pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '')}`,
        source: 'omelete',
        title: meta.title,
        description: truncate(meta.description ?? '', 300),
        url,
        date: toIso(meta.date),
        image: meta.image,
        section: meta.section,
      });
    } catch (err) {
      console.warn(`  omelete: ${err.message}`);
    }
  }

  const merged = mergeItems(stored.items, items);
  // Remember rejected links so we do not re-download them every hour.
  await writeJson(FILE, { ignored: [...stored.ignored, ...ignored].slice(-1000), items: merged });
  return `${links.length} links novos, ${items.length} matérias suas, ${ignored.length} ignorados, ${merged.length} no total`;
}

function extractArticleLinks(html, base) {
  const host = new URL(base).host;
  const urls = new Set();
  const candidates = [
    ...[...html.matchAll(/href=["']([^"'#?]+)["']/gi)].map((m) => m[1]),
    // Next.js and similar frameworks keep links inside embedded JSON.
    ...[...html.matchAll(/"(?:url|href|link|path|slug)"\s*:\s*"([^"]+)"/gi)].map((m) => m[1].replace(/\\\//g, '/')),
  ];
  for (const raw of candidates) {
    let u;
    try {
      u = new URL(decodeEntities(raw), base);
    } catch {
      continue;
    }
    if (u.host !== host || SKIP.test(u.pathname) || /\.\w{2,4}$/.test(u.pathname)) continue;
    // Articles live at /<section>/<slug>; section pages and the home have fewer segments.
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2 || parts.at(-1).length < 12) continue;
    urls.add(`${u.origin}${u.pathname.replace(/\/$/, '')}`);
  }
  return [...urls];
}

function readArticleMeta(html) {
  const meta = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = tag.match(/\b(?:property|name|itemprop)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = tag.match(/\bcontent=["']([^"']*)["']/i)?.[1];
    if (key && content != null && !(key in meta)) meta[key] = decodeEntities(content);
  }
  const ld = {};
  for (const [, json] of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(json), ld);
    } catch {}
  }
  return {
    title: ld.headline ?? meta['og:title'] ?? meta['twitter:title'],
    description: meta['og:description'] ?? meta.description,
    image: meta['og:image'] ?? ld.image,
    date: ld.datePublished ?? meta['article:published_time'] ?? meta['date'],
    author: [ld.author, meta.author, meta['article:author']].filter(Boolean).join(' '),
    section: meta['article:section'],
  };
}

function walk(node, out) {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, out));
  if (!node || typeof node !== 'object') return;
  if (/Article|Posting/.test([].concat(node['@type'] ?? []).join(' '))) {
    out.headline ??= node.headline;
    out.datePublished ??= node.datePublished;
    const img = [].concat(node.image ?? [])[0];
    out.image ??= typeof img === 'string' ? img : img?.url;
    out.author = [out.author, ...[].concat(node.author ?? []).map((a) => (typeof a === 'string' ? a : a?.name))]
      .filter(Boolean)
      .join(' ');
  }
  Object.values(node).forEach((v) => walk(v, out));
}
