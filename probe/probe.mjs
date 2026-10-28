import fs from 'node:fs/promises';
// Summarises what the Instagram API returns, without writing tokens anywhere.
const token = process.env.IG_ACCESS_TOKEN, id = process.env.IG_USER_ID;
const out = { media: [], errors: [] };
const f = 'id,media_type,media_product_type,timestamp,permalink,caption,is_shared_to_feed';
let url = `https://graph.facebook.com/v23.0/${id}/media?fields=${f}&limit=50&access_token=${token}`;
for (let i = 0; url && i < 60; i++) {
  const j = await (await fetch(url)).json();
  if (j.error) { out.errors.push(j.error.message); break; }
  out.media.push(...j.data.map((m) => ({ d: m.timestamp?.slice(0, 10), t: m.media_type, p: m.media_product_type, l: m.permalink, c: (m.caption ?? '').slice(0, 50) })));
  url = j.paging?.next;
}
const acc = await (await fetch(`https://graph.facebook.com/v23.0/${id}?fields=username,media_count&access_token=${token}`)).json();
out.account = { username: acc.username, media_count: acc.media_count, error: acc.error?.message };
const tags = await (await fetch(`https://graph.facebook.com/v23.0/${id}/tags?fields=id,media_type,media_product_type,timestamp,permalink,username&limit=50&access_token=${token}`)).json();
out.tags = tags.error ? tags.error.message : tags.data?.map((m) => `${m.timestamp?.slice(0, 10)} ${m.media_product_type} @${m.username} ${m.permalink}`);
out.summary = {};
for (const m of out.media) out.summary[`${m.t}/${m.p}`] = (out.summary[`${m.t}/${m.p}`] ?? 0) + 1;
await fs.mkdir('probe/out', { recursive: true });
await fs.writeFile('probe/out/ig.json', JSON.stringify(out, null, 1));
