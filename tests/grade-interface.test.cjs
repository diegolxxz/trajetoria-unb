const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { parseHTML } = require('linkedom');

const publicRoot = path.join(__dirname, '../public');
const disciplina = {
    codigo: 'MAT0026',
    nome: 'CÁLCULO 2',
    turmas: [
        {
            numero: '01',
            horarios: ['24M12'],
            professores: ['ANA'],
            local: 'ICC',
            vagas: 30,
            matriculados: 10,
            unidades: ['1'],
        },
    ],
};

async function interfaceGrade(backup) {
    const { document, HTMLElement, Event } = parseHTML(
        fs.readFileSync(path.join(publicRoot, 'grade/index.html'), 'utf8'),
    );
    // Linkedom não implementa foco; o teste verifica os controles, não a navegação por teclado.
    HTMLElement.prototype.focus = function () {};
    const storage = new Map();
    if (backup) storage.set('trajetoria-unb:grade:v1', JSON.stringify(backup));
    const context = vm.createContext({
        document,
        URL,
        TextEncoder,
        crypto: webcrypto,
        setTimeout,
        clearTimeout,
        location: { href: 'https://exemplo.test/grade/' },
        matchMedia: () => ({ matches: false }),
        CSS: { escape: (s) => s },
        localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        fetch: async (url) => ({
            ok: true,
            json: async () =>
                url.pathname.endsWith('index.json')
                    ? {
                          semestres: [
                              { semestre: '2026.2', arquivo: '2026-2.json', atualizadoEm: '2026-10-20T00:00:00Z' },
                          ],
                      }
                    : url.pathname.endsWith('componentes.json')
                      ? { componentes: {} }
                      : { disciplinas: [disciplina] },
        }),
    });
    for (const file of ['common.js', 'grade-calculos.js', 'grade-arquivos.js', 'grade.js']) {
        vm.runInContext(fs.readFileSync(path.join(publicRoot, 'js', file), 'utf8'), context, { filename: file });
    }
    await new Promise((resolve) => setImmediate(resolve));
    const buscar = () => {
        const input = document.getElementById('buscaGrade');
        input.value = 'MAT0026';
        input.dispatchEvent(new Event('input'));
        return document.querySelector('.grade-busca-item button');
    };
    return { document, buscar, storage };
}

test('a busca reflete o plano atual ao criar, desfazer e refazer um plano', async () => {
    const { document, buscar, storage } = await interfaceGrade();
    buscar().onclick();
    assert.equal(buscar().disabled, true);
    document.getElementById('novoPlanoGrade').onclick();
    assert.equal(document.querySelector('.grade-busca-item button').disabled, false);
    assert.equal(document.querySelector('.grade-busca-item button').textContent, 'Adicionar');
    document.getElementById('desfazerGrade').onclick();
    assert.equal(document.querySelector('.grade-busca-item button').disabled, true);
    document.getElementById('refazerGrade').onclick();
    document.querySelector('.grade-busca-item button').onclick();
    const backup = JSON.parse(storage.get('trajetoria-unb:grade:v1'));
    assert.equal(backup.planos.length, 2);
    assert.ok(backup.planos.every((p) => p.disciplinas.length === 1));
});

test('a semana só aparece após montar e permite voltar às escolhas sem perder o plano', async () => {
    const plano = {
        id: 'p1',
        nome: 'Meu plano',
        semestre: '2026.2',
        disciplinas: [{ codigo: disciplina.codigo, obrigatoria: true }],
        selecionadas: [{ codigo: disciplina.codigo, nome: disciplina.nome, turma: disciplina.turmas[0] }],
        inicio: '',
        fim: '',
    };
    const { document, storage } = await interfaceGrade({ versao: 1, ativo: plano.id, planos: [plano] });
    const semana = document.querySelector('.grade-semana');
    assert.equal(semana.hidden, true);
    assert.equal(document.querySelectorAll('.grade-evento').length, 0);
    const montar = document.getElementById('montarGrade');
    assert.equal(montar.disabled, false);
    montar.onclick();
    assert.equal(semana.hidden, false);
    assert.equal(document.querySelector('.grade-disciplinas').hidden, true);
    assert.equal(document.querySelectorAll('.grade-dia-titulo').length, 6);
    assert.ok(!semana.textContent.includes('Domingo'));
    assert.equal(document.querySelectorAll('.grade-evento').length, 2);
    document.getElementById('editarGrade').onclick();
    assert.equal(semana.hidden, true);
    assert.equal(document.querySelector('.grade-disciplinas').hidden, false);
    assert.deepEqual(JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos[0], plano);
    montar.onclick();
    document.getElementById('novoPlanoGrade').onclick();
    assert.equal(semana.hidden, true);
    assert.equal(montar.disabled, true);
});

test('montagem fica indisponível até escolher uma turma', async () => {
    const { document, buscar } = await interfaceGrade();
    assert.equal(document.getElementById('montarGrade')?.disabled, true);
    buscar().onclick();
    assert.equal(document.getElementById('montarGrade').disabled, true);
});
