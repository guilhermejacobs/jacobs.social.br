import { get, readJson, writeJson, mergeItems, toIso, truncate, stripTags, decodeEntities, xmlTag as tag, xmlAttr as attr, xmlItems } from '../lib.mjs';

const FILE = 'data/podcast.json';

// Prefers the Spotify Web API (episode links open in Spotify); falls back to the show's RSS feed.
export async function fetchPodcast(config) {
  const stored = await readJson(FILE, { show: null, items: [] });
  let result;
  if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    result = await fromSpotify(config, stored);
  } else if (config.rss) {
    result = await fromRss(config);
  } else {
    return 'pulado: defina SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET ou "podcast.rss" no site.config.json';
  }
  const merged = mergeItems(stored.items, result.items);
  await writeJson(FILE, { show: result.show ?? stored.show, items: merged });
  return `${result.items.length} recebidos, ${merged.length} no total`;
}

async function fromSpotify(config, stored) {
  const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const { access_token } = await (
    await get('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { authorization: `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    })
  ).json();
  const api = async (url) => (await get(url, { headers: { authorization: `Bearer ${access_token}` } })).json();

  const id = config.spotifyShowId;
  const s = await api(`https://api.spotify.com/v1/shows/${id}?market=BR`);
  const show = { name: s.name, publisher: s.publisher, url: s.external_urls?.spotify, image: s.images?.[0]?.url };

  const known = new Set(stored.items.map((i) => i.id));
  const items = [];
  let url = `https://api.spotify.com/v1/shows/${id}/episodes?market=BR&limit=50`;
  while (url) {
    const page = await api(url);
    const eps = page.items.filter(Boolean);
    for (const ep of eps) {
      items.push({
        id: `sp-${ep.id}`,
        source: 'podcast',
        title: ep.name,
        description: truncate(ep.description ?? '', 400),
        url: ep.external_urls?.spotify,
        // Day-precision dates become midday in Brasília so they never slip to the previous day.
        date: toIso(ep.release_date.length === 10 ? `${ep.release_date}T12:00:00-03:00` : ep.release_date),
        image: ep.images?.[0]?.url,
        duration: Math.round(ep.duration_ms / 1000),
      });
    }
    if (known.size && eps.every((ep) => known.has(`sp-${ep.id}`))) break;
    url = page.next;
  }
  return { show, items };
}

async function fromRss(config) {
  const xml = await (await get(config.rss)).text();
  const channel = xml.split(/<item[\s>]/i)[0];
  const cover = attr(channel, 'itunes:image', 'href');
  const show = { name: stripTags(tag(channel, 'title')), url: stripTags(tag(channel, 'link')), image: cover };

  const items = xmlItems(xml).map((src) => {
    const guid = stripTags(tag(src, 'guid') ?? tag(src, 'title'));
    return {
      id: `rss-${guid.replace(/[^\w-]+/g, '').slice(-64)}`,
      source: 'podcast',
      title: stripTags(tag(src, 'title')),
      description: truncate(stripTags(tag(src, 'description') ?? ''), 400),
      url: decodeEntities(stripTags(tag(src, 'link') ?? '')) || show.url,
      date: toIso(stripTags(tag(src, 'pubDate') ?? '')),
      image: attr(src, 'itunes:image', 'href') ?? cover,
      duration: parseDuration(stripTags(tag(src, 'itunes:duration') ?? '')),
    };
  });
  return { show, items };
}

function parseDuration(s) {
  if (!s) return undefined;
  return s.split(':').reduce((acc, part) => acc * 60 + Number(part), 0) || undefined;
}
