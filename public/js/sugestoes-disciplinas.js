(() => {
    const minimo = 3;
    const limite = 8;
    let catalogo;

    async function carregarCatalogo() {
        if (!catalogo) {
            catalogo = (async () => {
                const indice = await fetch(new URL('data/turmas/index.json', AppUnB.raiz));
                if (!indice.ok) throw new Error('Catálogo indisponível.');
                const { semestres = [] } = await indice.json();
                const recente = [...semestres].sort((a, b) => b.semestre.localeCompare(a.semestre))[0];
                if (!recente) return [];
                const resposta = await fetch(new URL(`data/turmas/${recente.arquivo}`, AppUnB.raiz));
                if (!resposta.ok) throw new Error('Disciplinas indisponíveis.');
                const { disciplinas = [] } = await resposta.json();
                return disciplinas.map(({ codigo, nome, nomesAlternativos = [] }) => ({
                    codigo,
                    nome,
                    busca: CalculosUnB.normalizar([codigo, nome, ...nomesAlternativos].join(' ')),
                }));
            })().catch(() => {
                catalogo = null;
                return [];
            });
        }
        return catalogo;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const periodos = document.getElementById('periodos');
        const lista = AppUnB.elemento('div', 'ira-sugestoes');
        lista.id = 'sugestoesDisciplinas';
        lista.setAttribute('role', 'listbox');
        lista.setAttribute('aria-label', 'Disciplinas sugeridas');
        lista.hidden = true;
        document.body.append(lista);
        let campo;
        let resultados = [];
        let ativo = -1;
        let revisao = 0;
        let temporizador;

        function fechar() {
            revisao++;
            clearTimeout(temporizador);
            lista.hidden = true;
            campo?.setAttribute('aria-expanded', 'false');
            campo?.removeAttribute('aria-activedescendant');
            ativo = -1;
        }

        function escolher(indice) {
            const disciplina = resultados[indice];
            if (!disciplina || !campo) return;
            campo.value = `${disciplina.codigo} — ${disciplina.nome}`;
            fechar();
            campo.dispatchEvent(new Event('change', { bubbles: true }));
        }

        async function sugerir(input) {
            fechar();
            campo = input;
            const termo = CalculosUnB.normalizar(input.value.trim());
            if (termo.length < minimo) return;
            const versao = revisao;
            const disciplinas = await carregarCatalogo();
            if (versao !== revisao || document.activeElement !== input || !input.isConnected) return;
            const termos = termo.split(/\s+/);
            resultados = disciplinas
                .filter((disciplina) => termos.every((parte) => disciplina.busca.includes(parte)))
                .sort((a, b) => {
                    const prioridade = (item) => (CalculosUnB.normalizar(item.codigo).startsWith(termo) ? 0 : 1);
                    return prioridade(a) - prioridade(b) || a.nome.localeCompare(b.nome, 'pt-BR');
                })
                .slice(0, limite);
            lista.replaceChildren();
            if (!resultados.length) return;
            resultados.forEach((disciplina, indice) => {
                const opcao = AppUnB.elemento('button', 'ira-sugestao');
                opcao.type = 'button';
                opcao.id = `sugestaoDisciplina-${indice}`;
                opcao.tabIndex = -1;
                opcao.dataset.indice = indice;
                opcao.setAttribute('role', 'option');
                opcao.setAttribute('aria-selected', 'false');
                opcao.append(
                    AppUnB.elemento('span', 'ira-sugestao-codigo', disciplina.codigo),
                    AppUnB.elemento('span', '', disciplina.nome),
                );
                lista.append(opcao);
            });
            input.parentElement.append(lista);
            lista.hidden = false;
            input.setAttribute('aria-expanded', 'true');
        }

        periodos.addEventListener('input', (evento) => {
            if (!evento.target.matches('.input-nome')) return;
            fechar();
            temporizador = setTimeout(() => sugerir(evento.target), 150);
        });
        periodos.addEventListener('focusin', (evento) => {
            if (evento.target.matches('.input-nome')) sugerir(evento.target);
        });
        periodos.addEventListener('focusout', (evento) => {
            if (evento.target === campo) fechar();
        });
        periodos.addEventListener('keydown', (evento) => {
            if (evento.target !== campo || lista.hidden) return;
            if (evento.key === 'Escape' || evento.key === 'Tab') fechar();
            else if (evento.key === 'Enter' && ativo >= 0) {
                evento.preventDefault();
                escolher(ativo);
            } else if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
                evento.preventDefault();
                ativo =
                    ativo < 0
                        ? evento.key === 'ArrowDown'
                            ? 0
                            : resultados.length - 1
                        : (ativo + (evento.key === 'ArrowDown' ? 1 : resultados.length - 1)) % resultados.length;
                [...lista.children].forEach((opcao, indice) => {
                    opcao.setAttribute('aria-selected', String(indice === ativo));
                });
                const opcao = lista.children[ativo];
                campo.setAttribute('aria-activedescendant', opcao.id);
                opcao.scrollIntoView({ block: 'nearest' });
            }
        });
        lista.addEventListener('pointerdown', (evento) => {
            if (evento.target.closest('.ira-sugestao')) evento.preventDefault();
        });
        lista.addEventListener('click', (evento) => {
            const opcao = evento.target.closest('.ira-sugestao');
            if (opcao) escolher(Number(opcao.dataset.indice));
        });
        document.addEventListener('pointerdown', (evento) => {
            if (evento.target !== campo && !lista.contains(evento.target)) fechar();
        });
        document.querySelectorAll('[name="visualizacaoIra"]').forEach((input) => {
            input.addEventListener('change', fechar);
        });
    });
})();
