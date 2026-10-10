(() => {
    const $ = id => document.getElementById(id);
    const el = AppUnB.elemento;
    const formato = AppUnB.numero;
    const slug = document.body.dataset.edital;
    const chaveFiltros = `calculadora-unb:filtros:${slug}`;
    let dados;

    async function carregarJson(caminho) {
        const resposta = await fetch(new URL(caminho, AppUnB.raiz));
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        return resposta.json();
    }

    function opcoesCurso(select) {
        dados.cursos.forEach(c => {
            const opcao = el('option', '', c.nome);
            opcao.value = c.nome;
            select.append(opcao);
        });
    }

    function restaurarPerfil() {
        const perfil = AppUnB.perfil();
        $('meuIra').value = perfil.ira ?? '';
        $('meuIpf').value = perfil.ipf ?? '';
        $('meuCurso').value = perfil.curso || '';
        const indisponivel = perfil.curso && !dados.cursos.some(c => c.nome === perfil.curso);
        $('avisoCurso').hidden = !indisponivel;
        $('avisoCurso').textContent = indisponivel ? `O curso salvo (${perfil.curso}) não aparece nesta publicação. Selecione outro curso para simular; nenhuma média de outro edital será usada.` : '';
    }

    function simular() {
        const curso = dados.cursos.find(c => c.nome === $('meuCurso').value);
        const ira = $('meuIra').valueAsNumber;
        const ipf = $('meuIpf').valueAsNumber;
        const incompleto = $('meuIra').value === '' || $('meuIpf').value === '';
        const invalido = !incompleto && (!Number.isFinite(ira) || ira < 0 || ira > 5 || !Number.isFinite(ipf) || ipf < 0 || ipf > 100);
        $('meuIra').setAttribute('aria-invalid', String($('meuIra').value !== '' && (!Number.isFinite(ira) || ira < 0 || ira > 5)));
        $('meuIpf').setAttribute('aria-invalid', String($('meuIpf').value !== '' && (!Number.isFinite(ipf) || ipf < 0 || ipf > 100)));
        $('erroPerfil').hidden = !invalido;
        $('erroPerfil').textContent = 'Informe um IRA entre 0 e 5 e um IPF entre 0% e 100%.';
        $('notasSimuladas').replaceChildren();
        if (!curso || incompleto || invalido) return;
        curso.variantes.forEach((v, i) => {
            const nota = CalculosUnB.nota(ira, ipf, v.media, v.desvio, dados.formula);
            const card = el('article', 'card-nota');
            const identificacao = v.turno ? `${curso.nome} — ${v.turno}` : curso.variantes.length > 1 ? `Referência ${i + 1} · turno não informado` : curso.nome;
            card.append(el('h3', '', identificacao));
            card.append(el('p', 'referencia-dados', `Média ${formato(v.media, 9)} · Desvio ${formato(v.desvio, 9)}`));
            card.append(el('span', 'resultado-label', 'Sua nota final'));
            card.append(el('strong', 'nota-final', nota ? formato(nota.final, 9) : 'Indisponível'));
            if (nota) card.append(el('p', 'texto-apoio', `IRA padronizado: ${formato(nota.padronizado, 9)}`));
            card.append(el('small', 'texto-apoio', `Referência encontrada em ${v.registros} registro(s) da publicação.`));
            $('notasSimuladas').append(card);
        });
    }

    function filtros() {
        return { curso: $('filtroCurso').value, alocacao: $('filtroAlocacao').value,
            busca: $('buscaResultado').value, ordem: $('ordemResultado').value };
    }

    function referenciaDoRegistro(registro) {
        const curso = dados.cursos.find(c => c.nome === CalculosUnB.cursoBase(registro.curso));
        if (!curso || curso.variantes.length < 2) return '';
        const indice = curso.variantes.findIndex(v => v.cursoFonte === registro.curso &&
            v.media === registro.media && v.desvio === registro.desvio);
        return indice >= 0 ? `Referência ${indice + 1}` : '';
    }

    function mostrarReferenciasCurso(nome) {
        const container = $('referenciasCurso');
        const curso = dados.cursos.find(c => c.nome === nome);
        container.replaceChildren();
        container.hidden = !curso;
        if (!curso) return;
        container.append(el('h3', 'referencias-titulo', `IRA médio e desvio — ${curso.nome}`));
        const lista = el('div', 'referencias-lista');
        curso.variantes.forEach((v, i) => {
            const card = el('div', 'referencia-curso');
            const titulo = curso.variantes.length > 1 ? `Referência ${i + 1}` : curso.nome;
            card.append(el('h4', '', v.turno ? `${titulo} · ${v.turno}` : titulo));
            const valores = el('div', 'referencia-valores');
            const media = el('p', '', 'IRA médio ');
            media.append(el('strong', '', formato(v.media, 9)));
            const desvio = el('p', '', 'Desvio padrão ');
            desvio.append(el('strong', '', formato(v.desvio, 9)));
            valores.append(media, desvio);
            card.append(valores);
            lista.append(card);
        });
        container.append(lista);
    }

    function renderizarTabela() {
        const filtro = filtros();
        mostrarReferenciasCurso(filtro.curso);
        const busca = CalculosUnB.normalizar(filtro.busca.trim());
        const linhas = dados.resultados.filter(r => {
            if (filtro.curso && CalculosUnB.cursoBase(r.curso) !== filtro.curso) return false;
            const alocado = CalculosUnB.alocado(r.alocacao);
            if (filtro.alocacao === 'alocados' && !alocado) return false;
            if (filtro.alocacao === 'nao-alocados' && alocado) return false;
            return !busca || CalculosUnB.normalizar([r.matricula, r.curso, ...r.opcoes, r.idiomas, r.alocacao,
                r.situacaoInscricao, r.classificacao, r.observacao].join(' ')).includes(busca);
        }).sort((a, b) => b[filtro.ordem] - a[filtro.ordem] || a.matricula.localeCompare(b.matricula));
        const fragmento = document.createDocumentFragment();
        const extras = dados.colunasExtras || [];
        const rotulos = ['Matrícula', 'Curso', 'IRA', 'IPF', 'Nota final', '1ª opção', '2ª opção', '3ª opção', '4ª opção', '5ª opção', 'Idiomas', 'Alocação',
            ...extras.map(c => c.rotulo)];
        linhas.forEach(r => {
            const tr = el('tr');
            const referencia = referenciaDoRegistro(r);
            const nomeCurso = referencia ? `${r.curso} · ${referencia}` : r.curso;
            const valores = [r.matricula, nomeCurso, formato(r.ira), `${formato(r.ipf, 2)}%`, formato(r.notaFinal, 9),
                ...r.opcoes.map(v => v || '—'), r.idiomas || '—', r.alocacao || '—',
                ...extras.map(c => r[c.campo] || '—')];
            valores.forEach((valor, i) => {
                const td = el('td', i >= 2 && i <= 4 ? 'celula-numero' : '', valor);
                td.dataset.label = rotulos[i];
                if (i === 11 && CalculosUnB.alocado(r.alocacao)) td.classList.add('celula-alocada');
                tr.append(td);
            });
            fragmento.append(tr);
        });
        if (!linhas.length) {
            const tr = el('tr');
            const td = el('td', 'estado-vazio', 'Nenhum candidato encontrado para estes filtros.');
            td.colSpan = 12 + extras.length; tr.append(td); fragmento.append(tr);
        }
        $('linhasResultados').replaceChildren(fragmento);
        const alocados = linhas.filter(r => CalculosUnB.alocado(r.alocacao)).length;
        $('contagemResultados').textContent = `${linhas.length} resultado(s) · ${alocados} alocado(s)`;
    }

    function mudarFiltros() { AppUnB.salvar(chaveFiltros, filtros()); renderizarTabela(); }

    async function inicializar() {
        try {
            if (!slug) {
                const editais = await carregarJson('data/editais/index.json');
                $('listaEditais').replaceChildren();
                editais.forEach(edital => {
                    const card = el('a', 'card-edital');
                    card.href = new URL(`intercambio/${edital.slug}/`, AppUnB.raiz);
                    card.append(el('span', 'selo', edital.situacao), el('h2', '', edital.titulo),
                        el('p', 'texto-apoio', `Mobilidade: ${edital.mobilidade}`), el('span', 'abrir-edital', 'Calcular e consultar resultados →'));
                    $('listaEditais').append(card);
                });
                return;
            }
            dados = await carregarJson(`data/editais/${slug}.json`);
            if (dados.colunasExtras?.length) {
                const tabela = document.querySelector('.tabela-resultados');
                const colunas = tabela.querySelector('colgroup');
                const cabecalho = tabela.querySelector('thead tr');
                dados.colunasExtras.forEach(c => {
                    const coluna = document.createElement('col');
                    coluna.style.width = `${c.largura}px`;
                    colunas.append(coluna);
                    const th = el('th', '', c.rotulo);
                    th.scope = 'col';
                    cabecalho.append(th);
                });
                tabela.style.setProperty('--tabela-largura', `${1535 + dados.colunasExtras.reduce((soma, c) => soma + c.largura, 0)}px`);
            }
            opcoesCurso($('meuCurso')); opcoesCurso($('filtroCurso'));
            restaurarPerfil();
            const perfil = AppUnB.perfil();
            const salvo = AppUnB.ler(chaveFiltros, { curso: perfil.curso || '', alocacao: 'todos', busca: '', ordem: 'notaFinal' });
            $('filtroCurso').value = salvo.curso || '';
            $('filtroAlocacao').value = ['todos', 'alocados', 'nao-alocados'].includes(salvo.alocacao) ? salvo.alocacao : 'todos';
            $('buscaResultado').value = salvo.busca || '';
            $('ordemResultado').value = ['notaFinal', 'ira', 'ipf'].includes(salvo.ordem) ? salvo.ordem : 'notaFinal';
            $('meuIra').addEventListener('input', () => { AppUnB.salvarPerfil({ ira: $('meuIra').value }); simular(); });
            $('meuIpf').addEventListener('input', () => { AppUnB.salvarPerfil({ ipf: $('meuIpf').value }); simular(); });
            $('meuCurso').addEventListener('change', () => {
                AppUnB.salvarPerfil({ curso: $('meuCurso').value });
                $('avisoCurso').hidden = true;
                $('filtroCurso').value = $('meuCurso').value;
                simular(); mudarFiltros();
            });
            ['filtroCurso', 'filtroAlocacao', 'ordemResultado'].forEach(id => $(id).addEventListener('change', mudarFiltros));
            $('buscaResultado').addEventListener('input', mudarFiltros);
            window.addEventListener('storage', event => { if (event.key === AppUnB.chavePerfil) { restaurarPerfil(); simular(); } });
            const descricao = dados.descricaoResultados ?? 'Inclui registros sem alocação e com “n/a”, conforme a fonte.';
            $('resumoDados').textContent = `${dados.resultados.length} registros · ${dados.cursos.length} cursos · ${dados.resultados.filter(r => CalculosUnB.alocado(r.alocacao)).length} alocados.${descricao ? ` ${descricao}` : ''}`;
            simular(); renderizarTabela();
            $('carregando').hidden = true;
            $('conteudoEdital').hidden = false;
        } catch (erro) {
            console.error(erro);
            if ($('carregando')) $('carregando').hidden = true;
            if ($('listaEditais')) $('listaEditais').replaceChildren();
            $('erroCarregamento').hidden = false;
            $('erroCarregamento').textContent = 'Não foi possível carregar os dados. Recarregue a página para tentar novamente.';
        }
    }
    document.addEventListener('DOMContentLoaded', inicializar);
})();
