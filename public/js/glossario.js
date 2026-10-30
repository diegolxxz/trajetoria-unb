(() => {
    const busca = document.getElementById('buscaGlossario');
    const lista = document.getElementById('listaGlossario');
    const estado = document.getElementById('estadoGlossario');
    const contagem = document.getElementById('contagemGlossario');
    const recarregar = document.getElementById('recarregarGlossario');
    let termos = [];
    let timer;
    function mensagem(titulo, texto = '') {
        estado.hidden = false;
        estado.replaceChildren(AppUnB.elemento('h2', '', titulo));
        if (texto) estado.append(AppUnB.elemento('p', '', texto));
    }
    function renderizar() {
        lista.replaceChildren();
        if (!termos.length) {
            contagem.textContent = '';
            mensagem('O glossário está em preparação', 'Os termos e suas definições serão adicionados em breve.');
            return;
        }
        const resultados = GlossarioUnB.pesquisar(termos, busca.value);
        const aproximados = resultados.filter((r) => r.aproximado).length;
        contagem.textContent = `${resultados.length} ${resultados.length === 1 ? 'termo' : 'termos'}${aproximados ? ' · Inclui grafias semelhantes' : ''}`;
        estado.hidden = resultados.length > 0;
        if (!resultados.length) mensagem('Nenhum termo encontrado', 'Tente outra palavra ou verifique a grafia.');
        const fragmento = document.createDocumentFragment();
        for (const { item } of resultados) {
            const artigo = AppUnB.elemento('article', 'glossario-termo');
            const titulo = AppUnB.elemento('h2', '', item.sigla ? `${item.sigla} — ${item.termo}` : item.termo);
            artigo.append(titulo);
            if (item.categoria) artigo.append(AppUnB.elemento('p', 'glossario-categoria', item.categoria));
            artigo.append(AppUnB.elemento('p', 'glossario-definicao', item.descricao));
            if (item.aliases?.length)
                artigo.append(
                    AppUnB.elemento('p', 'glossario-aliases', `Também conhecido como: ${item.aliases.join(', ')}`),
                );
            const mapas = GlossarioUnB.mapas(item);
            if (mapas.length) {
                const local = AppUnB.elemento('details', 'glossario-local');
                local.append(AppUnB.elemento('summary', '', 'Ver localização'));
                const conteudo = AppUnB.elemento('div', 'glossario-local-conteudo');
                conteudo.append(AppUnB.elemento('p', '', item.localizacao.nome || 'Localização'));
                if (item.localizacao.endereco)
                    conteudo.append(AppUnB.elemento('p', 'texto-apoio', item.localizacao.endereco));
                const links = AppUnB.elemento('div', 'glossario-mapas');
                for (const [nome, url] of mapas) {
                    const link = AppUnB.elemento('a', '', nome);
                    link.href = url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.setAttribute(
                        'aria-label',
                        `Abrir ${item.localizacao.nome || item.termo} no ${nome} (nova aba)`,
                    );
                    links.append(link);
                }
                conteudo.append(links);
                local.append(conteudo);
                artigo.append(local);
            }
            fragmento.append(artigo);
        }
        lista.append(fragmento);
    }
    async function carregar() {
        recarregar.hidden = true;
        busca.disabled = true;
        mensagem('Carregando glossário…');
        try {
            const resposta = await fetch(new URL('data/glossario/termos.json', AppUnB.raiz));
            if (!resposta.ok) throw new Error('Glossário indisponível.');
            termos = GlossarioUnB.preparar(await resposta.json());
            busca.disabled = !termos.length;
            renderizar();
        } catch {
            lista.replaceChildren();
            contagem.textContent = '';
            mensagem('Não foi possível carregar o glossário', 'Verifique sua conexão e tente novamente.');
            recarregar.hidden = false;
        }
    }
    busca.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(renderizar, 120);
    });
    recarregar.addEventListener('click', carregar);
    carregar();
})();
