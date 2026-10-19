(() => {
    const semestreSelect = document.getElementById('semestreTurmas');
    const busca = document.getElementById('buscaTurmas');
    const departamento = document.getElementById('departamentoTurmas');
    const horario = document.getElementById('horarioTurmas');
    const lotacao = document.getElementById('lotacaoTurmas');
    const modo = document.getElementById('modoAvancadoTurmas');
    const lista = document.getElementById('listaDisciplinas');
    const estado = document.getElementById('estadoTurmas');
    const contagem = document.getElementById('contagemTurmas');
    const atualizacao = document.getElementById('atualizacaoTurmas');
    const sentinela = document.getElementById('sentinelaTurmas');
    const passo = 24;
    let disciplinas = [];
    let unidades = {};
    let semestresPorArquivo = new Map();
    let gruposFiltrados = [];
    let gruposExibidos = 0;
    let observador;

    function normalizar(valor) {
        return String(valor ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('pt-BR');
    }

    function mostrarEstado(titulo, descricao = '') {
        estado.hidden = false;
        estado.replaceChildren(AppUnB.elemento('p', '', titulo));
        if (descricao) estado.append(AppUnB.elemento('p', '', descricao));
        lista.replaceChildren();
        sentinela.hidden = true;
        contagem.textContent = '';
    }

    function disponibilidade(turma) {
        if (turma.vagas == null || turma.matriculados == null) return 'indisponivel';
        return turma.matriculados >= turma.vagas ? 'lotada' : 'vagas';
    }

    function criarCampoTurma(valor, classe = '') {
        const campo = AppUnB.elemento('div', `turma-oferta-campo ${classe}`.trim());
        campo.append(AppUnB.elemento('span', 'turma-oferta-valor', valor));
        return campo;
    }

    function criarLinhaTurma(turma) {
        const linha = AppUnB.elemento('article', 'turma-oferta');
        const numero = criarCampoTurma(turma.numero, 'turma-oferta-numero');
        numero.querySelector('.turma-oferta-valor').classList.add('turma-oferta-numero-valor');
        linha.append(numero);
        linha.append(
            criarCampoTurma((turma.professores || []).join(' · ') || 'Não informado', 'turma-oferta-professores'),
        );
        linha.append(criarCampoTurma((turma.horarios || []).join(' · ') || 'Não informado', 'turma-oferta-horario'));
        linha.append(criarCampoTurma(turma.local || 'Não informado', 'turma-oferta-local'));

        const vagas = criarCampoTurma(`${turma.matriculados ?? '—'} / ${turma.vagas ?? '—'}`, 'turma-oferta-vagas');
        linha.append(vagas);
        return linha;
    }

    function criarCabecalhoTurmas() {
        const cabecalho = AppUnB.elemento('div', 'turmas-ofertas-cabecalho');
        for (const rotulo of ['Turma', 'Professor(a)', 'Horário', 'Local', 'Vagas (SIGAA)']) {
            cabecalho.append(AppUnB.elemento('span', '', rotulo));
        }
        return cabecalho;
    }

    function criarGrupo(grupo) {
        const detalhe = document.createElement('details');
        detalhe.className = 'turma-materia';
        detalhe.open = grupo.aberto;

        const resumo = document.createElement('summary');
        resumo.className = 'turma-materia-resumo';
        const identificacao = AppUnB.elemento('span', 'turma-materia-identificacao');
        identificacao.append(AppUnB.elemento('small', 'turma-materia-codigo', grupo.disciplina.codigo));
        identificacao.append(AppUnB.elemento('strong', '', grupo.disciplina.nome));
        resumo.append(identificacao);
        const finalResumo = AppUnB.elemento('span', 'turma-materia-final');
        finalResumo.append(
            AppUnB.elemento(
                'span',
                'turma-materia-contagem',
                `${grupo.turmas.length} ${grupo.turmas.length === 1 ? 'turma' : 'turmas'}`,
            ),
        );
        finalResumo.append(AppUnB.elemento('span', 'turma-materia-seta', '⌄'));
        resumo.append(finalResumo);
        detalhe.append(resumo);

        const ofertas = AppUnB.elemento('div', 'turma-ofertas-scroll');
        ofertas.append(criarCabecalhoTurmas());
        const linhas = AppUnB.elemento('div', 'turma-ofertas');
        for (const turma of grupo.turmas) linhas.append(criarLinhaTurma(turma));
        ofertas.append(linhas);
        detalhe.append(ofertas);
        return detalhe;
    }

    function adicionarProximoLote() {
        const proximos = gruposFiltrados.slice(gruposExibidos, gruposExibidos + passo);
        if (!proximos.length) {
            sentinela.hidden = true;
            observador?.disconnect();
            return;
        }
        const fragmento = document.createDocumentFragment();
        for (const grupo of proximos) fragmento.append(criarGrupo(grupo));
        lista.append(fragmento);
        gruposExibidos += proximos.length;
        sentinela.hidden = gruposExibidos >= gruposFiltrados.length;
        if (sentinela.hidden) observador?.disconnect();
        else observador?.observe(sentinela);
    }

    function filtrar() {
        const termo = normalizar(busca.value.trim());
        const unidadeSelecionada = normalizar(departamento.value.trim());
        const codigoHorario = normalizar(horario.value.trim());
        const filtroLotacao = lotacao.value;
        gruposFiltrados = [];
        let turmasEncontradas = 0;

        for (const disciplina of disciplinas) {
            const informacaoMateria = normalizar(
                [disciplina.codigo, disciplina.nome, ...(disciplina.nomesAlternativos || [])].join(' '),
            );
            const correspondeMateria = !termo || informacaoMateria.includes(termo);
            const turmas = [];
            let encontrouProfessor = false;

            for (const turma of disciplina.turmas || []) {
                const nomesUnidades = (turma.unidades || []).map((id) => unidades[id] || id);
                if (unidadeSelecionada && !nomesUnidades.some((nome) => normalizar(nome).includes(unidadeSelecionada)))
                    continue;
                if (codigoHorario && !(turma.horarios || []).some((item) => normalizar(item).includes(codigoHorario)))
                    continue;

                const situacao = disponibilidade(turma);
                if (filtroLotacao === 'vagas' && situacao !== 'vagas') continue;
                if (filtroLotacao === 'lotadas' && situacao !== 'lotada') continue;

                const correspondeProfessor = (turma.professores || []).some((nome) => normalizar(nome).includes(termo));
                const informacaoTurma = normalizar([...(turma.professores || []), turma.local, turma.numero].join(' '));
                if (termo && !correspondeMateria && !informacaoTurma.includes(termo)) continue;
                if (correspondeProfessor) encontrouProfessor = true;
                turmas.push(turma);
            }

            if (!turmas.length) continue;
            turmasEncontradas += turmas.length;
            gruposFiltrados.push({
                disciplina,
                turmas,
                aberto: Boolean(termo && encontrouProfessor && !correspondeMateria),
            });
        }

        gruposExibidos = 0;
        observador?.disconnect();
        lista.replaceChildren();
        estado.hidden = gruposFiltrados.length > 0;
        sentinela.hidden = gruposFiltrados.length === 0;
        if (!gruposFiltrados.length) {
            mostrarEstado('Nenhuma turma encontrada.', 'Ajuste a busca ou escolha outros filtros.');
            return;
        }

        contagem.textContent = `${turmasEncontradas.toLocaleString('pt-BR')} turmas · ${gruposFiltrados.length.toLocaleString('pt-BR')} disciplinas`;
        adicionarProximoLote();
    }

    async function carregarSemestre(arquivo) {
        mostrarEstado('Carregando turmas…');
        const dataAtualizacao = semestresPorArquivo.get(arquivo)?.atualizadoEm;
        if (dataAtualizacao) {
            const data = new Date(dataAtualizacao);
            atualizacao.textContent = Number.isNaN(data.valueOf())
                ? ''
                : `Atualizado em ${new Intl.DateTimeFormat('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                      timeZone: 'UTC',
                  }).format(data)}`;
            atualizacao.hidden = !atualizacao.textContent;
        } else {
            atualizacao.hidden = true;
        }
        for (const controle of [semestreSelect, busca, departamento, horario, lotacao]) controle.disabled = true;
        try {
            const response = await fetch(new URL(`data/turmas/${arquivo}`, AppUnB.raiz));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!Array.isArray(data.disciplinas)) throw new Error('Formato de dados inválido.');
            disciplinas = data.disciplinas;
            for (const controle of [semestreSelect, busca, departamento, horario, lotacao]) controle.disabled = false;
            filtrar();
        } catch {
            mostrarEstado('Não foi possível carregar as turmas.', 'Tente atualizar a página em alguns instantes.');
        }
    }

    async function iniciar() {
        mostrarEstado('Carregando semestres e departamentos…');
        try {
            const [indiceResponse, unidadesResponse] = await Promise.all([
                fetch(new URL('data/turmas/index.json', AppUnB.raiz)),
                fetch(new URL('data/turmas/unidades.json', AppUnB.raiz)),
            ]);
            if (!indiceResponse.ok || !unidadesResponse.ok) throw new Error('Catálogo indisponível.');
            const [indice, cadastro] = await Promise.all([indiceResponse.json(), unidadesResponse.json()]);
            unidades = cadastro.unidades || {};
            const semestres = indice.semestres || [];
            semestresPorArquivo = new Map(semestres.map((item) => [item.arquivo, item]));
            if (!semestres.length) {
                mostrarEstado('Nenhum semestre publicado ainda.');
                return;
            }

            semestreSelect.replaceChildren();
            for (const item of semestres) {
                const option = AppUnB.elemento('option', '', `Semestre ${item.semestre}`);
                option.value = item.arquivo;
                semestreSelect.append(option);
            }
            const opcoesDepartamento = document.getElementById('listaDepartamentosTurmas');
            opcoesDepartamento.replaceChildren();
            for (const [, nome] of Object.entries(unidades).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))) {
                opcoesDepartamento.append(AppUnB.elemento('option', '', nome));
            }

            await carregarSemestre(semestres[0].arquivo);
        } catch {
            mostrarEstado(
                'Não foi possível carregar o catálogo de turmas.',
                'Tente atualizar a página em alguns instantes.',
            );
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        observador = new IntersectionObserver(
            (entradas) => {
                if (entradas.some((entrada) => entrada.isIntersecting)) adicionarProximoLote();
            },
            { rootMargin: '400px 0px' },
        );
        const detalhesModo = document.getElementById('detalhesModo');
        const botaoFiltros = document.getElementById('botaoMaisFiltrosTurmas');
        const painelFiltros = document.getElementById('painelFiltrosTurmas');
        botaoFiltros.addEventListener('click', () => {
            const aberto = botaoFiltros.getAttribute('aria-expanded') === 'true';
            botaoFiltros.setAttribute('aria-expanded', String(!aberto));
            botaoFiltros.textContent = aberto ? 'Mais filtros' : 'Menos filtros';
            painelFiltros.hidden = aberto;
        });
        modo.addEventListener('change', () => {
            detalhesModo.hidden = !modo.checked;
        });
        semestreSelect.addEventListener('change', () => carregarSemestre(semestreSelect.value));
        for (const controle of [busca, departamento, horario, lotacao]) {
            controle.addEventListener('input', filtrar);
            controle.addEventListener('change', filtrar);
        }
        iniciar();
    });
})();
