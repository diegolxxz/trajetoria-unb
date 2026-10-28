/* global IntercambioCalculos */
(() => {
    const $ = (id) => document.getElementById(id);
    const el = AppUnB.elemento;
    const cursoChave = IntercambioCalculos.cursoChave;
    const compararNotas = Boolean($('geralIpf'));
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
        $('avisoCursoGeral').hidden =
            !perfil.curso || [...$('geralCurso').options].some((o) => o.value === cursoChave(perfil.curso));
        $('avisoCursoGeral').textContent =
            `O curso salvo (${perfil.curso}) não aparece nos editais carregados. Escolha um curso para comparar suas referências.`;
    }
    function renderizar() {
        const ira = AppUnB.valorNumero($('geralIra'));
        const ipf = $('geralIpf') ? AppUnB.valorNumero($('geralIpf')) : '';
        for (const [id, valor, maximo] of [
            ['geralIra', ira, 5],
            ['geralIpf', ipf, 100],
        ])
            $(id)?.setAttribute(
                'aria-invalid',
                String(valor !== '' && IntercambioCalculos.numero(valor, maximo) === null),
            );
        $('erroPerfilGeral').hidden = ![$('geralIra'), $('geralIpf')].some(
            (input) => input?.getAttribute('aria-invalid') === 'true',
        );
        const comparacao = IntercambioCalculos.comparar(editais, { curso: $('geralCurso').value, ira, ipf });
        const selecionados = comparacao.filter((e) => !$('editalGeral').value || e.slug === $('editalGeral').value);
        const historico = $('referenciasGerais').querySelector('tbody');
        const alocados = $('alocadosGerais')?.querySelector('tbody');
        historico.replaceChildren();
        alocados?.replaceChildren();
        const criterios = $('criteriosGerais');
        criterios.replaceChildren();
        const visiveis = selecionados
            .map((edital) => ({
                ...edital,
                referencias: edital.temCurso
                    ? edital.referencias.filter((r) =>
                          compararNotas
                              ? !r.motivo &&
                                (edital.formula.tipo === 'ira-direto' ||
                                    (Number.isFinite(r.media) && Number.isFinite(r.desvio) && r.desvio > 0))
                              : Number.isFinite(r.media),
                      )
                    : [],
            }))
            .filter((edital) => edital.referencias.length);
        const vazio = visiveis.length === 0;
        $('resumoGerais').hidden = vazio;
        $('fontesCriterios').hidden = vazio;
        $('avisoEstimativas').hidden = vazio;
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
                celula(tr, link(edital));
                celula(tr, multiplas ? r.turno || `Referência ${r.indice}` : '—');
                tr.children[1].hidden = !variasReferencias;
                if (compararNotas) {
                    celula(tr, r.nota ? formato(r.nota.final) : '—');
                } else {
                    celula(tr, formato(r.media));
                    celula(tr, Number.isFinite(r.diferenca) ? formato(r.diferenca) : '—');
                }
                historico.append(tr);
            });
            const grupo = el('section');
            const titulo = el('h3');
            titulo.append(link(edital));
            grupo.append(titulo);
            if (compararNotas)
                grupo.append(
                    el(
                        'p',
                        '',
                        `Fórmula: ${edital.formula.tipo === 'ira-direto' ? 'IRA' : '((IRA − média) / desvio)'} × ${formato(edital.formula.pesoIra)} + (IPF / 100) × ${formato(edital.formula.pesoIpf)}`,
                    ),
                );
            if (edital.metodoReferencias) grupo.append(el('p', '', edital.metodoReferencias));
            const metodos = new Set();
            edital.referencias.forEach((r) => {
                const nome = multiplas ? `${r.turno || `Referência ${r.indice}`}: ` : '';
                const origem =
                    r.motivo ||
                    (r.estimada
                        ? 'Estimada a partir do escore publicado.'
                        : Number.isFinite(r.media)
                          ? 'Referência publicada do curso.'
                          : edital.formula.tipo === 'ira-direto'
                            ? 'Fórmula direta: dispensa média e desvio.'
                            : 'Curso sem referência nesta publicação.');
                grupo.append(el('p', '', `${nome}${origem} Média: ${formato(r.media)}; desvio: ${formato(r.desvio)}.`));
                if (r.matriculasBase?.length)
                    metodos.add(`${nome}Matrículas usadas na estimativa: ${r.matriculasBase.join(', ')}`);
                if (r.metodo) metodos.add(String(r.metodo));
            });
            metodos.forEach((metodo) => grupo.append(el('p', '', metodo)));
            Object.entries(edital.fontes || {}).forEach(([nome, url]) => {
                const a = el('a', '', `Fonte: ${nome}`);
                a.href = url;
                grupo.append(el('br'), a);
            });
            criterios.append(grupo);
        });
        selecionados.forEach((edital) => {
            if (alocados)
                edital.alocados
                    .filter((r) => !$('cursoAlocados').value || cursoChave(r.curso) === $('cursoAlocados').value)
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
        if (alocados) {
            $('vazioAlocados').hidden = alocados.children.length > 0;
            $('contagemAlocados').textContent = `${alocados.children.length} alocados nos editais carregados`;
            ocultarColunasAusentes('alocadosGerais', [1, 3, 4, 5]);
        }
        ocultarColunasAusentes('referenciasGerais', compararNotas ? [2] : [2, 3]);
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
            for (const [id, campo] of [
                ['geralCurso', 'curso'],
                ['geralIra', 'ira'],
                ['geralIpf', 'ipf'],
            ])
                $(id)?.addEventListener(id === 'geralCurso' ? 'change' : 'input', () => {
                    AppUnB.salvarPerfil({ [campo]: campo === 'curso' ? $(id).value : AppUnB.editarNumero($(id)) });
                    if (campo === 'curso') $('avisoCursoGeral').hidden = true;
                    renderizar();
                });
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
