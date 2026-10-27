import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import calculos from '../public/js/calculos.js';

const project = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(project, 'public');
const root = process.argv[2] === 'dist' ? path.join(project, 'dist') : source;
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
for (const directory of ['ira', 'intercambio', 'turmas', 'grade', 'css', 'js', 'data/editais', 'data/turmas'])
  await collect(directory);
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
  if (file === '404.html') {
    check(!canonical, '404 não deve declarar canonical.');
    check(
      document.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex'),
      '404 deve ter noindex.',
    );
    continue;
  }
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
for (const file of pages.keys()) {
  if (file === '404.html') check(!locations.includes(urlFor(file).href), '404 deve ficar fora do sitemap.');
  else check(locations.includes(urlFor(file).href), `Sitemap: falta ${urlFor(file)}`);
}
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
const complete = await json('data/turmas/classroom_code_units.json');
const completeIds = new Set(Object.keys(complete.units));
check(completeIds.size > 0, 'Cadastro completo vazio.');
check(
  complete.semesters.length === 1 && /^20\d{2}\.[12]$/.test(complete.semesters[0]),
  'Semestre do cadastro completo inválido.',
);
const emptyUnits = new Set(complete.units_without_classes.map(String));
check(
  [...emptyUnits].every((id) => completeIds.has(id)),
  'Unidade vazia ausente no cadastro completo.',
);
for (const ids of Object.values(complete.prefixes)) {
  check(
    ids.length > 0 && ids.every((id) => completeIds.has(String(id)) && !emptyUnits.has(String(id))),
    'Prefixo associado a unidade inválida ou sem turmas.',
  );
}
const units = (await json('data/turmas/unidades.json')).unidades;
check(Object.keys(units).length > 0, 'Cadastro de unidades vazio.');
for (const [id, name] of Object.entries(units)) {
  check(/^[1-9]\d*$/.test(id) && typeof name === 'string' && name.trim(), `Unidade inválida: ${id}`);
}
if (files.has('data/turmas/index.json')) {
  const catalog = await json('data/turmas/index.json');
  const semesters = new Set();
  for (const entry of catalog.semestres) {
    check(!semesters.has(entry.semestre), `Semestre duplicado: ${entry.semestre}`);
    semesters.add(entry.semestre);
    const expectedFile = `${entry.semestre.replace('.', '-')}.json`;
    assert(/^20\d{2}\.[12]$/.test(entry.semestre) && entry.arquivo === expectedFile, 'Arquivo de semestre inválido.');
    const data = await json(`data/turmas/${entry.arquivo}`);
    check(Array.isArray(data.disciplinas), `${entry.arquivo}: disciplinas ausentes.`);
    check(data.disciplinas.length === entry.disciplinas, `${entry.arquivo}: contagem de disciplinas incorreta.`);
    const codes = new Set();
    let total = 0;
    for (const subject of data.disciplinas) {
      check(
        Boolean(subject.codigo && subject.nome) && !codes.has(subject.codigo),
        `${entry.arquivo}: disciplina inválida ou duplicada.`,
      );
      codes.add(subject.codigo);
      for (const classroom of subject.turmas) {
        check(typeof classroom.numero === 'string' && classroom.numero, `${subject.codigo}: número de turma inválido.`);
        check(
          classroom.unidades.length > 0 && classroom.unidades.every((id) => /^[1-9]\d*$/.test(id)),
          `${subject.codigo}: unidade inválida.`,
        );
        check(
          Array.isArray(classroom.professores) &&
            classroom.professores.every((name) => typeof name === 'string' && name.trim()),
          `${subject.codigo}: professores inválidos.`,
        );
        for (const key of ['vagas', 'matriculados']) {
          check(
            classroom[key] === null || (Number.isInteger(classroom[key]) && classroom[key] >= 0),
            `${subject.codigo}: ${key} inválido.`,
          );
        }
        total++;
      }
    }
    check(total === entry.turmas, `${entry.arquivo}: contagem de turmas incorreta.`);
  }
}
if (root !== source) {
  for (const privateFile of [
    'dados.json',
    'route.py',
    'pyproject.toml',
    'package.json',
    'local/dados.json',
    'server/route.py',
    'config/coleta.json',
  ]) {
    check(!files.has(privateFile), `Publicação contém arquivo privado ou de desenvolvimento: ${privateFile}`);
  }
}
assert(errors.length === 0, errors.join('\n'));
console.log(
  `${pages.size} páginas, ${slugs.size} editais e ${candidates} candidatos verificados em ${root === source ? 'fontes' : 'dist'}.`,
);
