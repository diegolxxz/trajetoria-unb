const { test } = require('node:test');
const assert = require('node:assert/strict');
const { estado, duracao, destinos } = require('../public/js/landing-timeline.js');

test('atalhos chegam a capítulos legíveis com a demonstração concluída', () => {
    destinos.forEach((tempo, i) => {
        const e = estado(tempo);
        assert.equal(e.ativo, i);
        assert.equal(e.paineis[i].texto, 1);
        if (i > 0) assert.equal(e.paineis[i].demonstracao, 1);
    });
});
test('portal preserva a passagem visual sem sobrepor títulos', () => {
    const e = estado(1.3);
    assert.equal(e.ativo, -1);
    assert.ok(e.portal > 0 && e.portal < 1);
    assert.ok(e.opacidade > 0);
    assert.ok(e.paineis.every((p) => p.texto === 0));
});
test('a saída mantém a ação final e não reintroduz os desenhos rejeitados', () => {
    const e = estado(duracao);
    assert.equal(e.ativo, 3);
    assert.equal(e.opacidade, 0);
    assert.equal(e.paineis[3].texto, 1);
    assert.equal(e.etapa, 0);
    assert.equal(e.progresso, 1);
});
test('rolar dentro do capítulo avança a demonstração sem deslocar a leitura para outro capítulo', () => {
    for (const [inicio, fim, capitulo] of [
        [2.3, 2.95, 1],
        [4.2, 4.85, 2],
        [6.1, 6.8, 3],
    ]) {
        const a = estado(inicio),
            b = estado(fim);
        assert.equal(a.ativo, capitulo);
        assert.equal(b.ativo, capitulo);
        assert.equal(a.paineis[capitulo].texto, 1);
        assert.equal(b.paineis[capitulo].texto, 1);
        assert.ok(b.paineis[capitulo].demonstracao > a.paineis[capitulo].demonstracao);
    }
});
test('depois do portal não há intervalo sem capítulo visual durante a passagem', () => {
    for (let t = 1.85; t <= duracao; t += 0.01) {
        assert.ok(Math.max(...estado(t).paineis.map((p) => p.opacidade)) > 0.1);
    }
});
test('linha do tempo é reversível e respeita limites em todos os canais', () => {
    assert.deepEqual(estado(-10), estado(0));
    assert.deepEqual(estado(100), estado(duracao));
    const tempos = Array.from({ length: 721 }, (_, i) => i * 0.01);
    const ida = tempos.map(estado);
    tempos.reverse().forEach((t) => {
        const e = estado(t);
        for (const p of e.paineis) for (const v of Object.values(p)) assert.ok(v >= 0 && v <= 1);
        assert.deepEqual(e, ida[Math.round(t * 100)]);
    });
});
