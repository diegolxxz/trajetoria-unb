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

test('agrupa variantes pelo horário canônico antes de limitar grades distintas', () => {
    const variantes = Array.from({ length: 40 }, (_, i) =>
        turma(String(i), i % 2 ? ['4M1', '2M1'] : ['24M1'], { professores: ['Prof ' + i] }),
    );
    const outra = turma('outra', ['3M1']);
    const resultado = calc.gerarGrades([{ codigo: 'A', obrigatoria: true, turmas: [...variantes, outra] }]);
    assert.deepEqual(resultado.grupos, [[{ codigo: 'A', turmas: variantes }], [{ codigo: 'A', turmas: [outra] }]]);
    assert.equal(resultado.truncado, false);
    assert.equal(resultado.diagnostico, '');
});

test('preserva atribuições de horário por disciplina mesmo com ocupação total igual', () => {
    const pedidos = ['A', 'B'].map((codigo) => ({
        codigo,
        obrigatoria: true,
        turmas: [turma('1', ['2M1']), turma('2', ['2M2'])],
    }));
    const resultado = calc.gerarGrades(pedidos);
    assert.equal(resultado.grupos.length, 2);
    assert.deepEqual(
        resultado.grupos.map((g) => g.map((p) => p.turmas[0].numero)),
        [
            ['1', '2'],
            ['2', '1'],
        ],
    );
});

test('não enumera o produto de professores e limita retenção com aviso de truncamento', () => {
    const pedidos = ['A', 'B', 'C'].map((codigo, i) => ({
        codigo,
        obrigatoria: true,
        turmas: Array.from({ length: 400 }, (_, n) => turma(String(n), [String(i + 2) + 'M1'])),
    }));
    const resultado = calc.gerarGrades(pedidos);
    assert.equal(resultado.grupos.length, 1);
    assert.deepEqual(
        resultado.grupos[0].map((p) => p.turmas.length),
        [400, 400, 400],
    );
    assert.ok(resultado.explorados < 1300);
    assert.equal(resultado.truncado, false);
    const enorme = calc.gerarGrades([
        { codigo: 'A', obrigatoria: true, turmas: Array(100000).fill(turma('1', ['2M1'])) },
    ]);
    assert.equal(enorme.truncado, true);
    assert.ok(enorme.grupos[0][0].turmas.length <= 500);
    assert.ok(enorme.explorados <= 501);
});

test('explica impossibilidade conjunta de três disciplinas sem alegar conflito mínimo', () => {
    const pedidos = ['A', 'B', 'C'].map((codigo) => ({
        codigo,
        obrigatoria: true,
        turmas: [turma('1', ['2M1']), turma('2', ['2M2'])],
    }));
    assert.equal(calc.gerarGrades(pedidos.slice(0, 2)).grupos.length, 2);
    const resultado = calc.gerarGrades(pedidos);
    assert.deepEqual(resultado.grupos, []);
    assert.equal(resultado.truncado, false);
    assert.match(resultado.diagnostico, /conjunto/i);
    for (const codigo of ['A', 'B', 'C']) assert.ok(resultado.diagnostico.includes(codigo));
    assert.doesNotMatch(resultado.diagnostico, /mínim/i);
});

test('distingue disciplina sem turmas elegíveis de busca interrompida', () => {
    const pedidos = [{ codigo: 'SEM', obrigatoria: true, turmas: [] }];
    const vazio = calc.gerarGrades(pedidos);
    assert.match(vazio.diagnostico, /SEM/);
    assert.match(vazio.diagnostico, /elegíve/i);
    const limitado = calc.gerarGrades([{ codigo: 'A', obrigatoria: true, turmas: [turma('1', ['2M1'])] }], {
        maxNos: 1,
    });
    assert.equal(limitado.truncado, true);
    assert.deepEqual(limitado.grupos, []);
    assert.equal(limitado.explorados, 1);
    assert.match(limitado.diagnostico, /limite|inconclusiv/i);
    assert.doesNotMatch(limitado.diagnostico, /impossív/i);
});

test('ordena extras encontrados por inclusão e parcial permite omitir obrigatórias explicitamente', () => {
    const pedidos = [
        { codigo: 'A', obrigatoria: true, turmas: [turma('1', ['2M1'])] },
        { codigo: 'B', obrigatoria: false, turmas: [turma('2', ['2M2'])] },
        { codigo: 'C', obrigatoria: false, turmas: [turma('3', ['2M3'])] },
    ];
    const resultado = calc.gerarGrades(pedidos);
    assert.deepEqual(
        resultado.grupos.map((g) => g.length),
        [3],
    );
    pedidos[1].turmas = [turma('choque', ['2M1'])];
    const extrasOmitidos = calc.gerarGrades(pedidos);
    assert.deepEqual(
        extrasOmitidos.grupos.map((g) => g.map((p) => p.codigo)),
        [['A', 'C'], ['A']],
    );
    pedidos[1].obrigatoria = true;
    pedidos[1].turmas = [turma('choque', ['2M1'])];
    assert.deepEqual(calc.gerarGrades(pedidos).grupos, []);
    const parcial = calc.gerarGrades(pedidos, { parcial: true });
    assert.ok(parcial.grupos.some((g) => g.some((p) => p.codigo === 'B') && !g.some((p) => p.codigo === 'A')));
    assert.ok(parcial.grupos.every((g) => g.length > 0));
    assert.equal(pedidos[0].obrigatoria, true);
    assert.deepEqual(calc.gerarGrades([]).grupos, []);
});

test('limita a vinte grades distintas e contabiliza pré-processamento no orçamento', () => {
    const turmas = Array.from({ length: 30 }, (_, i) =>
        turma(String(i), [String(1 + Math.floor(i / 5)) + 'M' + (1 + (i % 5))]),
    );
    const resultado = calc.gerarGrades([{ codigo: 'A', obrigatoria: true, turmas }]);
    assert.equal(resultado.grupos.length, 20);
    assert.equal(resultado.truncado, true);
    const curto = calc.gerarGrades(
        [{ codigo: 'A', obrigatoria: true, turmas: Array(100000).fill(turma('1', ['inválido'])) }],
        { maxNos: 7 },
    );
    assert.equal(curto.explorados, 7);
    assert.equal(curto.truncado, true);
    assert.deepEqual(curto.grupos, []);
});

test('tenta inclusão completa antes que subconjuntos de extras consumam o limite de resultados', () => {
    const pedidos = [
        { codigo: 'REQ', obrigatoria: true, turmas: [turma('1', ['2M1']), turma('2', ['2M2'])] },
        { codigo: 'EXTRA', obrigatoria: false, turmas: [turma('1', ['2M1'])] },
        ...Array.from({ length: 5 }, (_, i) => ({
            codigo: 'EXTRA' + i,
            obrigatoria: false,
            turmas: [turma('1', [String(i + 3) + 'M1'])],
        })),
    ];
    const resultado = calc.gerarGrades(pedidos);
    assert.ok(resultado.grupos.some((grupo) => grupo.length === 7));
    assert.equal(resultado.grupos[0][0].turmas[0].numero, '2');
    assert.equal(resultado.truncado, false);
    const limitado = calc.gerarGrades(pedidos, { maxNos: 10 });
    assert.equal(limitado.explorados, 10);
    assert.equal(limitado.truncado, true);
    assert.deepEqual(limitado.grupos, []);
});

test('compatibilidade força candidata substituindo alternativas e inclui disciplina desabilitada', () => {
    const a = turma('1', ['2M1']);
    const b = turma('2', ['2M2']);
    const pedidos = [
        { codigo: 'A', obrigatoria: true, turmas: [a, b] },
        { codigo: 'B', obrigatoria: true, turmas: [a] },
        { codigo: 'EXTRA', obrigatoria: false, turmas: [a] },
    ];
    const candidatos = [
        { codigo: 'A', turma: a },
        { codigo: 'A', turma: b },
        { codigo: 'DESLIGADA', turma: b },
        { codigo: 'EXTRA', turma: b },
    ];
    const resultado = calc.compatibilidades(pedidos, candidatos);
    assert.deepEqual(
        resultado.estados.map((e) => e.estado),
        ['incompativel', 'compativel', 'incompativel', 'incompativel'],
    );
    assert.equal(resultado.estados[1].id, calc.idTurma('A', b));
    assert.equal(resultado.truncado, false);
    assert.equal(calc.compatibilidades([], [{ codigo: 'SO', turma: a }]).estados[0].estado, 'compativel');
    assert.equal(
        calc.compatibilidades([], [{ codigo: 'SO', turma: turma('?', ['a definir']) }]).estados[0].estado,
        'desconhecido',
    );
    const isolada = calc.compatibilidades(pedidos.slice(1, 2), [{ codigo: 'DESLIGADA', turma: b }]);
    assert.equal(isolada.estados[0].estado, 'compativel');
    const primeiraSolucao = calc.compatibilidades(pedidos.slice(0, 1), [
        { codigo: 'NOVA', turma: turma('3', ['3M1']) },
    ]);
    assert.equal(primeiraSolucao.estados[0].estado, 'compativel');
});

test('compatibilidade considera atribuição global, e não só conflitos par a par', () => {
    const pedidos = ['A', 'B'].map((codigo) => ({
        codigo,
        obrigatoria: true,
        turmas: [turma('1', ['2M1']), turma('2', ['2M2'])],
    }));
    const resultado = calc.compatibilidades(pedidos, [{ codigo: 'C', turma: turma('1', ['2M1']) }]);
    assert.equal(resultado.estados[0].estado, 'incompativel');
});

test('compatibilidade usa orçamento agregado e mantém desconhecidas as candidatas restantes', () => {
    const candidatos = Array.from({ length: 10 }, (_, i) => ({ codigo: 'A' + i, turma: turma('1', ['2M1']) }));
    const resultado = calc.compatibilidades([], candidatos, { maxNos: 5 });
    assert.equal(resultado.explorados, 5);
    assert.equal(resultado.truncado, true);
    assert.deepEqual(
        resultado.estados.map((e) => e.estado),
        ['compativel', 'compativel', ...Array(8).fill('desconhecido')],
    );
    const enorme = calc.compatibilidades(
        [{ codigo: 'B', obrigatoria: true, turmas: Array(100000).fill(turma('?', ['a definir'])) }],
        candidatos,
        { maxNos: 9 },
    );
    assert.equal(enorme.explorados, 9);
    assert.ok(enorme.estados.every((e) => e.estado === 'desconhecido'));
    assert.equal(enorme.truncado, true);
});
