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

async function interfaceGrade(backup, semestres = [{ semestre: '2026.2', arquivo: '2026-2.json' }]) {
    const requisicoes = [];
    const { document, HTMLElement, Event } = parseHTML(
        fs.readFileSync(path.join(publicRoot, 'grade/index.html'), 'utf8'),
    );
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
        fetch: async (url) => {
            requisicoes.push(url.pathname);
            return {
                ok: true,
                json: async () =>
                    url.pathname.endsWith('index.json')
                        ? { semestres }
                        : url.pathname.endsWith('componentes.json')
                          ? { componentes: {} }
                          : { disciplinas: [disciplina] },
            };
        },
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
    return { document, buscar, storage, requisicoes };
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

test('Grade validates catalog and changes without losing plans', async () => {
    const { document, buscar, storage, requisicoes } = await interfaceGrade(undefined, [
        null,
        {},
        { semestre: null, arquivo: null },
        { semestre: '2026.3', arquivo: 'bad.json' },
        { semestre: '2026.1', arquivo: '../bad.json' },
        { semestre: '2026.1', arquivo: '/bad.json' },
        { semestre: '2026.1', arquivo: 'bad.json?x' },
        { semestre: '2026.2', arquivo: '2026-2.json' },
        { semestre: '2027.1', arquivo: '2027-1.json' },
    ]);
    const select = document.getElementById('semestreGrade');
    assert.deepEqual(
        [...select.options].map((o) => o.value),
        ['2027.1', '2026.2'],
    );
    buscar().onclick();
    const antes = storage.get('trajetoria-unb:grade:v1');
    const total = requisicoes.length;
    for (const valor of ['', 'null', '2099.1']) {
        select.value = valor;
        select.onchange();
        assert.equal(select.value, '2027.1');
        assert.equal(storage.get('trajetoria-unb:grade:v1'), antes);
        assert.equal(requisicoes.length, total);
    }
    for (const valor of ['2026.2', '2027.1']) {
        select.value = valor;
        select.onchange();
        await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos.length, 2);
    assert.equal(buscar().disabled, true);
});

test('Grade preserves unavailable historical backup with empty catalog', async () => {
    const plano = {
        id: 'p1',
        nome: 'History',
        semestre: '2020.1',
        disciplinas: [],
        selecionadas: [],
        inicio: '',
        fim: '',
    };
    const backup = { versao: 1, ativo: plano.id, planos: [plano] };
    const { document, storage, requisicoes } = await interfaceGrade(backup, []);
    const select = document.getElementById('semestreGrade');
    assert.equal(select.disabled, true);
    assert.equal(select.value, '2020.1');
    assert.match(document.getElementById('ofertaGrade').textContent, /sem oferta/);
    select.value = 'null';
    select.onchange();
    assert.equal(select.value, '2020.1');
    assert.deepEqual(JSON.parse(storage.get('trajetoria-unb:grade:v1')), backup);
    assert.equal(requisicoes.length, 2);
});

test('Grade creates and saves a published semester beyond 2099', async () => {
    const { buscar, storage } = await interfaceGrade(undefined, [{ semestre: '2100.1', arquivo: '2100-1.json' }]);
    buscar().onclick();
    const backup = JSON.parse(storage.get('trajetoria-unb:grade:v1'));
    assert.equal(backup.planos[0].semestre, '2100.1');
});
