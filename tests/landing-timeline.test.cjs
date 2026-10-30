const { test } = require('node:test');
const assert = require('node:assert/strict');
const { estado, duracao } = require('../public/js/landing-timeline.js');
test('narrativa mantém uma seção ativa nos trechos de leitura', () => {
    for (const [tempo, ativo, etapa] of [
        [0, 0, 0],
        [2.65, 1, 1],
        [4.4, 2, 2],
        [6.15, 3, 3],
    ]) {
        const e = estado(tempo);
        assert.equal(e.ativo, ativo);
        assert.equal(e.paineis[ativo].opacidade, 1);
        assert.equal(e.etapa, etapa);
        assert.equal(e.paineis.filter((p) => p.opacidade > 0.1).length, 1);
    }
});
test('portal ocupa a transição após a abertura sem sobrepor textos', () => {
    const e = estado(1.5);
    assert.equal(e.ativo, -1);
    assert.ok(e.portal > 0.5 && e.portal < 1);
    assert.ok(e.opacidade > 0);
    assert.ok(e.paineis.every((p) => p.opacidade === 0));
});
test('fim libera conteúdo seguinte sem figura ou painel residual', () => {
    const e = estado(duracao);
    assert.equal(e.ativo, -1);
    assert.equal(e.opacidade, 0);
    assert.equal(e.progresso, 1);
    assert.ok(e.paineis.every((p) => p.opacidade === 0));
});
test('linha do tempo é reversível e respeita limites', () => {
    assert.deepEqual(estado(-10), estado(0));
    assert.deepEqual(estado(100), estado(duracao));
    let progresso = -1;
    for (let t = 0; t <= duracao; t += 0.01) {
        const e = estado(t);
        assert.ok(e.progresso >= progresso);
        assert.ok(e.etapa >= 0 && e.etapa <= 3);
        for (const p of e.paineis) assert.ok(p.opacidade >= 0 && p.opacidade <= 1);
        progresso = e.progresso;
        assert.deepEqual(estado(t), e);
    }
});

test('morphing não dá saltos nas fronteiras dos capítulos', () => {
    for (const t of [3.05, 4.1, 4.8, 5.85]) {
        const antes = estado(t - 0.0001),
            depois = estado(t + 0.0001);
        assert.ok(Math.abs(antes.etapa - depois.etapa) < 0.001);
    }
});
