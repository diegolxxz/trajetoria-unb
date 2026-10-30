const GlossarioUnB = (() => {
    function normalizar(valor) {
        return String(valor ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('pt-BR')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }
    // Distância de edição com troca de letras vizinhas (ex.: biblioteca/biblotieca).
    function distancia(a, b) {
        const linhas = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
        for (let i = 0; i <= a.length; i++) linhas[i][0] = i;
        for (let j = 0; j <= b.length; j++) linhas[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                linhas[i][j] = Math.min(
                    linhas[i - 1][j] + 1,
                    linhas[i][j - 1] + 1,
                    linhas[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
                );
                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
                    linhas[i][j] = Math.min(linhas[i][j], linhas[i - 2][j - 2] + 1);
            }
        }
        return linhas[a.length][b.length];
    }
    function preparar(data) {
        if (data?.versao !== 1 || !Array.isArray(data.termos)) throw new Error('Formato do glossário inválido.');
        const ids = new Set();
        return data.termos.map((item) => {
            if (
                !item ||
                typeof item.id !== 'string' ||
                !item.id.trim() ||
                ids.has(item.id) ||
                typeof item.termo !== 'string' ||
                !item.termo.trim() ||
                typeof item.descricao !== 'string' ||
                !item.descricao.trim()
            )
                throw new Error('Termo inválido ou duplicado.');
            if (
                item.aliases != null &&
                (!Array.isArray(item.aliases) || item.aliases.some((a) => typeof a !== 'string'))
            )
                throw new Error('Variações inválidas.');
            if (item.sigla != null && typeof item.sigla !== 'string') throw new Error('Sigla inválida.');
            if (item.categoria != null && typeof item.categoria !== 'string') throw new Error('Categoria inválida.');
            const local = item.localizacao;
            if (local != null) {
                if (typeof local !== 'object' || Array.isArray(local)) throw new Error('Localização inválida.');
                for (const campo of ['nome', 'endereco'])
                    if (local[campo] != null && typeof local[campo] !== 'string') throw new Error('Endereço inválido.');
                if (local.latitude != null || local.longitude != null) {
                    if (
                        !Number.isFinite(local.latitude) ||
                        Math.abs(local.latitude) > 90 ||
                        !Number.isFinite(local.longitude) ||
                        Math.abs(local.longitude) > 180
                    )
                        throw new Error('Coordenadas inválidas.');
                }
            }
            ids.add(item.id);
            const nomes = [item.termo, item.sigla, ...(item.aliases || [])].filter(Boolean).map(normalizar);
            return {
                ...item,
                nomes,
                palavras: nomes.join(' ').split(' '),
                texto: normalizar(
                    [item.descricao, item.categoria, local?.nome, local?.endereco].filter(Boolean).join(' '),
                ),
            };
        });
    }
    function mapas(item) {
        const local = item.localizacao;
        if (!local) return [];
        const coordenadas =
            Number.isFinite(local.latitude) && Number.isFinite(local.longitude)
                ? `${local.latitude},${local.longitude}`
                : '';
        const destino = coordenadas || local.endereco?.trim();
        if (!destino) return [];
        const google = new URL('https://www.google.com/maps/search/');
        google.searchParams.set('api', '1');
        google.searchParams.set('query', destino);
        const apple = new URL('https://maps.apple.com/');
        apple.searchParams.set('q', local.nome || item.termo);
        if (coordenadas) apple.searchParams.set('ll', coordenadas);
        else apple.searchParams.set('address', destino);
        const waze = new URL('https://waze.com/ul');
        waze.searchParams.set(coordenadas ? 'll' : 'q', destino);
        if (coordenadas) waze.searchParams.set('navigate', 'yes');
        return [
            ['Google Maps', google.href],
            ['Apple Maps', apple.href],
            ['Waze', waze.href],
        ];
    }
    function pesquisar(termos, consulta) {
        const q = normalizar(consulta).slice(0, 160);
        const tokens = q.split(' ').filter(Boolean).slice(0, 16);
        return termos
            .map((item) => {
                let pontos = 0;
                let aproximado = false;
                for (const token of tokens) {
                    if (item.palavras.includes(token)) pontos += 100;
                    else if (item.palavras.some((p) => p.startsWith(token))) pontos += 70;
                    else if (item.texto.split(' ').some((p) => p.startsWith(token))) pontos += 30;
                    else {
                        const limite = token.length >= 8 ? 2 : token.length >= 4 ? 1 : 0;
                        if (
                            !limite ||
                            !item.palavras.some(
                                (p) => Math.abs(p.length - token.length) <= limite && distancia(token, p) <= limite,
                            )
                        )
                            return null;
                        pontos += 10;
                        aproximado = true;
                    }
                }
                if (q && item.nomes.includes(q)) pontos += 1000;
                return { item, pontos, aproximado };
            })
            .filter(Boolean)
            .sort((a, b) => b.pontos - a.pontos || a.item.termo.localeCompare(b.item.termo, 'pt-BR'));
    }
    return { preparar, pesquisar, mapas };
})();
if (typeof module !== 'undefined') module.exports = GlossarioUnB;
