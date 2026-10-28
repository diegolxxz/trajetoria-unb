const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const calc = require('../public/js/calculos.js');
const comparar = (...args) => require('../public/js/intercambio-calculos.js').comparar(...args);
const edital = (slug = 'a') => ({
    slug,
    titulo: `Edital ${slug}`,
    mobilidade: '2027',
    fontes: { edital: 'https://example.org/' },
    formula: { pesoIra: 1, pesoIpf: 2 },
    cursos: [
        {
            nome: 'CURSO',
            variantes: [
                { media: 3, desvio: 1, estimada: true, metodo: 'estimativa', turno: null },
                { media: 4, desvio: 2 },
            ],
        },
    ],
    resultados: [
        { matricula: '123', curso: 'CURSO', ira: 0, ipf: 0, notaFinal: 0, alocacao: 'Destino' },
        { matricula: '456', curso: 'OUTRO', alocacao: 'Não alocado' },
    ],
});
test('médias e diferenças independem de IPF; preserva variantes, estimativas e fontes', () => {
    const a = comparar([edital()], { curso: 'CURSO', ira: 4, ipf: '' })[0];
    assert.deepEqual(
        a.referencias.map((r) => [r.media, r.desvio, r.diferenca, r.nota]),
        [
            [3, 1, 1, null],
            [4, 2, 0, null],
        ],
    );
    assert.equal(a.referencias[0].estimada, true);
    assert.equal(a.fontes.edital, 'https://example.org/');
    assert.equal(comparar([edital()], { curso: 'CURSO', ira: 4, ipf: 50 })[0].referencias[0].nota.final, 2);
});
test('fórmulas específicas; curso ausente; direto dispensa média; desvio inválido não simula', () => {
    const d = edital();
    d.formula = { tipo: 'ira-direto', pesoIra: 1, pesoIpf: 2 };
    assert.equal(comparar([d], { curso: 'AUSENTE', ira: 4, ipf: 50 })[0].referencias[0].nota.final, 5);
    assert.equal(comparar([edital()], { curso: 'AUSENTE', ira: 4, ipf: 50 })[0].referencias[0].nota, null);
    d.formula = { pesoIra: 2, pesoIpf: 3 };
    d.cursos[0].variantes[0].desvio = 0;
    const r = comparar([d], { curso: 'CURSO', ira: 4, ipf: 50 })[0].referencias;
    assert.equal(r[0].nota, null);
    assert.equal(r[1].nota.final, 1.5);
});
test('zeros válidos, vazios e inválidos ausentes; alocados identificados sem ranking', () => {
    for (const valor of ['', null, undefined, NaN, Infinity, -1, 6])
        assert.equal(comparar([edital()], { curso: 'CURSO', ira: valor, ipf: 0 })[0].referencias[0].nota, null);
    for (const ipf of ['', null, undefined, NaN, Infinity, -1, 101])
        assert.equal(comparar([edital()], { curso: 'CURSO', ira: 0, ipf })[0].referencias[0].nota, null);
    const r = comparar([edital()], { curso: 'CURSO', ira: 0, ipf: 0 })[0];
    assert.equal(r.referencias[0].nota.final, -3);
    assert.equal(r.alocados.length, 1);
    assert.equal(r.alocados[0].matricula, '123');
});
async function pagina(falhas = [], transformar = (e) => e) {
    const { document, Event, HTMLSelectElement } = parseHTML(fs.readFileSync('public/intercambio/index.html', 'utf8'));
    Object.defineProperty(HTMLSelectElement.prototype, 'value', {
        configurable: true,
        get() {
            return this.querySelector('option[selected]')?.value ?? this.querySelector('option')?.value ?? '';
        },
        set(value) {
            this.querySelectorAll('option').forEach((o) => o.toggleAttribute('selected', o.value === String(value)));
        },
    });
    const storage = new Map([
        [
            'calculadora-unb:perfil-intercambio:v1',
            JSON.stringify({ curso: 'CURSO', ira: 4, ipf: '', extra: 'preservar' }),
        ],
    ]);
    const context = vm.createContext({
        document,
        URL,
        location: { href: 'https://example.org/intercambio/' },
        localStorage: { getItem: (k) => storage.get(k), setItem: (k, v) => storage.set(k, v) },
        window: { addEventListener() {} },
        console,
        CalculosUnB: calc,
        fetch: async (url) => {
            const name = String(url).split('/').pop().replace('.json', '');
            if (name === 'index')
                return {
                    ok: true,
                    json: async () =>
                        [edital('a'), edital('b')].map(({ slug, titulo, mobilidade }) => ({
                            slug,
                            titulo,
                            mobilidade,
                        })),
                };
            if (falhas.includes(name)) throw Error('offline');
            return { ok: true, json: async () => transformar(edital(name)) };
        },
    });
    for (const f of ['common', 'intercambio-calculos', 'intercambio-geral'])
        vm.runInContext(fs.readFileSync(`public/js/${f}.js`, 'utf8'), context);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((resolve) => setImmediate(resolve));
    return { document, Event, storage };
}
test('DOM real: comparação sem IPF, entrada persiste, filtros de curso e edital, números ausentes', async () => {
    const { document: d, Event, storage } = await pagina();
    assert.equal(d.querySelectorAll('#referenciasGerais tbody tr').length, 4);
    assert.match(d.querySelector('#referenciasGerais').textContent, /Estimad/);
    assert.match(d.querySelector('#referenciasGerais').textContent, /Indisponível/);
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 2);
    d.getElementById('geralIpf').value = '50';
    d.getElementById('geralIpf').dispatchEvent(new Event('input'));
    assert.equal(JSON.parse(storage.get('calculadora-unb:perfil-intercambio:v1')).extra, 'preservar');
    assert.doesNotMatch(d.querySelector('#referenciasGerais tbody').textContent, /Indisponível/);
    d.getElementById('editalGeral').querySelector('option[value="a"]').selected = true;
    d.getElementById('editalGeral').dispatchEvent(new Event('change'));
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 1);
    d.getElementById('cursoAlocados').querySelector('option[value="OUTRO"]').selected = true;
    d.getElementById('cursoAlocados').dispatchEvent(new Event('change'));
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 0);
});
test('DOM falha parcial preserva restante e aviso; falha total mostra erro', async () => {
    const a = await pagina(['b']);
    assert.equal(a.document.querySelectorAll('#alocadosGerais tbody tr').length, 1);
    assert.equal(a.document.getElementById('erroCarregamento').hidden, false);
    const b = await pagina(['a', 'b']);
    assert.equal(b.document.getElementById('erroCarregamento').hidden, false);
    assert.match(b.document.getElementById('erroCarregamento').textContent, /Não foi possível/);
});

test('DOM valida intervalos, diferencia vazio de zero e mantém zero publicado', async () => {
    const { document: d, Event } = await pagina();
    assert.equal(d.querySelector('#alocadosGerais tbody tr').children[3].textContent, '0');
    const ira = d.getElementById('geralIra'),
        ipf = d.getElementById('geralIpf');
    ira.value = '6';
    ira.dispatchEvent(new Event('input'));
    assert.equal(ira.getAttribute('aria-invalid'), 'true');
    assert.equal(d.getElementById('erroPerfilGeral').hidden, false);
    ira.value = '0';
    ipf.value = '0';
    ipf.dispatchEvent(new Event('input'));
    assert.equal(d.querySelector('#referenciasGerais tbody tr').children[6].textContent, '≈ -3');
    ipf.value = '';
    ipf.dispatchEvent(new Event('input'));
    assert.equal(d.querySelector('#referenciasGerais tbody tr').children[6].textContent, 'Indisponível');
});
test('DOM explicita ausências, oculta colunas numéricas vazias e não transforma ausências em zero', async () => {
    const { document: d } = await pagina([], (e) => {
        e.resultados[0].ipf = null;
        e.resultados[0].notaFinal = null;
        return e;
    });
    const linha = d.querySelector('#alocadosGerais tbody tr');
    assert.equal(linha.children[4].textContent, 'Indisponível');
    assert.equal(linha.children[4].hidden, true);
    assert.equal(d.querySelector('#alocadosGerais thead tr').children[5].hidden, true);
    assert.equal(linha.children[3].hidden, false);
});
test('dados reais de todos os editais preservam alocados e referências sem notas não finitas', () => {
    const indice = JSON.parse(fs.readFileSync('public/data/editais/index.json'));
    const editais = indice.map((e) => JSON.parse(fs.readFileSync(`public/data/editais/${e.slug}.json`)));
    for (const e of editais) {
        const r = comparar([e], { curso: 'DIREITO', ira: 4, ipf: 50 })[0];
        assert.equal(r.alocados.length, e.resultados.filter((r) => calc.alocado(r.alocacao)).length);
        assert.ok(r.referencias.every((v) => v.nota === null || Number.isFinite(v.nota.final)));
    }
    const estimado = editais.find((e) => e.metodoReferencias);
    assert.ok(estimado);
    const curso = estimado.cursos.find((c) => c.variantes.some((v) => v.estimada));
    const r = comparar([estimado], { curso: curso.nome, ira: 4, ipf: 50 })[0];
    assert.equal(r.metodoReferencias, estimado.metodoReferencias);
    assert.deepEqual(r.referencias[0].matriculasBase, curso.variantes[0].matriculasBase);
});
