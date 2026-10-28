const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

test('consulta mostra carga curricular por disciplina sem usar horas do professor ou do horário', async () => {
    const root = path.join(__dirname, '../public');
    const { document, Event } = parseHTML(fs.readFileSync(path.join(root, 'turmas/index.html'), 'utf8'));
    const dados = {
        'index.json': {
            semestres: [{ semestre: '2026.2', arquivo: '2026-2.json', atualizadoEm: '2026-10-20T00:00:00Z' }],
        },
        'unidades.json': { unidades: {} },
        'componentes.json': { componentes: { MAT0026: { nome: 'CÁLCULO 2', cargaHoraria: 90 } } },
        '2026-2.json': {
            disciplinas: ['MAT0026', 'FAV0013'].map((codigo) => ({
                codigo,
                nome: codigo,
                turmas: [
                    {
                        numero: '01',
                        professores: ['ANA'],
                        horarios: ['24M12'],
                        local: 'ICC',
                        vagas: 10,
                        matriculados: 5,
                        unidades: [],
                    },
                ],
            })),
        },
    };
    const context = vm.createContext({
        document,
        URL,
        location: { href: 'https://exemplo.test/turmas/' },
        localStorage: { getItem: () => null },
        IntersectionObserver: class {
            observe() {}
            disconnect() {}
        },
        fetch: async (url) => ({ ok: true, json: async () => dados[url.pathname.split('/').at(-1)] }),
    });
    for (const file of ['common.js', 'turmas.js'])
        vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((resolve) => setImmediate(resolve));
    const cargas = document.querySelectorAll('.turma-materia-carga');
    assert.equal(cargas[0]?.textContent, '90 h · 6 créditos');
    assert.equal(cargas[1]?.textContent, 'Carga horária curricular não informada');
    assert.equal(document.querySelectorAll('.turma-oferta').length, 2);
    const busca = document.getElementById('buscaTurmas');
    busca.value = 'MAT0026';
    busca.dispatchEvent(new Event('input'));
    document.querySelector('.turma-materia').open = true;
    busca.dispatchEvent(new Event('change'));
    assert.equal(document.querySelector('.turma-materia').open, true);
});

async function seletorTurmas(semestres) {
    const root = path.join(__dirname, '../public');
    const { document, Event } = parseHTML(fs.readFileSync(path.join(root, 'turmas/index.html'), 'utf8'));
    // Linkedom exposes select.value without a setter; emulate browser selection.
    for (const select of document.querySelectorAll('select')) {
        let value;
        Object.defineProperty(select, 'value', {
            configurable: true,
            get: () => value ?? select.options[0]?.value ?? '',
            set: (next) => {
                value = next;
            },
        });
    }
    const requisicoes = [];
    const context = vm.createContext({
        document,
        URL,
        location: { href: 'https://exemplo.test/turmas/' },
        localStorage: { getItem: () => null },
        IntersectionObserver: class {
            observe() {}
            disconnect() {}
        },
        fetch: async (url) => {
            requisicoes.push(url.pathname);
            return {
                ok: true,
                json: async () =>
                    url.pathname.endsWith('index.json')
                        ? { semestres }
                        : { unidades: {}, componentes: {}, disciplinas: [] },
            };
        },
    });
    for (const file of ['common.js', 'turmas.js'])
        vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((resolve) => setImmediate(resolve));
    return { document, Event, requisicoes };
}

test('Turmas filters catalog and rejects invalid changes', async () => {
    const { document, Event, requisicoes } = await seletorTurmas([
        null,
        {},
        { semestre: null, arquivo: null },
        { semestre: '2026.3', arquivo: 'bad.json' },
        { semestre: '2026.1', arquivo: '../bad.json' },
        { semestre: '2026.1', arquivo: 'bad.json?x' },
        { semestre: '2026.2', arquivo: '2026-2.json' },
        { semestre: '2027.1', arquivo: '2027-1.json' },
    ]);
    const select = document.getElementById('semestreTurmas');
    assert.deepEqual(
        [...select.options].map((o) => o.value),
        ['2026-2.json', '2027-1.json'],
    );
    const total = requisicoes.length;
    for (const valor of ['', 'null', 'missing.json']) {
        select.value = valor;
        select.dispatchEvent(new Event('change'));
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(select.value, '2026-2.json');
        assert.equal(requisicoes.length, total);
    }
    select.value = '2027-1.json';
    select.dispatchEvent(new Event('change'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(select.value, '2027-1.json');
    assert.ok(requisicoes.at(-1).endsWith('/2027-1.json'));
});

test('Turmas disables selection without valid entries', async () => {
    const { document, requisicoes } = await seletorTurmas([null, { semestre: '2026.2', arquivo: null }]);
    assert.equal(document.getElementById('semestreTurmas').disabled, true);
    assert.equal(document.getElementById('semestreTurmas').options.length, 0);
    assert.equal(requisicoes.length, 3);
});
