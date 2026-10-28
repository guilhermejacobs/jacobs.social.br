import fs from 'node:fs/promises';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const out = {};
const html = await (await fetch('https://open.spotify.com/show/7yJkAgNTUU5BqaoshKqlMR', { headers: { 'user-agent': UA } })).text();
out.ogTitle = html.match(/property="og:title" content="([^"]+)"/)?.[1];
out.ogDesc = html.match(/property="og:description" content="([^"]+)"/)?.[1];
out.rssInPage = [...new Set(html.match(/https?:\/\/[^"'\s]+(rss|feed)[^"'\s]*/gi) ?? [])].slice(0, 10);
if (out.ogTitle) {
  const r = await (await fetch(`https://itunes.apple.com/search?media=podcast&country=BR&term=${encodeURIComponent(out.ogTitle)}`)).json();
  out.itunes = r.results.slice(0, 6).map((x) => ({ name: x.collectionName, artist: x.artistName, feed: x.feedUrl, count: x.trackCount, last: x.releaseDate }));
  for (const x of out.itunes.filter((x) => x.feed).slice(0, 3)) {
    try {
      const xml = await (await fetch(x.feed, { headers: { 'user-agent': UA } })).text();
      x.feedTitle = xml.match(/<title>(?:<!\[CDATA\[)?([^<\]]+)/)?.[1];
      x.items = (xml.match(/<item[\s>]/g) ?? []).length;
      x.firstItem = xml.split(/<item[\s>]/)[1]?.slice(0, 1500);
    } catch (e) { x.error = e.message; }
  }
}
await fs.mkdir('probe/out', { recursive: true });
await fs.writeFile('probe/out/podcast.json', JSON.stringify(out, null, 2));
