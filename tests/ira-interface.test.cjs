const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const calc = require('../public/js/calculos.js');

async function interfaceIra(dados = {}, preferencias = {}) {
    const { document, HTMLElement, HTMLSelectElement, HTMLInputElement, Event } = parseHTML(
        fs.readFileSync('public/ira/index.html', 'utf8'),
    );
    HTMLElement.prototype.focus = function () {};
    // Linkedom não implementa selectedIndex; reproduzimos o contrato nativo usado pelo app.
    Object.defineProperty(HTMLSelectElement.prototype, 'selectedIndex', {
        configurable: true,
        get() {
            return [...this.querySelectorAll('option')].findIndex((o) => o.hasAttribute('selected'));
        },
        set(index) {
            this.querySelectorAll('option').forEach((o, i) => o.toggleAttribute('selected', i === index));
        },
    });
    Object.defineProperty(HTMLInputElement.prototype, 'checked', {
        configurable: true,
        get() {
            return this.hasAttribute('checked');
        },
        set(value) {
            this.toggleAttribute('checked', Boolean(value));
        },
    });
    const storage = new Map(Object.entries({ 'calculadora-ira-unb': dados, ...preferencias }));
    const context = vm.createContext({
        document,
        CalculosUnB: calc,
        AppUnB: {
            ler: (key, fallback) => storage.get(key) ?? fallback,
            salvar: (key, value) => storage.set(key, value),
            numero: (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 4 }),
            elemento: (tag, classe, texto) => {
                const el = document.createElement(tag);
                el.className = classe;
                el.textContent = texto;
                return el;
            },
        },
    });
    vm.runInContext(fs.readFileSync('public/js/functionality.js', 'utf8'), context);
    await vm.runInContext('inicializar()', context);
    return { document, storage, Event, run: (code) => vm.runInContext(code, context) };
}

test('cria três semestres com acumulados e carrega formatos legados', async () => {
    const app = await interfaceIra({ 1: { 1: [4, 1] }, 2: { 1: ['B', 2, 6] } });
    app.run('criarPeriodo()');
    assert.deepEqual(
        [...app.document.querySelectorAll('.periodo h2')].map((el) => el.textContent),
        ['1º Semestre', '2º Semestre', '3º Semestre'],
    );
    assert.equal(app.document.querySelectorAll('.ira-parcial').length, 3);
    assert.equal(app.document.querySelector('.ira-parcial').getAttribute('aria-label'), 'Acumulado até o 1º semestre');
    assert.equal(app.storage.get('calculadora-ira-unb')[1][1][1], 4);
});

test('Somente IRA persiste em ambas as visualizações e preserva módulo livre ao retornar', async () => {
    for (const visualizacao of ['compacto', 'expandido']) {
        const app = await interfaceIra(
            { 1: { 1: ['ML', 2, 1, true] } },
            { 'calculadora-unb:visualizacao-ira': visualizacao, 'calculadora-unb:modo-ira': 'ira' },
        );
        const { document } = app;
        assert.ok(document.body.classList.contains('ira-somente'));
        assert.ok(!document.getElementById('ira-mp').textContent.includes('MP'));
        assert.ok(!document.querySelector('.ira-parcial').textContent.includes('MP'));
        assert.equal(document.querySelector('h1').textContent, 'Calculadora IRA');
        assert.equal(document.querySelector('.chk-modulo-livre').checked, true);
        const completo = document.querySelector('[name="modoIra"][value="completo"]');
        completo.checked = true;
        completo.dispatchEvent(new app.Event('change'));
        assert.equal(app.storage.get('calculadora-unb:modo-ira'), 'completo');
        assert.equal(app.storage.get('calculadora-ira-unb')[1][1][3], true);
        assert.ok(document.getElementById('ira-mp').textContent.includes('MP: —'));
        assert.ok(!document.body.classList.contains('ira-somente'));
        const ira = document.querySelector('[name="modoIra"][value="ira"]');
        ira.checked = true;
        ira.dispatchEvent(new app.Event('change'));
        assert.equal(app.storage.get('calculadora-unb:modo-ira'), 'ira');
        assert.equal(document.querySelector('.chk-modulo-livre').checked, true);
        assert.ok(document.body.classList.contains('ira-compacto') === (visualizacao === 'compacto'));
        assert.ok(!document.getElementById('ira-mp').textContent.includes('MP'));
        const css = fs.readFileSync('public/css/interface.css', 'utf8');
        assert.match(css, /\.pagina-ira\.ira-somente \.ira-modulo-livre,[\s\S]*?display: none !important/);
        assert.match(css, /\.pagina-ira\.ira-somente \.ira-ajuda-mp[\s\S]*?display: none !important/);
    }
});

test('horas aprovadas atualizam ao editar, remover e desfazer', async () => {
    const app = await interfaceIra({ 1: { 1: ['A', 2, 1, false], 2: ['B', 2, 3, true] } });
    const horas = () => app.document.getElementById('horasAprovadas').textContent;
    assert.equal(horas(), 'Horas aprovadas: 60h');
    const mencao = app.document.querySelector('.sel-mencao');
    mencao.selectedIndex = 4;
    mencao.dispatchEvent(new app.Event('change', { bubbles: true }));
    assert.equal(horas(), 'Horas aprovadas: 30h');
    app.run("removerDisciplina(document.querySelectorAll('.btn-remover-disc')[1])");
    assert.equal(horas(), 'Horas aprovadas: 0h');
    app.run('desfazerExclusao()');
    assert.equal(horas(), 'Horas aprovadas: 30h');
});
