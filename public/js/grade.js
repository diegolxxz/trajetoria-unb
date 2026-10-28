/* global GradeCalculos, GradeArquivos */
(() => {
    const $ = (id) => document.getElementById(id);
    const el = AppUnB.elemento;
    const chave = 'trajetoria-unb:grade:v1';
    const dias = [2, 3, 4, 5, 6, 7];
    const nomesDias = { 2: 'Segunda', 3: 'Terça', 4: 'Quarta', 5: 'Quinta', 6: 'Sexta', 7: 'Sábado' };
    const cores = ['#81b4ff', '#87d6a6', '#d5b4ff', '#f0c785', '#f5a9ce', '#8dd4dc'];
    const normalizar = (s) =>
        String(s ?? '')
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase();
    const professores = (t) => t.professores.map((p) => (typeof p === 'string' ? p : p.nome)).join(' · ');
    const hora = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const copiar = (v) => JSON.parse(JSON.stringify(v));
    let catalogo = [];
    let disciplinas = new Map();
    let componentes = {};
    let semestreCarregado = '';
    let carregamento = 0;
    let worker;
    let historico;
    let geracoes = [];
    let planoVisualizado = '';
    let editor = null;
    let workerCompat = null;
    let compatibilidade = new Map();
    try {
        historico = GradeArquivos.criarHistorico(
            GradeArquivos.validarBackup(AppUnB.ler(chave, { versao: 1, ativo: '', planos: [] })),
        );
    } catch {
        historico = GradeArquivos.criarHistorico({ versao: 1, ativo: '', planos: [] });
        mensagem(
            'Não foi possível ler os planos salvos. O conteúdo anterior será mantido até você criar ou importar um plano.',
        );
    }
    const atual = () => historico.atual.planos.find((p) => p.id === historico.atual.ativo);
    function mensagem(texto) {
        $('mensagemGrade').hidden = !texto;
        $('mensagemGrade').textContent = texto;
    }
    function novoPlano(semestre) {
        return {
            id: crypto.randomUUID(),
            nome: `Plano ${historico.atual.planos.length + 1}`,
            semestre,
            disciplinas: [],
            selecionadas: [],
            inicio: '',
            fim: '',
        };
    }
    function cancelar() {
        if (worker) worker.terminate();
        worker = null;
        $('cancelarGrade').hidden = true;
        $('gerarGrade').disabled = !atual()?.disciplinas.length || semestreCarregado !== atual()?.semestre;
    }
    function registrar(proximo) {
        const validado = GradeArquivos.validarBackup(proximo);
        const anterior = atual();
        historico = GradeArquivos.registrar(historico, validado);
        const plano = atual();
        if (
            anterior?.id !== plano?.id ||
            anterior?.semestre !== plano?.semestre ||
            !plano?.disciplinas.some((d) => d.codigo === editor?.codigo)
        )
            editor = null;
        AppUnB.salvar(chave, historico.atual);
        cancelar();
        geracoes = [];
        $('combinacoesGrade').replaceChildren();
        $('estadoGeradorGrade').textContent = '';
        $('parciaisGrade').hidden = true;
        compatibilidade.clear();
        renderizar();
        buscar();
        verificarEncaixes();
    }
    function alterar(fn) {
        const proximo = copiar(historico.atual);
        fn(proximo.planos.find((p) => p.id === proximo.ativo));
        registrar(proximo);
    }
    async function json(caminho) {
        const resposta = await fetch(new URL(caminho, AppUnB.raiz));
        if (!resposta.ok) throw new Error('Não foi possível carregar a oferta. Tente novamente recarregando a página.');
        return resposta.json();
    }
    async function carregarOferta(semestre) {
        const token = ++carregamento;
        cancelar();
        workerCompat?.terminate();
        workerCompat = null;
        compatibilidade.clear();
        semestreCarregado = '';
        disciplinas = new Map();
        $('buscaGrade').disabled = true;
        $('ofertaGrade').textContent = 'Carregando a oferta de turmas…';
        $('resultadosBuscaGrade').replaceChildren();
        renderizar();
        const item = catalogo.find((c) => c.semestre === semestre);
        if (!item) {
            $('ofertaGrade').textContent =
                `Semestre ${semestre} sem oferta disponível. As escolhas salvas foram preservadas.`;
            return;
        }
        try {
            const dados = await json(`data/turmas/${item.arquivo}`);
            if (token !== carregamento) return;
            disciplinas = new Map(
                dados.disciplinas.map((d) => [
                    d.codigo,
                    {
                        ...d,
                        busca: normalizar(
                            [d.codigo, d.nome, ...(d.nomesAlternativos || []), ...d.turmas.map(professores)].join(' '),
                        ),
                    },
                ]),
            );
            semestreCarregado = semestre;
            $('buscaGrade').disabled = false;
            const data = new Date(item.atualizadoEm);
            $('ofertaGrade').textContent =
                `Oferta de ${data.toLocaleDateString('pt-BR', { year: '2-digit', month: '2-digit', day: '2-digit' })}`;
            renderizar();
            buscar();
            verificarEncaixes();
        } catch (erro) {
            if (token === carregamento) {
                $('ofertaGrade').textContent = erro.message;
                renderizar();
            }
        }
    }
    function opcoesPlanos() {
        $('planoGrade').replaceChildren(
            ...historico.atual.planos.map((p) => {
                const opcao = el('option', '', `${p.nome} · ${p.semestre}`);
                opcao.value = p.id;
                return opcao;
            }),
        );
        $('planoGrade').value = historico.atual.ativo;
        const p = atual();
        if (!p) return;
        if (![...$('semestreGrade').options].some((o) => o.value === p.semestre)) {
            const opcao = el('option', '', `${p.semestre} (backup)`);
            opcao.value = p.semestre;
            $('semestreGrade').append(opcao);
        }
        $('semestreGrade').value = p.semestre;
        $('nomePlanoGrade').value = p.nome;
        $('inicioGrade').value = p.inicio;
        $('fimGrade').value = p.fim;
        $('somenteVagasGrade').checked = p.filtros?.vagas || false;
        $('encaixeGrade').checked = p.filtros?.encaixe || false;
        $('ocultarExtrasGrade').checked = p.filtros?.extras || false;
        const ativos = [p.filtros?.vagas, p.filtros?.encaixe, p.filtros?.extras].filter(Boolean).length;
        $('resumoFiltrosGrade').textContent = ativos ? `Filtros · ${ativos} ativo(s)` : 'Filtros';
    }
    function buscar() {
        const termo = normalizar($('buscaGrade').value.trim());
        const resultados = $('resultadosBuscaGrade');
        resultados.replaceChildren();
        if (termo.length < 3 || !atual()) return;
        const encontrados = [...disciplinas.values()].filter((d) => d.busca.includes(termo));
        const escolhidas = new Set(atual().disciplinas.map((d) => d.codigo));
        for (const d of encontrados.slice(0, 15)) {
            const linha = el('div', 'grade-busca-item');
            linha.append(el('p', '', `${d.codigo} · ${d.nome}`));
            const botao = el('button', 'grade-botao', escolhidas.has(d.codigo) ? 'No plano' : 'Adicionar');
            botao.type = 'button';
            botao.disabled = escolhidas.has(d.codigo) || escolhidas.size >= 20;
            botao.setAttribute('aria-label', `Adicionar ${d.nome}`);
            botao.onclick = () => {
                alterar((p) => p.disciplinas.push({ codigo: d.codigo, obrigatoria: true }));
                $('buscaGrade').value = '';
                resultados.replaceChildren();
                const campo = document.querySelector(`[data-codigo="${CSS.escape(d.codigo)}"] .grade-escolher`);
                campo?.focus();
            };
            linha.append(botao);
            resultados.append(linha);
        }
        resultados.append(
            el(
                'p',
                'grade-muted',
                encontrados.length > 15
                    ? `15 de ${encontrados.length} disciplinas. Refine a busca para ver outras.`
                    : `${encontrados.length} disciplina(s).`,
            ),
        );
    }
    function carga(codigo) {
        const horas = componentes[codigo]?.cargaHoraria;
        return Number.isFinite(horas)
            ? `${AppUnB.numero(horas)} h · ${AppUnB.numero(horas / 15)} créditos`
            : 'Carga horária curricular não informada';
    }
    function elegiveis(codigo, restrita = true) {
        const pedido = atual()?.disciplinas.find((d) => d.codigo === codigo);
        return (disciplinas.get(codigo)?.turmas || []).filter((t) => {
            if (
                $('somenteVagasGrade').checked &&
                !(t.vagas != null && t.matriculados != null && t.matriculados < t.vagas)
            )
                return false;
            return (
                !restrita || pedido?.permitidas == null || pedido.permitidas.includes(GradeCalculos.idTurma(codigo, t))
            );
        });
    }
    function pedidosGerador() {
        return (atual()?.disciplinas || [])
            .filter((d) => d.ativa !== false)
            .map((d) => ({ ...d, turmas: elegiveis(d.codigo) }));
    }
    function visiveis(codigo) {
        return elegiveis(codigo, false).filter(
            (t) =>
                !$('encaixeGrade').checked || compatibilidade.get(GradeCalculos.idTurma(codigo, t)) !== 'incompativel',
        );
    }
    function verificarEncaixes() {
        workerCompat?.terminate();
        workerCompat = null;
        $('estadoEncaixeGrade').textContent = '';
        if (!$('encaixeGrade').checked || !atual() || semestreCarregado !== atual().semestre) return;
        if (!('Worker' in window)) {
            $('estadoEncaixeGrade').textContent =
                'Verificação indisponível neste navegador; as turmas continuam visíveis.';
            return;
        }
        const candidatos = atual().disciplinas.flatMap((d) =>
            elegiveis(d.codigo, false).map((turma) => ({ codigo: d.codigo, turma })),
        );
        const ativo = new Worker(new URL('js/grade-worker.js', AppUnB.raiz));
        workerCompat = ativo;
        $('estadoEncaixeGrade').textContent = 'Verificando encaixes… Turmas ainda não verificadas continuam visíveis.';
        ativo.onmessage = ({ data }) => {
            if (workerCompat !== ativo) return;
            ativo.terminate();
            workerCompat = null;
            if (data.erro) {
                $('estadoEncaixeGrade').textContent =
                    'Não foi possível verificar os encaixes. As turmas continuam visíveis.';
                return;
            }
            compatibilidade = new Map(data.resultado.estados.map((s) => [s.id, s.estado]));
            $('estadoEncaixeGrade').textContent =
                data.resultado.truncado ||
                candidatos.length > 500 ||
                data.resultado.estados.some((s) => s.estado === 'desconhecido')
                    ? 'Verificação parcial. Encaixes não concluídos continuam visíveis.'
                    : 'Encaixes verificados com as matérias necessárias ativadas.';
            renderizarDisciplinas(atual());
        };
        ativo.onerror = () => {
            if (workerCompat === ativo) {
                ativo.terminate();
                workerCompat = null;
                $('estadoEncaixeGrade').textContent = 'Não foi possível verificar os encaixes. Tente novamente.';
            }
        };
        ativo.postMessage({ tipo: 'compatibilidade', pedidos: pedidosGerador(), candidatos: candidatos.slice(0, 500) });
    }
    function criarEditor(pedido, artigo) {
        const painel = el('div', 'grade-editor');
        const titulo = el('p', 'grade-editor-titulo', 'Turmas que o gerador pode usar');
        const busca = el('input', 'form-control');
        busca.type = 'search';
        busca.placeholder = 'Filtrar por professor, turma ou horário';
        busca.id = 'buscaEditorGrade';
        busca.value = editor.busca || '';
        busca.setAttribute('aria-label', `Filtrar turmas de ${pedido.codigo}`);
        const lista = el('div', 'grade-editor-lista');
        const contagem = el('p', 'grade-muted');
        let filtradas = [];
        function atualizar() {
            filtradas = visiveis(pedido.codigo).filter((t) =>
                normalizar(`${t.numero} ${professores(t)} ${t.horarios.join(' ')} ${t.local || ''}`).includes(
                    normalizar(busca.value),
                ),
            );
            lista.replaceChildren();
            filtradas.forEach((t) => {
                const id = GradeCalculos.idTurma(pedido.codigo, t);
                const rotulo = el('label', 'grade-checkbox grade-candidata');
                const check = el('input');
                check.id = `candidataGrade-${pedido.codigo}-${disciplinas.get(pedido.codigo).turmas.indexOf(t)}`;
                check.type = 'checkbox';
                check.checked = editor.ids.has(id);
                check.onchange = () => {
                    if (check.checked) editor.ids.add(id);
                    else editor.ids.delete(id);
                    contagem.textContent = `${filtradas.length} visíveis · ${editor.ids.size} marcadas`;
                };
                const pendente =
                    $('encaixeGrade').checked && !['compativel', 'incompativel'].includes(compatibilidade.get(id));
                rotulo.append(
                    check,
                    el(
                        'span',
                        '',
                        `${t.numero} · ${professores(t) || 'Docente não informado'}\n${t.horarios.join(' · ') || 'Sem horário'} · ${t.local || 'Local a definir'} · ${t.matriculados ?? '—'}/${t.vagas ?? '—'} matriculados${pendente ? ' · Encaixe ainda não verificado' : ''}`,
                    ),
                );
                lista.append(rotulo);
            });
            contagem.textContent = `${filtradas.length} visíveis · ${editor.ids.size} marcadas`;
        }
        busca.oninput = () => {
            editor.busca = busca.value;
            atualizar();
        };
        const acoes = el('div', 'grade-acoes');
        const marcacoes = el('div', 'grade-acoes');
        function botao(texto, classe, acao, id) {
            const b = el('button', `grade-botao ${classe}`, texto);
            b.type = 'button';
            b.id = `${id}-${pedido.codigo}`;
            b.onclick = acao;
            return b;
        }
        marcacoes.append(
            botao(
                'Marcar visíveis',
                '',
                () => {
                    filtradas.forEach((t) => editor.ids.add(GradeCalculos.idTurma(pedido.codigo, t)));
                    atualizar();
                },
                'marcarVisiveisGrade',
            ),
            botao(
                'Limpar marcações',
                '',
                () => {
                    editor.ids.clear();
                    atualizar();
                },
                'limparMarcacoesGrade',
            ),
        );
        acoes.append(
            botao(
                'Aplicar turmas',
                'grade-aplicar grade-principal',
                () => {
                    if (!editor.ids.size) {
                        mensagem(
                            'Selecione ao menos uma turma ou desative a matéria no gerador. Sua escolha anterior foi preservada.',
                        );
                        return;
                    }
                    const ids = [...editor.ids];
                    editor = null;
                    alterar((p) => {
                        p.disciplinas.find((d) => d.codigo === pedido.codigo).permitidas = ids;
                    });
                    mensagem('Turmas permitidas atualizadas. A turma da grade salva foi mantida.');
                    ($(`escolherGrade-${pedido.codigo}`) || $('buscaGrade')).focus({ preventScroll: true });
                },
                'aplicarTurmasGrade',
            ),
            botao(
                'Cancelar',
                '',
                () => {
                    editor = null;
                    renderizarDisciplinas(atual());
                    mensagem('Edição cancelada. As turmas permitidas foram mantidas.');
                    ($(`escolherGrade-${pedido.codigo}`) || $('buscaGrade')).focus({ preventScroll: true });
                },
                'cancelarTurmasGrade',
            ),
        );
        painel.append(titulo, busca, contagem, marcacoes, lista, acoes);
        artigo.append(painel);
        atualizar();
    }
    function renderizarDisciplinas(p) {
        const focoEditor = document.activeElement?.closest?.('.grade-materia') ? document.activeElement.id : '';
        const lista = $('disciplinasGrade');
        const abertas = new Set(
            [...lista.querySelectorAll('.grade-opcoes:not([hidden])')].map(
                (d) => d.closest('.grade-materia').dataset.codigo,
            ),
        );
        lista.replaceChildren();
        $('totalDesejadasGrade').textContent = `${p.disciplinas.length}/20`;
        $('planoVazioGrade').hidden = !!p.disciplinas.length;
        p.disciplinas.forEach((pedido, indice) => {
            const d = disciplinas.get(pedido.codigo);
            const salva = p.selecionadas.find((s) => s.codigo === pedido.codigo);
            const disponiveis = visiveis(pedido.codigo);
            if (
                ($('ocultarExtrasGrade').checked &&
                    !pedido.obrigatoria &&
                    pedido.ativa === false &&
                    !salva &&
                    editor?.codigo !== pedido.codigo) ||
                (!disponiveis.length &&
                    ($('encaixeGrade').checked || $('somenteVagasGrade').checked) &&
                    editor?.codigo !== pedido.codigo)
            )
                return;
            const artigo = el('article', 'grade-materia');
            artigo.dataset.codigo = pedido.codigo;
            const topo = el('div', 'grade-materia-cabecalho');
            const nome = el('div');
            const codigo = el('span', 'grade-codigo', pedido.codigo);
            codigo.style.color = cores[indice % cores.length];
            nome.append(el('h3', '', d?.nome || salva?.nome || pedido.codigo));
            const remover = el('button', 'grade-botao grade-remover', 'Remover do plano');
            remover.id = `removerGrade-${pedido.codigo}`;
            remover.type = 'button';
            remover.setAttribute('aria-label', `Remover ${d?.nome || pedido.codigo} do plano`);
            remover.onclick = () => {
                alterar((plano) => {
                    plano.disciplinas = plano.disciplinas.filter((x) => x.codigo !== pedido.codigo);
                    plano.selecionadas = plano.selecionadas.filter((x) => x.codigo !== pedido.codigo);
                });
                mensagem(`${pedido.codigo} removida do plano e da grade salva. Use Desfazer em Plano para restaurar.`);
                $('buscaGrade').focus();
                buscar();
            };
            topo.append(nome);
            const usarRotulo = el('label', 'grade-checkbox grade-usar');
            const usar = el('input');
            usar.id = `usarGrade${indice}`;
            usar.type = 'checkbox';
            usar.checked = pedido.ativa !== false;
            usar.onchange = () =>
                alterar((plano) => {
                    plano.disciplinas.find((d) => d.codigo === pedido.codigo).ativa = usar.checked;
                });
            usar.setAttribute('aria-label', `Usar ${d?.nome || pedido.codigo} no gerador`);
            usarRotulo.append(usar, el('span', '', 'Usar no gerador'));
            const rotulo = el('div', 'grade-campo');
            const prioridade = el('select', 'form-select grade-prioridade');
            prioridade.id = `obrigatoriaGrade${indice}`;
            for (const [valor, texto] of [
                ['obrigatoria', 'Obrigatória'],
                ['extra', 'Extra'],
            ]) {
                const opcao = el('option', '', texto);
                opcao.value = valor;
                opcao.selected = pedido.obrigatoria === (valor === 'obrigatoria');
                prioridade.append(opcao);
            }
            prioridade.onchange = () =>
                alterar((plano) => {
                    plano.disciplinas.find((x) => x.codigo === pedido.codigo).obrigatoria =
                        prioridade.value === 'obrigatoria';
                });
            const labelPrioridade = el('label', '', 'Prioridade no gerador');
            labelPrioridade.htmlFor = prioridade.id;
            rotulo.append(labelPrioridade, prioridade);
            const label = el('label', '', 'Turma da grade salva');
            label.htmlFor = `turmaGrade${indice}`;
            const select = el('select', 'form-select');
            select.id = label.htmlFor;
            const primeira = el('option', '', 'Nenhuma turma escolhida');
            primeira.value = '';
            select.append(primeira);
            const idSalvo = salva && GradeCalculos.idTurma(pedido.codigo, salva.turma);
            let localizada = false;
            for (const t of d?.turmas || []) {
                const id = GradeCalculos.idTurma(pedido.codigo, t);
                const opcao = el(
                    'option',
                    '',
                    `${t.numero} · ${t.horarios.join(' · ') || 'Sem horário'} · ${professores(t) || 'Docente não informado'}`,
                );
                opcao.value = id;
                select.append(opcao);
                if (id === idSalvo) localizada = true;
            }
            if (salva && !localizada) {
                const opcao = el('option', '', `${salva.turma.numero} · Escolha salva fora da oferta atual`);
                opcao.value = idSalvo;
                select.append(opcao);
            }
            select.value = idSalvo || '';
            select.disabled = !d;
            select.onchange = () =>
                alterar((plano) => {
                    plano.selecionadas = plano.selecionadas.filter((x) => x.codigo !== pedido.codigo);
                    const t = d.turmas.find((t) => GradeCalculos.idTurma(d.codigo, t) === select.value);
                    if (t) plano.selecionadas.push({ codigo: d.codigo, nome: d.nome, turma: copiar(t) });
                });
            artigo.append(usarRotulo, topo);
            const quantidade = el(
                'p',
                'grade-muted',
                `${disponiveis.length}/${d?.turmas.length || 0} turmas${pedido.permitidas == null ? '' : ` · ${pedido.permitidas.length} ${pedido.permitidas.length === 1 ? 'permitida' : 'permitidas'}`}${!pedido.obrigatoria ? ' · Extra' : ''}`,
            );
            const meta = el('div', 'grade-materia-meta');
            meta.append(codigo, quantidade, el('span', 'grade-muted', carga(pedido.codigo)));
            nome.append(meta);
            const escolher = el('button', 'grade-botao grade-escolher', 'Escolher turmas');
            escolher.id = `escolherGrade-${pedido.codigo}`;
            escolher.type = 'button';
            escolher.onclick = () => {
                if (editor) {
                    if (editor.codigo !== pedido.codigo)
                        mensagem('Aplique ou cancele a edição em andamento antes de escolher turmas de outra matéria.');
                    $('buscaEditorGrade')?.focus({ preventScroll: true });
                    return;
                }
                mensagem('');
                editor = { codigo: pedido.codigo, ids: new Set(pedido.permitidas || []) };
                renderizarDisciplinas(atual());
                $('buscaEditorGrade')?.focus({ preventScroll: true });
            };
            const todas = el('button', 'grade-botao grade-todas', 'Permitir todas no gerador');
            todas.id = `todasGrade-${pedido.codigo}`;
            todas.type = 'button';
            todas.onclick = () => {
                if (editor?.codigo === pedido.codigo) editor = null;
                alterar((plano) => {
                    plano.disciplinas.find((d) => d.codigo === pedido.codigo).permitidas = null;
                });
                mensagem('Todas as turmas foram permitidas no gerador. A turma da grade salva foi mantida.');
            };
            const opcoes = el('div', 'grade-opcoes');
            opcoes.id = `painelOpcoesGrade-${pedido.codigo}`;
            opcoes.hidden = !abertas.has(pedido.codigo);
            const abrirOpcoes = el('button', 'grade-botao grade-opcoes-botao', 'Opções');
            abrirOpcoes.id = `opcoesGrade-${pedido.codigo}`;
            abrirOpcoes.type = 'button';
            abrirOpcoes.setAttribute('aria-controls', opcoes.id);
            abrirOpcoes.setAttribute('aria-expanded', String(!opcoes.hidden));
            opcoes.setAttribute('role', 'region');
            opcoes.setAttribute('aria-labelledby', abrirOpcoes.id);
            abrirOpcoes.onclick = () => {
                opcoes.hidden = !opcoes.hidden;
                abrirOpcoes.setAttribute('aria-expanded', String(!opcoes.hidden));
            };
            const configuracao = el('div', 'grade-opcoes-conteudo');
            const manual = el('div', 'grade-campo');
            const ajudaManual = el('p', 'grade-muted', 'Não altera as turmas permitidas no gerador.');
            ajudaManual.id = `ajudaManualGrade-${pedido.codigo}`;
            select.setAttribute('aria-describedby', ajudaManual.id);
            manual.append(label, select, ajudaManual);
            const ajudaPrioridade = el(
                'p',
                'grade-muted',
                'Quando marcada no gerador: obrigatória entra em toda combinação; extra pode ficar de fora.',
            );
            ajudaPrioridade.id = `ajudaPrioridadeGrade-${pedido.codigo}`;
            prioridade.setAttribute('aria-describedby', ajudaPrioridade.id);
            rotulo.append(ajudaPrioridade);
            const acoesOpcoes = el('div', 'grade-acoes');
            acoesOpcoes.append(todas, remover);
            configuracao.append(rotulo, manual, acoesOpcoes);
            opcoes.append(configuracao);
            const acoes = el('div', 'grade-materia-acoes');
            acoes.append(escolher, abrirOpcoes);
            artigo.append(acoes, opcoes);
            if (pedido.permitidas && !elegiveis(pedido.codigo).length)
                artigo.append(
                    el(
                        'p',
                        'grade-conflito',
                        'Nenhuma turma permitida está elegível na oferta atual. A restrição foi preservada.',
                    ),
                );
            if (editor?.codigo === pedido.codigo) criarEditor(pedido, artigo);
            if (salva) {
                const vigente = d?.turmas.find((t) => GradeCalculos.idTurma(pedido.codigo, t) === idSalvo);
                const t = vigente || salva.turma;
                const vagas =
                    t.matriculados != null && t.vagas != null
                        ? `${t.matriculados}/${t.vagas} matriculados`
                        : 'Vagas não informadas';
                manual.append(
                    el(
                        'p',
                        'grade-muted grade-turma-resumo',
                        `${professores(t) || 'Docente não informado'}\n${t.horarios.join(' · ') || 'Horário não informado'} · ${t.local || 'Local não informado'}\n${vagas}`,
                    ),
                );
                if (!localizada && semestreCarregado)
                    artigo.append(
                        el(
                            'p',
                            'grade-conflito',
                            'Esta escolha não consta na oferta atual. O horário salvo foi preservado.',
                        ),
                    );
            } else if (!d) artigo.append(el('p', 'grade-muted', 'Disciplina ausente da oferta deste semestre.'));
            lista.append(artigo);
        });
        if (focoEditor) ($(focoEditor) || $('buscaGrade'))?.focus({ preventScroll: true });
    }
    function conflitos(p) {
        const conflitantes = new Set();
        const avisos = [];
        p.selecionadas.forEach((a, i) => {
            if (!GradeCalculos.parseHorario(a.turma.horarios).valido)
                avisos.push(
                    `${a.codigo}: horário não informado ou incompleto. Não é possível garantir a compatibilidade.`,
                );
            for (const b of p.selecionadas.slice(i + 1)) {
                if (GradeCalculos.haConflito(a.turma.horarios, b.turma.horarios)) {
                    conflitantes.add(a.codigo);
                    conflitantes.add(b.codigo);
                    avisos.push(`Conflito: ${a.codigo} e ${b.codigo} ocupam o mesmo horário.`);
                }
            }
        });
        $('conflitosGrade').replaceChildren(...avisos.map((s) => el('p', 'grade-conflito', s)));
        if (p.selecionadas.length && !avisos.length)
            $('conflitosGrade').append(el('p', 'grade-compatibilidade', 'Sem conflitos entre as turmas escolhidas.'));
        return conflitantes;
    }
    function eventos(p) {
        const resultado = [];
        for (const s of p.selecionadas) {
            const indice = p.disciplinas.findIndex((d) => d.codigo === s.codigo);
            const blocos = GradeCalculos.parseHorario(s.turma.horarios).blocos;
            for (const b of blocos) {
                const linha = GradeCalculos.periodos.findIndex((p) => p.periodo === b.periodo);
                const anterior = resultado.at(-1);
                if (
                    anterior &&
                    anterior.codigo === s.codigo &&
                    anterior.dia === b.dia &&
                    anterior.ultimaLinha + 1 === linha
                ) {
                    anterior.ultimaLinha = linha;
                    anterior.fim = b.fim;
                } else
                    resultado.push({
                        ...s,
                        dia: b.dia,
                        primeiraLinha: linha,
                        ultimaLinha: linha,
                        inicio: b.inicio,
                        fim: b.fim,
                        cor: cores[indice % cores.length],
                    });
            }
        }
        return resultado;
    }
    function semana(p, conflitantes) {
        const quadro = $('semanaGrade');
        quadro.replaceChildren();
        const dia = Number($('diaGrade').value);
        const visiveis = dia ? [dia] : dias;
        quadro.classList.toggle('grade-dia', !!dia);
        visiveis.forEach((d, indice) => {
            const titulo = el('div', 'grade-dia-titulo grade-celula', nomesDias[d]);
            titulo.style.gridColumn = indice + 2;
            titulo.style.gridRow = 1;
            quadro.append(titulo);
        });
        GradeCalculos.periodos.forEach((p, i) => {
            const rotulo = el('div', 'grade-hora grade-celula');
            rotulo.append(el('span', '', hora(p.inicio)), el('span', '', p.periodo));
            rotulo.style.gridRow = i + 2;
            rotulo.style.gridColumn = 1;
            quadro.append(rotulo);
            visiveis.forEach((_, coluna) => {
                const celula = el('div', 'grade-celula');
                celula.style.gridRow = i + 2;
                celula.style.gridColumn = coluna + 2;
                quadro.append(celula);
            });
        });
        const todos = eventos(p);
        for (const evento of todos.filter((e) => visiveis.includes(e.dia))) {
            const bloco = el('div', `grade-evento${conflitantes.has(evento.codigo) ? ' grade-evento-conflito' : ''}`);
            bloco.style.gridColumn = visiveis.indexOf(evento.dia) + 2;
            bloco.style.gridRow = `${evento.primeiraLinha + 2} / ${evento.ultimaLinha + 3}`;
            bloco.style.setProperty('--grade-evento-cor', evento.cor);
            bloco.title = `${evento.nome} · ${evento.turma.numero}\n${hora(evento.inicio)}–${hora(evento.fim)} · ${evento.turma.local || 'Local não informado'}`;
            bloco.append(el('strong', '', evento.codigo), el('span', '', `Turma ${evento.turma.numero}`));
            if (evento.ultimaLinha > evento.primeiraLinha)
                bloco.append(el('div', '', evento.turma.local || 'Local a definir'));
            quadro.append(bloco);
        }
    }
    function renderizar() {
        const foco = document.activeElement?.id;
        opcoesPlanos();
        const p = atual();
        $('desfazerGrade').disabled = !historico.passado.length;
        $('refazerGrade').disabled = !historico.futuro.length;
        if (!p) return;
        renderizarDisciplinas(p);
        $('resumoGrade').textContent = `${p.selecionadas.length} disciplina(s) escolhida(s)`;
        const horas = p.selecionadas.map((s) => componentes[s.codigo]?.cargaHoraria);
        if (horas.length && horas.every(Number.isFinite)) {
            const total = horas.reduce((a, b) => a + b, 0);
            $('resumoGrade').textContent += ` · ${AppUnB.numero(total)} h · ${AppUnB.numero(total / 15)} créditos`;
        }
        $('gerarGrade').disabled =
            !!worker || !p.disciplinas.some((d) => d.ativa !== false) || semestreCarregado !== p.semestre;
        $('exportarGradePng').disabled = !p.selecionadas.length;
        $('exportarGradeIcs').disabled = !p.selecionadas.length;
        $('montarGrade').disabled = !p.selecionadas.length;
        $('montarGrade').hidden = !p.selecionadas.length;
        if (planoVisualizado !== p.id || !p.selecionadas.length) planoVisualizado = '';
        const visualizando = planoVisualizado === p.id;
        document.querySelector('.grade-disciplinas').hidden = visualizando;
        document.querySelector('.grade-semana').hidden = !visualizando;
        if (visualizando) semana(p, conflitos(p));
        else $('semanaGrade').replaceChildren();
        if (foco && $(foco) && document.activeElement?.id !== foco) $(foco).focus({ preventScroll: true });
    }
    function baixar(conteudo, tipo, nome) {
        const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
        const link = el('a');
        link.href = url;
        link.download = nome;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function gerar(parcial = false) {
        cancelar();
        const pedidos = pedidosGerador();
        if (!('Worker' in window)) {
            mensagem(
                'Este navegador não suporta a geração automática. Você ainda pode escolher as turmas manualmente.',
            );
            return;
        }
        worker = new Worker(new URL('js/grade-worker.js', AppUnB.raiz));
        const ativo = worker;
        $('cancelarGrade').hidden = false;
        $('gerarGrade').disabled = true;
        $('combinacoesGrade').replaceChildren();
        $('estadoGeradorGrade').textContent = 'Procurando combinações…';
        worker.onmessage = ({ data }) => {
            if (worker !== ativo) return;
            cancelar();
            if (data.erro) {
                mensagem(data.erro);
                return;
            }
            geracoes = data.resultado.grupos;
            $('estadoGeradorGrade').textContent =
                `${geracoes.length} grade(s) com horários distintos.${data.resultado.truncado ? ' Busca parcial: podem existir outras grades e turmas equivalentes.' : ''} ${data.resultado.diagnostico || ''}${parcial ? ' Alternativas parciais: confira as matérias omitidas antes de aplicar.' : ''}`;
            $('parciaisGrade').hidden = parcial || !!geracoes.length || !pedidos.some((d) => d.obrigatoria);
            geracoes.forEach((combinacao, i) => {
                const linha = el('div', 'grade-combinacao');
                linha.append(el('p', '', `${i + 1}. ${combinacao.map((s) => s.codigo).join(' · ')}`));
                const escolhas = new Map(combinacao.map((s) => [s.codigo, s.turmas[0]]));
                const omitidas = pedidos.filter((d) => !escolhas.has(d.codigo));
                if (omitidas.length)
                    linha.append(
                        el('p', 'grade-muted', `Ficaram de fora: ${omitidas.map((d) => d.codigo).join(' · ')}`),
                    );
                const detalhes = el('details');
                detalhes.open = true;
                detalhes.append(el('summary', '', 'Turmas e professores deste horário'));
                combinacao.forEach((s, indice) => {
                    const rotulo = el(
                        'label',
                        'grade-muted',
                        `${s.codigo} · ${s.turmas.length} turma(s) neste horário`,
                    );
                    const select = el('select', 'form-select');
                    select.id = `alternativaGrade${i}-${indice}`;
                    rotulo.htmlFor = select.id;
                    s.turmas.forEach((t, n) => {
                        const opcao = el('option', '', `${t.numero} · ${professores(t)} · ${t.horarios.join(' · ')}`);
                        opcao.value = String(n);
                        select.append(opcao);
                    });
                    select.onchange = () => escolhas.set(s.codigo, s.turmas[Number(select.value)]);
                    detalhes.append(rotulo, select);
                });
                linha.append(detalhes);
                const usar = el('button', 'grade-botao', 'Usar');
                usar.type = 'button';
                usar.setAttribute('aria-label', `Usar combinação ${i + 1}`);
                usar.onclick = () =>
                    alterar((plano) => {
                        plano.selecionadas = combinacao.map((s) => ({
                            codigo: s.codigo,
                            turma: escolhas.get(s.codigo),
                            nome: disciplinas.get(s.codigo).nome,
                        }));
                    });
                linha.append(usar);
                $('combinacoesGrade').append(linha);
            });
        };
        worker.onerror = () => {
            if (worker !== ativo) return;
            cancelar();
            mensagem('Não foi possível gerar combinações. Tente novamente.');
            $('estadoGeradorGrade').textContent = '';
        };
        worker.postMessage({ tipo: 'gerar', pedidos, parcial });
    }
    function imagem() {
        const p = atual();
        const canvas = el('canvas');
        canvas.width = 1540;
        canvas.height = 1240;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#111215';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f0f1f4';
        ctx.font = 'bold 28px system-ui';
        ctx.fillText(`${p.nome} · ${p.semestre}`, 28, 42, 1480);
        ctx.font = '16px system-ui';
        ctx.fillStyle = '#adb2bd';
        ctx.fillText('Trajetória Unb · Planejamento pessoal', 28, 70);
        const left = 90,
            top = 120,
            col = (canvas.width - left - 50) / dias.length,
            row = 52;
        dias.forEach((d, i) => ctx.fillText(nomesDias[d], left + i * col + 8, top - 16));
        GradeCalculos.periodos.forEach((p, i) => {
            ctx.fillStyle = '#adb2bd';
            ctx.font = '13px system-ui';
            ctx.fillText(hora(p.inicio), 28, top + i * row + 22);
            ctx.strokeStyle = '#383b43';
            ctx.beginPath();
            ctx.moveTo(left, top + i * row);
            ctx.lineTo(left + col * dias.length, top + i * row);
            ctx.stroke();
        });
        const ocupacoes = new Map();
        for (const evento of eventos(p).filter((e) => dias.includes(e.dia))) {
            const x = left + dias.indexOf(evento.dia) * col;
            const y = top + evento.primeiraLinha * row;
            const n = ocupacoes.get(`${x}-${y}`) || 0;
            ocupacoes.set(`${x}-${y}`, n + 1);
            ctx.globalAlpha = n ? 0.75 : 1;
            ctx.fillStyle = '#263750';
            ctx.fillRect(x + 2, y + 2 + n * 18, col - 4, (evento.ultimaLinha - evento.primeiraLinha + 1) * row - 4);
            ctx.globalAlpha = 1;
            ctx.fillStyle = evento.cor;
            ctx.fillRect(x + 2, y + 2, 3, (evento.ultimaLinha - evento.primeiraLinha + 1) * row - 4);
            ctx.fillStyle = '#f0f1f4';
            ctx.font = 'bold 15px system-ui';
            ctx.fillText(`${evento.codigo} · ${evento.turma.numero}`, x + 10, y + 23 + n * 18, col - 18);
        }
        ctx.font = '14px system-ui';
        p.selecionadas.forEach((s, i) => {
            ctx.fillStyle = cores[p.disciplinas.findIndex((d) => d.codigo === s.codigo) % cores.length];
            const x = i < 10 ? 28 : 790;
            ctx.fillText(`${s.codigo} · ${s.nome} (${s.turma.numero})`, x, 930 + (i % 10) * 25, 720);
        });
        ctx.fillStyle = '#adb2bd';
        ctx.fillText($('conflitosGrade').textContent.slice(0, 180), 28, 1210, 1480);
        canvas.toBlob((blob) => {
            if (blob) baixar(blob, 'image/png', `grade-${p.semestre}.png`);
        }, 'image/png');
    }
    $('buscaGrade').addEventListener('input', buscar);
    $('montarGrade').onclick = () => {
        if (!atual()?.selecionadas.length) return;
        planoVisualizado = atual().id;
        renderizar();
        $('tituloSemanaGrade').focus();
    };
    $('editarGrade').onclick = () => {
        planoVisualizado = '';
        renderizar();
        $('buscaGrade').focus();
    };
    $('diaGrade').onchange = () => {
        const p = atual();
        if (p) semana(p, conflitos(p));
    };
    if (matchMedia('(max-width: 767px)').matches) $('diaGrade').value = '2';
    $('gerarGrade').onclick = () => gerar(false);
    $('parciaisGrade').onclick = () => gerar(true);
    $('cancelarGrade').onclick = () => {
        cancelar();
        $('estadoGeradorGrade').textContent = 'Busca cancelada.';
    };
    for (const id of ['somenteVagasGrade', 'encaixeGrade', 'ocultarExtrasGrade'])
        $(id).onchange = () => {
            const filtros = {
                vagas: $('somenteVagasGrade').checked,
                encaixe: $('encaixeGrade').checked,
                extras: $('ocultarExtrasGrade').checked,
            };
            alterar((p) => {
                p.filtros = filtros;
            });
        };
    $('novoPlanoGrade').onclick = () => {
        if (historico.atual.planos.length >= 20) {
            mensagem('Você pode guardar até 20 planos. Exporte um backup e exclua um plano para criar outro.');
            return;
        }
        const plano = novoPlano(atual()?.semestre || catalogo[0]?.semestre);
        if (!plano.semestre) return;
        registrar({ ...historico.atual, ativo: plano.id, planos: [...historico.atual.planos, plano] });
    };
    $('nomePlanoGrade').onchange = () => {
        const nome = $('nomePlanoGrade').value.trim();
        if (nome)
            alterar((p) => {
                p.nome = nome;
            });
        else renderizar();
    };
    $('excluirPlanoGrade').onclick = () => {
        const planos = historico.atual.planos.filter((p) => p.id !== atual().id);
        if (!planos.length) planos.push(novoPlano(atual().semestre));
        registrar({ versao: 1, ativo: planos[0].id, planos });
        if (semestreCarregado !== atual().semestre) carregarOferta(atual().semestre);
        mensagem('Plano excluído. Use Desfazer para restaurá-lo.');
    };
    $('planoGrade').onchange = () => {
        registrar({ ...historico.atual, ativo: $('planoGrade').value });
        if (semestreCarregado !== atual().semestre) carregarOferta(atual().semestre);
    };
    $('semestreGrade').onchange = () => {
        const semestre = $('semestreGrade').value;
        const existente = historico.atual.planos.find((p) => p.semestre === semestre);
        if (existente) registrar({ ...historico.atual, ativo: existente.id });
        else {
            if (historico.atual.planos.length >= 20) {
                mensagem('Limite de 20 planos. Exclua um plano para usar outro semestre.');
                renderizar();
                return;
            }
            const p = novoPlano(semestre);
            registrar({ ...historico.atual, ativo: p.id, planos: [...historico.atual.planos, p] });
        }
        carregarOferta(semestre);
    };
    for (const [id, metodo] of [
        ['desfazerGrade', 'desfazer'],
        ['refazerGrade', 'refazer'],
    ])
        $(id).onclick = () => {
            cancelar();
            historico = GradeArquivos[metodo](historico);
            AppUnB.salvar(chave, historico.atual);
            $('combinacoesGrade').replaceChildren();
            $('estadoGeradorGrade').textContent = '';
            $('parciaisGrade').hidden = true;
            editor = null;
            compatibilidade.clear();
            renderizar();
            buscar();
            verificarEncaixes();
            if (atual() && semestreCarregado !== atual().semestre) carregarOferta(atual().semestre);
        };
    for (const [id, campo] of [
        ['inicioGrade', 'inicio'],
        ['fimGrade', 'fim'],
    ])
        $(id).onchange = () => {
            try {
                alterar((p) => {
                    p[campo] = $(id).value;
                });
            } catch (erro) {
                mensagem(erro.message);
                renderizar();
            }
        };
    $('exportarGradeJson').onclick = () =>
        baixar(JSON.stringify(historico.atual, null, 2), 'application/json', 'trajetoria-planos.json');
    $('importarGradeJson').onclick = () => $('arquivoGrade').click();
    $('arquivoGrade').onchange = async () => {
        const arquivo = $('arquivoGrade').files[0];
        if (!arquivo) return;
        try {
            if (arquivo.size > 1024 * 1024) throw new Error('Use um arquivo JSON de até 1 MB.');
            const backup = GradeArquivos.validarBackup(JSON.parse(await arquivo.text()));
            if (!backup.planos.length) throw new Error('O arquivo não contém planos.');
            editor = null;
            registrar(backup);
            await carregarOferta(atual().semestre);
            mensagem('Planos importados. Use Desfazer para voltar aos planos anteriores.');
        } catch (erro) {
            mensagem(
                `Importação cancelada. ${erro instanceof SyntaxError ? 'O arquivo não é um JSON válido.' : erro.message}`,
            );
        }
        $('arquivoGrade').value = '';
    };
    $('exportarGradeIcs').onclick = () => {
        try {
            baixar(GradeArquivos.calendario(atual()), 'text/calendar;charset=utf-8', `grade-${atual().semestre}.ics`);
        } catch (erro) {
            mensagem(`Confira as datas e os horários antes de exportar. ${erro.message}`);
        }
    };
    $('exportarGradePng').onclick = imagem;
    async function iniciar() {
        try {
            const dados = await json('data/turmas/index.json');
            catalogo = [...dados.semestres].sort((a, b) => b.semestre.localeCompare(a.semestre));
            $('semestreGrade').replaceChildren(
                ...catalogo.map((s) => {
                    const opcao = el('option', '', s.semestre);
                    opcao.value = s.semestre;
                    return opcao;
                }),
            );
            $('semestreGrade').disabled = !catalogo.length;
            if (!atual() && catalogo.length) {
                const p = novoPlano(catalogo[0].semestre);
                historico = GradeArquivos.criarHistorico({ versao: 1, ativo: p.id, planos: [p] });
            }
            if (atual()) await carregarOferta(atual().semestre);
            else $('ofertaGrade').textContent = 'Nenhuma oferta publicada ainda.';
        } catch (erro) {
            $('ofertaGrade').textContent = erro.message;
        }
        try {
            componentes = (await json('data/turmas/componentes.json')).componentes || {};
            renderizar();
        } catch {
            /* A carga curricular é opcional; nunca é estimada pelo horário. */
        }
    }
    iniciar();
})();
