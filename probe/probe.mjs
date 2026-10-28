import fs from 'node:fs/promises';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const out = {};
const html = await (await fetch('https://open.spotify.com/show/7yJkAgNTUU5BqaoshKqlMR', { headers: { 'user-agent': UA } })).text();
out.title = html.match(/<title>([^<]+)/)?.[1];
out.names = [...new Set(html.match(/"name":"[^"]{2,80}"/g) ?? [])].slice(0, 15);
out.searches = {};
for (const term of ['De Quinta Omelete', 'Omelete podcast', 'Guilherme Jacobs', out.title?.split(/[|-]/)[0].trim()].filter(Boolean)) {
  const r = await (await fetch(`https://itunes.apple.com/search?media=podcast&country=BR&term=${encodeURIComponent(term)}`)).json();
  out.searches[term] = r.results.slice(0, 5).map((x) => `${x.collectionName} | ${x.artistName} | ${x.feedUrl} | ${x.trackCount} eps | ${x.releaseDate}`);
}
await fs.mkdir('probe/out', { recursive: true });
await fs.writeFile('probe/out/podcast.json', JSON.stringify(out, null, 2));
