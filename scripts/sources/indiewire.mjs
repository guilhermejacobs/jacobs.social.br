import { get, readJson, writeJson, mergeItems, toIso, truncate, stripTags, decodeEntities, xmlTag, xmlAttr, xmlItems } from '../lib.mjs';
import { fetchAuthorPage, readArticleMeta } from './author-page.mjs';

const FILE = 'data/indiewire.json';

// IndieWire runs on WordPress, which publishes a feed per author at <author page>/feed/.
// The feed only lists that author's posts. If it ever fails, read the author page instead.
export async function fetchIndiewire(config) {
  if (!config.authorUrl) return 'pulado: defina "indiewire.authorUrl" no site.config.json';
  const stored = await readJson(FILE, { ignored: [], items: [] });
  const known = new Set(stored.items.map((i) => i.url));
  const feed = `${config.authorUrl.replace(/\/$/, '')}/feed/`;

  let entries = [];
  try {
    // The first run walks back through older pages of the feed to fill the archive.
    // WordPress answers 404 past the last page, which simply ends the loop.
    for (let page = 1; page <= (known.size ? 1 : 20); page++) {
      const res = await get(page === 1 ? feed : `${feed}?paged=${page}`).catch((err) => {
        if (page === 1) throw err;
        return null;
      });
      const pageItems = res ? xmlItems(await res.text()) : [];
      if (!pageItems.length) break;
      entries.push(...pageItems);
    }
  } catch (err) {
    if (entries.length) {
      console.warn(`  indiewire: feed interrompido (${err.message}); seguindo com o que veio`);
    } else {
      console.warn(`  indiewire: feed indisponível (${err.message}); lendo a página de autor`);
      return `${await fetchAuthorPage(config, { source: 'indiewire', prefix: 'iw' })} (pela página de autor)`;
    }
  }

  const items = [];
  for (const src of entries) {
    const url = decodeEntities(stripTags(xmlTag(src, 'link') ?? ''));
    if (!url) continue;
    const item = {
      id: `iw-${new URL(url).pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '')}`,
      source: 'indiewire',
      title: stripTags(xmlTag(src, 'title')),
      description: truncate(stripTags(xmlTag(src, 'description') ?? ''), 300),
      url,
      date: toIso(stripTags(xmlTag(src, 'pubDate') ?? '')),
      image:
        xmlAttr(src, 'media:content', 'url') ??
        xmlAttr(src, 'media:thumbnail', 'url') ??
        xmlAttr(src, 'enclosure', 'url') ??
        xmlAttr(xmlTag(src, 'content:encoded') ?? '', 'img', 'src'),
    };
    // Feeds without images: read the image from the article page, once per article.
    if (!item.image && !known.has(url)) {
      try {
        item.image = readArticleMeta(await (await get(url)).text()).image;
      } catch (err) {
        console.warn(`  indiewire: sem imagem para ${url} (${err.message})`);
      }
    }
    items.push(item);
  }

  const merged = mergeItems(stored.items, items);
  await writeJson(FILE, { ignored: stored.ignored, items: merged });
  return `${items.length} recebidos, ${merged.length} no total`;
}
