import { get, download, readJson, writeJson, mergeItems, toIso, truncate } from '../lib.mjs';

const FILE = 'data/instagram.json';
const FIELDS = 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp';

// Uses the "Instagram API with Instagram Login" (professional accounts only).
// Thumbnails are downloaded because Instagram CDN links expire after a few days.
export async function fetchInstagram(config) {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) return 'pulado: defina o secret IG_ACCESS_TOKEN';

  const stored = await readJson(FILE, { items: [] });
  const known = new Set(stored.items.map((i) => i.id));
  const firstRun = known.size === 0;

  const media = [];
  let url = `https://graph.instagram.com/${config.apiVersion}/me/media?fields=${FIELDS}&limit=50&access_token=${token}`;
  for (let page = 0; url && page < (firstRun ? 40 : 3); page++) {
    const json = await (await get(url)).json();
    media.push(...json.data);
    // Stop paging once a page only contains posts we already have.
    if (!firstRun && json.data.every((m) => known.has(`ig-${m.id}`))) break;
    url = json.paging?.next;
  }

  const items = [];
  for (const m of media) {
    if (config.onlyReels && m.media_product_type !== 'REELS') continue;
    const caption = (m.caption ?? '').trim();
    const item = {
      id: `ig-${m.id}`,
      source: 'instagram',
      title: truncate(caption.split('\n')[0] || 'Reel', 140),
      description: truncate(caption, 400),
      url: m.permalink,
      date: toIso(m.timestamp),
    };
    const thumb = m.thumbnail_url ?? (m.media_type === 'VIDEO' ? null : m.media_url);
    if (thumb) {
      try {
        item.image = await download(thumb, `public/media/instagram/${m.id}.jpg`);
      } catch (err) {
        console.warn(`  instagram: sem miniatura para ${m.id} (${err.message})`);
      }
    }
    items.push(item);
  }

  const merged = mergeItems(stored.items, items);
  await writeJson(FILE, { items: merged });
  return `${items.length} recebidos, ${merged.length} no total`;
}
