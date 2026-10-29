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
    const itemValido = (item) =>
        item &&
        typeof item.semestre === 'string' &&
        /^\d{4}\.[12]$/.test(item.semestre) &&
        typeof item.arquivo === 'string' &&
        /^[A-Za-z0-9_-]+\.json$/.test(item.arquivo);
    let catalogo = [];
    let disciplinas = new Map();
    let componentes = {};
    let semestreCarregado = '';
    let carregamento = 0;
    let worker;
    let historico;
    let geracoes = [];
    let modo = location.pathname?.includes('gerador-grade') ? 'gerador' : 'manual';
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
        const data = new Date().toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
        const base = `Grade · ${data.replace(',', '')}`;
        let nome = base;
        for (let n = 2; historico.atual.planos.some((p) => p.nome === nome); n++) nome = `${base} (${n})`;
        return {
            id: crypto.randomUUID(),
            nome,
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
        mensagem('');
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
        $('ofertaGrade').hidden = false;
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
            $('ofertaGrade').textContent = '';
            $('ofertaGrade').hidden = true;
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
                const opcao = el('option', '', p.nome);
                opcao.value = p.id;
                return opcao;
            }),
        );
        const nova = el('option', '', 'Criar nova grade');
        let valorNovo = '__nova_grade__';
        while (historico.atual.planos.some((p) => p.id === valorNovo)) valorNovo += '_';
        nova.value = valorNovo;
        nova.dataset.acao = 'novo';
        $('planoGrade').append(nova);
        $('planoGrade').value = historico.atual.ativo;
        const p = atual();
        if (!p) return;
        if (![...$('semestreGrade').options].some((o) => o.value === p.semestre)) {
            const opcao = el('option', '', `${p.semestre} (backup)`);
            opcao.value = p.semestre;
            $('semestreGrade').append(opcao);
        }
        $('semestreGrade').value = p.semestre;
        if ($('inicioGrade')) $('inicioGrade').value = p.inicio;
        if ($('fimGrade')) $('fimGrade').value = p.fim;
        $('somenteVagasGrade').checked = p.filtros?.vagas || false;
        $('encaixeGrade').checked = p.filtros?.encaixe || false;
        $('ocultarExtrasGrade').checked = p.filtros?.extras || false;
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
            const prioridade = el('select', 'form-select grade-adicionar-prioridade');
            prioridade.setAttribute('aria-label', `Prioridade de ${d.nome}`);
            for (const [valor, texto] of [
                ['obrigatoria', 'Obrigatória'],
                ['extra', 'Extra'],
            ]) {
                const op = el('option', '', texto);
                op.value = valor;
                prioridade.append(op);
            }
            prioridade.disabled = escolhidas.has(d.codigo);
            const botao = el('button', 'grade-botao', escolhidas.has(d.codigo) ? 'No plano' : 'Adicionar');
            botao.type = 'button';
            botao.disabled = escolhidas.has(d.codigo) || escolhidas.size >= 20;
            botao.setAttribute('aria-label', `Adicionar ${d.nome}`);
            botao.onclick = () => {
                alterar((p) => p.disciplinas.push({ codigo: d.codigo, obrigatoria: prioridade.value !== 'extra' }));
                $('buscaGrade').value = '';
                resultados.replaceChildren();
                const campo = document.querySelector(`[data-codigo="${CSS.escape(d.codigo)}"] .grade-escolher`);
                campo?.focus();
            };
            linha.append(prioridade, botao);
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
        if (escolhidas.size >= 20)
            resultados.append(
                el('p', 'grade-muted', 'Este plano já tem 20 disciplinas. Remova uma para adicionar outra.'),
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
                !$('encaixeGrade').checked ||
                (modo === 'manual'
                    ? estadoManual(codigo, t)
                    : compatibilidade.get(GradeCalculos.idTurma(codigo, t))) !== 'incompativel',
        );
    }
    function estadoManual(codigo, turma) {
        const outras = atual().selecionadas.filter((s) => s.codigo !== codigo);
        if (outras.some((s) => GradeCalculos.haConflito(turma.horarios, s.turma.horarios))) return 'incompativel';
        if (
            !GradeCalculos.parseHorario(turma.horarios).valido ||
            outras.some((s) => !GradeCalculos.parseHorario(s.turma.horarios).valido)
        )
            return 'desconhecido';
        return 'compativel';
    }
    function verificarEncaixes() {
        workerCompat?.terminate();
        workerCompat = null;
        $('estadoEncaixeGrade').textContent = '';
        if (!$('encaixeGrade').checked || !atual() || semestreCarregado !== atual().semestre) return;
        if (modo === 'manual') return;
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
        painel.id = `turmasGeradorGrade-${pedido.codigo}`;
        painel.hidden = !!editor.recolhido;
        painel.setAttribute('role', 'region');
        painel.setAttribute('aria-labelledby', `escolherGrade-${pedido.codigo}`);
        const titulo = el('p', 'grade-editor-titulo', 'Escolha as turmas que aceita nesta disciplina');
        const lista = el('tbody');
        const tabela = el('table', 'grade-turmas-tabela');
        const head = el('thead');
        const titulos = el('tr');
        head.append(titulos);
        tabela.append(head, lista);
        const rolagem = el('div', 'grade-editor-lista grade-manual-turmas');
        rolagem.append(tabela);
        const contagem = el('p', 'grade-muted');
        let filtradas = [];
        function atualizar() {
            filtradas = visiveis(pedido.codigo);
            lista.replaceChildren();
            const vagasVisiveis =
                !filtradas.length ||
                !filtradas.every((t) => t.matriculados === 0 && Number.isFinite(t.vagas) && t.vagas > 0);
            titulos.replaceChildren();
            for (const texto of [
                'Turma',
                'Professor(a)',
                'Horário',
                'Local',
                ...(vagasVisiveis ? ['Vagas'] : []),
                'Selecionar',
            ]) {
                const th = el('th', '', texto === 'Selecionar' ? '' : texto);
                th.scope = 'col';
                if (texto === 'Selecionar') th.append(el('span', 'visually-hidden', texto));
                titulos.append(th);
            }
            filtradas.forEach((t) => {
                const id = GradeCalculos.idTurma(pedido.codigo, t);
                const rotulo = el('tr', 'grade-candidata');
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
                const celula = el('td');
                const label = el('label', 'grade-checkbox grade-checkbox-tabela');
                check.className = 'visually-hidden';
                check.setAttribute('aria-label', `Permitir turma ${t.numero} de ${pedido.codigo}`);
                const marca = el('span', 'grade-checkbox-marca');
                marca.setAttribute('aria-hidden', 'true');
                label.append(check, marca);
                celula.append(label);
                rotulo.append(
                    el('td', '', t.numero),
                    el('td', '', professores(t) || 'Docente não informado'),
                    el('td', '', t.horarios.join(' · ') || 'Não informado'),
                    el('td', '', t.local || 'A definir'),
                );
                if (vagasVisiveis) rotulo.append(el('td', 'grade-vagas', `${t.matriculados ?? '—'}/${t.vagas ?? '—'}`));
                if (pendente) rotulo.title = 'Encaixe ainda não verificado';
                rotulo.append(celula);
                lista.append(rotulo);
            });
            contagem.textContent = `${filtradas.length} visíveis · ${editor.ids.size} marcadas`;
        }
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
        painel.append(titulo, contagem, marcacoes, rolagem, acoes);
        artigo.append(painel);
        atualizar();
        return painel;
    }
    function salvarTurma(codigo, turma) {
        const conflitantes = turma
            ? atual().selecionadas.filter(
                  (s) => s.codigo !== codigo && GradeCalculos.haConflito(turma.horarios, s.turma.horarios),
              )
            : [];
        function aplicar() {
            alterar((p) => {
                p.selecionadas = p.selecionadas.filter(
                    (s) => s.codigo !== codigo && !conflitantes.some((c) => c.codigo === s.codigo),
                );
                if (turma) p.selecionadas.push({ codigo, nome: disciplinas.get(codigo).nome, turma: copiar(turma) });
            });
        }
        if (!conflitantes.length) {
            aplicar();
            return;
        }
        confirmarAcao(
            'Conflito de horário',
            `A turma ${turma.numero} de ${disciplinas.get(codigo)?.nome || codigo} conflita com ${conflitantes.map((c) => (c.nome || disciplinas.get(c.codigo)?.nome || c.codigo) + ' (turma ' + c.turma.numero + ')').join(', ')}. Substituir essas escolhas?`,
            'Confirmar substituição',
            aplicar,
        );
    }
    function confirmarAcao(tituloTexto, texto, rotulo, aplicar) {
        const dialog = el('dialog', 'grade-confirmacao');
        const titulo = el('h2', '', tituloTexto);
        titulo.id = 'tituloConfirmacaoGrade';
        dialog.setAttribute('aria-labelledby', titulo.id);
        dialog.append(titulo, el('p', '', texto));
        const cancelar = el('button', 'grade-botao', 'Cancelar');
        cancelar.type = 'button';
        cancelar.onclick = () => dialog.close();
        const confirmar = el('button', 'grade-botao grade-principal', rotulo);
        confirmar.type = 'button';
        confirmar.onclick = () => {
            aplicar();
            dialog.close();
        };
        const acoes = el('div', 'grade-acoes');
        acoes.append(cancelar, confirmar);
        dialog.append(acoes);
        const foco = document.activeElement;
        dialog.addEventListener('close', () => {
            dialog.remove();
            if (foco?.isConnected) foco.focus();
            else document.getElementById('buscaGrade').focus();
        });
        dialog.addEventListener('click', (e) => {
            const r = dialog.getBoundingClientRect();
            if (
                e.target === dialog &&
                (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            )
                dialog.close();
        });
        document.body.append(dialog);
        dialog.showModal();
        cancelar.focus();
    }
    function turmasManuais(pedido, artigo) {
        const painel = el('div', 'grade-manual-turmas');
        const tabela = el('table', 'grade-turmas-tabela');
        const legenda = el('caption', 'visually-hidden', `Turmas de ${pedido.codigo}`);
        const head = el('thead');
        const titulos = el('tr');
        head.append(titulos);
        const corpo = el('tbody');
        const salva = atual().selecionadas.find((s) => s.codigo === pedido.codigo);
        const turmas = visiveis(pedido.codigo);
        if (
            salva &&
            !turmas.some(
                (t) => GradeCalculos.idTurma(pedido.codigo, t) === GradeCalculos.idTurma(pedido.codigo, salva.turma),
            )
        )
            turmas.unshift(salva.turma);
        const mostrarVagas =
            !turmas.length || !turmas.every((t) => t.matriculados === 0 && Number.isFinite(t.vagas) && t.vagas > 0);
        const colunas = ['Turma', 'Professor(a)', 'Horário', 'Local', ...(mostrarVagas ? ['Vagas'] : []), 'Escolher'];
        for (const texto of colunas) {
            const th = el('th', '', texto === 'Escolher' ? '' : texto);
            if (texto === 'Escolher') th.append(el('span', 'visually-hidden', 'Selecionar turma'));
            if (texto === 'Vagas') th.title = 'Matriculados / total de vagas';
            th.scope = 'col';
            titulos.append(th);
        }
        for (const t of turmas) {
            const escolhida =
                !!salva &&
                GradeCalculos.idTurma(pedido.codigo, salva.turma) === GradeCalculos.idTurma(pedido.codigo, t);
            const linha = el('tr', escolhida ? 'grade-turma-escolhida' : '');
            const numero = el('td', '', t.numero);
            const docente = el('td', '', professores(t) || 'Docente não informado');
            const horario = el('td', '', t.horarios.join(' · ') || 'Não informado');
            const local = el('td', '', t.local || 'A definir');
            const acao = el('td');
            const botao = el(
                'button',
                `grade-botao grade-selecionar-turma${escolhida ? ' grade-retirar-turma' : ''}`,
                escolhida ? '−' : '+',
            );
            botao.type = 'button';
            botao.id = `turmaManual-${pedido.codigo}-${turmas.indexOf(t)}`;
            botao.setAttribute('aria-pressed', String(escolhida));
            botao.setAttribute(
                'aria-label',
                `${escolhida ? 'Retirar' : 'Adicionar'} turma ${t.numero} de ${pedido.codigo}`,
            );
            botao.onclick = () => {
                salvarTurma(pedido.codigo, escolhida ? null : t);
                document.getElementById(botao.id)?.focus({ preventScroll: true });
            };
            acao.append(botao);
            linha.append(numero, docente, horario, local);
            if (mostrarVagas) linha.append(el('td', 'grade-vagas', `${t.matriculados ?? '—'}/${t.vagas ?? '—'}`));
            linha.append(acao);
            corpo.append(linha);
        }
        tabela.append(legenda, head, corpo);
        painel.append(tabela);
        if (!turmas.length) painel.append(el('p', 'grade-muted', 'Nenhuma turma com estes filtros.'));
        artigo.append(painel);
    }
    function materiaManual(pedido, artigo, nome, salva, disponiveis, remover) {
        artigo.classList.add('grade-materia-manual');
        nome.classList.add('grade-disciplina-identificacao');
        nome.prepend(el('span', 'grade-codigo', pedido.codigo));
        const prioridade = el('button', 'grade-botao grade-prioridade', pedido.obrigatoria ? 'Obrigatória' : 'Extra');
        prioridade.type = 'button';
        prioridade.setAttribute('aria-pressed', String(!pedido.obrigatoria));
        prioridade.setAttribute('aria-label', `Alternar prioridade de ${pedido.codigo}`);
        prioridade.onclick = () =>
            alterar((p) => {
                p.disciplinas.find((d) => d.codigo === pedido.codigo).obrigatoria = !pedido.obrigatoria;
            });
        remover.textContent = '';
        remover.classList.add('grade-remover-disciplina');
        remover.title = 'Remover disciplina';
        const acoes = el('div', 'grade-materia-acoes');
        acoes.append(prioridade, remover);
        artigo.querySelector('.grade-materia-cabecalho').append(acoes);
        turmasManuais(pedido, artigo);
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
        $('planoVazioGrade').hidden = !!p.disciplinas.length;
        [...p.disciplinas]
            .sort((a, b) => Number(b.obrigatoria) - Number(a.obrigatoria))
            .forEach((pedido, indice) => {
                const d = disciplinas.get(pedido.codigo);
                const salva = p.selecionadas.find((s) => s.codigo === pedido.codigo);
                const disponiveis = visiveis(pedido.codigo);
                if (
                    ($('ocultarExtrasGrade').checked &&
                        !pedido.obrigatoria &&
                        (modo === 'manual' || pedido.ativa === false) &&
                        !salva &&
                        editor?.codigo !== pedido.codigo) ||
                    (!disponiveis.length &&
                        ($('encaixeGrade').checked || $('somenteVagasGrade').checked) &&
                        !salva &&
                        editor?.codigo !== pedido.codigo)
                )
                    return;
                const artigo = el('article', 'grade-materia');
                artigo.dataset.codigo = pedido.codigo;
                const topo = el('div', 'grade-materia-cabecalho');
                const nome = el('div');
                const codigo = el('span', 'grade-codigo', pedido.codigo);
                codigo.style.setProperty('--grade-cor', cores[indice % cores.length]);
                nome.append(el('h3', '', d?.nome || salva?.nome || pedido.codigo));
                const remover = el('button', 'grade-botao grade-remover', 'Remover do plano');
                remover.id = `removerGrade-${pedido.codigo}`;
                remover.type = 'button';
                remover.setAttribute('aria-label', `Remover ${d?.nome || pedido.codigo} do plano`);
                remover.onclick = () =>
                    confirmarAcao(
                        'Remover disciplina?',
                        `Remover ${d?.nome || salva?.nome || pedido.codigo} e suas escolhas deste plano?`,
                        'Remover disciplina',
                        () => {
                            if (editor?.codigo === pedido.codigo) editor = null;
                            alterar((plano) => {
                                plano.disciplinas = plano.disciplinas.filter((x) => x.codigo !== pedido.codigo);
                                plano.selecionadas = plano.selecionadas.filter((x) => x.codigo !== pedido.codigo);
                            });
                            mensagem(`${pedido.codigo} removida. Use Desfazer para restaurar.`);
                            $('buscaGrade').focus();
                            buscar();
                        },
                    );
                topo.append(nome);
                if (modo === 'manual') {
                    artigo.append(topo);
                    materiaManual(pedido, artigo, nome, salva, disponiveis, remover);
                    lista.append(artigo);
                    return;
                }
                const usarRotulo = el('label', 'grade-checkbox grade-usar');
                const usar = el('input');
                usar.id = `usarGrade${indice}`;
                usar.type = 'checkbox';
                usar.checked = pedido.ativa !== false;
                usar.onchange = () =>
                    alterar((plano) => {
                        plano.disciplinas.find((d) => d.codigo === pedido.codigo).ativa = usar.checked;
                    });
                usar.setAttribute('aria-label', `Incluir ${d?.nome || pedido.codigo} nas combinações`);
                usarRotulo.append(usar, el('span', '', 'Incluir'));
                const prioridade = el(
                    'button',
                    'grade-botao grade-prioridade',
                    pedido.obrigatoria ? 'Obrigatória' : 'Extra',
                );
                prioridade.id = `obrigatoriaGrade${indice}`;
                prioridade.type = 'button';
                prioridade.setAttribute('aria-pressed', String(!pedido.obrigatoria));
                prioridade.setAttribute('aria-label', `Usar ${pedido.codigo} como matéria extra`);
                prioridade.title = 'Alternar obrigatória/extra no gerador';
                prioridade.onclick = () =>
                    alterar((plano) => {
                        plano.disciplinas.find((x) => x.codigo === pedido.codigo).obrigatoria = !pedido.obrigatoria;
                    });
                artigo.classList.add('grade-materia-manual');
                artigo.append(topo);
                const quantidade = el(
                    'p',
                    'grade-muted',
                    `${disponiveis.length}/${d?.turmas.length || 0} turmas${pedido.permitidas == null ? '' : ` · ${pedido.permitidas.length} ${pedido.permitidas.length === 1 ? 'permitida' : 'permitidas'}`}`,
                );
                const meta = el('div', 'grade-materia-meta');
                nome.classList.add('grade-disciplina-identificacao');
                nome.prepend(codigo);
                meta.append(quantidade, el('span', 'grade-muted', carga(pedido.codigo)));
                meta.style.flexBasis = '100%';
                nome.append(meta);
                const escolher = el('button', 'grade-botao grade-escolher grade-seta');
                escolher.id = `escolherGrade-${pedido.codigo}`;
                escolher.type = 'button';
                escolher.setAttribute('aria-controls', `turmasGeradorGrade-${pedido.codigo}`);
                escolher.setAttribute('aria-expanded', String(editor?.codigo === pedido.codigo && !editor.recolhido));
                escolher.setAttribute(
                    'aria-label',
                    `${editor?.codigo === pedido.codigo && !editor.recolhido ? 'Ocultar' : 'Ver'} turmas de ${d?.nome || pedido.codigo}`,
                );
                escolher.onclick = () => {
                    if (editor) {
                        if (editor.codigo !== pedido.codigo) {
                            mensagem(
                                'Aplique ou cancele a edição em andamento antes de escolher turmas de outra matéria.',
                            );
                            editor.recolhido = false;
                        } else editor.recolhido = !editor.recolhido;
                        renderizarDisciplinas(atual());
                        $(`escolherGrade-${editor.codigo}`)?.focus({ preventScroll: true });
                        return;
                    }
                    mensagem('');
                    editor = { codigo: pedido.codigo, ids: new Set(pedido.permitidas || []) };
                    renderizarDisciplinas(atual());
                    $(`escolherGrade-${pedido.codigo}`)?.focus({ preventScroll: true });
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
                const acoesOpcoes = el('div', 'grade-acoes');
                acoesOpcoes.append(todas, remover);
                configuracao.append(acoesOpcoes);
                opcoes.append(configuracao);
                const acoes = el('div', 'grade-materia-acoes');
                topo.append(escolher);
                acoes.append(usarRotulo, prioridade, abrirOpcoes);
                if (pedido.permitidas && !elegiveis(pedido.codigo).length)
                    artigo.append(
                        el(
                            'p',
                            'grade-conflito',
                            'Nenhuma turma permitida está elegível na oferta atual. A restrição foi preservada.',
                        ),
                    );
                let painelTurmas;
                if (editor?.codigo === pedido.codigo) painelTurmas = criarEditor(pedido, artigo);
                else {
                    painelTurmas = el('div');
                    painelTurmas.id = `turmasGeradorGrade-${pedido.codigo}`;
                    painelTurmas.hidden = true;
                    artigo.append(painelTurmas);
                }
                painelTurmas.prepend(acoes);
                painelTurmas.append(opcoes);
                if (!d) artigo.append(el('p', 'grade-muted', 'Disciplina ausente da oferta deste semestre.'));
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
                    `${a.nome || a.codigo}: horário não informado ou incompleto. Não é possível garantir a compatibilidade.`,
                );
            for (const b of p.selecionadas.slice(i + 1)) {
                if (GradeCalculos.haConflito(a.turma.horarios, b.turma.horarios)) {
                    conflitantes.add(a.codigo);
                    conflitantes.add(b.codigo);
                    avisos.push(`Conflito: ${a.nome || a.codigo} e ${b.nome || b.codigo} ocupam o mesmo horário.`);
                }
            }
        });
        $('conflitosGrade').replaceChildren(...avisos.map((s) => el('p', 'grade-conflito', s)));
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
    function periodosDaGrade(p) {
        const usados = new Set(
            p.selecionadas.flatMap((s) => GradeCalculos.parseHorario(s.turma.horarios).blocos.map((b) => b.periodo)),
        );
        return GradeCalculos.periodos.filter(
            (p) => (!p.periodo.startsWith('N') && p.periodo !== 'T6') || usados.has(p.periodo),
        );
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
        const periodosVisiveis = periodosDaGrade(p);
        quadro.style.gridTemplateRows = `38px repeat(${periodosVisiveis.length}, 42px)`;
        periodosVisiveis.forEach((p, i) => {
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
            bloco.style.gridRow = `${periodosVisiveis.indexOf(GradeCalculos.periodos[evento.primeiraLinha]) + 2} / ${periodosVisiveis.indexOf(GradeCalculos.periodos[evento.ultimaLinha]) + 3}`;
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
        $('excluirPlanoGrade').disabled = !p;
        $('exportarGradeJson').disabled = !historico.atual.planos.length;
        $('planoGrade').disabled = !p && !catalogo.length;
        $('modoManualGrade').disabled = !p;
        $('modoGeradorGrade').disabled = !p;
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
        if ($('exportarGradeIcs')) $('exportarGradeIcs').disabled = !p.selecionadas.length;
        $('modoManualGrade').setAttribute('aria-pressed', String(modo === 'manual'));
        $('modoGeradorGrade').setAttribute('aria-pressed', String(modo === 'gerador'));
        $('painelGeradorGrade').hidden = modo !== 'gerador';
        $('planoVazioGrade').textContent =
            modo === 'manual'
                ? 'Adicione sua primeira disciplina para escolher uma turma.'
                : 'Adicione as disciplinas que quer cursar. Depois escolha quais turmas podem entrar nas combinações.';
        document.querySelector('.grade-semana').hidden = !p.selecionadas.length;
        if (p.selecionadas.length) semana(p, conflitos(p));
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
                const usar = el('button', 'grade-botao', 'Usar esta grade');
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
        const periodos = periodosDaGrade(p);
        const fimQuadro = 120 + periodos.length * 52;
        const canvas = el('canvas');
        canvas.width = 1540;
        canvas.height = fimQuadro + Math.min(10, p.selecionadas.length) * 25 + 70;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#111215';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f0f1f4';
        ctx.font = 'bold 28px system-ui';
        ctx.fillText(p.nome, 28, 42, 1480);
        ctx.font = '16px system-ui';
        ctx.fillStyle = '#adb2bd';
        ctx.fillText('Trajetória Unb · Planejamento pessoal', 28, 70);
        const left = 90,
            top = 120,
            col = (canvas.width - left - 50) / dias.length,
            row = 52;
        dias.forEach((d, i) => ctx.fillText(nomesDias[d], left + i * col + 8, top - 16));
        periodos.forEach((p, i) => {
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
            const y = top + periodos.indexOf(GradeCalculos.periodos[evento.primeiraLinha]) * row;
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
            ctx.fillText(`${s.codigo} · ${s.nome} (${s.turma.numero})`, x, fimQuadro + 35 + (i % 10) * 25, 720);
        });
        ctx.fillStyle = '#adb2bd';
        ctx.fillText($('conflitosGrade').textContent.slice(0, 180), 28, canvas.height - 25, 1480);
        canvas.toBlob((blob) => {
            if (blob) baixar(blob, 'image/png', `grade-${p.semestre}.png`);
        }, 'image/png');
    }
    $('buscaGrade').addEventListener('input', buscar);
    function mudarModo(proximo) {
        if (modo === proximo) return;
        modo = proximo;
        cancelar();
        workerCompat?.terminate();
        workerCompat = null;
        compatibilidade.clear();
        $('estadoEncaixeGrade').textContent = '';
        renderizar();
        verificarEncaixes();
    }
    $('modoManualGrade').onclick = () => {
        if (modo === 'manual') return;
        if (location.pathname) location.href = new URL('grade/', AppUnB.raiz).href;
        else mudarModo('manual');
    };
    $('modoGeradorGrade').onclick = () => {
        if (modo === 'gerador') return;
        if (location.pathname) location.href = new URL('gerador-grade/', AppUnB.raiz).href;
        else mudarModo('gerador');
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
    function criarPlano() {
        if (historico.atual.planos.length >= 20) {
            mensagem('Você pode guardar até 20 planos. Exporte um backup e exclua um plano para criar outro.');
            renderizar();
            return;
        }
        const plano = novoPlano(atual()?.semestre || catalogo[0]?.semestre);
        if (!plano.semestre) return;
        registrar({ ...historico.atual, ativo: plano.id, planos: [...historico.atual.planos, plano] });
    }
    $('excluirPlanoGrade').onclick = () => {
        const planos = historico.atual.planos.filter((p) => p.id !== atual().id);
        if (!planos.length) planos.push(novoPlano(atual().semestre));
        registrar({ versao: 1, ativo: planos[0].id, planos });
        if (semestreCarregado !== atual().semestre) carregarOferta(atual().semestre);
        mensagem('Plano excluído. Use Desfazer para restaurá-lo.');
    };
    $('planoGrade').onchange = () => {
        const opcao = [...$('planoGrade').options].find((o) => o.value === $('planoGrade').value);
        if (opcao?.dataset.acao === 'novo') {
            criarPlano();
            return;
        }
        if (!historico.atual.planos.some((p) => p.id === $('planoGrade').value)) {
            renderizar();
            return;
        }
        registrar({ ...historico.atual, ativo: $('planoGrade').value });
        if (semestreCarregado !== atual().semestre) carregarOferta(atual().semestre);
    };
    $('semestreGrade').onchange = () => {
        const semestre = $('semestreGrade').value;
        const existente = historico.atual.planos.find((p) => p.semestre === semestre);
        if (!existente && !catalogo.some((item) => item.semestre === semestre)) {
            renderizar();
            return;
        }
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
    function moverHistorico(metodo) {
        if (!(metodo === 'desfazer' ? historico.passado : historico.futuro).length) return false;
        mensagem('');
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
        return true;
    }
    $('desfazerGrade').onclick = () => moverHistorico('desfazer');
    $('refazerGrade').onclick = () => moverHistorico('refazer');
    document.addEventListener('keydown', (event) => {
        if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
        if (event.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))
            return;
        const tecla = event.key.toLowerCase();
        const metodo =
            tecla === 'z'
                ? event.shiftKey
                    ? 'refazer'
                    : 'desfazer'
                : tecla === 'y' && !event.shiftKey
                  ? 'refazer'
                  : null;
        if (metodo && moverHistorico(metodo)) event.preventDefault();
    });
    for (const [id, campo] of [
        ['inicioGrade', 'inicio'],
        ['fimGrade', 'fim'],
    ])
        if ($(id))
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
    $('exportarGradePng').onclick = imagem;
    async function iniciar() {
        try {
            const dados = await json('data/turmas/index.json');
            catalogo = (Array.isArray(dados.semestres) ? dados.semestres : [])
                .filter(itemValido)
                .sort((a, b) => b.semestre.localeCompare(a.semestre));
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
