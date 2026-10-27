const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const path = require('node:path');
const arquivo = path.join(__dirname, '../public/js/grade-calculos.js');
const calc = existsSync(arquivo) ? require(arquivo) : {};
const turma = (numero, horarios, extras = {}) => ({
    numero,
    horarios,
    professores: ['Professora A'],
    local: 'ICC',
    vagas: 40,
    matriculados: 20,
    unidades: ['CIC'],
    ...extras,
});

test('conflito exige simultaneamente dia e período iguais', () => {
    assert.equal(calc.haConflito?.(['246M12'], '4M2'), true);
    for (const outro of ['3M12', '2M3', '2T12', '2M3 4N1', '2M2x']) {
        assert.equal(calc.haConflito?.('2M1', outro), false);
    }
    assert.equal(calc.haConflito?.('2M5', '2T1'), false);
});

test('identidade preserva turma após atualizações de vagas e ordenação de detalhes', () => {
    const a = turma('01', ['4M1', '2M1'], { professores: ['Maria', 'João'] });
    const b = turma(' 01 ', ['2M1', '4M1'], {
        professores: [' João ', 'Maria'],
        local: ' ICC ',
        vagas: 10,
        matriculados: 30,
        unidades: ['MAT'],
    });
    const id = calc.idTurma?.(' CIC0001 ', a);
    assert.equal(typeof id, 'string');
    assert.equal(id, calc.idTurma?.('CIC0001', b));
});

test('identidade distingue variantes de mesmo número sem colisão por separadores', () => {
    const a = turma('01', ['2M1']);
    const id = calc.idTurma?.('CIC0001', a);
    assert.equal(typeof id, 'string');
    for (const variante of [
        { ...a, horarios: ['4M1'] },
        { ...a, professores: ['Outra'] },
        { ...a, local: 'BSA' },
        { ...a, numero: '02' },
    ])
        assert.notEqual(id, calc.idTurma?.('CIC0001', variante));
    assert.notEqual(calc.idTurma?.('A|B', a), calc.idTurma?.('A', { ...a, numero: 'B|01' }));
});

test('identidade usa nome de professor objeto e ignora mudanças de carga horária', () => {
    const a = turma('01', ['2M1'], { professores: [{ nome: 'Maria', cargaHoraria: 30 }] });
    const id = calc.idTurma('CIC1', a);
    assert.notEqual(id, calc.idTurma('CIC1', { ...a, professores: [{ nome: 'João', cargaHoraria: 30 }] }));
    assert.equal(id, calc.idTurma('CIC1', { ...a, professores: [{ nome: ' Maria ', cargaHoraria: 60 }] }));
    assert.equal(id, calc.idTurma('CIC1', { ...a, professores: ['Maria'] }));
});

test('expande dias e períodos SIGAA em blocos únicos ordenados', () => {
    assert.deepEqual(calc.parseHorario?.(['4m21 · 2M1', '2M1']), {
        valido: true,
        blocos: [
            { dia: 2, periodo: 'M1', inicio: 480, fim: 535 },
            { dia: 4, periodo: 'M1', inicio: 480, fim: 535 },
            { dia: 4, periodo: 'M2', inicio: 535, fim: 590 },
        ],
        invalidos: [],
    });
});

test('rejeita tokens incompletos, dias e períodos inexistentes sem perder os válidos', () => {
    assert.deepEqual(calc.parseHorario?.('2M1 8M1 2M6 2N5 2T7 2M1x 2MT12'), {
        valido: false,
        blocos: [{ dia: 2, periodo: 'M1', inicio: 480, fim: 535 }],
        invalidos: ['8M1', '2M6', '2N5', '2T7', '2M1x', '2MT12'],
    });
});

test('horário ausente ou vazio nunca é considerado válido', () => {
    for (const entrada of [undefined, null, '', [], [''], ['2M1', null]]) {
        assert.equal(calc.parseHorario?.(entrada)?.valido, false);
    }
});

test('traduz os extremos de cada turno e os intervalos oficiais', () => {
    assert.deepEqual(calc.parseHorario?.('1M345 7T123456 2N1234')?.blocos, [
        { dia: 1, periodo: 'M3', inicio: 600, fim: 655 },
        { dia: 1, periodo: 'M4', inicio: 655, fim: 710 },
        { dia: 1, periodo: 'M5', inicio: 720, fim: 775 },
        { dia: 2, periodo: 'N1', inicio: 1140, fim: 1190 },
        { dia: 2, periodo: 'N2', inicio: 1190, fim: 1240 },
        { dia: 2, periodo: 'N3', inicio: 1250, fim: 1300 },
        { dia: 2, periodo: 'N4', inicio: 1300, fim: 1350 },
        { dia: 7, periodo: 'T1', inicio: 775, fim: 830 },
        { dia: 7, periodo: 'T2', inicio: 840, fim: 895 },
        { dia: 7, periodo: 'T3', inicio: 895, fim: 950 },
        { dia: 7, periodo: 'T4', inicio: 960, fim: 1015 },
        { dia: 7, periodo: 'T5', inicio: 1015, fim: 1070 },
        { dia: 7, periodo: 'T6', inicio: 1080, fim: 1135 },
    ]);
});

test('gera escolhas obrigatórias sem conflito e permite omitir a opcional', () => {
    const a = turma('A', ['2M1']);
    const b = turma('B', ['2M2']);
    const choque = turma('X', ['2M1']);
    const pedidos = [
        { codigo: 'CIC1', obrigatoria: true, turmas: [a] },
        { codigo: 'MAT1', obrigatoria: false, turmas: [choque, b] },
    ];
    assert.deepEqual(calc.gerarCombinacoes?.(pedidos)?.combinacoes, [
        [
            { codigo: 'CIC1', turma: a },
            { codigo: 'MAT1', turma: b },
        ],
        [{ codigo: 'CIC1', turma: a }],
    ]);
    assert.equal(calc.gerarCombinacoes?.(pedidos)?.truncado, false);
});

test('obrigatórias impossíveis não geram combinação e opcionais nunca geram grade vazia', () => {
    const a = turma('A', ['2M1']);
    assert.deepEqual(
        calc.gerarCombinacoes?.([
            { codigo: 'CIC1', obrigatoria: true, turmas: [a] },
            { codigo: 'MAT1', obrigatoria: true, turmas: [a] },
        ])?.combinacoes,
        [],
    );
    for (const horarios of [[], ['2M1', 'a definir'], ['8T1']]) {
        assert.deepEqual(
            calc.gerarCombinacoes?.([{ codigo: 'CIC1', obrigatoria: false, turmas: [turma('A', horarios)] }])
                ?.combinacoes,
            [],
        );
    }
    assert.deepEqual(calc.gerarCombinacoes?.([])?.combinacoes, []);
});

test('limita resultados deterministicamente e sinaliza truncamento', () => {
    const turmas = Array.from({ length: 30 }, (_, i) => turma(String(i), ['2M1']));
    const pedidos = [{ codigo: 'CIC1', obrigatoria: true, turmas }];
    const padrao = calc.gerarCombinacoes?.(pedidos);
    assert.equal(padrao?.combinacoes.length, 20);
    assert.equal(padrao?.truncado, true);
    const limitado = calc.gerarCombinacoes?.(pedidos, { maxResultados: 2 });
    assert.deepEqual(
        limitado?.combinacoes.map((c) => c[0].turma.numero),
        ['0', '1'],
    );
    assert.equal(limitado?.truncado, true);
});

test('orçamento de nós conta tentativas conflitantes e inválidas em grupos enormes', () => {
    const a = turma('A', ['2M1']);
    for (const escolha of [a, turma('X', ['a definir'])]) {
        const resultado = calc.gerarCombinacoes?.(
            [
                { codigo: 'CIC1', obrigatoria: true, turmas: [a] },
                { codigo: 'MAT1', obrigatoria: true, turmas: Array(100000).fill(escolha) },
            ],
            { maxNos: 7 },
        );
        assert.equal(resultado?.explorados, 7);
        assert.equal(resultado?.truncado, true);
        assert.deepEqual(resultado?.combinacoes, []);
    }
});

test('valida códigos repetidos, quantidade de pedidos e limites antes da busca', () => {
    assert.equal(typeof calc.gerarCombinacoes, 'function');
    const pedido = { codigo: 'CIC1', obrigatoria: true, turmas: [] };
    for (const pedidos of [
        null,
        [pedido, { ...pedido, codigo: ' CIC1 ' }],
        Array.from({ length: 21 }, (_, i) => ({ ...pedido, codigo: String(i) })),
        [{ codigo: '', turmas: [] }],
        [{ codigo: 'CIC1', turmas: null }],
    ]) {
        assert.throws(() => calc.gerarCombinacoes(pedidos), /pedido|código|turmas/i);
    }
    for (const opcoes of [{ maxNos: 0 }, { maxResultados: -1 }, { maxNos: 1.5 }, { maxResultados: Infinity }]) {
        assert.throws(() => calc.gerarCombinacoes([pedido], opcoes), /limite/i);
    }
});
