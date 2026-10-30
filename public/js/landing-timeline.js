const LandingTimeline = (() => {
    const duracao = 7.2;
    const destinos = [0, 2.65, 4.4, 6.15];
    const limitar = (valor) => Math.min(1, Math.max(0, valor));
    const suave = (a, b, valor) => {
        const t = limitar((valor - a) / (b - a));
        return limitar(t * t * t * (t * (t * 6 - 15) + 10));
    };
    const janelas = [
        [0, 0, 0.6, 1.15],
        [1.8, 2.35, 3.05, 3.55],
        [3.55, 4.1, 4.8, 5.3],
        [5.3, 5.85, 6.55, duracao],
    ];
    function estado(tempo) {
        const t = Math.min(duracao, Math.max(0, tempo));
        const paineis = janelas.map(([inicio, fimEntrada, inicioSaida, fim]) => {
            const entrada = fimEntrada === 0 ? 1 : suave(inicio, fimEntrada, t);
            const saida = suave(inicioSaida, fim, t);
            return { opacidade: entrada * (1 - saida), entrada, saida };
        });
        const maximo = Math.max(...paineis.map((p) => p.opacidade));
        const ativo = maximo > 0.1 ? paineis.findIndex((p) => p.opacidade === maximo) : -1;
        const portal = limitar((t - 0.65) / 1.35);
        const depoisPortal = t >= 2;
        const etapa = depoisPortal ? 1 + suave(3.05, 4.1, t) + suave(4.8, 5.85, t) : 0;
        const opacidade = (depoisPortal ? suave(2, 2.4, t) : 1 - suave(0.8, 1, portal)) * (1 - suave(6.55, duracao, t));
        return { paineis, ativo, portal: depoisPortal ? 0 : portal, etapa, opacidade, progresso: t / duracao };
    }
    return { duracao, destinos, estado };
})();
if (typeof module !== 'undefined') module.exports = LandingTimeline;
