/* global IntercambioCalculos */
(() => {
    const $ = (id) => document.getElementById(id);
    const el = AppUnB.elemento;
    let editais = [];
    const formato = (valor) => (Number.isFinite(valor) ? AppUnB.numero(valor) : 'Indisponível');
    function link(edital) {
        const a = el('a', '', edital.titulo);
        a.href = `${edital.slug}/`;
        return a;
    }
    function celula(linha, valor) {
        const td = el('td');
        if (typeof valor === 'object' && valor !== null) td.append(valor);
        else td.textContent = valor == null || String(valor).trim() === '' ? 'Indisponível' : valor;
        linha.append(td);
    }
    function restaurarPerfil() {
        const perfil = AppUnB.perfil();
        for (const [id, campo] of [
            ['geralCurso', 'curso'],
            ['geralIra', 'ira'],
            ['geralIpf', 'ipf'],
        ])
            $(id).value = perfil[campo] ?? '';
        $('avisoCursoGeral').hidden =
            !perfil.curso || [...$('geralCurso').options].some((o) => o.value === perfil.curso);
        $('avisoCursoGeral').textContent =
            `O curso salvo (${perfil.curso}) não aparece nos editais carregados. Escolha um curso para comparar suas referências.`;
    }
    function renderizar() {
        const ira = $('geralIra').value;
        const ipf = $('geralIpf').value;
        for (const [id, valor, maximo] of [
            ['geralIra', ira, 5],
            ['geralIpf', ipf, 100],
        ])
            $(id).setAttribute(
                'aria-invalid',
                String(valor !== '' && IntercambioCalculos.numero(valor, maximo) === null),
            );
        $('erroPerfilGeral').hidden = ![$('geralIra'), $('geralIpf')].some(
            (input) => input.getAttribute('aria-invalid') === 'true',
        );
        const comparacao = IntercambioCalculos.comparar(editais, { curso: $('geralCurso').value, ira, ipf });
        const selecionados = comparacao.filter((e) => !$('editalGeral').value || e.slug === $('editalGeral').value);
        const historico = $('referenciasGerais').querySelector('tbody');
        const alocados = $('alocadosGerais').querySelector('tbody');
        historico.replaceChildren();
        alocados.replaceChildren();
        selecionados.forEach((edital) => {
            edital.referencias.forEach((r) => {
                const tr = el('tr');
                celula(tr, link(edital));
                celula(tr, edital.mobilidade);
                celula(tr, `Referência ${r.indice}${r.turno ? ` · ${r.turno}` : ''}`);
                celula(tr, formato(r.media));
                celula(tr, formato(r.desvio));
                celula(tr, formato(r.diferenca));
                celula(tr, r.nota ? `${r.estimada ? '≈ ' : ''}${formato(r.nota.final)}` : 'Indisponível');
                const detalhes = el('div');
                detalhes.append(
                    el(
                        'p',
                        '',
                        `Fórmula: ${edital.formula.tipo === 'ira-direto' ? 'IRA' : '((IRA − média) / desvio)'} × ${formato(edital.formula.pesoIra)} + (IPF / 100) × ${formato(edital.formula.pesoIpf)}`,
                    ),
                );
                detalhes.append(
                    el(
                        'span',
                        '',
                        r.motivo ||
                            (r.estimada
                                ? 'Estimada a partir do escore publicado.'
                                : Number.isFinite(r.media)
                                  ? 'Referência publicada do curso.'
                                  : edital.formula.tipo === 'ira-direto'
                                    ? 'Fórmula direta: dispensa média e desvio.'
                                    : 'Curso sem referência nesta publicação.'),
                    ),
                );
                if (edital.metodoReferencias) detalhes.append(el('p', '', edital.metodoReferencias));
                if (r.matriculasBase?.length)
                    detalhes.append(el('p', '', `Matrículas usadas na estimativa: ${r.matriculasBase.join(', ')}`));
                if (r.metodo) detalhes.append(el('p', '', String(r.metodo)));
                Object.entries(edital.fontes || {}).forEach(([nome, url]) => {
                    const a = el('a', '', `Fonte: ${nome}`);
                    a.href = url;
                    detalhes.append(el('br'), a);
                });
                celula(tr, detalhes);
                historico.append(tr);
            });
            edital.alocados
                .filter((r) => !$('cursoAlocados').value || CalculosUnB.cursoBase(r.curso) === $('cursoAlocados').value)
                .forEach((r) => {
                    const tr = el('tr');
                    celula(tr, link(edital));
                    for (const valor of [
                        r.matricula,
                        r.curso,
                        formato(r.ira),
                        formato(r.ipf),
                        formato(r.notaFinal),
                        r.alocacao,
                    ])
                        celula(tr, valor);
                    alocados.append(tr);
                });
        });
        $('vazioAlocados').hidden = alocados.children.length > 0;
        $('contagemAlocados').textContent = `${alocados.children.length} alocados nos editais carregados`;
        // Oculta apenas colunas inteiramente ausentes após aplicar os filtros.
        [1, 3, 4, 5].forEach((indice) => {
            const linhas = [...alocados.children];
            const ocultar =
                linhas.length > 0 && linhas.every((tr) => tr.children[indice].textContent === 'Indisponível');
            $('alocadosGerais').querySelector('thead tr').children[indice].hidden = ocultar;
            linhas.forEach((tr) => {
                tr.children[indice].hidden = ocultar;
            });
        });
    }
    async function json(caminho) {
        const resposta = await fetch(new URL(caminho, AppUnB.raiz));
        if (!resposta.ok) throw new Error('Falha no carregamento');
        return resposta.json();
    }
    async function iniciar() {
        try {
            const indice = await json('data/editais/index.json');
            const respostas = await Promise.allSettled(indice.map((e) => json(`data/editais/${e.slug}.json`)));
            editais = respostas.filter((r) => r.status === 'fulfilled').map((r) => r.value);
            if (!editais.length) throw new Error('Nenhum edital carregado');
            const falhas = indice.filter((_, i) => respostas[i].status === 'rejected');
            if (falhas.length) {
                $('erroCarregamento').hidden = false;
                $('erroCarregamento').textContent =
                    `Não foi possível carregar: ${falhas.map((e) => e.titulo).join(', ')}. Os demais editais continuam disponíveis.`;
            }
            $('listaEditais').replaceChildren(
                ...indice.map((e) => {
                    const a = link(e);
                    a.className = 'card-edital';
                    a.append(el('span', 'texto-apoio', ` · Mobilidade: ${e.mobilidade}`));
                    return a;
                }),
            );
            const cursos = [
                ...new Set(
                    editais.flatMap((e) => [
                        ...e.cursos.map((c) => c.nome),
                        ...e.resultados.map((r) => CalculosUnB.cursoBase(r.curso)),
                    ]),
                ),
            ].sort((a, b) => a.localeCompare(b, 'pt-BR'));
            for (const id of ['geralCurso', 'cursoAlocados'])
                cursos.forEach((c) => {
                    const o = el('option', '', c);
                    o.value = c;
                    $(id).append(o);
                });
            editais.forEach((e) => {
                const o = el('option', '', e.titulo);
                o.value = e.slug;
                $('editalGeral').append(o);
            });
            restaurarPerfil();
            for (const [id, campo] of [
                ['geralCurso', 'curso'],
                ['geralIra', 'ira'],
                ['geralIpf', 'ipf'],
            ])
                $(id).addEventListener(id === 'geralCurso' ? 'change' : 'input', () => {
                    AppUnB.salvarPerfil({ [campo]: $(id).value });
                    if (campo === 'curso') $('avisoCursoGeral').hidden = true;
                    renderizar();
                });
            for (const id of ['editalGeral', 'cursoAlocados']) $(id).addEventListener('change', renderizar);
            window.addEventListener('storage', (event) => {
                if (event.key === AppUnB.chavePerfil) {
                    restaurarPerfil();
                    renderizar();
                }
            });
            $('comparacaoGeral').hidden = false;
            renderizar();
        } catch {
            $('erroCarregamento').hidden = false;
            $('erroCarregamento').textContent =
                'Não foi possível carregar os dados para comparação. Recarregue a página para tentar novamente.';
        }
    }
    document.addEventListener('DOMContentLoaded', iniciar);
})();
