const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const calc = require('../public/js/calculos.js');
const comparar = (...args) => require('../public/js/intercambio-calculos.js').comparar(...args);
const edital = (slug = 'a') => ({
    slug,
    titulo: `Edital ${slug}`,
    mobilidade: '2027',
    fontes: { edital: 'https://example.org/' },
    formula: { pesoIra: 1, pesoIpf: 2 },
    cursos: [
        {
            nome: 'CURSO',
            variantes: [
                { media: 3, desvio: 1, estimada: true, metodo: 'estimativa', turno: null },
                { media: 4, desvio: 2 },
            ],
        },
    ],
    resultados: [
        { matricula: '123', curso: 'CURSO', ira: 0, ipf: 0, notaFinal: 0, alocacao: 'Destino' },
        { matricula: '456', curso: 'OUTRO', alocacao: 'Não alocado' },
    ],
});
test('médias e diferenças independem de IPF; preserva variantes, estimativas e fontes', () => {
    const a = comparar([edital()], { curso: 'CURSO', ira: 4, ipf: '' })[0];
    assert.deepEqual(
        a.referencias.map((r) => [r.media, r.desvio, r.diferenca, r.nota]),
        [
            [3, 1, 1, null],
            [4, 2, 0, null],
        ],
    );
    assert.equal(a.referencias[0].estimada, true);
    assert.equal(a.fontes.edital, 'https://example.org/');
    assert.equal(comparar([edital()], { curso: 'CURSO', ira: 4, ipf: 50 })[0].referencias[0].nota.final, 2);
});
test('fórmulas específicas; curso ausente; direto dispensa média; desvio inválido não simula', () => {
    const d = edital();
    d.formula = { tipo: 'ira-direto', pesoIra: 1, pesoIpf: 2 };
    assert.equal(comparar([d], { curso: 'AUSENTE', ira: 4, ipf: 50 })[0].referencias[0].nota.final, 5);
    assert.equal(comparar([edital()], { curso: 'AUSENTE', ira: 4, ipf: 50 })[0].referencias[0].nota, null);
    d.formula = { pesoIra: 2, pesoIpf: 3 };
    d.cursos[0].variantes[0].desvio = 0;
    const r = comparar([d], { curso: 'CURSO', ira: 4, ipf: 50 })[0].referencias;
    assert.equal(r[0].nota, null);
    assert.equal(r[1].nota.final, 1.5);
});
test('zeros válidos, vazios e inválidos ausentes; alocados identificados sem ranking', () => {
    for (const valor of ['', null, undefined, NaN, Infinity, -1, 6])
        assert.equal(comparar([edital()], { curso: 'CURSO', ira: valor, ipf: 0 })[0].referencias[0].nota, null);
    for (const ipf of ['', null, undefined, NaN, Infinity, -1, 101])
        assert.equal(comparar([edital()], { curso: 'CURSO', ira: 0, ipf })[0].referencias[0].nota, null);
    const r = comparar([edital()], { curso: 'CURSO', ira: 0, ipf: 0 })[0];
    assert.equal(r.referencias[0].nota.final, -3);
    assert.equal(r.alocados.length, 1);
    assert.equal(r.alocados[0].matricula, '123');
});
async function pagina(falhas = [], transformar = (e) => e, modo = 'comparacao', perfil = {}) {
    const { document, Event, HTMLSelectElement } = parseHTML(
        fs.readFileSync(`public/intercambio/${modo}/index.html`, 'utf8'),
    );
    Object.defineProperty(HTMLSelectElement.prototype, 'value', {
        configurable: true,
        get() {
            return this.querySelector('option[selected]')?.value ?? this.querySelector('option')?.value ?? '';
        },
        set(value) {
            this.querySelectorAll('option').forEach((o) => o.toggleAttribute('selected', o.value === String(value)));
        },
    });
    const storage = new Map([
        [
            'calculadora-unb:perfil-intercambio:v1',
            JSON.stringify({ curso: 'CURSO', ira: 4, ipf: '', extra: 'preservar', ...perfil }),
        ],
    ]);
    const context = vm.createContext({
        document,
        URL,
        location: { href: `https://example.org/intercambio/${modo}/` },
        localStorage: { getItem: (k) => storage.get(k), setItem: (k, v) => storage.set(k, v) },
        window: { addEventListener() {} },
        console,
        CalculosUnB: calc,
        fetch: async (url) => {
            const name = String(url).split('/').pop().replace('.json', '');
            if (name === 'index')
                return {
                    ok: true,
                    json: async () =>
                        [edital('a'), edital('b')].map(({ slug, titulo, mobilidade }) => ({
                            slug,
                            titulo,
                            mobilidade,
                        })),
                };
            if (falhas.includes(name)) throw Error('offline');
            return { ok: true, json: async () => transformar(edital(name)) };
        },
    });
    for (const f of ['common', 'intercambio-calculos', 'intercambio-geral'])
        vm.runInContext(fs.readFileSync(`public/js/${f}.js`, 'utf8'), context);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((resolve) => setImmediate(resolve));
    return { document, Event, storage };
}
test('DOM real: comparação sem IPF, entrada persiste, filtros de curso e edital, números ausentes', async () => {
    const { document: d, Event, storage } = await pagina();
    assert.equal(d.querySelectorAll('#referenciasGerais tbody tr').length, 4);
    assert.match(d.getElementById('criteriosGerais').textContent, /estimativa/);
    assert.match(d.querySelector('#referenciasGerais').textContent, /Indisponível/);
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 2);
    d.getElementById('geralIpf').value = '50';
    d.getElementById('geralIpf').dispatchEvent(new Event('input'));
    assert.equal(JSON.parse(storage.get('calculadora-unb:perfil-intercambio:v1')).extra, 'preservar');
    assert.doesNotMatch(d.querySelector('#referenciasGerais tbody').textContent, /Indisponível/);
    d.getElementById('editalGeral').querySelector('option[value="a"]').selected = true;
    d.getElementById('editalGeral').dispatchEvent(new Event('change'));
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 1);
    d.getElementById('cursoAlocados').querySelector('option[value="OUTRO"]').selected = true;
    d.getElementById('cursoAlocados').dispatchEvent(new Event('change'));
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 0);
});
test('DOM falha parcial preserva restante e aviso; falha total mostra erro', async () => {
    const a = await pagina(['b']);
    assert.equal(a.document.querySelectorAll('#alocadosGerais tbody tr').length, 1);
    assert.equal(a.document.getElementById('erroCarregamento').hidden, false);
    const b = await pagina(['a', 'b']);
    assert.equal(b.document.getElementById('erroCarregamento').hidden, false);
    assert.match(b.document.getElementById('erroCarregamento').textContent, /Não foi possível/);
});

test('DOM valida intervalos, diferencia vazio de zero e mantém zero publicado', async () => {
    const { document: d, Event } = await pagina();
    assert.equal(d.querySelector('#alocadosGerais tbody tr').children[3].textContent, '0');
    const ira = d.getElementById('geralIra'),
        ipf = d.getElementById('geralIpf');
    ira.value = '6';
    ira.dispatchEvent(new Event('input'));
    assert.equal(ira.getAttribute('aria-invalid'), 'true');
    assert.equal(d.getElementById('erroPerfilGeral').hidden, false);
    ira.value = '0';
    ipf.value = '0';
    ipf.dispatchEvent(new Event('input'));
    assert.equal(celulaResumo(d, 'Nota simulada').textContent, '≈ -3');
    ipf.value = '';
    ipf.dispatchEvent(new Event('input'));
    assert.equal(celulaResumo(d, 'Nota simulada').textContent, 'Indisponível');
});
test('DOM explicita ausências, oculta colunas numéricas vazias e não transforma ausências em zero', async () => {
    const { document: d } = await pagina([], (e) => {
        e.resultados[0].ipf = null;
        e.resultados[0].notaFinal = null;
        return e;
    });
    const linha = d.querySelector('#alocadosGerais tbody tr');
    assert.equal(linha.children[4].textContent, 'Indisponível');
    assert.equal(linha.children[4].hidden, true);
    assert.equal(d.querySelector('#alocadosGerais thead tr').children[5].hidden, true);
    assert.equal(linha.children[3].hidden, false);
});
test('dados reais de todos os editais preservam alocados e referências sem notas não finitas', () => {
    const indice = JSON.parse(fs.readFileSync('public/data/editais/index.json'));
    const editais = indice.map((e) => JSON.parse(fs.readFileSync(`public/data/editais/${e.slug}.json`)));
    for (const e of editais) {
        const r = comparar([e], { curso: 'DIREITO', ira: 4, ipf: 50 })[0];
        assert.equal(r.alocados.length, e.resultados.filter((r) => calc.alocado(r.alocacao)).length);
        assert.ok(r.referencias.every((v) => v.nota === null || Number.isFinite(v.nota.final)));
    }
    const estimado = editais.find((e) => e.metodoReferencias);
    assert.ok(estimado);
    const curso = estimado.cursos.find((c) => c.variantes.some((v) => v.estimada));
    const r = comparar([estimado], { curso: curso.nome, ira: 4, ipf: 50 })[0];
    assert.equal(r.metodoReferencias, estimado.metodoReferencias);
    assert.deepEqual(r.referencias[0].matriculasBase, curso.variantes[0].matriculasBase);
});

function cabecalho(d, titulo) {
    return [...d.querySelectorAll('#referenciasGerais th')].find((th) => th.textContent.trim() === titulo);
}
function celulaResumo(d, titulo, linha = 0) {
    const indice = [...d.querySelectorAll('#referenciasGerais th')].indexOf(cabecalho(d, titulo));
    return d.querySelectorAll('#referenciasGerais tbody tr')[linha].children[indice];
}

test('DOM histórico oculta ausências e restaura média e diferença ao alternar filtros', async () => {
    const { document: d, Event } = await pagina(
        [],
        (e) => {
            if (e.slug === 'a') {
                e.formula.tipo = 'ira-direto';
                e.cursos = [];
            }
            return e;
        },
        'medias',
    );
    for (const slug of ['a', 'b', 'a']) {
        d.getElementById('editalGeral').value = slug;
        d.getElementById('editalGeral').dispatchEvent(new Event('change'));
        for (const titulo of ['Média do curso', 'Seu IRA − média']) {
            assert.equal(cabecalho(d, titulo).hidden, slug === 'a');
            assert.equal(celulaResumo(d, titulo).hidden, slug === 'a');
        }
    }
});

test('DOM histórico mantém zeros visíveis e oculta nota indisponível', async () => {
    const transformar = (e) => {
        e.cursos[0].variantes = [{ media: 0, desvio: 0 }];
        return e;
    };
    const { document: d } = await pagina([], transformar, 'medias', { ira: 0 });
    for (const titulo of ['Média do curso', 'Seu IRA − média']) {
        assert.equal(celulaResumo(d, titulo).textContent, '0');
        assert.equal(celulaResumo(d, titulo).hidden, false);
        assert.equal(cabecalho(d, titulo).hidden, false);
    }
    const { document: c } = await pagina([], transformar);
    assert.equal(celulaResumo(c, 'Nota simulada').textContent, 'Indisponível');
    assert.equal(cabecalho(c, 'Nota simulada').hidden, true);
});

test('médias é uma página independente sem simulação nem alocados e preserva IPF salvo', async () => {
    const { document: d, Event, storage } = await pagina([], (e) => e, 'medias');
    assert.equal(d.querySelectorAll('#referenciasGerais tbody tr').length, 4);
    assert.equal(d.querySelector('[role="region"]').getAttribute('aria-label'), 'Referências históricas dos cursos');
    assert.equal(d.getElementById('geralIpf'), null);
    assert.equal(d.getElementById('alocadosGerais'), null);
    assert.doesNotMatch(d.querySelector('#referenciasGerais').textContent, /Nota simulada|IPF|Fórmula:/);
    assert.equal(d.querySelector('#referenciasGerais tbody tr').children.length, 4);
    assert.equal(d.querySelector('#referenciasGerais tbody a').href, 'https://example.org/intercambio/a/');
    assert.equal(d.querySelector('#criteriosGerais a[href="https://example.org/"]').textContent, 'Fonte: edital');
    const chave = 'calculadora-unb:perfil-intercambio:v1';
    storage.set(chave, JSON.stringify({ curso: 'CURSO', ira: 4, ipf: 37 }));
    d.getElementById('geralIra').value = '3';
    d.getElementById('geralIra').dispatchEvent(new Event('input'));
    assert.equal(JSON.parse(storage.get(chave)).ipf, 37);
    assert.doesNotMatch(d.querySelector('#referenciasGerais').textContent, /NaN/);
    d.getElementById('editalGeral').value = 'a';
    d.getElementById('editalGeral').dispatchEvent(new Event('change'));
    assert.equal(d.querySelectorAll('#referenciasGerais tbody tr').length, 2);
});

test('hub mantém cinco cartões e carrega somente catálogo pelo script original', async () => {
    const { document: d, Event } = parseHTML(fs.readFileSync('public/intercambio/index.html', 'utf8'));
    assert.equal(d.querySelectorAll('.card-edital').length, 5);
    assert.equal(d.getElementById('comparacaoGeral'), null);
    assert.equal(d.getElementById('geralCurso'), null);
    const chamadas = [];
    const context = vm.createContext({
        document: d,
        URL,
        location: { href: 'https://example.org/intercambio/' },
        localStorage: {
            getItem() {
                return null;
            },
        },
        window: { addEventListener() {} },
        console,
        CalculosUnB: calc,
        fetch: async (url) => {
            chamadas.push(String(url));
            return { ok: true, json: async () => JSON.parse(fs.readFileSync('public/data/editais/index.json')) };
        },
    });
    for (const f of ['common', 'intercambio']) vm.runInContext(fs.readFileSync(`public/js/${f}.js`, 'utf8'), context);
    d.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(chamadas, ['https://example.org/data/editais/index.json']);
    assert.equal(d.querySelectorAll('.card-edital .edital-identificacao h2').length, 5);
    assert.equal(d.querySelectorAll('script[src="../js/intercambio.js"]').length, 1);
});

test('médias mantém fontes após falha parcial e valida IRA sem depender de IPF', async () => {
    const { document: d, Event } = await pagina(['b'], (e) => e, 'medias');
    assert.equal(d.querySelectorAll('#referenciasGerais tbody tr').length, 2);
    assert.equal(d.getElementById('erroCarregamento').hidden, false);
    const ira = d.getElementById('geralIra');
    ira.value = '6';
    ira.dispatchEvent(new Event('input'));
    assert.equal(ira.getAttribute('aria-invalid'), 'true');
    assert.equal(d.getElementById('erroPerfilGeral').hidden, false);
    assert.equal(d.querySelector('#criteriosGerais a[href="https://example.org/"]').textContent, 'Fonte: edital');
});

test('navegação interna marca a página atual e resolve os três destinos', () => {
    for (const modo of ['', 'medias/', 'comparacao/']) {
        const { document: d } = parseHTML(fs.readFileSync(`public/intercambio/${modo}index.html`, 'utf8'));
        const links = [...d.querySelectorAll('.navegacao-intercambio a')];
        assert.equal(links.length, 3);
        assert.deepEqual(
            links.map((a) => new URL(a.getAttribute('href'), `https://example.org/intercambio/${modo}`).pathname),
            ['/intercambio/', '/intercambio/medias/', '/intercambio/comparacao/'],
        );
        assert.equal(links.filter((a) => a.getAttribute('aria-current') === 'page').length, 1);
        const ativo = links.find((a) => a.getAttribute('aria-current') === 'page');
        assert.equal(
            new URL(ativo.getAttribute('href'), `https://example.org/intercambio/${modo}`).pathname,
            `/intercambio/${modo}`,
        );
    }
});

test('curso canônico une caixa e espaços sem perder variantes nem precisão', () => {
    const a = edital('a'),
        b = edital('b');
    a.cursos = [
        { nome: '  Direito ', variantes: [{ media: 3.123456789, desvio: 1 }] },
        { nome: 'DIREITO', variantes: [{ media: 4, desvio: 2 }] },
    ];
    b.cursos = [{ nome: 'Direito  -  Noturno', variantes: [{ media: 2, desvio: 1 }] }];
    const original = JSON.stringify([a, b]);
    const r = comparar([a, b], { curso: ' direito ', ira: 4, ipf: 50 });
    assert.deepEqual(
        r.map((e) => e.referencias.map((v) => v.media)),
        [[3.123456789, 4], [2]],
    );
    assert.equal(r[0].referencias[0].diferenca, 4 - 3.123456789);
    assert.equal(JSON.stringify([a, b]), original);
});

test('DOM curso canônico deduplica seletores, restaura perfil e filtra alocados', async () => {
    const { document: d, Event } = await pagina(
        [],
        (e) => {
            e.cursos[0].nome = e.slug === 'a' ? 'Direito' : ' DIREITO ';
            e.resultados[0].curso = e.slug === 'a' ? ' direito - NOTURNO' : 'DIREITO';
            return e;
        },
        'comparacao',
        { curso: ' Direito  ', ipf: 50 },
    );
    for (const id of ['geralCurso', 'cursoAlocados']) {
        const opcoes = [...d.getElementById(id).options].filter(
            (o) => o.textContent.trim().toUpperCase() === 'DIREITO',
        );
        assert.equal(opcoes.length, 1);
        assert.equal(opcoes[0].value, 'DIREITO');
    }
    assert.equal(d.getElementById('geralCurso').value, 'DIREITO');
    assert.equal(d.getElementById('avisoCursoGeral').hidden, true);
    assert.equal(d.querySelectorAll('#referenciasGerais tbody tr').length, 4);
    d.getElementById('cursoAlocados').value = 'DIREITO';
    d.getElementById('cursoAlocados').dispatchEvent(new Event('change'));
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 2);
});

test('DOM resumo compacto, referências condicionais e critérios recolhidos por edital', async () => {
    for (const modo of ['medias', 'comparacao']) {
        const { document: d, Event } = await pagina(
            [],
            (e) => {
                if (e.slug === 'a') e.cursos[0].variantes = [{ media: 0, desvio: 1 }];
                e.cursos.push({ nome: 'ÚNICO', variantes: [{ media: 3, desvio: 1 }] });
                return e;
            },
            modo,
            { ipf: 50 },
        );
        assert.deepEqual(
            [...d.querySelectorAll('#referenciasGerais th')].map((h) => h.textContent.trim()),
            modo === 'medias'
                ? ['Edital', 'Referência', 'Média do curso', 'Seu IRA − média']
                : ['Edital', 'Referência', 'Nota simulada'],
        );
        const detalhes = d.getElementById('fontesCriterios');
        assert.equal(detalhes.tagName, 'DETAILS');
        assert.equal(detalhes.hasAttribute('open'), false);
        assert.equal(detalhes.querySelector('summary').textContent, 'Fontes e critérios');
        assert.equal(d.querySelectorAll('#criteriosGerais > section').length, 2);
        assert.equal(d.querySelectorAll('#criteriosGerais a[href="https://example.org/"]').length, 2);
        assert.equal(celulaResumo(d, 'Referência', 0).textContent, '—');
        assert.equal(celulaResumo(d, 'Referência', 1).textContent, 'Referência 1');
        assert.match(celulaResumo(d, modo === 'medias' ? 'Média do curso' : 'Nota simulada', 1).textContent, /≈/);
        for (const slug of ['a', 'b', 'a']) {
            d.getElementById('editalGeral').value = slug;
            d.getElementById('editalGeral').dispatchEvent(new Event('change'));
            assert.equal(cabecalho(d, 'Referência').hidden, slug === 'a');
            assert.equal(d.querySelectorAll('#criteriosGerais > section').length, 1);
        }
        d.getElementById('editalGeral').value = 'b';
        d.getElementById('editalGeral').dispatchEvent(new Event('change'));
        for (const curso of ['ÚNICO', 'CURSO', 'ÚNICO']) {
            d.getElementById('geralCurso').value = curso;
            d.getElementById('geralCurso').dispatchEvent(new Event('change'));
            assert.equal(cabecalho(d, 'Referência').hidden, curso === 'ÚNICO');
        }
    }
});

test('curso canônico mantém uma referência direta quando entradas equivalentes não têm variantes', () => {
    const e = edital();
    e.formula.tipo = 'ira-direto';
    e.cursos = [
        { nome: 'DIREITO', variantes: [] },
        { nome: 'Direito', variantes: [] },
    ];
    const r = comparar([e], { curso: ' direito ', ira: 4, ipf: 50 })[0];
    assert.equal(r.referencias.length, 1);
    assert.equal(r.referencias[0].media, null);
    assert.equal(r.referencias[0].nota.final, 5);
});

test('DOM referência preserva turno publicado, colapsa espaços e mantém critério por referência', async () => {
    const { document: d } = await pagina(
        [],
        (e) => {
            e.cursos[0].nome = e.slug === 'a' ? 'Ciência   Política' : ' CIÊNCIA POLÍTICA ';
            e.cursos[0].variantes[0].turno = 'Noturno';
            e.cursos[0].variantes[0].matriculasBase = ['123'];
            return e;
        },
        'medias',
        { curso: 'ciência  política' },
    );
    assert.equal(d.getElementById('geralCurso').value, 'CIÊNCIA POLÍTICA');
    assert.equal([...d.getElementById('geralCurso').options].filter((o) => o.value === 'CIÊNCIA POLÍTICA').length, 1);
    assert.equal(celulaResumo(d, 'Referência').textContent, 'Noturno');
    assert.match(d.getElementById('criteriosGerais').textContent, /Matrículas usadas na estimativa: 123/);
    assert.equal(d.querySelectorAll('#criteriosGerais > section').length, 2);
});

test('critérios associam matrículas da estimativa à referência correspondente', async () => {
    const { document: d } = await pagina(
        [],
        (e) => {
            e.cursos[0].variantes[0].matriculasBase = ['111', '112'];
            e.cursos[0].variantes[1].matriculasBase = ['221', '222'];
            return e;
        },
        'medias',
    );
    const primeiro = d.querySelector('#criteriosGerais > section');
    const paragrafos = [...primeiro.querySelectorAll('p')].map((p) => p.textContent);
    assert.ok(paragrafos.includes('Referência 1: Matrículas usadas na estimativa: 111, 112'));
    assert.ok(paragrafos.includes('Referência 2: Matrículas usadas na estimativa: 221, 222'));
});
