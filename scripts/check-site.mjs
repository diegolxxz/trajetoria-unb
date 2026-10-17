import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import calculos from '../js/calculos.js';

const project = fileURLToPath(new URL('../', import.meta.url));
const root = process.argv[2] === 'dist' ? path.join(project, 'dist') : project;
const origin = 'https://trajetoriaunb.vercel.app';
const files = new Set();
const pages = new Map();
const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};
const json = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
async function collect(directory) {
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const file = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) await collect(file);
    else files.add(file);
  }
}
for (const directory of ['ira', 'intercambio', 'turmas', 'css', 'js', 'data/editais']) await collect(directory);
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile()) files.add(entry.name);
}
const urlFor = (file) => new URL(file === 'index.html' ? '/' : `/${file.replace(/index\.html$/, '')}`, origin);
const fileFor = (url) => {
  const pathname = decodeURIComponent(url.pathname).slice(1);
  return !pathname || pathname.endsWith('/') ? `${pathname}index.html` : pathname;
};
for (const file of files) {
  if (file.endsWith('.json') || file.endsWith('.webmanifest')) {
    if (file === 'dados.json' || (!file.startsWith('data/') && file !== 'site.webmanifest')) continue;
    await json(file);
  }
  if (!file.endsWith('.html')) continue;
  const document = parseHTML(await readFile(path.join(root, file), 'utf8')).document;
  pages.set(file, document);
  check(Boolean(document.querySelector('title')?.textContent.trim()), `${file}: título ausente.`);
  check(document.querySelectorAll('h1').length === 1, `${file}: deve ter um h1.`);
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
  check(canonical === urlFor(file).href, `${file}: canonical não corresponde à rota.`);
  check(
    !document.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex'),
    `${file}: página pública com noindex.`,
  );
}
for (const [file, document] of pages) {
  for (const element of document.querySelectorAll('a[href], link[href], script[src], img[src]')) {
    const reference = element.getAttribute('href') ?? element.getAttribute('src');
    const url = new URL(reference, urlFor(file));
    if (url.origin !== origin) continue;
    const target = fileFor(url);
    check(files.has(target), `${file}: link ou recurso ausente: ${reference}`);
    if (url.hash && pages.has(target)) {
      check(
        Boolean(pages.get(target).getElementById(decodeURIComponent(url.hash.slice(1)))),
        `${file}: âncora ausente: ${reference}`,
      );
    }
  }
}
const sitemap = await readFile(path.join(root, 'sitemap.xml'), 'utf8');
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
check(new Set(locations).size === locations.length, 'Sitemap contém URLs duplicadas.');
for (const location of locations) {
  const url = new URL(location);
  check(url.origin === origin && pages.has(fileFor(url)), `Sitemap: rota inválida ${location}`);
}
for (const file of pages.keys()) check(locations.includes(urlFor(file).href), `Sitemap: falta ${urlFor(file)}`);
const catalog = await json('data/editais/index.json');
const slugs = new Set();
let candidates = 0;
for (const edital of catalog) {
  check(typeof edital.slug === 'string' && /^[a-z0-9-]+$/.test(edital.slug), 'Catálogo: slug inválido.');
  check(!slugs.has(edital.slug), `Catálogo: slug duplicado ${edital.slug}`);
  slugs.add(edital.slug);
  const file = `data/editais/${edital.slug}.json`;
  const data = await json(file);
  check(data.slug === edital.slug && data.titulo === edital.titulo, `${file}: identificação difere do catálogo.`);
  check(pages.has(`intercambio/${edital.slug}/index.html`), `${file}: página ausente.`);
  check(Number.isFinite(data.formula?.pesoIra) && Number.isFinite(data.formula?.pesoIpf), `${file}: pesos inválidos.`);
  assert(Array.isArray(data.cursos) && Array.isArray(data.resultados), `${file}: estrutura inválida.`);
  const courses = new Set(data.cursos.map((course) => course.nome));
  check(courses.size === data.cursos.length, `${file}: cursos duplicados.`);
  const registrations = new Set();
  for (const row of data.resultados) {
    check(typeof row.matricula === 'string' && /^\d+$/.test(row.matricula), `${file}: matrícula inválida.`);
    check(!registrations.has(row.matricula), `${file}: matrícula duplicada ${row.matricula}`);
    registrations.add(row.matricula);
    check(courses.has(calculos.cursoBase(row.curso)), `${file}: curso sem referência para ${row.matricula}`);
    check(Array.isArray(row.opcoes) && row.opcoes.length === 5, `${file}: opções inválidas para ${row.matricula}`);
    for (const field of ['ira', 'ipf', 'media', 'desvio', 'notaFinal']) {
      check(row[field] == null || Number.isFinite(row[field]), `${file}: ${field} inválido para ${row.matricula}`);
    }
  }
  candidates += data.resultados.length;
}
if (root !== project) {
  for (const privateFile of ['dados.json', 'route.py', 'pyproject.toml', 'package.json']) {
    check(!files.has(privateFile), `Publicação contém arquivo privado ou de desenvolvimento: ${privateFile}`);
  }
}
assert(errors.length === 0, errors.join('\n'));
console.log(
  `${pages.size} páginas, ${slugs.size} editais e ${candidates} candidatos verificados em ${root === project ? 'fontes' : 'dist'}.`,
);
