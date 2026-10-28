import { get, readJson, writeJson, mergeItems, toIso, truncate, decodeEntities } from '../lib.mjs';

const SKIP = /^\/(autor|autores|tag|tags|busca|search|assine|login|cadastro|newsletter|sobre|contato|termos|politica|privacidade|_next|_scroll|api|static|assets|images|feed)(\/|$)/i;

// For sites without a feed: collect article links from the author page, then read each
// new article's metadata (title, image, date, author, type). Only articles whose author matches
// `authorMatch` are kept, which filters out "most read" boxes and other people's articles.
// With `includeTypes`, only those content types are kept (Omelete: review, article, list, news).
// With `scroll`, older articles are also collected through Omelete's "Ver Mais" endpoint,
// a few pages per run, until the whole history has been read.
export async function fetchAuthorPage(config, { source, prefix }) {
  if (!config.authorUrl) return `pulado: defina "${source}.authorUrl" no site.config.json`;
  const file = `data/${source}.json`;
  const stored = await readJson(file, { ignored: [], items: [] });
  stored.pending ??= [];
  const wanted = (type) => !config.includeTypes || config.includeTypes.includes(type);
  const seen = new Set([...stored.items.map((i) => i.url), ...stored.ignored, ...stored.pending]);

  // Newest first: links on the author page go to the front of the queue.
  const html = await (await get(config.authorUrl)).text();
  const fresh = extractArticleLinks(html, config.authorUrl).filter((u) => !seen.has(u));
  fresh.forEach((u) => seen.add(u));
  // Items stored before types were recorded get read again once to learn their type.
  const untyped = config.includeTypes ? stored.items.filter((i) => !i.type).map((i) => i.url) : [];
  const queue = [...fresh, ...untyped.filter((u) => !stored.pending.includes(u)), ...stored.pending];

  let scrolled = 0;
  if (config.scroll && !stored.scrollDone) {
    let cursor = stored.cursor ?? html.match(/lastNewsTimestamp\s*=\s*'(\d+)'/)?.[1];
    const { origin, pathname } = new URL(config.authorUrl);
    for (let page = 0; cursor && page < (config.scrollPagesPerRun ?? 10); page++) {
      const entries = await (await get(`${origin}/_scroll${pathname}?next=${cursor}`)).json();
      if (!Array.isArray(entries)) throw new Error('resposta inesperada do "Ver Mais"');
      if (!entries.length) {
        stored.scrollDone = true;
        break;
      }
      for (const entry of entries) {
        // The listing already says the type, so unwanted articles are never downloaded.
        if (!wanted(entry.content_type)) continue;
        for (const u of extractArticleLinks(entry.body ?? '', config.authorUrl)) {
          if (!seen.has(u)) {
            seen.add(u);
            queue.push(u);
            scrolled++;
          }
        }
      }
      cursor = entries.at(-1).timestamp;
    }
    stored.cursor = cursor;
  }

  const items = [];
  const ignored = [];
  const dropped = new Set();
  const authorRe = new RegExp(config.authorMatch, 'i');
  const batch = queue.slice(0, config.maxNewPerRun);
  for (const url of batch) {
    try {
      const meta = readArticleMeta(await (await get(url)).text());
      if (!meta.title || !authorRe.test(meta.author ?? '') || !wanted(meta.type)) {
        ignored.push(url);
        dropped.add(url);
        continue;
      }
      items.push({
        id: `${prefix}-${new URL(url).pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '')}`,
        source,
        title: meta.title,
        description: truncate(meta.description ?? '', 300),
        url,
        date: toIso(meta.date),
        image: meta.image,
        section: meta.section,
        type: meta.type,
      });
    } catch (err) {
      console.warn(`  ${source}: ${err.message}`);
    }
  }

  const merged = mergeItems(stored.items, items).filter((i) => !dropped.has(i.url));
  await writeJson(file, {
    // Remember rejected links so we do not re-download them every hour.
    ignored: [...stored.ignored, ...ignored].slice(-2000),
    pending: queue.slice(batch.length),
    ...(config.scroll && { cursor: stored.cursor ?? null, scrollDone: !!stored.scrollDone }),
    items: merged,
  });
  const backlog = queue.length - batch.length;
  return `${fresh.length} links novos, ${scrolled} do histórico, ${items.length} matérias guardadas, ${ignored.length} ignoradas, ${backlog} na fila, ${merged.length} no total`;
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

export function readArticleMeta(html) {
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
    // Omelete labels each page for its ad server: "news", "review", "article" or "list".
    type: html.match(/"content_type":\s*"([^"]+)"/)?.[1],
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
