import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Some sites refuse requests without a browser-like user agent.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'));
  } catch {
    return fallback;
  }
}

export async function writeJson(file, data) {
  const full = path.join(ROOT, file);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(data, null, 2) + '\n');
}

export async function exists(file) {
  try {
    await fs.access(path.join(ROOT, file));
    return true;
  } catch {
    return false;
  }
}

// Errors only mention host + path, so access tokens in query strings never reach the logs.
export async function get(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'user-agent': UA, 'accept-language': 'pt-BR,pt;q=0.9', ...init.headers },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const u = new URL(url);
    throw new Error(`HTTP ${res.status} em ${u.host}${u.pathname}`);
  }
  return res;
}

export async function download(url, file) {
  if (await exists(file)) return file;
  const res = await get(url);
  const full = path.join(ROOT, file);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, Buffer.from(await res.arrayBuffer()));
  return file;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s = '') {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

export function stripTags(s = '') {
  return decodeEntities(s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(s = '', max) {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

export function toIso(value) {
  if (!value) return null;
  // Instagram sends "+0000" offsets; normalise to "+00:00" so every engine parses it.
  const d = new Date(String(value).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// New items win over stored ones, but stored fields survive when the new copy lacks them.
export function mergeItems(existing = [], incoming = []) {
  const byId = new Map(existing.map((i) => [i.id, i]));
  for (const item of incoming) {
    const old = byId.get(item.id) ?? {};
    const merged = { ...old };
    for (const [k, v] of Object.entries(item)) if (v != null && v !== '') merged[k] = v;
    byId.set(item.id, merged);
  }
  return [...byId.values()].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

// Minimal RSS helpers: feeds are simple enough that a regex beats pulling in an XML parser.
export const xmlTag = (src, name) => src.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1];
export const xmlAttr = (src, name, a) => src.match(new RegExp(`<${name}[^>]*\\b${a}="([^"]+)"`, 'i'))?.[1];
export const xmlItems = (xml) => [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map((m) => m[0]);
