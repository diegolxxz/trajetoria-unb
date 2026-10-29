const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const root = path.join(__dirname, '../public');

test('links e recursos locais não dependem da profundidade da rota', () => {
    function verificar(pasta) {
        for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
            const arquivo = path.join(pasta, item.name);
            if (item.isDirectory()) verificar(arquivo);
            else if (item.name.endsWith('.html')) {
                const { document } = parseHTML(fs.readFileSync(arquivo, 'utf8'));
                for (const el of document.querySelectorAll('[href],script[src],img[src]')) {
                    const link = el.getAttribute('href') ?? el.getAttribute('src');
                    assert.match(link, /^(?:\/|#|[a-z][a-z\d+.-]*:)/i, `${arquivo}: ${link}`);
                }
            }
        }
    }
    verificar(root);
});

test('base dos links permanece na raiz mesmo em um endereço quebrado repetido', () => {
    const source = fs.readFileSync(path.join(root, 'js/common.js'), 'utf8');
    for (const pathname of ['/grade/', '/grade/grade/', '/ira/ira/', '/intercambio/qualquer/rota/']) {
        const app = vm.runInNewContext(source + '\nAppUnB;', {
            URL,
            location: { href: 'https://exemplo.test' + pathname },
            document: { addEventListener() {}, querySelector: () => ({ content: '../' }) },
        });
        assert.equal(new URL('grade/', app.raiz).href, 'https://exemplo.test/grade/');
        assert.equal(new URL('gerador-grade/', app.raiz).href, 'https://exemplo.test/gerador-grade/');
    }
});
