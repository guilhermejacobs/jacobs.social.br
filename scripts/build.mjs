import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, readJson, mergeItems } from './lib.mjs';

const DIST = path.join(ROOT, 'dist');
const sample = process.argv.includes('--sample');
const config = await readJson('site.config.json');

// Each source belongs to one of the three blocks on the home page.
const GROUPS = {
  podcasts: { title: 'Podcasts' },
  social: { title: 'Social' },
  textos: { title: 'No Omelete e além' },
};
const SOURCES = {
  podcast: { label: 'Podcast', group: 'podcasts' },
  instagram: { label: 'Instagram', group: 'social' },
  tiktok: { label: 'TikTok', group: 'social' },
  omelete: { label: 'Omelete', group: 'textos' },
  indiewire: { label: 'IndieWire', group: 'textos' },
};
// Manual items may use any source as long as they say which block they belong to.
const groupOf = (i) => i.group ?? SOURCES[i.source]?.group;
const labelOf = (i) => i.sourceLabel ?? SOURCES[i.source]?.label ?? i.source;

// ---------- data ----------
let show = null;
let items;
if (sample) {
  ({ show, items } = await readJson('fixtures/sample.json'));
} else {
  const ig = await readJson('data/instagram.json', { items: [] });
  const pod = await readJson('data/podcast.json', { items: [] });
  const om = await readJson('data/omelete.json', { items: [] });
  const iw = await readJson('data/indiewire.json', { items: [] });
  const manual = await readJson('data/manual.json', { items: [] });
  show = pod.show;
  const extra = manual.items.map((i) => ({ id: `manual-${i.url}`, ...i, date: new Date(i.date).toISOString() }));
  items = mergeItems([...ig.items, ...pod.items, ...om.items, ...iw.items], extra);
}
// "hide" in site.config.json lists URLs to keep off the site even if a fetch brings them back.
const hidden = new Set(config.hide ?? []);
items = items.filter((i) => GROUPS[groupOf(i)] && i.url && i.date && !hidden.has(i.url));
const byGroup = (g) => items.filter((i) => groupOf(i) === g);

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
const kicker = (item) => `<span class="kicker k-${groupOf(item)}">${esc(labelOf(item))}</span>`;
const thumb = (item, cls = '') =>
  item.image
    ? `<div class="thumb ${cls}"><img src="${esc(img(item.image))}" alt="" loading="lazy" decoding="async"></div>`
    : `<div class="thumb ${cls} thumb-empty"><span>${esc(labelOf(item))}</span></div>`;

function card(item) {
  const group = groupOf(item);
  return `<article class="card card-${group}" data-group="${group}">
  <a href="${esc(item.url)}" ${ext}>
    ${thumb(item, group === 'social' ? 'tall' : '')}
    <div class="card-body">${kicker(item)}<h3>${esc(item.title)}</h3>${meta(item)}</div>
  </a>
</article>`;
}

function socialList(cls = '') {
  return `<ul class="social ${cls}">${config.social
    .map((s) => `<li><a href="${esc(s.url)}" ${ext}><span class="social-label">${esc(s.label)}</span><span class="social-handle">${esc(s.handle)}</span></a></li>`)
    .join('')}</ul>`;
}

// Simple line icons for the header, picked by the link's domain.
const ICONS = {
  'instagram.com': '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" class="fill"/>',
  'tiktok.com': '<path class="fill" d="M16.2 3c.3 2.3 1.7 3.9 3.8 4.2v3.1a7 7 0 0 1-3.8-1.2v6.1a5.6 5.6 0 1 1-5.6-5.6l.8.1v3.2a2.4 2.4 0 1 0 1.6 2.3V3h3.2z"/>',
  'x.com': '<path d="M4.5 4h4.3l10.7 16h-4.3z" class="fill"/><path d="M19.2 4l-6.1 7M10.9 13 4.8 20"/>',
  'letterboxd.com': '<circle cx="5.5" cy="12" r="3.4" class="fill"/><circle cx="12" cy="12" r="3.4" class="fill"/><circle cx="18.5" cy="12" r="3.4" class="fill"/>',
  'spotify.com': '<circle cx="12" cy="12" r="9.5"/><path d="M7 9.4c3.4-1 7.2-.7 10.2 1M7.6 12.6c2.8-.8 5.8-.5 8.2.9M8.3 15.6c2.2-.6 4.5-.4 6.4.7"/>',
};
const iconFor = (url) => Object.entries(ICONS).find(([host]) => new URL(url).hostname.endsWith(host))?.[1];

function socialIcons() {
  return `<ul class="social-icons" aria-label="Redes sociais">${config.social
    .map((s) => {
      const icon = iconFor(s.url);
      const inner = icon ? `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>` : esc(s.label);
      return `<li><a href="${esc(s.url)}" ${ext} aria-label="${esc(s.label)}" title="${esc(s.label)}">${inner}</a></li>`;
    })
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
<html lang="pt-BR" data-theme="dark">
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
<script>
document.documentElement.classList.add('js');
try { if (localStorage.getItem('theme') === 'light') document.documentElement.dataset.theme = 'light'; } catch {}
</script>
</head>
<body>
<header class="masthead">
  <div class="wrap masthead-inner">
    <a class="wordmark" href="/">Guilherme <span>Jacobs</span></a>
    ${socialIcons()}
    <div class="masthead-right">
      <nav class="nav" aria-label="Principal">${nav
        .map(([href, label]) => `<a href="${href}"${active === href ? ' aria-current="page"' : ''}>${label}</a>`)
        .join('')}</nav>
      <button type="button" class="theme-toggle" id="theme-toggle" aria-label="Ativar modo claro" title="Ativar modo claro">
        <svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></svg>
        <svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>
      </button>
    </div>
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

function section(group, list, cls = '') {
  if (!list.length) return '';
  return `<section class="wrap block block-${group}">
  <header class="block-head">
    <h2>${GROUPS[group].title}</h2>
    <a class="more" href="/arquivo/?tipo=${group}">Ver tudo →</a>
  </header>
  <div class="row ${cls}">${list.map(card).join('')}</div>
</section>`;
}

// ---------- pages ----------
function home() {
  const blocks = [
    section('podcasts', byGroup('podcasts').slice(0, 4)),
    section('social', byGroup('social').slice(0, 6), 'row-social'),
    section('textos', byGroup('textos').slice(0, 4)),
  ].join('\n');
  const empty = `<section class="wrap empty"><h1>Em breve</h1><p>Os conteúdos aparecem aqui assim que a primeira atualização automática rodar.</p></section>`;
  return page({
    path: '/',
    active: '/',
    body: `${items.length ? blocks : empty}
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
  const filters = [['todos', 'Tudo', items.length], ...Object.entries(GROUPS).map(([g, v]) => [g, v.title, byGroup(g).length])]
    .filter(([, , n]) => n > 0)
    .map(([key, label, n]) => `<button type="button" class="chip" data-filter="${key}" aria-pressed="${key === 'todos'}">${label} <span>${n}</span></button>`)
    .join('');
  return page({
    title: 'Arquivo',
    description: `Todos os podcasts, vídeos e textos de ${config.name}.`,
    path: '/arquivo/',
    active: '/arquivo/',
    body: `<section class="wrap archive">
  <header class="page-head"><h1>Arquivo</h1><p>Tudo o que publiquei, do mais novo ao mais antigo.</p></header>
  ${items.length ? `<div class="filters" role="group" aria-label="Filtrar por tipo">${filters}</div>` : '<p class="empty">Nada por aqui ainda.</p>'}
  <div class="grid" id="archive-grid">${items.map(card).join('')}</div>
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
