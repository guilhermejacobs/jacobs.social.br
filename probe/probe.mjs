import fs from 'node:fs/promises';
const xml = await (await fetch('https://anchor.fm/s/109c2da44/podcast/rss')).text();
const items = xml.split(/<item>/).slice(1, 4).map((s) => s.slice(0, 1800));
await fs.mkdir('probe/out', { recursive: true });
await fs.writeFile('probe/out/feed.txt', xml.split(/<item>/)[0].slice(0, 2500) + '\n=====\n' + items.join('\n=====\n'));
