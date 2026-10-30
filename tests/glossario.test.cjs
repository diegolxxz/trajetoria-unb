const { test } = require('node:test');
const assert = require('node:assert/strict');
const { preparar, pesquisar, mapas } = require('../public/js/glossario-busca.js');
const termos = preparar({
    versao: 1,
    termos: [
        {
            id: 'biblioteca',
            termo: 'Biblioteca de Teste',
            sigla: 'BT',
            aliases: ['Biblioteca Central'],
            descricao: 'Consulta ao acervo.',
            localizacao: { nome: 'Entrada de teste', latitude: -15.7, longitude: -47.8 },
        },
        { id: 'credito', termo: 'Crédito acadêmico', descricao: 'Unidade de carga horária.' },
    ],
});
test('busca ignora acentos e caixa e prioriza sigla exata', () => {
    assert.equal(pesquisar(termos, 'CREDITO')[0].item.id, 'credito');
    assert.equal(pesquisar(termos, 'bt')[0].item.id, 'biblioteca');
    assert.equal(pesquisar(termos, 'biblioteca central')[0].item.id, 'biblioteca');
});
test('tolera omissão e troca de letras e sinaliza aproximação', () => {
    for (const consulta of ['bibliteca', 'biblotieca']) assert.equal(pesquisar(termos, consulta)[0].aproximado, true);
    assert.equal(pesquisar(termos, 'credito inexistente').length, 0);
    assert.equal(pesquisar(termos, 'BX').length, 0);
});
test('consulta vazia inclui termos com e sem localização em ordem alfabética', () => {
    assert.deepEqual(
        pesquisar(termos, '').map((r) => r.item.id),
        ['biblioteca', 'credito'],
    );
});
test('links usam coordenadas verificadas e parâmetros codificados', () => {
    const links = mapas(termos[0]).map(([, url]) => new URL(url));
    assert.equal(links[0].searchParams.get('query'), '-15.7,-47.8');
    assert.equal(links[1].searchParams.get('ll'), '-15.7,-47.8');
    assert.equal(links[2].searchParams.get('navigate'), 'yes');
    assert.equal(mapas(termos[1]).length, 0);
    const endereco = mapas({ termo: 'Local', localizacao: { endereco: 'Rua A & B, Brasília' } });
    assert.equal(new URL(endereco[0][1]).searchParams.get('query'), 'Rua A & B, Brasília');
});
test('rejeita IDs repetidos e coordenadas inválidas', () => {
    assert.throws(() => preparar({ versao: 1, termos: [termos[0], termos[0]] }));
    assert.throws(() =>
        preparar({ versao: 1, termos: [{ ...termos[0], localizacao: { latitude: 100, longitude: 0 } }] }),
    );
});
