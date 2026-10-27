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
