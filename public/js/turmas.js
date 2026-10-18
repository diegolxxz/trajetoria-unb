(() => {
    const semestreSelect = document.getElementById('semestreTurmas');
    const busca = document.getElementById('buscaTurmas');
    const departamento = document.getElementById('departamentoTurmas');
    const horario = document.getElementById('horarioTurmas');
    const modo = document.getElementById('modoAvancadoTurmas');
    const lista = document.getElementById('listaDisciplinas');
    const estado = document.getElementById('estadoTurmas');
    const contagem = document.getElementById('contagemTurmas');
    const mais = document.getElementById('maisTurmas');
    const pageSize = 100;
    let disciplinas = [];
    let unidades = {};
    let exibidas = pageSize;

    function normalizar(valor) {
        return String(valor ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('pt-BR');
    }

    function mostrarEstado(titulo, descricao = '') {
        estado.hidden = false;
        estado.replaceChildren();
        const principal = AppUnB.elemento('p', '', titulo);
        estado.append(principal);
        if (descricao) estado.append(AppUnB.elemento('p', '', descricao));
        lista.replaceChildren();
        contagem.textContent = '';
        mais.hidden = true;
    }

    function montarTabela(registros) {
        const tabela = AppUnB.elemento('table', 'table tabela-resultados turmas-tabela');
        const cabecalho = document.createElement('thead');
        const linhaCabecalho = document.createElement('tr');
        for (const nome of ['Disciplina', 'Turma', 'Professor(es)', 'Horário', 'Local', 'Matriculados / vagas']) {
            const celula = AppUnB.elemento('th', '', nome);
            celula.scope = 'col';
            linhaCabecalho.append(celula);
        }
        cabecalho.append(linhaCabecalho);
        const corpo = document.createElement('tbody');

        for (const { disciplina, turma } of registros) {
            const linha = document.createElement('tr');
            const nome = AppUnB.elemento('td', 'turmas-disciplina');
            nome.append(AppUnB.elemento('strong', '', disciplina.nome));
            nome.append(AppUnB.elemento('small', '', disciplina.codigo));
            const origens = (turma.unidades || []).map((id) => unidades[id]).filter(Boolean);
            if (origens.length) nome.title = `Departamento: ${origens.join('; ')}`;
            linha.append(nome);
            linha.append(AppUnB.elemento('td', '', turma.numero));
            linha.append(AppUnB.elemento('td', '', (turma.professores || []).join(' · ') || '—'));
            linha.append(AppUnB.elemento('td', '', (turma.horarios || []).join(' · ') || '—'));
            linha.append(AppUnB.elemento('td', '', turma.local || '—'));
            linha.append(AppUnB.elemento('td', '', `${turma.matriculados ?? '—'} / ${turma.vagas ?? '—'}`));
            corpo.append(linha);
        }

        tabela.append(cabecalho, corpo);
        lista.replaceChildren(tabela);
    }

    function filtrar() {
        const termo = normalizar(busca.value.trim());
        const unidadeSelecionada = normalizar(departamento.value.trim());
        const codigoHorario = normalizar(horario.value.trim());
        const resultados = [];
        const cursos = new Set();

        for (const disciplina of disciplinas) {
            for (const turma of disciplina.turmas || []) {
                const nomesUnidades = (turma.unidades || []).map((id) => unidades[id] || id);
                if (unidadeSelecionada && !nomesUnidades.some((nome) => normalizar(nome).includes(unidadeSelecionada)))
                    continue;
                if (codigoHorario && !(turma.horarios || []).some((item) => normalizar(item).includes(codigoHorario)))
                    continue;
                const texto = normalizar(
                    [
                        disciplina.codigo,
                        disciplina.nome,
                        ...(disciplina.nomesAlternativos || []),
                        ...(turma.professores || []),
                        turma.local,
                        turma.numero,
                    ]
                        .filter(Boolean)
                        .join(' '),
                );
                if (termo && !texto.includes(termo)) continue;
                cursos.add(disciplina.codigo);
                resultados.push({ disciplina, turma });
            }
        }

        const visiveis = resultados.slice(0, exibidas);
        estado.hidden = resultados.length > 0;
        if (!resultados.length) {
            mostrarEstado('Nenhuma turma encontrada.', 'Ajuste a busca ou escolha outro departamento.');
        } else {
            montarTabela(visiveis);
            contagem.textContent = `${resultados.length.toLocaleString('pt-BR')} turmas · ${cursos.size.toLocaleString('pt-BR')} disciplinas`;
            mais.hidden = resultados.length <= exibidas;
            mais.textContent = `Mostrar mais (${Math.min(pageSize, resultados.length - exibidas)} turmas)`;
        }
    }

    async function carregarSemestre(arquivo) {
        mostrarEstado('Carregando turmas…');
        semestreSelect.disabled = true;
        busca.disabled = true;
        departamento.disabled = true;
        horario.disabled = true;
        try {
            const response = await fetch(new URL(`data/turmas/${arquivo}`, AppUnB.raiz));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!Array.isArray(data.disciplinas)) throw new Error('Formato de dados inválido.');
            disciplinas = data.disciplinas;
            exibidas = pageSize;
            semestreSelect.disabled = false;
            busca.disabled = false;
            departamento.disabled = false;
            horario.disabled = false;
            estado.hidden = true;
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
                const option = AppUnB.elemento('option', '', nome);
                option.value = nome;
                opcoesDepartamento.append(option);
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
        const detalhesModo = document.getElementById('detalhesModo');
        modo.addEventListener('change', () => {
            detalhesModo.hidden = !modo.checked;
        });
        semestreSelect.addEventListener('change', () => carregarSemestre(semestreSelect.value));
        for (const controle of [busca, departamento, horario]) {
            controle.addEventListener('input', () => {
                exibidas = pageSize;
                filtrar();
            });
            controle.addEventListener('change', () => {
                exibidas = pageSize;
                filtrar();
            });
        }
        mais.addEventListener('click', () => {
            exibidas += pageSize;
            filtrar();
        });
        iniciar();
    });
})();
