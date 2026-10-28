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

async function interfaceGrade(backup, Worker, oferta = [disciplina]) {
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
        Worker,
        window: Worker ? { Worker } : {},
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
                      : { disciplinas: oferta },
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

test('ações secundárias ficam recolhidas sem remover controles e escolhas', async () => {
    const { document, buscar } = await interfaceGrade();
    buscar().onclick();
    const opcoes = document.querySelector('.grade-opcoes');
    assert.ok(opcoes);
    assert.equal(opcoes.hidden, true);
    assert.ok(opcoes.querySelector('.grade-remover'));
    assert.ok(opcoes.querySelector('select[id^="turmaGrade"]'));
    assert.equal(opcoes.querySelector('details'), null);
    const botao = document.querySelector('.grade-opcoes-botao');
    assert.equal(botao.getAttribute('aria-controls'), opcoes.id);
    assert.equal(botao.getAttribute('aria-expanded'), 'false');
    assert.equal(opcoes.parentElement, document.querySelector('.grade-materia'));
    botao.onclick();
    assert.equal(opcoes.hidden, false);
    assert.equal(botao.getAttribute('aria-expanded'), 'true');
    botao.onclick();
    assert.equal(opcoes.hidden, true);
    assert.equal(document.getElementById('novoPlanoGrade').closest('details').hasAttribute('open'), false);
    assert.equal(document.getElementById('encaixeGrade').closest('details').hasAttribute('open'), false);
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
    document.querySelector('.grade-escolher').onclick();
    const marcada = document.querySelector('.grade-candidata input');
    marcada.checked = true;
    marcada.onchange();
    const usar = document.querySelector('.grade-usar input');
    usar.checked = false;
    usar.onchange();
    assert.equal(document.querySelectorAll('.grade-materia').length, 2);
    assert.equal(document.querySelector('.grade-candidata input').checked, true);
    document.querySelectorAll('.grade-escolher')[1].onclick();
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
