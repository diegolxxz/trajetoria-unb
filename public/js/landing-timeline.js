const LandingTimeline = (() => {
    const duracao = 7.2;
    const destinos = [0, 2.95, 4.85, 6.8];
    const limitar = (valor) => Math.min(1, Math.max(0, valor));
    const suave = (a, b, valor) => {
        const t = limitar((valor - a) / (b - a));
        return limitar(t * t * t * (t * (t * 6 - 15) + 10));
    };
    const inicios = [0, 1.55, 3.45, 5.35];
    function estado(tempo) {
        const t = Math.min(duracao, Math.max(0, tempo));
        const paineis = inicios.map((inicio, i) => {
            if (i === 0) {
                const saida = suave(0.65, 1.15, t);
                return { opacidade: 1 - saida, texto: 1 - saida, entrada: 1, saida, demonstracao: 0 };
            }
            const proximo = inicios[i + 1] ?? duracao + 1;
            const entrada = suave(inicio, inicio + 0.7, t);
            const saida = suave(proximo + 0.2, proximo + 0.65, t);
            const texto = suave(inicio + 0.2, inicio + 0.7, t) * (1 - suave(proximo, proximo + 0.2, t));
            return {
                opacidade: entrada * (1 - saida),
                texto,
                entrada,
                saida,
                demonstracao: suave(inicio + 0.7, inicio + 1.4, t),
            };
        });
        const maximo = Math.max(...paineis.map((p) => p.texto));
        const ativo = maximo > 0.1 ? paineis.findIndex((p) => p.texto === maximo) : -1;
        const portal = limitar((t - 0.65) / 1.25);
        const opacidade = 1 - suave(1.65, 2.05, t);
        return { paineis, ativo, portal, etapa: 0, opacidade, viagem: 0, progresso: t / duracao };
    }
    return { duracao, destinos, estado };
})();
if (typeof module !== 'undefined') module.exports = LandingTimeline;
