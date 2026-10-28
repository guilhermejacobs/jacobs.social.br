import { readJson } from './lib.mjs';
import { fetchInstagram } from './sources/instagram.mjs';
import { fetchPodcast } from './sources/podcast.mjs';
import { fetchAuthorPage } from './sources/author-page.mjs';
import { fetchIndiewire } from './sources/indiewire.mjs';

const config = await readJson('site.config.json');
const sources = {
  instagram: () => fetchInstagram(config.instagram),
  podcast: () => fetchPodcast(config.podcast),
  omelete: () => fetchAuthorPage(config.omelete, { source: 'omelete', prefix: 'om' }),
  indiewire: () => fetchIndiewire(config.indiewire),
};

// One broken source must not stop the others (or the site build) from updating.
let failures = 0;
for (const [name, run] of Object.entries(sources)) {
  try {
    console.log(`${name}: ${await run()}`);
  } catch (err) {
    failures++;
    console.error(`::warning::${name} falhou: ${err.message}`);
  }
}
if (failures === Object.keys(sources).length) process.exitCode = 1;
