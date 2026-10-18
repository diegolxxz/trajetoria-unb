const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const calc = require('../public/js/calculos.js');
const dados = require('../public/data/editais/edital-int-n-7-2026.json');

test('a fórmula reproduz os 317 resultados respeitando o arredondamento do IPF publicado', () => {
    assert.equal(dados.resultados.length, 317);
    for (const r of dados.resultados) {
        const nota = calc.nota(r.ira, r.ipf, r.media, r.desvio, dados.formula);
        assert.ok(Math.abs(nota.final - r.notaFinal) < 0.000101, r.matricula);
    }
});

test('Direito possui duas referências e não inventa rótulos de turno', () => {
    const direito = dados.cursos.find((c) => c.nome === 'DIREITO');
    assert.equal(direito.variantes.length, 2);
    assert.ok(direito.variantes.every((v) => v.turno === null));
    const notas = direito.variantes.map((v) => calc.nota(4.5, 55, v.media, v.desvio, dados.formula).final);
    assert.equal(notas[0].toFixed(9), '1.590602214');
    assert.equal(notas[1].toFixed(9), '1.524460795');
});

test('IRA ignora linhas incompletas e MP lida com módulos livres sem divisão por zero', () => {
    const resultado = calc.historico({ 1: { 1: ['Teste', 4, 1, true], 2: ['', 0, 0, false] } });
    assert.deepEqual(resultado, {
        ira: 5,
        mp: 0,
        horas: 60,
        temDisciplinas: true,
        parciais: [{ periodo: 1, ira: 5, mp: 0 }],
    });
    const misto = calc.historico({ 1: { 1: ['A', 4, 1, false] }, 2: { 1: ['B', 2, 3, false] } });
    assert.equal(misto.ira, 4);
    assert.equal(misto.mp, 26 / 6);
    assert.equal(misto.horas, 90);
    assert.deepEqual(misto.parciais, [
        { periodo: 1, ira: 5, mp: 5 },
        { periodo: 2, ira: 4, mp: 26 / 6 },
    ]);
});

test('somente alocados exclui n/a e justificativas negativas da fonte', () => {
    assert.equal(dados.resultados.filter((r) => calc.alocado(r.alocacao)).length, 99);
    for (const s of [
        '',
        'n/a',
        'Não alocado',
        'Não alocado por falta de vaga',
        'Não consta na alocação',
        'Inscrição não homologada',
    ])
        assert.equal(calc.alocado(s), false);
    assert.equal(calc.alocado('Portugal / Universidade de Coimbra'), true);
    assert.equal(calc.cursoBase('DIREITO - NOTURNO'), 'DIREITO');
});

test('entradas fora do intervalo ou com desvio zero não geram notas', () => {
    assert.equal(calc.nota(5.1, 55, 3, 1, dados.formula), null);
    assert.equal(calc.nota(4, 101, 3, 1, dados.formula), null);
    assert.equal(calc.nota(4, 55, 3, 0, dados.formula), null);
    assert.equal(calc.nota(NaN, 55, 3, 1, dados.formula), null);
    assert.equal(calc.nota(0, 0, 3, 1, dados.formula).final, -3);
});

function app(storage, slug = 'edital-int-n-7-2026') {
    const context = {
        CalculosUnB: calc,
        URL,
        location: { href: `https://exemplo.test/projeto/intercambio/${slug}/` },
        document: { querySelector: () => ({ content: '../../' }), addEventListener() {}, getElementById: () => null },
        localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    };
    return vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, '../public/js/common.js'), 'utf8') + '\nAppUnB;',
        context,
    );
}

test('perfil persiste entre editais e filtros permanecem independentes', () => {
    const storage = new Map();
    const a = app(storage);
    a.salvarPerfil({ ira: '4.5', ipf: '55', curso: 'DIREITO' });
    a.salvar('calculadora-unb:filtros:edital-int-n-7-2026', { curso: 'FARMÁCIA' });
    const b = app(storage, 'outro-edital-apenas-no-teste');
    assert.equal(b.perfil().ira, '4.5');
    assert.equal(b.perfil().ipf, '55');
    assert.equal(b.perfil().curso, 'DIREITO');
    assert.equal(b.ler('calculadora-unb:filtros:outro-edital-apenas-no-teste'), null);
    assert.equal(b.raiz.href, 'https://exemplo.test/projeto/');
});

test('migra valores manuais e automáticos do painel antigo sem perder zero', () => {
    const storage = new Map([
        [
            'calculadora-ira-unb',
            JSON.stringify({
                intercambio: { modoManual: true, iraManual: '0', ipfManual: '55', cursoSelecionado: 'DIREITO' },
            }),
        ],
    ]);
    assert.equal(app(storage).perfil().ira, '0');
    assert.equal(app(storage).perfil().ipf, '55');
    storage.set(
        'calculadora-ira-unb',
        JSON.stringify({ 1: { 1: ['A', 4, 1, false] }, intercambio: { horasCurso: 120 } }),
    );
    assert.equal(app(storage).perfil().ira, '5');
    assert.equal(app(storage).perfil().ipf, '50');
    storage.set('calculadora-ira-unb', JSON.stringify({ 1: { 1: ['A', 4, 1, false] }, horasCurso: 240 }));
    assert.equal(app(storage).perfil().ipf, '25');
    storage.set('calculadora-unb:perfil-intercambio:v1', '{quebrado');
    assert.equal(app(storage).perfil().ira, '5');
});
