/* global IntercambioCalculos */
(() => {
    const $ = (id) => document.getElementById(id);
    const el = AppUnB.elemento;
    const cursoChave = IntercambioCalculos.cursoChave;
    const mostrarReferencias = Boolean($('referenciasGerais'));
    let editais = [];
    const formato = (valor) => (Number.isFinite(valor) ? AppUnB.numero(valor) : 'Indisponível');
    function link(edital) {
        const a = el('a', '', edital.titulo);
        a.href = new URL(`intercambio/${edital.slug}/`, AppUnB.raiz).href;
        return a;
    }
    function celula(linha, valor) {
        const td = el('td');
        if (typeof valor === 'object' && valor !== null) td.append(valor);
        else td.textContent = valor == null || String(valor).trim() === '' ? 'Indisponível' : valor;
        linha.append(td);
        return td;
    }
    function restaurarPerfil() {
        const perfil = AppUnB.perfil();
        for (const [id, campo] of [
            ['geralCurso', 'curso'],
            ['geralIra', 'ira'],
            ['geralIpf', 'ipf'],
        ])
            if ($(id)) {
                if (campo === 'curso') $(id).value = cursoChave(perfil.curso);
                else AppUnB.preencherNumero($(id), perfil[campo]);
            }
        AppUnB.atualizarCursos();
        if (!$('avisoCursoGeral')) return;
        $('avisoCursoGeral').hidden =
            !perfil.curso || [...$('geralCurso').options].some((o) => o.value === cursoChave(perfil.curso));
        $('avisoCursoGeral').textContent =
            `O curso salvo (${perfil.curso}) não aparece nos editais carregados. Escolha um curso para comparar suas referências.`;
    }
    function renderizar() {
        const ira = $('geralIra') ? AppUnB.valorNumero($('geralIra')) : '';
        const ipf = $('geralIpf') ? AppUnB.valorNumero($('geralIpf')) : '';
        for (const [id, valor, maximo] of [
            ['geralIra', ira, 5],
            ['geralIpf', ipf, 100],
        ])
            $(id)?.setAttribute(
                'aria-invalid',
                String(valor !== '' && IntercambioCalculos.numero(valor, maximo) === null),
            );
        if ($('erroPerfilGeral'))
            $('erroPerfilGeral').hidden = ![$('geralIra'), $('geralIpf')].some(
                (input) => input?.getAttribute('aria-invalid') === 'true',
            );
        const comparacao = IntercambioCalculos.comparar(editais, { curso: $('geralCurso')?.value || '', ira, ipf });
        const selecionados = comparacao.filter((e) => !$('editalGeral').value || e.slug === $('editalGeral').value);
        if (mostrarReferencias) renderizarReferencias(selecionados);
        const buscaAlocacao = CalculosUnB.normalizar($('buscaAlocacao')?.value.trim() || '');
        const alocados = $('alocadosGerais')?.querySelector('tbody');
        alocados?.replaceChildren();
        selecionados.forEach((edital) => {
            if (alocados)
                edital.alocados
                    .filter((r) => !$('cursoAlocados').value || cursoChave(r.curso) === $('cursoAlocados').value)
                    .filter((r) => !buscaAlocacao || CalculosUnB.normalizar(r.alocacao || '').includes(buscaAlocacao))
                    .forEach((r) => {
                        const tr = el('tr');
                        celula(tr, link(edital));
                        for (const valor of [r.curso, formato(r.ira), formato(r.ipf), formato(r.notaFinal), r.alocacao])
                            celula(tr, valor);
                        tr.children[4].classList.add('nota-intercambio');
                        const titulos = $('alocadosGerais').querySelectorAll('th');
                        [...tr.children].forEach((td, i) => {
                            td.dataset.label = titulos[i].textContent.trim();
                        });
                        alocados.append(tr);
                    });
        });
        if (alocados) {
            const editalUnico = Boolean($('editalGeral').value);
            $('alocadosGerais').classList.toggle('edital-unico', editalUnico);
            $('alocadosGerais').querySelector('thead th').hidden = editalUnico;
            [...alocados.children].forEach((tr) => {
                tr.children[0].hidden = editalUnico;
            });
            $('vazioAlocados').hidden = alocados.children.length > 0;
            $('contagemAlocados').textContent = `${alocados.children.length} alocados nos editais carregados`;
            ocultarColunasAusentes('alocadosGerais', [2, 3, 4]);
        }
    }
    function renderizarReferencias(selecionados) {
        const historico = $('referenciasGerais').querySelector('tbody');
        historico.replaceChildren();
        const visiveis = selecionados
            .map((edital) => ({
                ...edital,
                referencias: edital.temCurso
                    ? edital.referencias.filter((r) => Number.isFinite(r.media) || edital.formula.tipo === 'ira-direto')
                    : [],
            }))
            .filter((edital) => edital.referencias.length);
        const vazio = visiveis.length === 0;
        $('resumoGerais').hidden = vazio;
        $('vazioReferencias').hidden = !vazio;
        $('vazioReferencias').textContent = $('geralCurso').value
            ? 'Sem dados para este curso nos editais selecionados.'
            : 'Selecione um curso para consultar os dados dos editais.';
        const variasReferencias = visiveis.some((e) => e.referencias.length > 1);
        $('referenciasGerais').querySelector('thead tr').children[1].hidden = !variasReferencias;
        visiveis.forEach((edital) => {
            const multiplas = edital.referencias.length > 1;
            edital.referencias.forEach((r) => {
                const tr = el('tr');
                const identificacao = el('span');
                identificacao.append(link(edital));
                if (edital.formula.tipo === 'ira-direto') {
                    const aviso = el('small', 'formula-antiga', 'Fórmula antiga');
                    aviso.title = 'Fórmula diferente da atual: usa o IRA diretamente.';
                    identificacao.append(el('br'), aviso);
                }
                celula(tr, identificacao);
                celula(tr, multiplas ? r.turno || `Referência ${r.indice}` : '—');
                tr.children[1].hidden = !variasReferencias;
                celula(tr, Number.isFinite(r.media) ? formato(r.media) : '—');
                celula(tr, r.nota ? formato(r.nota.final) : '—').classList.add('nota-intercambio');
                historico.append(tr);
            });
        });
        ocultarColunasAusentes('referenciasGerais', [2, 3]);
    }
    function ocultarColunasAusentes(id, indices) {
        const tabela = $(id);
        const linhas = [...tabela.querySelector('tbody').children];
        // Reavalia após cada filtro, preservando valores numéricos iguais a zero.
        indices.forEach((indice) => {
            const ocultar =
                linhas.length > 0 && linhas.every((tr) => tr.children[indice].textContent === 'Indisponível');
            tabela.querySelector('thead tr').children[indice].hidden = ocultar;
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
            const cursos = [
                ...new Set(
                    editais.flatMap((e) => [
                        ...e.cursos.map((c) => cursoChave(c.nome)),
                        ...e.resultados.map((r) => cursoChave(r.curso)),
                    ]),
                ),
            ]
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b, 'pt-BR'));
            for (const id of ['geralCurso', 'cursoAlocados'])
                cursos.forEach((c) => {
                    const o = el('option', '', c);
                    o.value = c;
                    $(id)?.append(o);
                });
            editais.forEach((e) => {
                const o = el('option', '', e.titulo);
                o.value = e.slug;
                $('editalGeral').append(o);
            });
            restaurarPerfil();
            if ($('geralCurso')) AppUnB.iniciarCurso($('geralCurso'));
            if ($('cursoAlocados')) AppUnB.iniciarCurso($('cursoAlocados'), false);
            for (const [id, campo] of [
                ['geralCurso', 'curso'],
                ['geralIra', 'ira'],
                ['geralIpf', 'ipf'],
            ])
                $(id)?.addEventListener(id === 'geralCurso' ? 'change' : 'input', () => {
                    if (campo !== 'curso') AppUnB.salvarPerfil({ [campo]: AppUnB.editarNumero($(id)) });
                    if (campo === 'curso') $('avisoCursoGeral').hidden = true;
                    renderizar();
                });
            $('buscaAlocacao')?.addEventListener('input', renderizar);
            for (const id of ['editalGeral', 'cursoAlocados']) $(id)?.addEventListener('change', renderizar);
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
