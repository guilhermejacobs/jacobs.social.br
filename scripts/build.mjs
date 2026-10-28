import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, readJson, mergeItems } from './lib.mjs';

const DIST = path.join(ROOT, 'dist');
const sample = process.argv.includes('--sample');
const config = await readJson('site.config.json');

const SOURCES = {
  podcast: { label: 'Podcast', cta: 'Ouvir no Spotify' },
  instagram: { label: 'Reels', cta: 'Ver no Instagram' },
  omelete: { label: 'Omelete', cta: 'Ler no Omelete' },
};

// ---------- data ----------
let show = null;
let items;
if (sample) {
  ({ show, items } = await readJson('fixtures/sample.json'));
} else {
  const ig = await readJson('data/instagram.json', { items: [] });
  const pod = await readJson('data/podcast.json', { items: [] });
  const om = await readJson('data/omelete.json', { items: [] });
  const manual = await readJson('data/manual.json', { items: [] });
  show = pod.show;
  const extra = manual.items.map((i) => ({ id: `manual-${i.url}`, ...i, date: new Date(i.date).toISOString() }));
  items = mergeItems([...ig.items, ...pod.items, ...om.items], extra);
}
items = items.filter((i) => SOURCES[i.source] && i.url && i.date);
const bySource = (s) => items.filter((i) => i.source === s);

// ---------- helpers ----------
const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const img = (src) => (!src ? '' : /^https?:/.test(src) ? src : `/${src.replace(/^public\//, '')}`);
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' });
const fmtDate = (iso) => dateFmt.format(new Date(iso)).replace(/ de /g, ' ');
const fmtDuration = (s) => (s ? `${Math.round(s / 60)} min` : '');
const ext = 'target="_blank" rel="noopener"';

function meta(item) {
  const bits = [fmtDate(item.date), item.source === 'podcast' && fmtDuration(item.duration)].filter(Boolean);
  return `<span class="meta"><time datetime="${item.date}">${bits.join(' · ')}</time></span>`;
}
const kicker = (item) => `<span class="kicker k-${item.source}">${SOURCES[item.source].label}</span>`;
const thumb = (item, cls = '') =>
  item.image
    ? `<div class="thumb ${cls}"><img src="${esc(img(item.image))}" alt="" loading="lazy" decoding="async"></div>`
    : `<div class="thumb ${cls} thumb-empty"><span>${SOURCES[item.source].label}</span></div>`;

function card(item, variant = '') {
  return `<article class="card card-${item.source} ${variant}" data-source="${item.source}">
  <a href="${esc(item.url)}" ${ext}>
    ${thumb(item, item.source === 'instagram' ? 'tall' : '')}
    <div class="card-body">${kicker(item)}<h3>${esc(item.title)}</h3>${meta(item)}</div>
  </a>
</article>`;
}

function socialList(cls = '') {
  return `<ul class="social ${cls}">${config.social
    .map((s) => `<li><a href="${esc(s.url)}" ${ext}><span class="social-label">${esc(s.label)}</span><span class="social-handle">${esc(s.handle)}</span></a></li>`)
    .join('')}</ul>`;
}

function page({ title, description = config.description, path: pagePath = '/', body, active }) {
  const nav = [
    ['/', 'Início'],
    ['/arquivo/', 'Arquivo'],
    ['/sobre/', 'Sobre'],
  ];
  const fullTitle = title ? `${title} · ${config.name}` : config.name;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${config.url}${pagePath}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${config.url}${pagePath}">
<meta property="og:image" content="${config.url}/assets/guilherme-jacobs.jpg">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/styles.css">
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
<header class="masthead">
  <div class="wrap masthead-inner">
    <a class="wordmark" href="/">Guilherme <span>Jacobs</span></a>
    <nav class="nav" aria-label="Principal">${nav
      .map(([href, label]) => `<a href="${href}"${active === href ? ' aria-current="page"' : ''}>${label}</a>`)
      .join('')}</nav>
  </div>
</header>
<main>
${body}
</main>
<footer class="footer">
  <div class="wrap">
    <p class="footer-title">Me acompanhe</p>
    ${socialList('social-footer')}
    <p class="fineprint">© ${new Date().getFullYear()} ${esc(config.name)}. Conteúdo atualizado automaticamente.</p>
  </div>
</footer>
<script src="/assets/app.js" defer></script>
</body>
</html>
`;
}

function section(source, title, list, { more = true, cls = '' } = {}) {
  if (!list.length) return '';
  return `<section class="wrap block block-${source}">
  <header class="block-head">
    <h2>${title}</h2>
    ${more ? `<a class="more" href="/arquivo/?tipo=${source}">Ver tudo →</a>` : ''}
  </header>
  <div class="row ${cls}">${list.map((i) => card(i)).join('')}</div>
</section>`;
}

// ---------- pages ----------
function home() {
  const [lead, ...rest] = items;
  const side = rest.slice(0, 4);
  const hero = lead
    ? `<section class="wrap hero">
  <article class="lead card-${lead.source}">
    <a href="${esc(lead.url)}" ${ext}>
      ${thumb(lead, lead.source === 'instagram' ? 'tall' : 'wide')}
      <div class="lead-body">${kicker(lead)}<h1>${esc(lead.title)}</h1>
      ${lead.description ? `<p class="dek">${esc(lead.description)}</p>` : ''}${meta(lead)}</div>
    </a>
  </article>
  <aside class="latest" aria-label="Mais recentes">
    <h2 class="rail-title">Mais recentes</h2>
    <ol>${side
      .map(
        (i) => `<li><a href="${esc(i.url)}" ${ext}>${thumb(i, 'mini')}<div>${kicker(i)}<h3>${esc(i.title)}</h3>${meta(i)}</div></a></li>`,
      )
      .join('')}</ol>
  </aside>
</section>`
    : `<section class="wrap empty"><h1>Em breve</h1><p>Os conteúdos aparecem aqui assim que a primeira atualização automática rodar.</p></section>`;

  const showName = show?.name ? esc(show.name) : 'Podcast';
  return page({
    path: '/',
    active: '/',
    body: `${hero}
${section('podcast', `Episódios · ${showName}`, bySource('podcast').slice(0, 4))}
${section('instagram', 'Reels', bySource('instagram').slice(0, 6), { cls: 'row-reels' })}
${section('omelete', 'No Omelete', bySource('omelete').slice(0, 4))}
<section class="wrap about-strip">
  <img src="/assets/guilherme-jacobs.jpg" alt="Guilherme Jacobs" width="160" height="160" loading="lazy">
  <div>
    <p class="about-lede">${esc(config.bio[0])}</p>
    <a class="more" href="/sobre/">Leia a bio completa →</a>
  </div>
</section>`,
  });
}

function archive() {
  const counts = Object.fromEntries(Object.keys(SOURCES).map((s) => [s, bySource(s).length]));
  const filters = [['todos', 'Tudo', items.length], ...Object.entries(SOURCES).map(([s, v]) => [s, v.label, counts[s]])]
    .filter(([, , n]) => n > 0)
    .map(([key, label, n]) => `<button type="button" class="chip" data-filter="${key}" aria-pressed="${key === 'todos'}">${label} <span>${n}</span></button>`)
    .join('');
  return page({
    title: 'Arquivo',
    description: `Todos os reels, episódios de podcast e textos de ${config.name}.`,
    path: '/arquivo/',
    active: '/arquivo/',
    body: `<section class="wrap archive">
  <header class="page-head"><h1>Arquivo</h1><p>Tudo o que publiquei, do mais novo ao mais antigo.</p></header>
  ${items.length ? `<div class="filters" role="group" aria-label="Filtrar por tipo">${filters}</div>` : '<p class="empty">Nada por aqui ainda.</p>'}
  <div class="grid" id="archive-grid">${items.map((i) => card(i)).join('')}</div>
  <p class="load"><button type="button" class="button" id="load-more" hidden>Carregar mais</button></p>
</section>`,
  });
}

function about() {
  return page({
    title: 'Sobre',
    description: config.bio[0],
    path: '/sobre/',
    active: '/sobre/',
    body: `<section class="wrap bio">
  <figure class="bio-photo"><img src="/assets/guilherme-jacobs.jpg" alt="Guilherme Jacobs" width="900" height="900"></figure>
  <div class="bio-text">
    <p class="kicker">Sobre</p>
    <h1>${esc(config.name)}</h1>
    ${config.bio.map((p) => `<p>${esc(p)}</p>`).join('\n    ')}
    <h2>Onde me encontrar</h2>
    ${socialList('social-big')}
  </div>
</section>`,
  });
}

function notFound() {
  return page({
    title: 'Página não encontrada',
    path: '/404.html',
    body: `<section class="wrap empty"><h1>404</h1><p>Essa página saiu de cartaz. <a href="/">Volte para o início</a>.</p></section>`,
  });
}

// ---------- write ----------
await fs.rm(DIST, { recursive: true, force: true });
await fs.cp(path.join(ROOT, 'public'), DIST, { recursive: true });
await fs.cp(path.join(ROOT, 'src/assets'), path.join(DIST, 'assets'), { recursive: true });
if (sample) await fs.cp(path.join(ROOT, 'fixtures/media'), path.join(DIST, 'sample'), { recursive: true });
const out = async (file, html) => {
  await fs.mkdir(path.dirname(path.join(DIST, file)), { recursive: true });
  await fs.writeFile(path.join(DIST, file), html);
};
await out('index.html', home());
await out('arquivo/index.html', archive());
await out('sobre/index.html', about());
await out('404.html', notFound());
await out('CNAME', new URL(config.url).host + '\n');
console.log(`site gerado em dist/ com ${items.length} itens${sample ? ' (dados de exemplo)' : ''}`);
