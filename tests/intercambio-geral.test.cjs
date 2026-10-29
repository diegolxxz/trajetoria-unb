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
async function pagina(falhas = [], transformar = (e) => e, modo = 'medias', perfil = {}) {
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

function cabecalho(d, titulo) {
    return [...d.querySelectorAll('#referenciasGerais th')].find((th) => th.textContent.trim() === titulo);
}
function celulaResumo(d, titulo, linha = 0) {
    const indice = [...d.querySelectorAll('#referenciasGerais th')].indexOf(cabecalho(d, titulo));
    return d.querySelectorAll('#referenciasGerais tbody tr')[linha].children[indice];
}

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
    assert.equal(d.querySelectorAll('script[src="/js/intercambio.js"]').length, 1);
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

test('DOM referência preserva turno publicado e colapsa espaços', async () => {
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
});

test('dados de origem preservam matrículas da estimativa sem bloco visual de critérios', () => {
    const e = edital();
    e.cursos[0].variantes[0].matriculasBase = ['111', '112'];
    e.cursos[0].variantes[1].matriculasBase = ['221', '222'];
    const r = comparar([e], { curso: 'CURSO', ira: 4, ipf: 50 })[0];
    assert.deepEqual(
        r.referencias.map((v) => v.matriculasBase),
        [
            ['111', '112'],
            ['221', '222'],
        ],
    );
});

test('notas dos alocados calculáveis conferem com publicação dentro do arredondamento dos dados', () => {
    const indice = JSON.parse(fs.readFileSync('public/data/editais/index.json'));
    let conferidos = 0;
    for (const entrada of indice) {
        const e = JSON.parse(fs.readFileSync(`public/data/editais/${entrada.slug}.json`));
        for (const r of e.resultados.filter((r) => calc.alocado(r.alocacao) && Number.isFinite(r.notaFinal))) {
            const nota = calc.nota(r.ira, r.ipf, r.media, r.desvio, e.formula);
            if (!nota) continue;
            assert.ok(Math.abs(nota.final - r.notaFinal) <= 0.00011, `${e.slug}: ${r.matricula}`);
            conferidos++;
        }
    }
    assert.equal(conferidos, 463);
});

test('catálogo e cartões estáticos começam pelo edital mais recente', () => {
    const indice = JSON.parse(fs.readFileSync('public/data/editais/index.json'));
    assert.deepEqual(
        indice.map((e) => e.titulo),
        [
            'Edital INT nº 7/2026',
            'Edital INT nº 1/2026',
            'Edital INT nº 1/2025',
            'Edital INT nº 10/2024',
            'Edital INT nº 3/2024',
        ],
    );
    const { document: d } = parseHTML(fs.readFileSync('public/intercambio/index.html', 'utf8'));
    assert.equal(d.querySelector('h1').textContent, 'Intercâmbio');
    assert.doesNotMatch(d.querySelector('main').textContent, /Consulte os resultados e simule/);
    assert.match(d.querySelector('.card-edital').textContent, /7\/2026/);
});

test('todas as páginas exibem apenas IRA no item compacto do menu', () => {
    for (const arquivo of fs.readdirSync('public', { recursive: true }).filter((f) => f.endsWith('.html'))) {
        const { document: d } = parseHTML(fs.readFileSync(`public/${arquivo}`, 'utf8'));
        if (arquivo === '404.html') {
            assert.equal(d.querySelector('.erro-caminhos a[href="/ira/"]').textContent.trim(), 'IRA e MP ↗');
            continue;
        }
        assert.equal(d.querySelector('.nav-ira-curto').textContent, 'IRA', arquivo);
    }
    assert.doesNotMatch(
        fs.readFileSync('public/js/functionality.js', 'utf8'),
        /nav-ira-curto'\).textContent = somente/,
    );
});

test('médias reúne média e nota sem exigir IPF para consultar histórico', async () => {
    const { document: d, Event, storage } = await pagina();
    assert.equal(d.getElementById('alocadosGerais'), null);
    assert.equal(d.querySelectorAll('#referenciasGerais tbody tr').length, 4);
    assert.deepEqual(
        [...d.querySelectorAll('#referenciasGerais th')].map((h) => h.textContent.trim()),
        ['Edital', 'Referência', 'Média do curso', 'Nota final de intercâmbio'],
    );
    assert.equal(celulaResumo(d, 'Média do curso').textContent, '3');
    assert.equal(celulaResumo(d, 'Nota final de intercâmbio').textContent, '—');
    d.getElementById('geralIpf').value = '50';
    d.getElementById('geralIpf').dispatchEvent(new Event('input'));
    assert.equal(celulaResumo(d, 'Nota final de intercâmbio').textContent, '2');
    assert.equal(JSON.parse(storage.get('calculadora-unb:perfil-intercambio:v1')).extra, 'preservar');
    assert.equal(d.querySelector('.ajuda-comparacao'), null);
    for (const id of ['fontesCriterios', 'criteriosGerais', 'avisoEstimativas'])
        assert.equal(d.getElementById(id), null);
    assert.equal(d.querySelector('.navegacao-intercambio [aria-current]').textContent, 'Médias');
    assert.match(d.querySelector('.formula').textContent, /Fórmula atual/);
    assert.doesNotMatch(
        d.querySelector('main').textContent,
        /Diferença para a média|Referências estimadas|Fontes e critérios|Seu IRA − média|As médias e os desvios|Notas simuladas seguem/,
    );
});

test('comparar editais contém apenas alocados e filtros independentes sem alterar perfil', async () => {
    const { document: d, Event, storage } = await pagina([], (e) => e, 'comparacao');
    const antes = storage.get('calculadora-unb:perfil-intercambio:v1');
    for (const id of ['geralCurso', 'geralIra', 'geralIpf', 'referenciasGerais', 'fontesCriterios'])
        assert.equal(d.getElementById(id), null);
    assert.equal(d.querySelector('.formula'), null);
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 2);
    assert.equal(d.querySelector('#alocadosGerais tbody tr').children[2].textContent, '0');
    d.getElementById('editalGeral').value = 'a';
    d.getElementById('editalGeral').dispatchEvent(new Event('change'));
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 1);
    d.getElementById('cursoAlocados').value = 'OUTRO';
    d.getElementById('cursoAlocados').dispatchEvent(new Event('change'));
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 0);
    assert.equal(d.getElementById('vazioAlocados').hidden, false);
    d.getElementById('cursoAlocados').value = '';
    d.getElementById('cursoAlocados').dispatchEvent(new Event('change'));
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 1);
    assert.equal(storage.get('calculadora-unb:perfil-intercambio:v1'), antes);
});

test('falhas parciais e totais são tratadas nas duas páginas reorganizadas', async () => {
    for (const modo of ['medias', 'comparacao']) {
        const { document: d } = await pagina(['b'], (e) => e, modo);
        assert.equal(d.getElementById('comparacaoGeral').hidden, false);
        assert.equal(d.getElementById('erroCarregamento').hidden, false);
        assert.match(d.getElementById('erroCarregamento').textContent, /Edital b/);
        assert.equal(
            d.querySelectorAll(modo === 'medias' ? '#referenciasGerais tbody tr' : '#alocadosGerais tbody tr').length,
            modo === 'medias' ? 2 : 1,
        );
        const falha = await pagina(['a', 'b'], (e) => e, modo);
        assert.equal(falha.document.getElementById('erroCarregamento').hidden, false);
        assert.equal(falha.document.getElementById('comparacaoGeral').hidden, true);
    }
});

test('histórico mantém médias e zero com inputs vazios ou inválidos e não simula inválidos', async () => {
    const { document: d, Event } = await pagina(
        [],
        (e) => {
            e.cursos[0].variantes = [{ media: 0, desvio: 1 }];
            return e;
        },
        'medias',
        { ira: 0, ipf: 0 },
    );
    for (const titulo of ['Média do curso', 'Nota final de intercâmbio'])
        assert.equal(celulaResumo(d, titulo).textContent, '0');
    for (const [id, valor] of [
        ['geralIra', '6'],
        ['geralIpf', '101'],
    ]) {
        d.getElementById(id).value = valor;
        d.getElementById(id).dispatchEvent(new Event('input'));
        assert.equal(d.getElementById(id).getAttribute('aria-invalid'), 'true');
        assert.equal(celulaResumo(d, 'Nota final de intercâmbio').textContent, '—');
        assert.equal(d.querySelectorAll('#referenciasGerais tbody tr').length, 2);
    }
    d.getElementById('geralIra').value = '';
    d.getElementById('geralIra').dispatchEvent(new Event('input'));
    assert.equal(celulaResumo(d, 'Média do curso').textContent, '0');
});

test('referências condicionais acompanham filtros sem duplicar curso', async () => {
    const { document: d, Event } = await pagina(
        [],
        (e) => {
            e.cursos[0].nome = e.slug === 'a' ? 'Direito' : 'DIREITO';
            if (e.slug === 'a') e.cursos[0].variantes = [{ media: 3, desvio: 1 }];
            return e;
        },
        'medias',
        { curso: ' direito ', ipf: 50 },
    );
    assert.equal([...d.getElementById('geralCurso').options].filter((o) => o.value === 'DIREITO').length, 1);
    assert.equal(d.getElementById('geralCurso').value, 'DIREITO');
    assert.equal(cabecalho(d, 'Referência').hidden, false);
    assert.equal(celulaResumo(d, 'Referência').textContent, '—');
    assert.equal(celulaResumo(d, 'Referência', 1).textContent, 'Referência 1');
    d.getElementById('editalGeral').value = 'a';
    d.getElementById('editalGeral').dispatchEvent(new Event('change'));
    assert.equal(cabecalho(d, 'Referência').hidden, true);
    assert.doesNotMatch(d.querySelector('#referenciasGerais').textContent, /≈/);
});

test('curso ausente oculta linhas e restaura tudo ao trocar filtros', async () => {
    const { document: d, Event } = await pagina(
        [],
        (e) => {
            if (e.slug === 'a') e.cursos = [];
            return e;
        },
        'medias',
        { ipf: 50 },
    );
    assert.equal(d.querySelectorAll('#referenciasGerais tbody tr').length, 2);
    const mudar = (id, valor) => {
        d.getElementById(id).value = valor;
        d.getElementById(id).dispatchEvent(new Event('change'));
    };
    mudar('editalGeral', 'a');
    assert.equal(d.getElementById('resumoGerais').hidden, true);
    assert.match(d.getElementById('vazioReferencias').textContent, /Sem dados/);
    mudar('editalGeral', '');
    mudar('geralCurso', '');
    assert.match(d.getElementById('vazioReferencias').textContent, /Selecione um curso/);
    mudar('geralCurso', 'CURSO');
    assert.equal(d.getElementById('resumoGerais').hidden, false);
    assert.equal(d.querySelectorAll('#referenciasGerais tbody tr').length, 2);
});

test('fórmula antiga conhecida simula sem média; referência inválida mantém média sem inventar nota', async () => {
    const { document: d } = await pagina(
        [],
        (e) => {
            if (e.slug === 'a') {
                e.formula.tipo = 'ira-direto';
                e.cursos[0].variantes = [];
            } else
                e.cursos[0].variantes = [
                    { media: 3, desvio: 0 },
                    { media: 4, desvio: 1, motivo: 'Ambígua' },
                ];
            return e;
        },
        'medias',
        { ipf: 50 },
    );
    assert.equal(celulaResumo(d, 'Nota final de intercâmbio').textContent, '5');
    assert.equal(celulaResumo(d, 'Média do curso').textContent, '—');
    assert.match(d.querySelector('#referenciasGerais tbody tr').textContent, /Fórmula antiga/);
    assert.equal(celulaResumo(d, 'Nota final de intercâmbio', 1).textContent, '—');
    assert.equal(celulaResumo(d, 'Nota final de intercâmbio', 2).textContent, '—');
});

test('alocados ocultam colunas ausentes e mantêm zeros publicados', async () => {
    const { document: d } = await pagina(
        [],
        (e) => {
            e.resultados[0].ipf = null;
            e.resultados[0].notaFinal = null;
            return e;
        },
        'comparacao',
    );
    const tr = d.querySelector('#alocadosGerais tbody tr');
    assert.equal(tr.children[2].textContent, '0');
    assert.equal(tr.children[2].hidden, false);
    assert.equal(tr.children[3].hidden, true);
    assert.equal(tr.children[4].hidden, true);
    assert.equal(tr.children[5].hidden, false);
});

test('home apresenta as ferramentas com acesso direto e mantém conteúdo sem depender de áudio ou WebGL', () => {
    const { document: d } = parseHTML(fs.readFileSync('public/index.html', 'utf8'));
    const hero = d.querySelector('.jornada-hero');
    for (const destino of ['/ira/', '/intercambio/', '/turmas/', '/grade/', '/glossario/']) {
        assert.ok(hero.querySelector(`a[href="${destino}"]`));
        assert.ok(d.querySelector(`main a[href="${destino}"]`));
    }
    assert.ok(d.querySelector('main h1').textContent.includes('Sua trajetória.'));
    assert.ok(d.querySelector('button#movimentoInicio'));
    assert.equal(d.querySelector('audio, video'), null);
    assert.match(d.querySelector('.jornada-glossario').textContent, /em preparação/);
    assert.doesNotMatch(d.querySelector('main').textContent, /modo avançado/);
});

test('3/2024 calcula sem média do curso pela fórmula direta com os valores do exemplo', () => {
    const indice = JSON.parse(fs.readFileSync('public/data/editais/index.json'));
    const entrada = indice.find((e) => e.titulo.includes('3/2024'));
    const e = JSON.parse(fs.readFileSync(`public/data/editais/${entrada.slug}.json`));
    assert.deepEqual(e.formula, { tipo: 'ira-direto', pesoIra: 1, pesoIpf: 2 });
    const r = comparar([e], { curso: 'ENGENHARIA DE SOFTWARE', ira: 4.4201, ipf: 35.74 })[0];
    assert.equal(r.temCurso, true);
    assert.equal(r.referencias[0].media, null);
    assert.ok(Math.abs(r.referencias[0].nota.final - 5.1349) < 1e-12);
});

test('comparação alinha curso e edital em um grupo sem títulos ou legendas visuais redundantes', async () => {
    const { document: d } = await pagina([], (e) => e, 'comparacao');
    const filtros = d.querySelector('.filtros-alocados');
    assert.deepEqual(
        [...filtros.querySelectorAll('select')].map((e) => e.id),
        ['cursoAlocados', 'editalGeral'],
    );
    assert.equal(d.getElementById('cursoAlocados').getAttribute('aria-label'), 'Curso dos alocados');
    assert.equal(d.getElementById('editalGeral').getAttribute('aria-label'), 'Edital');
    assert.equal(d.querySelector('.intro-pagina p'), null);
    assert.equal(d.querySelector('#comparacaoGeral h2'), null);
    assert.equal(filtros.querySelector('label'), null);
    const { document: m } = await pagina();
    assert.equal(m.querySelector('.intro-pagina p'), null);
});

test('nota final de intercâmbio tem título padronizado sem exibir matrícula na comparação', async () => {
    const { document: d } = await pagina([], (e) => e, 'comparacao');
    assert.deepEqual(
        [...d.querySelectorAll('#alocadosGerais th')].map((e) => e.textContent.trim()),
        ['Edital', 'Curso', 'IRA', 'IPF (%)', 'Nota final', 'Alocação'],
    );
    const tr = d.querySelector('#alocadosGerais tbody tr');
    assert.equal(tr.children.length, 6);
    assert.equal(tr.children[1].textContent, 'CURSO');
    assert.equal(tr.children[4].textContent, '0');
    assert.equal(tr.children[4].classList.contains('nota-intercambio'), true);
    assert.equal(tr.children[5].textContent, 'Destino');
    assert.doesNotMatch(d.getElementById('alocadosGerais').textContent, /Matrícula|123/);
    const { document: m } = await pagina([], (e) => e, 'medias', { ipf: 50 });
    assert.equal(celulaResumo(m, 'Nota final de intercâmbio').textContent, '2');
    assert.equal(celulaResumo(m, 'Nota final de intercâmbio').classList.contains('nota-intercambio'), true);
});

test('comparação usa curso salvo pelo botão sem alterar o perfil ao filtrar ou clicar', async () => {
    const {
        document: d,
        Event,
        storage,
    } = await pagina([], (e) => e, 'comparacao', { curso: 'CURSO', ira: '4.123456', ipf: '73.123456' });
    const select = d.getElementById('cursoAlocados');
    const botao = select.closest('.seletor-curso').querySelector('button');
    const antes = storage.get('calculadora-unb:perfil-intercambio:v1');
    assert.equal(botao.hidden, false);
    botao.dispatchEvent(new Event('click'));
    assert.equal(select.value, 'CURSO');
    assert.equal(botao.hidden, true);
    assert.equal(storage.get('calculadora-unb:perfil-intercambio:v1'), antes);
    select.value = 'OUTRO';
    select.dispatchEvent(new Event('change'));
    assert.equal(botao.hidden, false);
    assert.equal(storage.get('calculadora-unb:perfil-intercambio:v1'), antes);
    botao.dispatchEvent(new Event('click'));
    assert.equal(select.value, 'CURSO');
    assert.equal(botao.hidden, true);
    assert.equal(storage.get('calculadora-unb:perfil-intercambio:v1'), antes);
});

test('médias salva novo curso e oculta botão; vazio permite retomar curso sem perder precisão', async () => {
    const {
        document: d,
        Event,
        storage,
    } = await pagina([], (e) => e, 'medias', { curso: 'CURSO', ira: '4.123456', ipf: '73.123456' });
    const select = d.getElementById('geralCurso');
    const botao = select.closest('.seletor-curso').querySelector('button');
    assert.equal(botao.hidden, true);
    select.value = 'OUTRO';
    select.dispatchEvent(new Event('change'));
    let salvo = JSON.parse(storage.get('calculadora-unb:perfil-intercambio:v1'));
    assert.equal(salvo.curso, 'OUTRO');
    assert.equal(salvo.ira, '4.123456');
    assert.equal(salvo.ipf, '73.123456');
    assert.equal(botao.hidden, true);
    select.value = '';
    select.dispatchEvent(new Event('change'));
    assert.equal(botao.hidden, false);
    botao.dispatchEvent(new Event('click'));
    assert.equal(select.value, 'OUTRO');
    assert.equal(botao.hidden, true);
    salvo = JSON.parse(storage.get('calculadora-unb:perfil-intercambio:v1'));
    assert.equal(salvo.curso, 'OUTRO');
});

test('botão fica oculto sem curso salvo ou quando ele não existe na seleção', async () => {
    for (const curso of ['', 'AUSENTE']) {
        for (const modo of ['medias', 'comparacao']) {
            const { document: d } = await pagina([], (e) => e, modo, { curso });
            assert.equal(d.querySelector('.seletor-curso button').hidden, true);
        }
    }
});

test('busca de alocação ignora caixa e acentos e combina curso e edital sem alterar perfil', async () => {
    const {
        document: d,
        Event,
        storage,
    } = await pagina(
        [],
        (e) => {
            e.resultados[0].alocacao = e.slug === 'a' ? 'Universidade de Brasília' : 'Universidade do Porto';
            return e;
        },
        'comparacao',
        { curso: 'CURSO' },
    );
    const antes = storage.get('calculadora-unb:perfil-intercambio:v1');
    const busca = d.getElementById('buscaAlocacao');
    const buscar = (valor) => {
        busca.value = valor;
        busca.dispatchEvent(new Event('input'));
    };
    buscar('  BRASILIA  ');
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 1);
    assert.match(d.querySelector('#alocadosGerais tbody').textContent, /Brasília/);
    d.getElementById('editalGeral').value = 'b';
    d.getElementById('editalGeral').dispatchEvent(new Event('change'));
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 0);
    assert.equal(d.getElementById('vazioAlocados').hidden, false);
    buscar('PORTO');
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 1);
    d.getElementById('cursoAlocados').value = 'OUTRO';
    d.getElementById('cursoAlocados').dispatchEvent(new Event('change'));
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 0);
    d.getElementById('cursoAlocados').value = '';
    d.getElementById('cursoAlocados').dispatchEvent(new Event('change'));
    buscar('');
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 1);
    d.getElementById('editalGeral').value = '';
    d.getElementById('editalGeral').dispatchEvent(new Event('change'));
    assert.equal(d.querySelectorAll('#alocadosGerais tbody tr').length, 2);
    assert.equal(storage.get('calculadora-unb:perfil-intercambio:v1'), antes);
});

test('tabelas de intercâmbio usam títulos visíveis sem legendas redundantes', () => {
    const indice = JSON.parse(fs.readFileSync('public/data/editais/index.json'));
    for (const destino of [...indice.map((e) => e.slug), 'medias', 'comparacao']) {
        const { document: d } = parseHTML(fs.readFileSync(`public/intercambio/${destino}/index.html`, 'utf8'));
        assert.equal(d.querySelector('caption'), null, destino);
        const tabela = d.querySelector('table');
        const titulo = d.getElementById(tabela.getAttribute('aria-labelledby'));
        assert.ok(titulo?.textContent.trim(), destino);
    }
});

test('edital específico oculta coluna repetida e todos os editais restaura após filtros e estado vazio', async () => {
    const { document: d, Event } = await pagina([], (e) => e, 'comparacao');
    const tabela = d.getElementById('alocadosGerais');
    const mudar = (id, valor) => {
        d.getElementById(id).value = valor;
        d.getElementById(id).dispatchEvent(new Event('change'));
    };
    for (const slug of ['a', 'b', '']) {
        mudar('editalGeral', slug);
        assert.equal(tabela.classList.contains('edital-unico'), Boolean(slug));
        assert.equal(tabela.querySelector('thead th').hidden, Boolean(slug));
        for (const tr of tabela.querySelectorAll('tbody tr')) {
            assert.equal(tr.children[0].hidden, Boolean(slug));
            assert.equal(tr.children[1].hidden, false);
            assert.equal(tr.children[4].hidden, false);
        }
        mudar('cursoAlocados', 'OUTRO');
        assert.equal(tabela.querySelectorAll('tbody tr').length, 0);
        assert.equal(tabela.querySelector('thead th').hidden, Boolean(slug));
        mudar('cursoAlocados', '');
        assert.equal(tabela.querySelectorAll('tbody tr').length, slug ? 1 : 2);
    }
});
