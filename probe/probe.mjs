import fs from 'node:fs/promises';
const token = process.env.IG_ACCESS_TOKEN, id = process.env.IG_USER_ID;
const out = {};
const tries = {
  basic: 'id,caption,media_product_type,permalink,timestamp',
  collaborators: 'id,caption,media_product_type,permalink,timestamp,collaborators',
  thumb: 'id,media_product_type,permalink,thumbnail_url,media_url',
};
for (const [name, fields] of Object.entries(tries)) {
  const url = `https://graph.facebook.com/v23.0/${id}?fields=business_discovery.username(omelete){username,media_count,media.limit(40){${fields}}}&access_token=${token}`;
  const j = await (await fetch(url)).json();
  if (j.error) { out[name] = 'ERRO: ' + j.error.message; continue; }
  const media = j.business_discovery?.media?.data ?? [];
  out[name] = {
    count: j.business_discovery?.media_count,
    returned: media.length,
    mentionsGjsix: media.filter((m) => /gjsix|jacobs/i.test(m.caption ?? '')).map((m) => `${m.timestamp?.slice(0, 10)} ${m.media_product_type} ${m.permalink} ${JSON.stringify(m.collaborators ?? null)}`),
    sample: media.slice(0, 3).map((m) => ({ ...m, caption: (m.caption ?? '').slice(0, 60) })),
    withCollaborators: media.filter((m) => m.collaborators).length,
  };
}
await fs.mkdir('probe/out', { recursive: true });
await fs.writeFile('probe/out/bd.json', JSON.stringify(out, null, 1));
