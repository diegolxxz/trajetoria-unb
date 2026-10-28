const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const path = require('node:path');
const arquivo = path.join(__dirname, '../public/js/grade-arquivos.js');
const api = existsSync(arquivo) ? require(arquivo) : {};
const plano = () => ({
    id: 'p1',
    nome: 'Meu plano',
    semestre: '2026.2',
    disciplinas: [{ codigo: 'CIC1', obrigatoria: true }],
    selecionadas: [
        {
            codigo: 'CIC1',
            nome: 'Computação',
            turma: {
                numero: '01',
                horarios: ['24M123'],
                professores: ['Maria'],
                local: 'ICC',
                vagas: 40,
                matriculados: 20,
                unidades: ['CIC'],
            },
        },
    ],
    inicio: '2026-10-26',
    fim: '2026-11-08',
});
const backup = () => ({ versao: 1, ativo: 'p1', planos: [plano()] });

test('backup e JSON preservam escolhas, filtros e snapshots independentes', () => {
    const b = backup();
    Object.assign(b.planos[0].disciplinas[0], {
        ativa: false,
        permitidas: ['["CIC1","02","indisponivel"]', '["CIC1","03","outra"]'],
    });
    b.planos[0].filtros = { vagas: true, encaixe: false, extras: true };
    const copia = api.validarBackup(b);
    assert.deepEqual(copia, b);
    assert.deepEqual(api.validarBackup(JSON.parse(JSON.stringify(copia))), b);
    copia.planos[0].disciplinas[0].permitidas.push('outra alternativa');
    copia.planos[0].filtros.vagas = false;
    assert.equal(b.planos[0].disciplinas[0].permitidas.length, 2);
    assert.equal(b.planos[0].filtros.vagas, true);
    assert.match(api.calendario(b.planos[0]), /Turma 01/);
});

test('backup aceita permitidas null e preserva vagas zero e matriculados null', () => {
    const b = backup();
    Object.assign(b.planos[0].disciplinas[0], { ativa: true, permitidas: null });
    Object.assign(b.planos[0].selecionadas[0].turma, { vagas: 0, matriculados: null });
    b.planos[0].filtros = { vagas: false, encaixe: true, extras: false };
    assert.deepEqual(api.validarBackup(b), b);
});

test('backup rejeita ativa invalida e permitidas vazias, duplicadas ou fora dos limites', () => {
    const invalidas = [
        { ativa: null },
        { ativa: 0 },
        { ativa: 'false' },
        { permitidas: [] },
        { permitidas: false },
        { permitidas: '01' },
        { permitidas: ['01', '01'] },
        { permitidas: [''] },
        { permitidas: ['  '] },
        { permitidas: ['01\0'] },
        { permitidas: [null] },
        { permitidas: [0] },
        { permitidas: ['a'.repeat(4001)] },
        { permitidas: Array.from({ length: 501 }, (_, i) => 'turma-' + i) },
    ];
    for (const campos of invalidas) {
        const b = backup();
        Object.assign(b.planos[0].disciplinas[0], campos);
        assert.throws(() => api.validarBackup(b), Error, JSON.stringify(campos));
    }
    const b = backup();
    b.planos[0].disciplinas[0].permitidas = Array.from({ length: 500 }, (_, i) => 'turma-' + i);
    b.planos[0].disciplinas[0].permitidas[0] = 'a'.repeat(4000);
    assert.deepEqual(api.validarBackup(b), b);
});

test('backup exige os tres filtros booleanos quando filtros estao presentes', () => {
    for (const filtros of [
        null,
        [],
        true,
        {},
        { vagas: true, encaixe: true },
        { vagas: 1, encaixe: false, extras: true },
        { vagas: true, encaixe: 'false', extras: true },
        { vagas: true, encaixe: false, extras: null },
    ]) {
        const b = backup();
        b.planos[0].filtros = filtros;
        assert.throws(() => api.validarBackup(b), Error, JSON.stringify(filtros));
    }
});

test('planos antigos mantem campos opcionais ausentes e snapshots independentes', () => {
    const b = backup();
    b.planos[0].disciplinas.push({ codigo: 'MAT1', obrigatoria: false });
    const copia = api.validarBackup(b);
    assert.deepEqual(copia, b);
    assert.equal(copia.versao, 1);
    assert.equal(Object.hasOwn(copia.planos[0], 'filtros'), false);
    for (const disciplina of copia.planos[0].disciplinas) {
        assert.equal(Object.hasOwn(disciplina, 'ativa'), false);
        assert.equal(Object.hasOwn(disciplina, 'permitidas'), false);
    }
});

test('historico restaura escolhas de geracao e filtros apos round-trip de backup', () => {
    const inicial = api.validarBackup(backup());
    const b = backup();
    Object.assign(b.planos[0].disciplinas[0], { ativa: false, permitidas: ['turma indisponivel'] });
    b.planos[0].filtros = { vagas: true, encaixe: true, extras: false };
    let h = api.registrar(api.criarHistorico(inicial), api.validarBackup(b));
    assert.deepEqual(h.atual.planos[0].disciplinas[0], {
        codigo: 'CIC1',
        obrigatoria: true,
        ativa: false,
        permitidas: ['turma indisponivel'],
    });
    h = api.desfazer(h);
    assert.deepEqual(h.atual, inicial);
    h = api.refazer(h);
    assert.deepEqual(api.validarBackup(JSON.parse(JSON.stringify(h.atual))), b);
    b.planos[0].disciplinas[0].permitidas.push('mutacao externa');
    assert.deepEqual(h.atual.planos[0].disciplinas[0].permitidas, ['turma indisponivel']);
});

test('expõe validação, histórico e calendário', () => {
    for (const nome of ['validarBackup', 'criarHistorico', 'registrar', 'desfazer', 'refazer', 'calendario'])
        assert.equal(typeof api[nome], 'function');
});
test('backup preserva snapshots e devolve cópia segura apenas com os campos conhecidos', () => {
    const origem = backup();
    origem.extra = true;
    const copia = api.validarBackup(origem);
    assert.equal(copia.extra, undefined);
    assert.deepEqual(copia, backup());
    copia.planos[0].selecionadas[0].turma.professores.push('Outro');
    assert.deepEqual(origem.planos[0].selecionadas[0].turma.professores, ['Maria']);
    assert.deepEqual(api.validarBackup({ versao: 1, ativo: '', planos: [] }).planos, []);
});
test('backup preserva professores com carga horária e campos desconhecidos na fonte como null', () => {
    const b = backup();
    Object.assign(b.planos[0].selecionadas[0].turma, {
        professores: [
            { nome: 'ANA', cargaHoraria: 30 },
            { nome: 'JOÃO', cargaHoraria: null },
        ],
        vagas: null,
        matriculados: null,
        local: null,
    });
    assert.deepEqual(api.validarBackup(b), b);
    assert.match(api.calendario(b.planos[0]), /DESCRIPTION:ANA/);
    assert.doesNotMatch(api.calendario(b.planos[0]), /LOCATION:null/);
});
test('backup rejeita tipos, limites, duplicatas e seleção sem pedido', () => {
    const mutacoes = [
        (b) => (b.versao = 2),
        (b) => (b.ativo = 'ausente'),
        (b) => (b.planos = null),
        (b) => b.planos.push(b.planos[0]),
        (b) => (b.planos[0].id = ''),
        (b) => (b.planos[0].nome = 3),
        (b) => (b.planos[0].nome = 'a'.repeat(201)),
        (b) => (b.planos[0].semestre = '2026.3'),
        (b) => (b.planos[0].inicio = '2026-02-30'),
        (b) => (b.planos[0].disciplinas[0].obrigatoria = 'sim'),
        (b) => b.planos[0].disciplinas.push(b.planos[0].disciplinas[0]),
        (b) => b.planos[0].selecionadas.push(b.planos[0].selecionadas[0]),
        (b) => (b.planos[0].selecionadas[0].codigo = 'OUTRO'),
        (b) => (b.planos[0].selecionadas[0].turma.horarios = [1]),
        (b) => (b.planos[0].selecionadas[0].turma.vagas = -1),
        (b) =>
            (b.planos[0].disciplinas = Array.from({ length: 21 }, (_, i) => ({ codigo: `C${i}`, obrigatoria: true }))),
        (b) => (b.planos = Array.from({ length: 21 }, (_, i) => ({ ...plano(), id: `p${i}` }))),
    ];
    for (const alterar of mutacoes) {
        const b = backup();
        alterar(b);
        assert.throws(
            () => api.validarBackup(b),
            /inválid|limite|até|únic|formato|data|plano|disciplina|turma|backup/i,
        );
    }
    for (const b of [null, [], 'json']) assert.throws(() => api.validarBackup(b));
});
test('histórico copia dados, ignora no-op, permite desfazer/refazer e corta ramo futuro', () => {
    const inicial = { itens: [1] };
    let h = api.criarHistorico(inicial);
    inicial.itens.push(9);
    assert.deepEqual(h.atual, { itens: [1] });
    h = api.registrar(h, { itens: [2] });
    h = api.registrar(h, { itens: [2] });
    assert.equal(h.passado.length, 1);
    const antes = h;
    h = api.desfazer(h);
    assert.deepEqual(h.atual, { itens: [1] });
    assert.deepEqual(antes.atual, { itens: [2] });
    assert.deepEqual(api.refazer(h).atual, { itens: [2] });
    h = api.registrar(h, { itens: [3] });
    assert.equal(h.futuro.length, 0);
    assert.deepEqual(api.refazer(h).atual, h.atual);
    for (let i = 0; i < 60; i++) h = api.registrar(h, { itens: [i] });
    assert.equal(h.passado.length, 50);
    for (let i = 0; i < 55; i++) h = api.desfazer(h);
    assert.equal(h.futuro.length, 50);
    assert.equal(h.passado.length, 0);
});
test('ICS usa primeira ocorrência, limite inclusivo, fuso e agrupa apenas minutos contíguos', () => {
    const p = plano();
    p.inicio = '2026-10-27';
    const ics = api.calendario(p);
    assert.match(ics, /DTSTART;TZID=America\/Sao_Paulo:20261102T080000/);
    assert.match(ics, /DTSTART;TZID=America\/Sao_Paulo:20261028T080000/);
    assert.match(ics, /DTEND;TZID=America\/Sao_Paulo:20261102T095000/);
    assert.match(ics, /DTSTART;TZID=America\/Sao_Paulo:20261102T100000/);
    assert.match(ics, /RRULE:FREQ=WEEKLY;UNTIL=20261109T025959Z/);
    assert.match(ics, /BEGIN:VTIMEZONE/);
    assert.match(ics, /TZOFFSETTO:-0300/);
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 4);
    const ids = (s) => [...s.matchAll(/UID:(.+)/g)].map((m) => m[1]);
    assert.deepEqual(ids(api.calendario(p)), ids(ics));
    p.inicio = p.fim = '2026-10-27';
    assert.doesNotMatch(api.calendario(p), /BEGIN:VEVENT/);
});
test('ICS escapa texto, impede injeção e dobra linhas em até 75 octetos UTF-8', () => {
    const p = plano();
    p.selecionadas[0].nome = 'á'.repeat(90) + ',;\\\nBEGIN:VEVENT';
    p.selecionadas[0].turma.local = 'ICC\r\nEND:VCALENDAR';
    const ics = api.calendario(p);
    assert.equal((ics.match(/\r\nBEGIN:VEVENT\r\n/g) || []).length, 4);
    assert.equal((ics.match(/\r\nEND:VCALENDAR\r\n/g) || []).length, 1);
    assert.match(ics.replace(/\r\n /g, ''), /\\,\\;\\\\\\nBEGIN:VEVENT/);
    for (const linha of ics.split('\r\n')) assert.ok(Buffer.byteLength(linha) <= 75);
    assert.doesNotMatch(ics.replace(/\r\n/g, ''), /[\r\n]/);
});
test('calendário rejeita datas impossíveis, inversas, longas e horários incompletos', () => {
    for (const [inicio, fim] of [
        ['2026-02-30', '2026-03-02'],
        ['2026-11-01', '2026-10-01'],
        ['2026-01-01', '2027-01-03'],
        ['', '2026-10-01'],
        ['2019-01-01', '2019-02-01'],
    ]) {
        const p = plano();
        p.inicio = inicio;
        p.fim = fim;
        assert.throws(() => api.calendario(p));
    }
    const p = plano();
    p.selecionadas[0].turma.horarios = ['2M1', 'inválido'];
    assert.throws(() => api.calendario(p));
    const b = plano();
    b.inicio = '2028-02-29';
    b.fim = '2028-03-01';
    assert.doesNotThrow(() => api.calendario(b));
});

test('backup roundtrips a four-digit future semester without a century ceiling', () => {
    const origem = backup();
    origem.planos[0].semestre = '2100.1';
    const exportado = JSON.stringify(api.validarBackup(origem));
    assert.deepEqual(api.validarBackup(JSON.parse(exportado)), origem);
});
