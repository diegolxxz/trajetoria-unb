(() => {
    const $ = (id) => document.getElementById(id);
    const el = AppUnB.elemento;
    const formato = AppUnB.numero;
    const slug = document.body.dataset.edital;
    const chaveFiltros = `calculadora-unb:filtros:${slug}`;
    let dados;

    function explicarReferencias(curso) {
        if (curso.variantes.length < 2) return null;
        const ajuda = el('details', 'ajuda-referencias');
        ajuda.append(el('summary', '', `Por que há ${curso.variantes.length} referências?`));
        const semTurno = curso.variantes.some((v) => !v.turno);
        ajuda.append(
            el(
                'p',
                '',
                semTurno
                    ? 'Este curso tem mais de uma referência de média e desvio. A fonte não identifica o turno de todas elas. Compare sua simulação com a referência indicada em cada candidato.'
                    : 'Cada referência usa a média e o desvio do turno indicado na publicação. Compare sua simulação com os candidatos da mesma referência.',
            ),
        );
        return ajuda;
    }

    function temConteudo(valor) {
        return valor != null && !/^(?:\s*|[-–—]+|n\/a)$/i.test(String(valor).trim());
    }

    async function carregarJson(caminho) {
        const resposta = await fetch(new URL(caminho, AppUnB.raiz));
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        return resposta.json();
    }

    function opcoesCurso(select) {
        dados.cursos.forEach((c) => {
            const opcao = el('option', '', c.nome);
            opcao.value = c.nome;
            select.append(opcao);
        });
    }

    function restaurarPerfil() {
        const perfil = AppUnB.perfil();
        AppUnB.preencherNumero($('meuIra'), perfil.ira);
        AppUnB.preencherNumero($('meuIpf'), perfil.ipf);
        AppUnB.preencherCurso($('meuCurso'), perfil.curso);
        AppUnB.atualizarCursos();
        const indisponivel = perfil.curso && !$('meuCurso').value;
        $('avisoCurso').hidden = !indisponivel;
        $('avisoCurso').textContent = indisponivel
            ? `O curso salvo (${perfil.curso}) não aparece nesta publicação. Selecione outro curso para simular; nenhuma média de outro edital será usada.`
            : '';
    }

    function simular() {
        const curso = dados.cursos.find((c) => c.nome === $('meuCurso').value);
        const iraTexto = AppUnB.valorNumero($('meuIra'));
        const ipfTexto = AppUnB.valorNumero($('meuIpf'));
        const ira = Number(iraTexto);
        const ipf = Number(ipfTexto);
        const incompleto = iraTexto === '' || ipfTexto === '';
        const invalido =
            !incompleto &&
            (!Number.isFinite(ira) || ira < 0 || ira > 5 || !Number.isFinite(ipf) || ipf < 0 || ipf > 100);
        $('meuIra').setAttribute(
            'aria-invalid',
            String($('meuIra').value !== '' && (!Number.isFinite(ira) || ira < 0 || ira > 5)),
        );
        $('meuIpf').setAttribute(
            'aria-invalid',
            String($('meuIpf').value !== '' && (!Number.isFinite(ipf) || ipf < 0 || ipf > 100)),
        );
        $('erroPerfil').hidden = !invalido;
        $('erroPerfil').textContent = 'Informe um IRA entre 0 e 5 e um IPF entre 0% e 100%.';
        $('notasSimuladas').replaceChildren();
        mostrarReferenciasCurso($('filtroCurso').value);
        if (dados.formula.tipo === 'ira-direto') {
            if (incompleto || invalido) return;
            const nota = CalculosUnB.nota(ira, ipf, null, null, dados.formula);
            const card = el('article', 'card-nota');
            card.append(el('h3', '', 'Sua nota final'));
            card.append(el('strong', 'nota-final', formato(nota.final, 5)));
            $('notasSimuladas').append(card);
            mostrarReferenciasCurso($('filtroCurso').value);
            return;
        }
        if (!curso || incompleto || invalido) return;
        curso.variantes.forEach((v, i) => {
            const nota = CalculosUnB.nota(ira, ipf, v.media, v.desvio, dados.formula);
            const card = el('article', 'card-nota');
            const titulo = curso.variantes.length > 1 ? `Referência ${i + 1}` : 'Sua nota';
            card.append(el('h3', '', v.turno ? `${titulo} · ${v.turno}` : titulo));
            if (v.motivo) {
                card.append(el('p', 'texto-apoio detalhes-calculo', v.motivo));
                $('notasSimuladas').append(card);
                return;
            }
            card.append(
                el(
                    'strong',
                    'nota-final',
                    nota ? `${v.estimada ? '≈ ' : ''}${formato(nota.final, 4)}` : 'Indisponível',
                ),
            );
            const detalhes = el('div', 'detalhes-calculo');
            detalhes.append(el('span', '', `Média ${formato(v.media)}`), el('span', '', `Desvio ${formato(v.desvio)}`));
            if (nota) detalhes.append(el('span', '', `IRA padronizado ${formato(nota.padronizado)}`));
            if (v.estimada) detalhes.append(el('span', '', 'Valores estimados pelo IRA padronizado publicado.'));
            card.append(detalhes);
            $('notasSimuladas').append(card);
        });
        const ajuda = explicarReferencias(curso);
        if (ajuda) $('notasSimuladas').append(ajuda);
        mostrarReferenciasCurso($('filtroCurso').value);
    }

    function filtros() {
        return {
            curso: $('filtroCurso').value,
            alocacao: $('filtroAlocacao').value,
            busca: $('buscaResultado').value,
            ordem: $('ordemResultado').value,
            visualizacao: document.querySelector('[name="visualizacao"]:checked').value,
        };
    }

    function referenciaDoRegistro(registro) {
        const curso = dados.cursos.find((c) => c.nome === CalculosUnB.cursoBase(registro.curso));
        if (!curso || curso.variantes.length < 2) return '';
        const indice = curso.variantes.findIndex(
            (v) => v.cursoFonte === registro.curso && v.media === registro.media && v.desvio === registro.desvio,
        );
        return indice >= 0 ? `Referência ${indice + 1}` : '';
    }

    function mostrarReferenciasCurso(nome) {
        const container = $('referenciasCurso');
        const curso = dados.cursos.find((c) => c.nome === nome);
        container.replaceChildren();
        if (dados.formula.tipo === 'ira-direto' || nome === $('meuCurso').value) {
            container.hidden = true;
            return;
        }
        container.hidden = !curso;
        if (!curso) return;
        container.append(el('h3', 'referencias-titulo', `IRA médio e desvio — ${curso.nome}`));
        const lista = el('div', 'referencias-lista');
        curso.variantes.forEach((v, i) => {
            const card = el('div', 'referencia-curso');
            const titulo = curso.variantes.length > 1 ? `Referência ${i + 1}` : curso.nome;
            card.append(el('h4', '', v.turno ? `${titulo} · ${v.turno}` : titulo));
            if (v.motivo) {
                card.append(el('p', 'texto-apoio', v.motivo));
                lista.append(card);
                return;
            }
            const valores = el('div', 'referencia-valores');
            const media = el('p', '', 'IRA médio ');
            media.append(el('strong', '', formato(v.media, 4)));
            const desvio = el('p', '', 'Desvio padrão ');
            desvio.append(el('strong', '', formato(v.desvio, 4)));
            valores.append(media, desvio);
            card.append(valores);
            if (v.estimada)
                card.append(el('small', 'texto-apoio', 'Valores estimados pelo IRA padronizado publicado.'));
            lista.append(card);
        });
        container.append(lista);
        const ajuda = explicarReferencias(curso);
        if (ajuda) container.append(ajuda);
    }

    function renderizarTabela() {
        const filtro = filtros();
        mostrarReferenciasCurso($('filtroCurso').value);
        const busca = CalculosUnB.normalizar(filtro.busca.trim());
        const linhas = dados.resultados
            .filter((r) => {
                if (filtro.curso && CalculosUnB.cursoBase(r.curso) !== filtro.curso) return false;
                const alocado = CalculosUnB.alocado(r.alocacao);
                if (filtro.alocacao === 'alocados' && !alocado) return false;
                if (filtro.alocacao === 'nao-alocados' && alocado) return false;
                return (
                    !busca ||
                    CalculosUnB.normalizar(
                        [
                            r.matricula,
                            r.curso,
                            ...r.opcoes,
                            r.idiomas,
                            r.alocacao,
                            r.situacaoInscricao,
                            r.classificacao,
                            r.observacao,
                        ].join(' '),
                    ).includes(busca)
                );
            })
            .sort((a, b) => b[filtro.ordem] - a[filtro.ordem] || a.matricula.localeCompare(b.matricula));
        const completo = filtro.visualizacao === 'completo';
        const extras = [0, 1, 2, 3, 4].map((i) => ({ titulo: `${i + 1}ª opção`, valor: (r) => r.opcoes[i] }));
        extras.push({ titulo: 'Idiomas homologados', valor: (r) => AppUnB.idiomas(r.idiomas || '') });
        const visiveis = extras.filter((c) => linhas.some((r) => temConteudo(c.valor(r))));
        const campos = ['matricula', 'curso', 'ira', 'ipf', 'notaFinal', 'alocacao'];
        const baseVisivel = campos.map((c) =>
            (linhas.length ? linhas : dados.resultados).some((r) => temConteudo(r[c])),
        );
        baseVisivel[0] = completo && baseVisivel[0];
        const tabela = document.querySelector('.tabela-resultados');
        tabela.classList.toggle('modo-completo', completo);
        const cabecalho = el('tr');
        const titulos = [
            'Matrícula',
            'Curso',
            'IRA',
            'IPF',
            'Nota final',
            'Alocação definitiva',
            ...(completo ? visiveis.map((c) => c.titulo) : visiveis.length ? ['Detalhes'] : []),
        ];
        titulos.forEach((titulo, i) => {
            if (i < 6 && !baseVisivel[i]) return;
            const th = el('th', i > 5 ? 'coluna-extra' : `coluna-${i}`, titulo);
            if (titulo === 'Idiomas homologados') th.classList.add('coluna-idiomas');
            th.scope = 'col';
            cabecalho.append(th);
        });
        tabela.tHead.replaceChildren(cabecalho);
        const fragmento = document.createDocumentFragment();
        linhas.forEach((r) => {
            const tr = el('tr');
            const referencia = referenciaDoRegistro(r);
            const valores = [
                r.matricula,
                r.curso,
                r.ira == null ? '—' : formato(r.ira),
                r.ipf == null ? '—' : `${formato(r.ipf, 2)}%`,
                r.notaFinal == null ? '—' : formato(r.notaFinal),
                r.alocacao || 'n/a',
            ];
            const rotulos = ['Matrícula', 'Curso', 'IRA', 'IPF', 'Nota final', 'Alocação definitiva'];
            valores.forEach((valor, i) => {
                if (!baseVisivel[i]) return;
                const td = el('td', `campo-${i}`, valor);
                td.dataset.label = rotulos[i];
                if (i === 1 && referencia) td.append(el('small', 'referencia-linha', referencia));
                if (i === 5 && CalculosUnB.alocado(r.alocacao)) td.classList.add('celula-alocada');
                tr.append(td);
            });
            if (completo) {
                visiveis.forEach((c) => {
                    const td = el('td', 'campo-extra', temConteudo(c.valor(r)) ? c.valor(r) : '');
                    td.dataset.label = c.titulo;
                    tr.append(td);
                });
                fragmento.append(tr);
                return;
            }
            if (!visiveis.length) {
                fragmento.append(tr);
                return;
            }
            const td = el('td', 'campo-detalhes');
            const botao = el('button', 'abrir-detalhes', 'Ver detalhes');
            botao.type = 'button';
            botao.setAttribute('aria-label', `Ver detalhes da matrícula ${r.matricula}`);
            botao.setAttribute('aria-expanded', 'false');
            const linhaDetalhes = el('tr', 'linha-detalhes');
            linhaDetalhes.id = `detalhes-${r.matricula}`;
            linhaDetalhes.hidden = true;
            botao.setAttribute('aria-controls', linhaDetalhes.id);
            const celulaDetalhes = el('td', 'conteudo-detalhes');
            celulaDetalhes.colSpan = cabecalho.children.length;
            const lista = el('dl', 'lista-detalhes');
            const adicionar = (titulo, valor) => {
                const coluna = lista.children.length / 2 + 1;
                const termo = el('dt', '', titulo);
                const descricao = el('dd', '', valor);
                termo.style.setProperty('--coluna', coluna);
                descricao.style.setProperty('--coluna', coluna);
                lista.append(termo, descricao);
            };
            r.opcoes.forEach((v, i) => {
                if (temConteudo(v)) adicionar(`${i + 1}ª opção`, v);
            });
            if (temConteudo(r.idiomas)) adicionar('Idiomas homologados', AppUnB.idiomas(r.idiomas));
            if (lista.children.length) {
                lista.style.setProperty('--colunas', lista.children.length / 2);
                celulaDetalhes.append(lista);
                linhaDetalhes.append(celulaDetalhes);
                td.append(botao);
                botao.addEventListener('click', () => {
                    const aberto = botao.getAttribute('aria-expanded') !== 'true';
                    botao.setAttribute('aria-expanded', String(aberto));
                    botao.textContent = aberto ? 'Ocultar detalhes' : 'Ver detalhes';
                    botao.setAttribute(
                        'aria-label',
                        `${aberto ? 'Ocultar' : 'Ver'} detalhes da matrícula ${r.matricula}`,
                    );
                    linhaDetalhes.hidden = !aberto;
                });
            }
            tr.append(td);
            fragmento.append(tr);
            if (lista.children.length) fragmento.append(linhaDetalhes);
        });
        if (!linhas.length) {
            const tr = el('tr');
            const td = el('td', 'estado-vazio', 'Nenhum candidato encontrado. Tente outra busca ou limpe os filtros.');
            td.colSpan = cabecalho.children.length;
            tr.append(td);
            fragmento.append(tr);
        }
        $('linhasResultados').replaceChildren(fragmento);
        const alocados = linhas.filter((r) => CalculosUnB.alocado(r.alocacao)).length;
        $('contagemResultados').textContent =
            `${linhas.length} ${linhas.length === 1 ? 'resultado' : 'resultados'} · ${alocados} ${alocados === 1 ? 'alocado' : 'alocados'}`;
    }

    function mudarFiltros() {
        AppUnB.salvar(chaveFiltros, filtros());
        renderizarTabela();
    }

    async function inicializar() {
        try {
            if (!slug) {
                const editais = await carregarJson('data/editais/index.json');
                $('listaEditais').replaceChildren();
                editais.sort(
                    (a, b) =>
                        Number(b.titulo.match(/\/(\d{4})/)[1]) - Number(a.titulo.match(/\/(\d{4})/)[1]) ||
                        Number(b.titulo.match(/nº (\d+)/)[1]) - Number(a.titulo.match(/nº (\d+)/)[1]),
                );
                editais.forEach((edital) => {
                    const card = el('a', 'card-edital');
                    card.href = new URL(`intercambio/${edital.slug}/`, AppUnB.raiz);
                    const identificacao = el('div', 'edital-identificacao');
                    identificacao.append(
                        el('h2', '', edital.titulo),
                        el('p', 'texto-apoio', `Mobilidade: ${edital.mobilidade}`),
                    );
                    card.append(identificacao, el('span', 'abrir-edital', 'Consultar edital'));
                    $('listaEditais').append(card);
                });
                return;
            }
            dados = await carregarJson(`data/editais/${slug}.json`);
            opcoesCurso($('meuCurso'));
            opcoesCurso($('filtroCurso'));
            restaurarPerfil();
            const perfil = AppUnB.perfil();
            const salvo = AppUnB.ler(chaveFiltros, {
                curso: perfil.curso || '',
                alocacao: 'todos',
                busca: '',
                ordem: 'notaFinal',
            });
            $('filtroCurso').value = salvo.curso || '';
            $('filtroAlocacao').value = ['todos', 'alocados', 'nao-alocados'].includes(salvo.alocacao)
                ? salvo.alocacao
                : 'todos';
            $('buscaResultado').value = salvo.busca || '';
            $('ordemResultado').value = ['notaFinal', 'ira', 'ipf'].includes(salvo.ordem) ? salvo.ordem : 'notaFinal';
            document.querySelector(
                `[name="visualizacao"][value="${salvo.visualizacao === 'completo' ? 'completo' : 'compacto'}"]`,
            ).checked = true;
            AppUnB.iniciarCurso($('meuCurso'));
            AppUnB.iniciarCurso($('filtroCurso'), true, $('usarMeuCurso'));
            document
                .querySelectorAll('[name="visualizacao"]')
                .forEach((input) => input.addEventListener('change', mudarFiltros));
            $('meuIra').addEventListener('input', () => {
                AppUnB.salvarPerfil({ ira: AppUnB.editarNumero($('meuIra')) });
                simular();
            });
            $('meuIpf').addEventListener('input', () => {
                AppUnB.salvarPerfil({ ipf: AppUnB.editarNumero($('meuIpf')) });
                simular();
            });
            $('meuCurso').addEventListener('change', () => {
                $('avisoCurso').hidden = true;
                simular();
            });
            $('limparFiltros').addEventListener('click', () => {
                $('filtroCurso').value = '';
                AppUnB.atualizarCursos();
                $('filtroAlocacao').value = 'todos';
                $('buscaResultado').value = '';
                $('ordemResultado').value = 'notaFinal';
                mudarFiltros();
            });
            ['filtroCurso', 'filtroAlocacao', 'ordemResultado'].forEach((id) =>
                $(id).addEventListener('change', mudarFiltros),
            );
            $('buscaResultado').addEventListener('input', mudarFiltros);
            window.addEventListener('storage', (event) => {
                if (event.key === AppUnB.chavePerfil) {
                    restaurarPerfil();
                    simular();
                }
            });
            const descricao = '';
            if ($('resumoDados'))
                $('resumoDados').textContent =
                    `${dados.resultados.length} registros · ${dados.cursos.length} cursos · ${dados.resultados.filter((r) => CalculosUnB.alocado(r.alocacao)).length} alocados.${descricao ? ` ${descricao}` : ''}`;
            simular();
            renderizarTabela();
            $('carregando').hidden = true;
            $('conteudoEdital').hidden = false;
        } catch (erro) {
            console.error(erro);
            if ($('carregando')) $('carregando').hidden = true;
            if ($('listaEditais')) $('listaEditais').replaceChildren();
            $('erroCarregamento').hidden = false;
            $('erroCarregamento').textContent =
                'Não foi possível carregar os dados. Recarregue a página para tentar novamente.';
        }
    }
    document.addEventListener('DOMContentLoaded', inicializar);
})();
