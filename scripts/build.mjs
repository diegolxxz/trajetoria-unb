import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(root, 'dist');
if (path.dirname(path.resolve(destination)) !== path.resolve(root) || path.basename(destination) !== 'dist') {
  throw new Error('Diretório de publicação fora do projeto.');
}
// Only the generated public directory is replaced; personal data stays outside it.
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
const publicFiles = [
  'index.html',
  'ira',
  'intercambio',
  'turmas',
  'css',
  'js',
  'data/editais',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  'favicon.ico',
  'favicon.svg',
  'favicon-96x96.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
];
for (const file of publicFiles) {
  await cp(path.join(root, file), path.join(destination, file), { recursive: true });
}
console.log(`Site estático gerado em dist/ (${(await readdir(destination)).length} entradas).`);
