const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const calc = require('../public/js/calculos.js');
const chave = 'calculadora-unb:perfil-intercambio:v1';
const indice = JSON.parse(fs.readFileSync('public/data/editais/index.json'));

async function pagina(
    modo = 'individual',
    perfil = { curso: 'DIREITO', ira: '4.123456789', ipf: '73.0987654' },
    legado,
    slug = 'edital-int-n-7-2026',
    storageInicial,
) {
    const caminho = modo === 'individual' ? slug : modo;
    const {
        document: d,
        Event,
        HTMLSelectElement,
        HTMLInputElement,
    } = parseHTML(fs.readFileSync(`public/intercambio/${caminho}/index.html`, 'utf8'));
    Object.defineProperty(HTMLSelectElement.prototype, 'value', {
        configurable: true,
        get() {
            return this.querySelector('option[selected]')?.value ?? this.querySelector('option')?.value ?? '';
        },
        set(value) {
            this.querySelectorAll('option').forEach((o) => o.toggleAttribute('selected', o.value === String(value)));
        },
    });
    Object.defineProperty(HTMLInputElement.prototype, 'valueAsNumber', {
        configurable: true,
        get() {
            return this.value === '' ? NaN : Number(this.value);
        },
    });
    const tabela = d.querySelector('.tabela-resultados');
    if (tabela)
        Object.defineProperty(tabela, 'tHead', {
            get() {
                return this.querySelector('thead');
            },
        });
    const storage =
        storageInicial ??
        new Map(legado ? [['calculadora-ira-unb', JSON.stringify(legado)]] : [[chave, JSON.stringify(perfil)]]);
    const notas = [];
    const context = vm.createContext({
        document: d,
        URL,
        location: { href: `https://example.org/intercambio/${caminho}/` },
        localStorage: { getItem: (k) => storage.get(k), setItem: (k, v) => storage.set(k, v) },
        window: { addEventListener() {} },
        console,
        CalculosUnB: {
            ...calc,
            nota: (...args) => {
                notas.push(args);
                return calc.nota(...args);
            },
        },
        fetch: async (url) => ({
            ok: true,
            json: async () =>
                String(url).endsWith('index.json')
                    ? indice
                    : JSON.parse(fs.readFileSync(`public/data/editais/${String(url).split('/').pop()}`)),
        }),
    });
    for (const script of [
        'common',
        ...(modo === 'individual' ? ['intercambio'] : ['intercambio-calculos', 'intercambio-geral']),
    ])
        vm.runInContext(fs.readFileSync(`public/js/${script}.js`, 'utf8'), context);
    d.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((resolve) => setImmediate(resolve));
    const app = vm.runInContext('AppUnB', context);
    const ira = d.getElementById(modo === 'individual' ? 'meuIra' : 'geralIra');
    const ipf = d.getElementById(modo === 'individual' ? 'meuIpf' : 'geralIpf');
    const editar = (input, valor, tipo = 'insertText') => {
        input.value = valor;
        const evento = new Event('input');
        Object.defineProperty(evento, 'inputType', { value: tipo });
        input.dispatchEvent(evento);
    };
    return { d, Event, storage, notas, app, ira, ipf, editar };
}

test('perfil exibe IRA com quatro e IPF com duas casas e conserva valores exatos ao carregar ou alterar outro campo', async () => {
    for (const modo of ['individual', 'medias']) {
        const a = await pagina(modo);
        assert.equal(a.ira.value, '4.1235');
        if (a.ipf) assert.equal(a.ipf.value, '73.1');
        assert.equal(a.app.valorNumero(a.ira), '4.123456789');
        assert.equal(JSON.parse(a.storage.get(chave)).ira, '4.123456789');
        assert.ok(a.notas.some(([ira, ipf]) => ira === 4.123456789 && ipf === 73.0987654));
        const curso = a.d.getElementById(modo === 'individual' ? 'meuCurso' : 'geralCurso');
        curso.dispatchEvent(new a.Event('change'));
        assert.equal(JSON.parse(a.storage.get(chave)).ira, '4.123456789');
        if (a.ipf) {
            a.editar(a.ipf, '75.5');
            assert.equal(JSON.parse(a.storage.get(chave)).ira, '4.123456789');
            assert.ok(a.notas.some(([ira, ipf]) => ira === 4.123456789 && ipf === 75.5));
        }
    }
});

test('digitação e colagem limitam casas, salvam somente campo editado e invalidam cache anterior', async () => {
    for (const modo of ['individual', 'medias']) {
        const a = await pagina(modo);
        a.editar(a.ira, '4.234567', 'insertFromPaste');
        assert.equal(a.ira.value, '4.2346');
        assert.equal(JSON.parse(a.storage.get(chave)).ira, '4.2346');
        assert.equal(JSON.parse(a.storage.get(chave)).ipf, '73.0987654');
        assert.equal(a.app.valorNumero(a.ira), '4.2346');
        a.editar(a.ira, '');
        assert.equal(a.ira.value, '');
        assert.equal(a.app.valorNumero(a.ira), '');
        a.editar(a.ira, '0');
        assert.equal(a.ira.value, '0');
        assert.equal(a.app.valorNumero(a.ira), '0');
    }
});

test('IPF aceita frações e cem, limita precisão manual e rejeita valores acima de cem', async () => {
    for (const modo of ['individual', 'medias']) {
        const a = await pagina(modo);
        for (const valor of ['73.09', '75.5', '100', '0']) {
            a.editar(a.ipf, valor);
            assert.equal(a.ipf.value, valor);
            assert.equal(a.ipf.getAttribute('aria-invalid'), 'false');
        }
        a.editar(a.ipf, '73.0987654', 'insertFromPaste');
        assert.equal(a.ipf.value, '73.1');
        a.editar(a.ipf, '73.123456', 'insertFromPaste');
        assert.equal(a.ipf.value, '73.12');
        for (const valor of ['100.00001', '-0.00001', '101']) {
            a.editar(a.ipf, valor);
            assert.equal(a.ipf.getAttribute('aria-invalid'), 'true');
            if (valor === '100.00001') assert.equal(a.ipf.value, '100.01');
            assert.ok(Number(a.app.valorNumero(a.ipf)) < 0 || Number(a.app.valorNumero(a.ipf)) > 100);
        }
    }
});

test('IRA fora do intervalo não arredonda para válido; notação científica restaurada conserva precisão', async () => {
    const a = await pagina('medias', { curso: 'DIREITO', ira: '4.123456789e0', ipf: '7.30987654e1' });
    assert.equal(a.ira.value, '4.1235');
    assert.equal(a.ipf.value, '73.1');
    assert.equal(a.app.valorNumero(a.ira), '4.123456789e0');
    assert.ok(a.notas.some(([ira, ipf]) => ira === 4.123456789 && ipf === 73.0987654));
    for (const valor of ['5.00001', '-0.00001']) {
        a.editar(a.ira, valor);
        assert.equal(a.ira.getAttribute('aria-invalid'), 'true');
        assert.ok(Number(a.app.valorNumero(a.ira)) < 0 || Number(a.app.valorNumero(a.ira)) > 5);
    }
});

test('perfil automático legado mantém IRA e IPF calculados exatos sem gravar versão arredondada', async () => {
    const legado = {
        1: { 1: ['A', 4, 1, false] },
        2: { 1: ['B', 2, 3, false] },
        horasCurso: 137,
        intercambio: { cursoSelecionado: 'DIREITO' },
    };
    const a = await pagina('individual', undefined, legado);
    const esperado = calc.historico(legado);
    assert.equal(a.ira.value, String(Number(esperado.ira.toFixed(4))));
    assert.equal(a.ipf.value, String(Number(((100 * esperado.horas) / 137).toFixed(2))));
    assert.equal(a.storage.has(chave), false);
    assert.ok(a.notas.some(([ira, ipf]) => ira === esperado.ira && ipf === (100 * esperado.horas) / 137));
});

test('inputs usam quatro casas para IRA e duas para IPF até cem', () => {
    for (const caminho of [...indice.map((e) => e.slug), 'medias']) {
        const { document: d } = parseHTML(fs.readFileSync(`public/intercambio/${caminho}/index.html`, 'utf8'));
        for (const input of d.querySelectorAll('#meuIra, #meuIpf, #geralIra, #geralIpf')) {
            assert.equal(input.getAttribute('step'), /Ipf/.test(input.id) ? '1' : '0.1');
            assert.equal(input.getAttribute('data-casas'), /Ipf/.test(input.id) ? '2' : '4');
            assert.equal(input.getAttribute('max'), /Ipf/.test(input.id) ? '100' : '5');
        }
    }
});

test('cinco editais preservam precisão bruta até edição e invalidam perfil restaurado fora do intervalo', async () => {
    for (const { slug } of indice) {
        const a = await pagina(
            'individual',
            { curso: 'DIREITO', ira: '4.123456789', ipf: '73.0987654' },
            undefined,
            slug,
        );
        assert.equal(a.ira.value, '4.1235');
        assert.equal(a.ipf.value, '73.1');
        assert.ok(
            a.notas.some(([ira, ipf]) => ira === 4.123456789 && ipf === 73.0987654),
            slug,
        );
        a.editar(a.ira, '4.234567', 'insertFromPaste');
        assert.equal(a.ira.value, '4.2346');
        assert.ok(
            a.notas.some(([ira, ipf]) => ira === 4.2346 && ipf === 73.0987654),
            slug,
        );
    }
    const b = await pagina('medias', { curso: 'DIREITO', ira: '5.00001', ipf: '100.00001' });
    assert.equal(b.ira.getAttribute('aria-invalid'), 'true');
    assert.equal(b.ipf.getAttribute('aria-invalid'), 'true');
    assert.equal(b.app.valorNumero(b.ira), '5.00001');
    assert.equal(b.app.valorNumero(b.ipf), '100.00001');
    assert.equal(JSON.parse(b.storage.get(chave)).ira, '5.00001');
});

test('edição dentro de quatro casas preserva valor nativo e cursor durante a digitação', async () => {
    const a = await pagina('medias');
    let escritas = 0;
    const input = { value: '4.23', getAttribute: (nome) => ({ min: '0', max: '5', step: '0.0001' })[nome] };
    let atual = input.value;
    Object.defineProperty(input, 'value', {
        get: () => atual,
        set: (v) => {
            escritas++;
            atual = v;
        },
    });
    assert.equal(a.app.editarNumero(input), '4.23');
    assert.equal(escritas, 0);
    assert.equal(a.app.valorNumero(input), '4.23');
});

test('reabrir e navegar entre páginas conserva apresentação curta e perfil bruto com artefatos de ponto flutuante', async () => {
    const perfil = { curso: 'DIREITO', ira: 4.123456789, ipf: '73.09999999999999' };
    const storage = new Map([[chave, JSON.stringify(perfil)]]);
    for (let abertura = 0; abertura < 3; abertura++) {
        for (const destino of [...indice.map((e) => e.slug), 'medias']) {
            const modo = ['medias'].includes(destino) ? destino : 'individual';
            const a = await pagina(modo, undefined, undefined, destino, storage);
            assert.equal(a.ira.value, '4.1235');
            if (a.ipf) assert.equal(a.ipf.value, '73.1');
            assert.equal(a.app.valorNumero(a.ira), '4.123456789');
            if (a.ipf) assert.equal(a.app.valorNumero(a.ipf), '73.09999999999999');
            assert.equal(storage.get(chave), JSON.stringify(perfil));
        }
    }
});

test('perfil automático legado reabre com IPF de duas casas sem persistir arredondamento', async () => {
    const legado = {
        1: { 1: ['A', 4, 1, false] },
        2: { 1: ['B', 2, 3, false] },
        horasCurso: 137,
        intercambio: { cursoSelecionado: 'DIREITO' },
    };
    const storage = new Map([['calculadora-ira-unb', JSON.stringify(legado)]]);
    for (const modo of ['individual', 'medias', 'individual', 'medias']) {
        const a = await pagina(modo, undefined, undefined, 'edital-int-n-7-2026', storage);
        assert.equal(a.ira.value, '4');
        if (a.ipf) {
            assert.equal(a.ipf.value, '65.69');
            assert.equal(Number(a.app.valorNumero(a.ipf)), (100 * 90) / 137);
        }
        assert.equal(storage.has(chave), false);
    }
});

test('IPF com duas casas não reatribui valor nem cursor; terceira casa normaliza e salva', async () => {
    const a = await pagina('medias');
    let escritas = 0,
        atual = '73.09';
    const input = { getAttribute: (nome) => ({ min: '0', max: '100', step: '0.01' })[nome] };
    Object.defineProperty(input, 'value', {
        get: () => atual,
        set: (v) => {
            escritas++;
            atual = v;
        },
    });
    assert.equal(a.app.editarNumero(input), '73.09');
    assert.equal(escritas, 0);
    atual = '73.099';
    assert.equal(a.app.editarNumero(input), '73.1');
    assert.equal(escritas, 1);
    a.editar(a.ipf, '73.123456', 'insertFromPaste');
    const salvo = JSON.parse(a.storage.get(chave));
    assert.equal(salvo.ipf, '73.12');
    const reaberto = await pagina('individual', salvo);
    assert.equal(reaberto.ipf.value, '73.12');
    assert.equal(reaberto.ira.value, '4.1235');
    assert.equal(JSON.parse(reaberto.storage.get(chave)).ira, '4.123456789');
});

test('campos nativos preservam labels e não criam botões ou interceptadores de teclado', async () => {
    for (const modo of ['individual', 'medias']) {
        const a = await pagina(modo);
        for (const input of [a.ira, a.ipf]) {
            assert.equal(input.getAttribute('type'), 'number');
            assert.ok(input.closest('label') || a.d.querySelector(`label[for="${input.id}"]`));
        }
        assert.equal(a.d.querySelector('.ajuste-numero, .setas-numero, .campo-numero'), null);
        assert.doesNotMatch(fs.readFileSync('public/js/common.js', 'utf8'), /ArrowUp|ArrowDown|controlesNumero/);
        assert.doesNotMatch(
            fs.readFileSync('public/css/interface.css', 'utf8'),
            /webkit-inner-spin-button|appearance: textfield/,
        );
    }
});

test('passo nativo de 0,1 e 1 é independente da precisão de quatro e duas casas', () => {
    for (const caminho of [...indice.map((e) => e.slug), 'medias']) {
        const { document: d } = parseHTML(fs.readFileSync(`public/intercambio/${caminho}/index.html`, 'utf8'));
        for (const input of d.querySelectorAll('#meuIra,#meuIpf,#geralIra,#geralIpf')) {
            assert.equal(input.getAttribute('step'), /Ipf/.test(input.id) ? '1' : '0.1');
            assert.equal(input.getAttribute('data-casas'), /Ipf/.test(input.id) ? '2' : '4');
            assert.equal(input.getAttribute('data-incremento'), null);
        }
    }
});

test('cinco editais ocultam matrícula só no resumo e removem referência duplicada do curso simulado', async () => {
    for (const { slug } of indice) {
        const a = await pagina(
            'individual',
            { curso: 'ENGENHARIA DE SOFTWARE', ira: '4.4201', ipf: '35.74' },
            undefined,
            slug,
        );
        const d = a.d;
        assert.equal(d.getElementById('erroCarregamento').hidden, true, slug);
        const tabela = d.querySelector('.tabela-resultados');
        assert.equal(tabela.querySelector('th.coluna-0'), null, slug);
        assert.equal(tabela.querySelector('td.campo-0'), null, slug);
        assert.ok(tabela.querySelector('th.coluna-4').textContent.includes('Nota final'));
        assert.equal(d.getElementById('notaComparacao'), null);
        assert.equal(d.getElementById('referenciasCurso').hidden, true, slug);
        assert.equal(d.getElementById('referenciasCurso').children.length, 0, slug);
        const curso = d.getElementById('filtroCurso');
        curso.value = [...curso.options].find((o) => o.value && o.value !== 'ENGENHARIA DE SOFTWARE').value;
        curso.dispatchEvent(new a.Event('change'));
        const direto = JSON.parse(fs.readFileSync(`public/data/editais/${slug}.json`)).formula.tipo === 'ira-direto';
        assert.equal(d.getElementById('referenciasCurso').hidden, direto, slug);
        if (!direto) assert.match(d.getElementById('referenciasCurso').textContent, /IRA médio e desvio/);
        curso.value = 'ENGENHARIA DE SOFTWARE';
        curso.dispatchEvent(new a.Event('change'));
        assert.equal(d.getElementById('referenciasCurso').hidden, true, slug);
        for (const modo of ['completo', 'compacto', 'completo']) {
            d.querySelectorAll('[name="visualizacao"]').forEach((el) => {
                el.toggleAttribute('checked', el.value === modo);
            });
            d.querySelector(`[name="visualizacao"][value="${modo}"]`).dispatchEvent(new a.Event('change'));
            assert.equal(Boolean(tabela.querySelector('th.coluna-0')), modo === 'completo', slug);
            assert.equal(Boolean(tabela.querySelector('td.campo-0')), modo === 'completo', slug);
            const colunas = tabela.querySelectorAll('thead th').length;
            for (const tr of tabela.querySelectorAll('tbody tr:not(.linha-detalhes)'))
                assert.equal(tr.children.length, colunas, slug);
        }
    }
});

test('seletores dos editais salvam novo curso e oferecem usar curso salvo nos outros campos', async () => {
    for (const { slug } of indice) {
        const a = await pagina('individual', { curso: 'DIREITO', ira: '4.123456', ipf: '73.123456' }, undefined, slug);
        const sim = a.d.getElementById('meuCurso'),
            filtro = a.d.getElementById('filtroCurso');
        const botaoSim = sim.closest('.seletor-curso').querySelector('button'),
            botaoFiltro = a.d.getElementById('usarMeuCurso');
        assert.equal(botaoSim.hidden, true);
        assert.equal(botaoFiltro.hidden, true);
        filtro.value = 'ENGENHARIA DE SOFTWARE';
        filtro.dispatchEvent(new a.Event('change'));
        let salvo = JSON.parse(a.storage.get(chave));
        assert.equal(salvo.curso, 'ENGENHARIA DE SOFTWARE');
        assert.equal(salvo.ira, '4.123456');
        assert.equal(salvo.ipf, '73.123456');
        assert.equal(botaoFiltro.hidden, true);
        assert.equal(botaoSim.hidden, false);
        botaoSim.dispatchEvent(new a.Event('click'));
        assert.equal(sim.value, 'ENGENHARIA DE SOFTWARE');
        assert.equal(botaoSim.hidden, true);
        sim.value = 'DIREITO';
        sim.dispatchEvent(new a.Event('change'));
        salvo = JSON.parse(a.storage.get(chave));
        assert.equal(salvo.curso, 'DIREITO');
        assert.equal(botaoSim.hidden, true);
        assert.equal(botaoFiltro.hidden, false);
        botaoFiltro.dispatchEvent(new a.Event('click'));
        assert.equal(filtro.value, 'DIREITO');
        assert.equal(botaoFiltro.hidden, true);
        a.d.getElementById('limparFiltros').dispatchEvent(new a.Event('click'));
        assert.equal(filtro.value, '');
        assert.equal(botaoFiltro.hidden, false);
        assert.equal(JSON.parse(a.storage.get(chave)).curso, 'DIREITO');
    }
});
