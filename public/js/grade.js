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
        historico = GradeArquivos.registrar(historico, validado);
        AppUnB.salvar(chave, historico.atual);
        cancelar();
        geracoes = [];
        $('combinacoesGrade').replaceChildren();
        $('estadoGeradorGrade').textContent = '';
        renderizar();
        buscar();
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
            $('ofertaGrade').textContent = `Semestre ${semestre} · Oferta de ${data.toLocaleDateString('pt-BR')}`;
            renderizar();
            buscar();
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
                const campo = document.querySelector(`[data-codigo="${CSS.escape(d.codigo)}"] select`);
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
    function renderizarDisciplinas(p) {
        const lista = $('disciplinasGrade');
        lista.replaceChildren();
        $('totalDesejadasGrade').textContent = `${p.disciplinas.length}/20`;
        $('planoVazioGrade').hidden = !!p.disciplinas.length;
        p.disciplinas.forEach((pedido, indice) => {
            const d = disciplinas.get(pedido.codigo);
            const salva = p.selecionadas.find((s) => s.codigo === pedido.codigo);
            const artigo = el('article', 'grade-materia');
            artigo.dataset.codigo = pedido.codigo;
            const topo = el('div', 'grade-materia-cabecalho');
            const nome = el('div');
            const codigo = el('span', 'grade-codigo', pedido.codigo);
            codigo.style.color = cores[indice % cores.length];
            nome.append(
                codigo,
                el('h3', '', d?.nome || salva?.nome || pedido.codigo),
                el('p', 'grade-muted', carga(pedido.codigo)),
            );
            const remover = el('button', 'grade-botao grade-remover', 'Remover');
            remover.type = 'button';
            remover.setAttribute('aria-label', `Remover ${d?.nome || pedido.codigo} do plano`);
            remover.onclick = () => {
                alterar((plano) => {
                    plano.disciplinas = plano.disciplinas.filter((x) => x.codigo !== pedido.codigo);
                    plano.selecionadas = plano.selecionadas.filter((x) => x.codigo !== pedido.codigo);
                });
                $('buscaGrade').focus();
                buscar();
            };
            topo.append(nome, remover);
            const rotulo = el('label', 'grade-checkbox');
            const check = el('input');
            check.id = `obrigatoriaGrade${indice}`;
            check.type = 'checkbox';
            check.checked = pedido.obrigatoria;
            check.onchange = () =>
                alterar((plano) => {
                    plano.disciplinas.find((x) => x.codigo === pedido.codigo).obrigatoria = check.checked;
                });
            rotulo.append(check, document.createTextNode('Obrigatória neste plano'));
            const label = el('label', 'visually-hidden', `Turma de ${d?.nome || pedido.codigo}`);
            label.htmlFor = `turmaGrade${indice}`;
            const select = el('select', 'form-select');
            select.id = label.htmlFor;
            const primeira = el('option', '', 'Escolher turma');
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
            artigo.append(topo, rotulo, label, select);
            if (salva) {
                const vigente = d?.turmas.find((t) => GradeCalculos.idTurma(pedido.codigo, t) === idSalvo);
                const t = vigente || salva.turma;
                const vagas =
                    t.matriculados != null && t.vagas != null
                        ? `${t.matriculados}/${t.vagas} matriculados`
                        : 'Vagas não informadas';
                artigo.append(
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
        $('gerarGrade').disabled = !!worker || !p.disciplinas.length || semestreCarregado !== p.semestre;
        $('exportarGradePng').disabled = !p.selecionadas.length;
        $('exportarGradeIcs').disabled = !p.selecionadas.length;
        $('montarGrade').disabled = !p.selecionadas.length;
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
    function gerar() {
        cancelar();
        const p = atual();
        const vagas = $('somenteVagasGrade').checked;
        const pedidos = p.disciplinas.map((d) => ({
            ...d,
            turmas: (disciplinas.get(d.codigo)?.turmas || []).filter(
                (t) => !vagas || (t.vagas != null && t.matriculados != null && t.matriculados < t.vagas),
            ),
        }));
        if (!('Worker' in window)) {
            mensagem(
                'Este navegador não suporta a geração automática. Você ainda pode escolher as turmas manualmente.',
            );
            return;
        }
        worker = new Worker(new URL('js/grade-worker.js', AppUnB.raiz));
        $('cancelarGrade').hidden = false;
        $('gerarGrade').disabled = true;
        $('combinacoesGrade').replaceChildren();
        $('estadoGeradorGrade').textContent = 'Procurando combinações…';
        worker.onmessage = ({ data }) => {
            cancelar();
            if (data.erro) {
                mensagem(data.erro);
                return;
            }
            geracoes = data.resultado.combinacoes;
            $('estadoGeradorGrade').textContent =
                `${geracoes.length} combinação(ões) sem conflitos.${data.resultado.truncado ? ' Limite de busca atingido; podem existir outras combinações.' : ''}${!geracoes.length ? ' Revise as disciplinas obrigatórias, os horários e o filtro de vagas.' : ''}`;
            geracoes.forEach((combinacao, i) => {
                const linha = el('div', 'grade-combinacao');
                linha.append(
                    el('p', '', `${i + 1}. ${combinacao.map((s) => `${s.codigo} (${s.turma.numero})`).join(' · ')}`),
                );
                const usar = el('button', 'grade-botao', 'Usar');
                usar.type = 'button';
                usar.setAttribute('aria-label', `Usar combinação ${i + 1}`);
                usar.onclick = () =>
                    alterar((plano) => {
                        plano.selecionadas = combinacao.map((s) => ({ ...s, nome: disciplinas.get(s.codigo).nome }));
                    });
                linha.append(usar);
                $('combinacoesGrade').append(linha);
            });
        };
        worker.onerror = () => {
            cancelar();
            mensagem('Não foi possível gerar combinações. Tente novamente.');
            $('estadoGeradorGrade').textContent = '';
        };
        worker.postMessage(pedidos);
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
    $('gerarGrade').onclick = gerar;
    $('cancelarGrade').onclick = () => {
        cancelar();
        $('estadoGeradorGrade').textContent = 'Busca cancelada.';
    };
    $('somenteVagasGrade').onchange = () => {
        cancelar();
        $('combinacoesGrade').replaceChildren();
        $('estadoGeradorGrade').textContent = '';
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
            renderizar();
            buscar();
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
                    const opcao = el('option', '', `Semestre ${s.semestre}`);
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
