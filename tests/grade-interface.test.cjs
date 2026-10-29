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

async function interfaceGrade(
    backup,
    Worker,
    oferta = [disciplina],
    semestres = [{ semestre: '2026.2', arquivo: '2026-2.json' }],
    modo = 'gerador',
) {
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
        Worker,
        window: Worker ? { Worker } : {},
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
                          : { disciplinas: oferta },
            };
        },
    });
    for (const file of ['common.js', 'grade-calculos.js', 'grade-arquivos.js', 'grade.js']) {
        vm.runInContext(fs.readFileSync(path.join(publicRoot, 'js', file), 'utf8'), context, { filename: file });
    }
    await new Promise((resolve) => setImmediate(resolve));
    if (modo === 'gerador') document.getElementById('modoGeradorGrade')?.onclick();
    const buscar = () => {
        const input = document.getElementById('buscaGrade');
        input.value = 'MAT0026';
        input.dispatchEvent(new Event('input'));
        return document.querySelector('.grade-busca-item button');
    };
    const tecla = (target, key, modificadores = {}) => {
        const event = new Event('keydown', { bubbles: true, cancelable: true });
        Object.assign(event, { key, ctrlKey: true, ...modificadores });
        target.dispatchEvent(event);
        return event;
    };
    return { document, buscar, storage, requisicoes, tecla };
}

function criarPlano(document) {
    const select = document.getElementById('planoGrade');
    select.value = [...select.options].find((o) => o.dataset.acao === 'novo')?.value;
    select.onchange();
}

test('a busca reflete o plano atual ao criar, desfazer e refazer um plano', async () => {
    const { document, buscar, storage } = await interfaceGrade();
    buscar().onclick();
    assert.equal(buscar().disabled, true);
    criarPlano(document);
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

test('a montagem manual mostra a semana abaixo das escolhas sem alterar o plano salvo', async () => {
    const plano = {
        id: 'p1',
        nome: 'Meu plano',
        semestre: '2026.2',
        disciplinas: [{ codigo: disciplina.codigo, obrigatoria: true }],
        selecionadas: [{ codigo: disciplina.codigo, nome: disciplina.nome, turma: disciplina.turmas[0] }],
        inicio: '',
        fim: '',
    };
    const { document, storage } = await interfaceGrade(
        { versao: 1, ativo: plano.id, planos: [plano] },
        undefined,
        [disciplina],
        undefined,
        'manual',
    );
    const semana = document.querySelector('.grade-semana');
    assert.equal(semana.hidden, false);
    assert.equal(document.querySelector('.grade-disciplinas').hidden, false);
    assert.equal(document.querySelectorAll('.grade-dia-titulo').length, 6);
    assert.ok(!semana.textContent.includes('Domingo'));
    assert.equal(document.querySelectorAll('.grade-evento').length, 2);
    assert.deepEqual(JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos[0], plano);
    criarPlano(document);
    assert.equal(semana.hidden, true);
});

test('a semana surge ao escolher uma turma e atualiza ao retirar a escolha', async () => {
    const { document, buscar } = await interfaceGrade(undefined, undefined, [disciplina], undefined, 'manual');
    assert.equal(document.querySelector('.grade-semana').hidden, true);
    buscar().onclick();
    assert.equal(document.querySelector('.grade-semana').hidden, true);
    document.querySelector('.grade-selecionar-turma').onclick();
    assert.equal(document.querySelector('.grade-semana').hidden, false);
    assert.equal(document.querySelectorAll('.grade-evento').length, 2);
    document.querySelector('.grade-retirar-turma').onclick();
    assert.equal(document.querySelector('.grade-semana').hidden, true);
});

test('ações secundárias ficam recolhidas sem remover controles e escolhas', async () => {
    const { document, buscar } = await interfaceGrade();
    buscar().onclick();
    const opcoes = document.querySelector('.grade-opcoes');
    assert.ok(opcoes);
    assert.equal(opcoes.hidden, true);
    assert.ok(opcoes.querySelector('.grade-remover'));
    assert.equal(opcoes.querySelector('select'), null);
    assert.equal(opcoes.querySelector('details'), null);
    const botao = document.querySelector('.grade-opcoes-botao');
    assert.equal(botao.getAttribute('aria-controls'), opcoes.id);
    assert.equal(botao.getAttribute('aria-expanded'), 'false');
    assert.equal(opcoes.closest('.grade-materia'), document.querySelector('.grade-materia'));
    botao.onclick();
    assert.equal(opcoes.hidden, false);
    assert.equal(botao.getAttribute('aria-expanded'), 'true');
    botao.onclick();
    assert.equal(opcoes.hidden, true);
    assert.equal(document.getElementById('novoPlanoGrade'), null);
    assert.equal(document.getElementById('nomePlanoGrade'), null);
    assert.equal(document.getElementById('desfazerGrade').closest('details'), null);
    assert.ok(!document.getElementById('encaixeGrade').closest('details'));
    assert.equal(document.getElementById('gerarGrade').closest('details'), null);
});

test('o rascunho das turmas sobrevive à reabertura, filtros e mudanças da mesma matéria', async () => {
    const { document, buscar, storage } = await interfaceGrade();
    buscar().onclick();
    document.querySelector('.grade-escolher').onclick();
    const marcada = document.querySelector('.grade-candidata input');
    marcada.checked = true;
    marcada.onchange();
    document.querySelector('.grade-escolher').onclick();
    assert.equal(document.querySelector('.grade-candidata input').checked, true);
    const vagas = document.getElementById('somenteVagasGrade');
    vagas.checked = true;
    vagas.onchange();
    assert.equal(document.querySelector('.grade-candidata input').checked, true);
    const usar = document.querySelector('.grade-usar input');
    usar.checked = false;
    usar.onchange();
    assert.equal(document.querySelector('.grade-candidata input').checked, true);
    document.querySelector('.grade-aplicar').onclick();
    assert.equal(document.querySelector('.grade-editor'), null);
    const plano = JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos[0];
    assert.equal(plano.disciplinas[0].permitidas.length, 1);
    assert.equal(plano.disciplinas[0].ativa, false);
});

test('cancelar descarta apenas o rascunho e permitir todas aplica o modo irrestrito', async () => {
    const { document, buscar, storage } = await interfaceGrade();
    buscar().onclick();
    document.querySelector('.grade-escolher').onclick();
    let marcada = document.querySelector('.grade-candidata input');
    marcada.checked = true;
    marcada.onchange();
    document.querySelector('.grade-aplicar').onclick();
    document.querySelector('.grade-escolher').onclick();
    marcada = document.querySelector('.grade-candidata input');
    marcada.checked = false;
    marcada.onchange();
    [...document.querySelectorAll('.grade-editor button')].find((b) => b.textContent === 'Cancelar').onclick();
    assert.equal(document.querySelector('.grade-editor'), null);
    assert.equal(JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos[0].disciplinas[0].permitidas.length, 1);
    document.querySelector('.grade-escolher').onclick();
    document.querySelector('.grade-todas').onclick();
    assert.equal(document.querySelector('.grade-editor'), null);
    assert.equal(JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos[0].disciplinas[0].permitidas, null);
});

test('uma extra em edição permanece acessível e trocar de editor não descarta suas marcações', async () => {
    const outra = { ...disciplina, codigo: 'MAT0027', nome: 'CÁLCULO 3' };
    const plano = {
        id: 'rascunho',
        nome: 'Rascunho',
        semestre: '2026.2',
        disciplinas: [
            { codigo: disciplina.codigo, obrigatoria: false, ativa: true },
            { codigo: outra.codigo, obrigatoria: true },
        ],
        selecionadas: [],
        inicio: '',
        fim: '',
        filtros: { vagas: false, encaixe: false, extras: true },
    };
    const { document } = await interfaceGrade({ versao: 1, ativo: plano.id, planos: [plano] }, undefined, [
        disciplina,
        outra,
    ]);
    document.querySelector('[data-codigo="MAT0026"] .grade-escolher').onclick();
    const marcada = document.querySelector('.grade-candidata input');
    marcada.checked = true;
    marcada.onchange();
    const usar = document.querySelector('[data-codigo="MAT0026"] .grade-usar input');
    usar.checked = false;
    usar.onchange();
    assert.equal(document.querySelectorAll('.grade-materia').length, 2);
    assert.equal(document.querySelector('.grade-candidata input').checked, true);
    document.querySelector('[data-codigo="MAT0027"] .grade-escolher').onclick();
    assert.equal(document.querySelector('.grade-editor').closest('.grade-materia').dataset.codigo, disciplina.codigo);
    assert.equal(document.querySelector('.grade-candidata input').checked, true);
    assert.match(document.getElementById('mensagemGrade').textContent, /aplique ou cancele/i);
    document.querySelector('.grade-aplicar').onclick();
    assert.equal(document.querySelector('.grade-editor'), null);
    assert.equal(document.querySelectorAll('.grade-materia').length, 1);
});

test('histórico e importação substituem o estado e encerram a edição mesmo no mesmo plano', async () => {
    const { document, buscar, storage } = await interfaceGrade();
    buscar().onclick();
    document.querySelector('.grade-escolher').onclick();
    const marcada = document.querySelector('.grade-candidata input');
    marcada.checked = true;
    marcada.onchange();
    const vagas = document.getElementById('somenteVagasGrade');
    vagas.checked = true;
    vagas.onchange();
    document.getElementById('desfazerGrade').onclick();
    assert.equal(document.querySelector('.grade-editor'), null);
    document.getElementById('refazerGrade').onclick();
    assert.equal(document.querySelector('.grade-editor'), null);
    document.querySelector('.grade-escolher').onclick();
    const arquivo = document.getElementById('arquivoGrade');
    Object.defineProperty(arquivo, 'files', {
        value: [{ size: 100, text: async () => storage.get('trajetoria-unb:grade:v1') }],
    });
    await arquivo.onchange();
    assert.equal(document.querySelector('.grade-editor'), null);
    assert.equal(document.querySelectorAll('.grade-materia').length, 1);
});

test('matéria fora do gerador continua na comparação e a edição permite escolher poucas turmas', async () => {
    const { document, buscar, storage } = await interfaceGrade();
    buscar().onclick();
    const usar = document.querySelector('.grade-usar input');
    assert.ok(usar);
    usar.checked = false;
    usar.onchange();
    assert.equal(document.querySelectorAll('.grade-materia').length, 1);
    let plano = JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos[0];
    assert.equal(plano.disciplinas[0].ativa, false);
    document.querySelector('.grade-escolher').onclick();
    assert.equal(document.querySelector('.grade-candidata input').checked, false);
    document.querySelector('.grade-aplicar').onclick();
    assert.match(document.getElementById('mensagemGrade').textContent, /ao menos uma turma/);
    const turma = document.querySelector('.grade-candidata input');
    turma.checked = true;
    turma.onchange();
    document.querySelector('.grade-aplicar').onclick();
    plano = JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos[0];
    assert.equal(plano.disciplinas[0].permitidas.length, 1);
    assert.equal(plano.disciplinas[0].ativa, false);
});

test('gerar não cancela a verificação de encaixes que está em andamento', async () => {
    const trabalhos = [];
    class Worker {
        constructor() {
            trabalhos.push(this);
            this.encerrado = false;
        }
        postMessage(dados) {
            this.dados = dados;
        }
        terminate() {
            this.encerrado = true;
        }
    }
    const { document, buscar } = await interfaceGrade(undefined, Worker);
    buscar().onclick();
    const filtro = document.getElementById('encaixeGrade');
    filtro.checked = true;
    filtro.onchange();
    const encaixe = trabalhos.at(-1);
    assert.equal(encaixe.dados.tipo, 'compatibilidade');
    document.getElementById('gerarGrade').onclick();
    assert.equal(encaixe.encerrado, false);
    trabalhos.at(-1).onmessage({ data: { resultado: { grupos: [], truncado: false, diagnostico: 'Sem solução' } } });
    assert.equal(encaixe.encerrado, false);
});

test('ocultar extras preserva as ativadas e as que já possuem turma na grade', async () => {
    const base = {
        id: 'extras',
        nome: 'Extras',
        semestre: '2026.2',
        disciplinas: [{ codigo: disciplina.codigo, obrigatoria: false, ativa: true }],
        selecionadas: [],
        inicio: '',
        fim: '',
        filtros: { vagas: false, encaixe: false, extras: true },
    };
    const { document } = await interfaceGrade({ versao: 1, ativo: base.id, planos: [base] });
    assert.equal(document.querySelectorAll('.grade-materia').length, 1);
    const usar = document.querySelector('.grade-usar input');
    usar.checked = false;
    usar.onchange();
    assert.equal(document.querySelectorAll('.grade-materia').length, 0);
    base.disciplinas[0].ativa = false;
    base.selecionadas = [{ codigo: disciplina.codigo, nome: disciplina.nome, turma: disciplina.turmas[0] }];
    const salva = await interfaceGrade({ versao: 1, ativo: base.id, planos: [base] });
    assert.equal(salva.document.querySelectorAll('.grade-materia').length, 1);
});

test('turmas e professores das combinações já aparecem expandidos', async () => {
    const trabalhos = [];
    class Worker {
        constructor() {
            trabalhos.push(this);
        }
        postMessage() {}
        terminate() {}
    }
    const { document, buscar } = await interfaceGrade(undefined, Worker);
    buscar().onclick();
    document.getElementById('gerarGrade').onclick();
    trabalhos.at(-1).onmessage({
        data: {
            resultado: {
                grupos: [[{ codigo: disciplina.codigo, turmas: disciplina.turmas }]],
                truncado: false,
                diagnostico: '',
            },
        },
    });
    assert.equal(document.querySelector('.grade-combinacao details').open, true);
});

test('Grade validates catalog and changes without losing plans', async () => {
    const { document, buscar, storage, requisicoes } = await interfaceGrade(undefined, undefined, undefined, [
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
    const { document, storage, requisicoes } = await interfaceGrade(backup, undefined, undefined, []);
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
    const { buscar, storage } = await interfaceGrade(undefined, undefined, undefined, [
        { semestre: '2100.1', arquivo: '2100-1.json' },
    ]);
    buscar().onclick();
    const backup = JSON.parse(storage.get('trajetoria-unb:grade:v1'));
    assert.equal(backup.planos[0].semestre, '2100.1');
});

test('o seletor cria grades com nome automático e sem contador técnico', async () => {
    const { document, storage } = await interfaceGrade();
    assert.ok(document.querySelector('#planoGrade option[data-acao="novo"]'));
    assert.equal(document.getElementById('totalDesejadasGrade'), null);
    assert.equal(document.getElementById('ofertaGrade').textContent, '');
    criarPlano(document);
    criarPlano(document);
    const backup = JSON.parse(storage.get('trajetoria-unb:grade:v1'));
    assert.equal(backup.planos.length, 3);
    assert.ok(backup.planos.every((p) => /^Grade · \d{2}\/\d{2} \d{2}:\d{2}/.test(p.nome)));
    assert.equal(new Set(backup.planos.map((p) => p.nome)).size, 3);
});

test('atalhos desfazem e refazem sem interferir na edição nativa de texto', async () => {
    const { document, buscar, storage, tecla } = await interfaceGrade();
    buscar().onclick();
    assert.equal(tecla(document, 'z').defaultPrevented, true);
    assert.equal(JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos[0].disciplinas.length, 0);
    tecla(document, 'z', { shiftKey: true });
    assert.equal(JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos[0].disciplinas.length, 1);
    tecla(document, 'z');
    tecla(document, 'y');
    assert.equal(JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos[0].disciplinas.length, 1);
    assert.equal(tecla(document.getElementById('buscaGrade'), 'z').defaultPrevented, false);
    assert.equal(JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos[0].disciplinas.length, 1);
    tecla(document, 'z', { ctrlKey: false, metaKey: true });
    assert.equal(JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos[0].disciplinas.length, 0);
});

test('o botão de prioridade alterna obrigatória e extra', async () => {
    const { document, buscar, storage } = await interfaceGrade();
    buscar().onclick();
    const prioridade = document.querySelector('button.grade-prioridade');
    assert.ok(prioridade);
    assert.equal(prioridade.getAttribute('aria-pressed'), 'false');
    prioridade.onclick();
    assert.equal(document.querySelector('.grade-prioridade').textContent, 'Extra');
    assert.equal(document.querySelector('.grade-prioridade').getAttribute('aria-pressed'), 'true');
    assert.equal(JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos[0].disciplinas[0].obrigatoria, false);
    document.querySelector('.grade-prioridade').onclick();
    assert.equal(JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos[0].disciplinas[0].obrigatoria, true);
});

test('encaixes manuais usam turmas escolhidas e a troca de modo preserva o plano', async () => {
    const outra = {
        codigo: 'FIS0001',
        nome: 'FÍSICA',
        turmas: [
            { ...disciplina.turmas[0], numero: '01', horarios: ['24M12'] },
            { ...disciplina.turmas[0], numero: '02', horarios: ['35M34'] },
        ],
    };
    const plano = {
        id: 'manual',
        nome: 'Meu nome antigo',
        semestre: '2026.2',
        inicio: '',
        fim: '',
        disciplinas: [
            { codigo: disciplina.codigo, obrigatoria: false, ativa: false },
            { codigo: outra.codigo, obrigatoria: true },
        ],
        selecionadas: [{ codigo: disciplina.codigo, nome: disciplina.nome, turma: disciplina.turmas[0] }],
        filtros: { vagas: false, encaixe: true, extras: false },
    };
    const { document, storage } = await interfaceGrade(
        { versao: 1, ativo: plano.id, planos: [plano] },
        undefined,
        [disciplina, outra],
        undefined,
        'manual',
    );
    assert.equal(document.querySelectorAll('[data-codigo="FIS0001"] .grade-selecionar-turma').length, 1);
    document.querySelector('[data-codigo="FIS0001"] .grade-selecionar-turma').onclick();
    const salvo = storage.get('trajetoria-unb:grade:v1');
    assert.equal(JSON.parse(salvo).planos[0].selecionadas[1].turma.numero, '02');
    assert.equal(JSON.parse(salvo).planos[0].nome, 'Meu nome antigo');
    document.getElementById('modoGeradorGrade').onclick();
    document.getElementById('modoManualGrade').onclick();
    assert.equal(storage.get('trajetoria-unb:grade:v1'), salvo);
    assert.equal(document.querySelector('.grade-semana').hidden, false);
});

test('uma escolha lotada permanece acessível e pode ser retirada com o filtro ativo', async () => {
    const turma = { ...disciplina.turmas[0], matriculados: 30 };
    const plano = {
        id: 'cheia',
        nome: 'Grade antiga',
        semestre: '2026.2',
        inicio: '',
        fim: '',
        disciplinas: [{ codigo: disciplina.codigo, obrigatoria: true, permitidas: ['fora-da-oferta'] }],
        selecionadas: [{ codigo: disciplina.codigo, nome: disciplina.nome, turma }],
        filtros: { vagas: true, encaixe: false, extras: false },
    };
    const { document, storage } = await interfaceGrade(
        { versao: 1, ativo: plano.id, planos: [plano] },
        undefined,
        [{ ...disciplina, turmas: [turma] }],
        undefined,
        'manual',
    );
    assert.equal(document.querySelectorAll('.grade-materia').length, 1);
    assert.equal(document.querySelectorAll('.grade-selecionar-turma').length, 1);
    document.querySelector('.grade-retirar-turma').onclick();
    assert.equal(JSON.parse(storage.get('trajetoria-unb:grade:v1')).planos[0].selecionadas.length, 0);
});

test('atalhos respeitam composição, controles editáveis e histórico indisponível', async () => {
    const { document, buscar, tecla } = await interfaceGrade();
    assert.equal(tecla(document, 'z').defaultPrevented, false);
    buscar().onclick();
    const editavel = document.createElement('div');
    editavel.setAttribute('contenteditable', 'true');
    const filho = document.createElement('span');
    editavel.append(filho);
    document.body.append(editavel);
    for (const target of [document.getElementById('planoGrade'), filho])
        assert.equal(tecla(target, 'z').defaultPrevented, false);
    assert.equal(tecla(document, 'z', { isComposing: true }).defaultPrevented, false);
    assert.equal(tecla(document, 'z', { altKey: true }).defaultPrevented, false);
    assert.equal(document.querySelectorAll('.grade-materia').length, 1);
});

test('criar grade não confunde IDs importados e mantém o limite sem salvar um ID inválido', async () => {
    const base = { nome: 'Legado', semestre: '2026.2', inicio: '', fim: '', disciplinas: [], selecionadas: [] };
    const planos = Array.from({ length: 20 }, (_, i) => ({ ...base, id: i ? `p${i}` : '__nova_grade__' }));
    const backup = { versao: 1, ativo: planos[0].id, planos };
    const { document, storage } = await interfaceGrade(backup);
    const nova = document.querySelector('#planoGrade option[data-acao="novo"]');
    assert.notEqual(nova.value, backup.ativo);
    criarPlano(document);
    assert.equal(document.getElementById('planoGrade').value, backup.ativo);
    assert.match(document.getElementById('mensagemGrade').textContent, /20 planos/);
    assert.deepEqual(JSON.parse(storage.get('trajetoria-unb:grade:v1')), backup);
});

test('o limite de disciplinas é explicado na busca sem contador permanente', async () => {
    const plano = {
        id: 'limite',
        nome: 'Grade',
        semestre: '2026.2',
        inicio: '',
        fim: '',
        selecionadas: [],
        disciplinas: Array.from({ length: 20 }, (_, i) => ({ codigo: `CIC${i}`, obrigatoria: true })),
    };
    const { document, buscar } = await interfaceGrade({ versao: 1, ativo: plano.id, planos: [plano] });
    assert.equal(buscar().disabled, true);
    assert.match(document.getElementById('resultadosBuscaGrade').textContent, /20 disciplinas/);
    assert.equal(document.getElementById('totalDesejadasGrade'), null);
});

test('resposta de encaixe do gerador não interfere após voltar à montagem manual', async () => {
    const trabalhos = [];
    class Worker {
        constructor() {
            trabalhos.push(this);
        }
        postMessage(dados) {
            this.dados = dados;
        }
        terminate() {
            this.encerrado = true;
        }
    }
    const plano = {
        id: 'modos',
        nome: 'Grade',
        semestre: '2026.2',
        inicio: '',
        fim: '',
        selecionadas: [],
        disciplinas: [{ codigo: disciplina.codigo, obrigatoria: true }],
        filtros: { vagas: false, encaixe: true, extras: false },
    };
    const { document } = await interfaceGrade({ versao: 1, ativo: plano.id, planos: [plano] }, Worker);
    const antigo = trabalhos.at(-1);
    document.getElementById('modoManualGrade').onclick();
    assert.equal(antigo.encerrado, true);
    antigo.onmessage({ data: {} });
    assert.equal(document.querySelectorAll('.grade-selecionar-turma').length, 1);
    assert.equal(document.getElementById('estadoEncaixeGrade').textContent, '');
});

test('turmas manuais ficam abertas e o botão de adicionar vira retirar', async () => {
    const { document, buscar } = await interfaceGrade(undefined, undefined, [disciplina], undefined, 'manual');
    buscar().onclick();
    assert.ok(!document.querySelector('.grade-escolher'));
    const painel = document.querySelector('.grade-manual-turmas');
    assert.equal(painel.hidden, false);
    assert.equal(painel.querySelector('input[type="search"]'), null);
    assert.equal(painel.querySelectorAll('.grade-selecionar-turma').length, 1);
    assert.equal(document.querySelector('.grade-selecionar-turma').textContent, '+');
    document.querySelector('.grade-selecionar-turma').onclick();
    assert.equal(document.querySelector('.grade-selecionar-turma').textContent, '−');
    assert.equal(document.querySelector('.grade-manual-turmas').hidden, false);
    document.querySelector('.grade-selecionar-turma').onclick();
    assert.equal(document.querySelector('.grade-selecionar-turma').textContent, '+');
});

test('vagas aparecem por disciplina e somem quando todos os matriculados publicados são zero', async () => {
    for (const matriculados of [0, 10, null]) {
        const oferta = [{ ...disciplina, turmas: [{ ...disciplina.turmas[0], matriculados }] }];
        const { document, buscar } = await interfaceGrade(undefined, undefined, oferta, undefined, 'manual');
        buscar().onclick();
        const tabela = document.querySelector('.grade-turmas-tabela');
        assert.equal(tabela.textContent.includes('Vagas'), matriculados !== 0);
        if (matriculados === 10) assert.match(tabela.textContent, /10\/30/);
        if (matriculados === null) assert.match(tabela.textContent, /—\/30/);
    }
});

test('as duas formas de montar compartilham disciplinas e o gerador também dispensa busca interna', async () => {
    const { document, buscar, storage } = await interfaceGrade(undefined, undefined, [disciplina], undefined, 'manual');
    buscar().onclick();
    assert.ok(!document.getElementById('tituloDisciplinasGrade'));
    assert.ok(!document.getElementById('ajudaDisciplinasGrade'));
    const antes = storage.get('trajetoria-unb:grade:v1');
    document.getElementById('modoGeradorGrade').onclick();
    assert.ok(!document.getElementById('tituloDisciplinasGrade'));
    assert.ok(!document.getElementById('ajudaMontagemGrade'));
    const painelId = document.querySelector('.grade-escolher').getAttribute('aria-controls');
    assert.ok(document.querySelector('.grade-prioridade').closest(`#${painelId}`));
    document.querySelector('.grade-escolher').onclick();
    assert.equal(document.querySelector('.grade-editor input[type="search"]'), null);
    const marcada = document.querySelector('.grade-candidata input');
    marcada.checked = true;
    marcada.onchange();
    document.querySelector('.grade-escolher').onclick();
    assert.equal(document.querySelector('.grade-editor').hidden, true);
    document.querySelector('.grade-escolher').onclick();
    assert.equal(document.querySelector('.grade-candidata input').checked, true);
    assert.equal(storage.get('trajetoria-unb:grade:v1'), antes);
});

test('a forma de montagem precede os planos e os filtros ficam visíveis sem frases auxiliares', async () => {
    const { document } = await interfaceGrade(undefined, undefined, [disciplina], undefined, 'manual');
    const metodo = document.querySelector('.grade-modos');
    assert.equal(metodo.closest('.grade-filtros-painel'), null);
    const filhos = [...document.querySelector('main').children];
    assert.ok(filhos.includes(metodo));
    assert.ok(filhos.indexOf(metodo) < filhos.indexOf(document.querySelector('.grade-plano-barra')));
    assert.equal(document.getElementById('modoManualGrade').textContent.trim(), 'Escolher turmas');
    assert.equal(document.getElementById('modoGeradorGrade').textContent.trim(), 'Gerar combinações');
    for (const id of ['encaixeGrade', 'somenteVagasGrade', 'ocultarExtrasGrade']) {
        assert.ok(!document.getElementById(id).closest('details'));
        assert.equal(document.getElementById(id).hidden, false);
    }
    assert.match(document.getElementById('somenteVagasGrade').parentElement.textContent, /Apenas turmas com vagas/);
    assert.match(document.getElementById('ocultarExtrasGrade').parentElement.textContent, /Ocultar extras não usadas/);
    assert.ok(!document.getElementById('ajudaExtrasGrade'));
    document.getElementById('modoGeradorGrade').onclick();
    assert.ok(!document.getElementById('encaixeGrade').closest('details'));
    assert.ok(!document.getElementById('ajudaMontagemGrade'));
});
