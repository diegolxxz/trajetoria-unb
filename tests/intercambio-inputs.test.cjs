const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const calc = require('../public/js/calculos.js');
const chave = 'calculadora-unb:perfil-intercambio:v1';
const indice = JSON.parse(fs.readFileSync('public/data/editais/index.json'));

async function pagina(
    modo = 'individual',
    perfil = { curso: 'DIREITO', ira: '4.123456789', ipf: '73.0987654' },
    legado,
    slug = 'edital-int-n-7-2026',
) {
    const caminho = modo === 'individual' ? slug : modo;
    const {
        document: d,
        Event,
        HTMLSelectElement,
        HTMLInputElement,
    } = parseHTML(fs.readFileSync(`public/intercambio/${caminho}/index.html`, 'utf8'));
    Object.defineProperty(HTMLSelectElement.prototype, 'value', {
        configurable: true,
        get() {
            return this.querySelector('option[selected]')?.value ?? this.querySelector('option')?.value ?? '';
        },
        set(value) {
            this.querySelectorAll('option').forEach((o) => o.toggleAttribute('selected', o.value === String(value)));
        },
    });
    Object.defineProperty(HTMLInputElement.prototype, 'valueAsNumber', {
        configurable: true,
        get() {
            return this.value === '' ? NaN : Number(this.value);
        },
    });
    const tabela = d.querySelector('.tabela-resultados');
    if (tabela)
        Object.defineProperty(tabela, 'tHead', {
            get() {
                return this.querySelector('thead');
            },
        });
    const storage = new Map(
        legado ? [['calculadora-ira-unb', JSON.stringify(legado)]] : [[chave, JSON.stringify(perfil)]],
    );
    const notas = [];
    const context = vm.createContext({
        document: d,
        URL,
        location: { href: `https://example.org/intercambio/${caminho}/` },
        localStorage: { getItem: (k) => storage.get(k), setItem: (k, v) => storage.set(k, v) },
        window: { addEventListener() {} },
        console,
        CalculosUnB: {
            ...calc,
            nota: (...args) => {
                notas.push(args);
                return calc.nota(...args);
            },
        },
        fetch: async (url) => ({
            ok: true,
            json: async () =>
                String(url).endsWith('index.json')
                    ? indice
                    : JSON.parse(fs.readFileSync(`public/data/editais/${String(url).split('/').pop()}`)),
        }),
    });
    for (const script of [
        'common',
        ...(modo === 'individual' ? ['intercambio'] : ['intercambio-calculos', 'intercambio-geral']),
    ])
        vm.runInContext(fs.readFileSync(`public/js/${script}.js`, 'utf8'), context);
    d.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((resolve) => setImmediate(resolve));
    const app = vm.runInContext('AppUnB', context);
    const ira = d.getElementById(modo === 'individual' ? 'meuIra' : 'geralIra');
    const ipf = d.getElementById(modo === 'individual' ? 'meuIpf' : 'geralIpf');
    const editar = (input, valor, tipo = 'insertText') => {
        input.value = valor;
        const evento = new Event('input');
        Object.defineProperty(evento, 'inputType', { value: tipo });
        input.dispatchEvent(evento);
    };
    return { d, Event, storage, notas, app, ira, ipf, editar };
}

test('perfil exibe quatro casas e conserva valores exatos ao carregar ou alterar outro campo', async () => {
    for (const modo of ['individual', 'comparacao', 'medias']) {
        const a = await pagina(modo);
        assert.equal(a.ira.value, '4.1235');
        if (a.ipf) assert.equal(a.ipf.value, '73.0988');
        assert.equal(a.app.valorNumero(a.ira), '4.123456789');
        assert.equal(JSON.parse(a.storage.get(chave)).ira, '4.123456789');
        if (modo !== 'medias') assert.ok(a.notas.some(([ira, ipf]) => ira === 4.123456789 && ipf === 73.0987654));
        const curso = a.d.getElementById(modo === 'individual' ? 'meuCurso' : 'geralCurso');
        curso.dispatchEvent(new a.Event('change'));
        assert.equal(JSON.parse(a.storage.get(chave)).ira, '4.123456789');
        if (a.ipf) {
            a.editar(a.ipf, '75.5');
            assert.equal(JSON.parse(a.storage.get(chave)).ira, '4.123456789');
            assert.ok(a.notas.some(([ira, ipf]) => ira === 4.123456789 && ipf === 75.5));
        }
    }
});

test('digitação e colagem limitam casas, salvam somente campo editado e invalidam cache anterior', async () => {
    for (const modo of ['individual', 'comparacao', 'medias']) {
        const a = await pagina(modo);
        a.editar(a.ira, '4.234567', 'insertFromPaste');
        assert.equal(a.ira.value, '4.2346');
        assert.equal(JSON.parse(a.storage.get(chave)).ira, '4.2346');
        assert.equal(JSON.parse(a.storage.get(chave)).ipf, '73.0987654');
        assert.equal(a.app.valorNumero(a.ira), '4.2346');
        a.editar(a.ira, '');
        assert.equal(a.ira.value, '');
        assert.equal(a.app.valorNumero(a.ira), '');
        a.editar(a.ira, '0');
        assert.equal(a.ira.value, '0');
        assert.equal(a.app.valorNumero(a.ira), '0');
    }
});

test('IPF aceita frações e cem, limita precisão manual e rejeita valores acima de cem', async () => {
    for (const modo of ['individual', 'comparacao']) {
        const a = await pagina(modo);
        for (const valor of ['73.09', '75.5', '100', '0']) {
            a.editar(a.ipf, valor);
            assert.equal(a.ipf.value, valor);
            assert.equal(a.ipf.getAttribute('aria-invalid'), 'false');
        }
        a.editar(a.ipf, '73.0987654', 'insertFromPaste');
        assert.equal(a.ipf.value, '73.0988');
        for (const valor of ['100.00001', '-0.00001', '101']) {
            a.editar(a.ipf, valor);
            assert.equal(a.ipf.getAttribute('aria-invalid'), 'true');
            assert.ok(Number(a.app.valorNumero(a.ipf)) < 0 || Number(a.app.valorNumero(a.ipf)) > 100);
        }
    }
});

test('IRA fora do intervalo não arredonda para válido; notação científica restaurada conserva precisão', async () => {
    const a = await pagina('comparacao', { curso: 'DIREITO', ira: '4.123456789e0', ipf: '7.30987654e1' });
    assert.equal(a.ira.value, '4.1235');
    assert.equal(a.ipf.value, '73.0988');
    assert.equal(a.app.valorNumero(a.ira), '4.123456789e0');
    assert.ok(a.notas.some(([ira, ipf]) => ira === 4.123456789 && ipf === 73.0987654));
    for (const valor of ['5.00001', '-0.00001']) {
        a.editar(a.ira, valor);
        assert.equal(a.ira.getAttribute('aria-invalid'), 'true');
        assert.ok(Number(a.app.valorNumero(a.ira)) < 0 || Number(a.app.valorNumero(a.ira)) > 5);
    }
});

test('perfil automático legado mantém IRA e IPF calculados exatos sem gravar versão arredondada', async () => {
    const legado = {
        1: { 1: ['A', 4, 1, false] },
        2: { 1: ['B', 2, 3, false] },
        horasCurso: 137,
        intercambio: { cursoSelecionado: 'DIREITO' },
    };
    const a = await pagina('individual', undefined, legado);
    const esperado = calc.historico(legado);
    assert.equal(a.ira.value, String(Number(esperado.ira.toFixed(4))));
    assert.equal(a.ipf.value, String(Number(((100 * esperado.horas) / 137).toFixed(4))));
    assert.equal(a.storage.has(chave), false);
    assert.ok(a.notas.some(([ira, ipf]) => ira === esperado.ira && ipf === (100 * esperado.horas) / 137));
});

test('todos os inputs IRA/IPF usam passo de quatro casas com IPF até cem', () => {
    for (const caminho of [...indice.map((e) => e.slug), 'comparacao', 'medias']) {
        const { document: d } = parseHTML(fs.readFileSync(`public/intercambio/${caminho}/index.html`, 'utf8'));
        for (const input of d.querySelectorAll('#meuIra, #meuIpf, #geralIra, #geralIpf')) {
            assert.equal(input.getAttribute('step'), '0.0001');
            assert.equal(input.getAttribute('max'), /Ipf/.test(input.id) ? '100' : '5');
        }
    }
});

test('cinco editais preservam precisão bruta até edição e invalidam perfil restaurado fora do intervalo', async () => {
    for (const { slug } of indice) {
        const a = await pagina(
            'individual',
            { curso: 'DIREITO', ira: '4.123456789', ipf: '73.0987654' },
            undefined,
            slug,
        );
        assert.equal(a.ira.value, '4.1235');
        assert.equal(a.ipf.value, '73.0988');
        assert.ok(
            a.notas.some(([ira, ipf]) => ira === 4.123456789 && ipf === 73.0987654),
            slug,
        );
        a.editar(a.ira, '4.234567', 'insertFromPaste');
        assert.equal(a.ira.value, '4.2346');
        assert.ok(
            a.notas.some(([ira, ipf]) => ira === 4.2346 && ipf === 73.0987654),
            slug,
        );
    }
    const b = await pagina('comparacao', { curso: 'DIREITO', ira: '5.00001', ipf: '100.00001' });
    assert.equal(b.ira.getAttribute('aria-invalid'), 'true');
    assert.equal(b.ipf.getAttribute('aria-invalid'), 'true');
    assert.equal(b.app.valorNumero(b.ira), '5.00001');
    assert.equal(b.app.valorNumero(b.ipf), '100.00001');
    assert.equal(JSON.parse(b.storage.get(chave)).ira, '5.00001');
});

test('edição dentro de quatro casas preserva valor nativo e cursor durante a digitação', async () => {
    const a = await pagina('comparacao');
    let escritas = 0;
    const input = { value: '4.23', getAttribute: (nome) => (nome === 'min' ? '0' : '5') };
    let atual = input.value;
    Object.defineProperty(input, 'value', {
        get: () => atual,
        set: (v) => {
            escritas++;
            atual = v;
        },
    });
    assert.equal(a.app.editarNumero(input), '4.23');
    assert.equal(escritas, 0);
    assert.equal(a.app.valorNumero(input), '4.23');
});
