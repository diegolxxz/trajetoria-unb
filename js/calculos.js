/* Funções compartilhadas, sem dependência da interface. */
const CalculosUnB = (() => {
    const creditos = [null, 1, 2, 3, 4, 6, 8, 10, 12];
    const mencoes = [null, 5, 4, 3, 2, 1, 0];
    const horasPorCredito = 15;

    function historico(dados = {}) {
        let pontosIra = 0, pesosIra = 0, pontosMp = 0, pesosMp = 0, horas = 0;
        const parciais = [];
        Object.keys(dados).filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b)).forEach((k, i) => {
            const pesoPeriodo = Math.min(i + 1, 6);
            Object.values(dados[k] || {}).forEach(d => {
                if (!Array.isArray(d)) return;
                const antigo = d.length === 2;
                const credito = creditos[d[antigo ? 0 : 1]];
                const mencao = mencoes[d[antigo ? 1 : 2]];
                if (!Number.isFinite(credito) || !Number.isFinite(mencao)) return;
                pontosIra += credito * mencao * pesoPeriodo;
                pesosIra += credito * pesoPeriodo;
                if (!d[3]) { pontosMp += credito * mencao; pesosMp += credito; }
                if (mencao >= 3) horas += credito * horasPorCredito;
            });
            parciais.push({ periodo: Number(k), ira: pesosIra ? pontosIra / pesosIra : 0,
                mp: pesosMp ? pontosMp / pesosMp : 0 });
        });
        return { ira: pesosIra ? pontosIra / pesosIra : 0, mp: pesosMp ? pontosMp / pesosMp : 0,
            horas, temDisciplinas: pesosIra > 0, parciais };
    }

    function nota(ira, ipfPercentual, media, desvio, formula) {
        if (formula?.tipo === 'ira-direto') {
            if (![ira, ipfPercentual, formula.pesoIra, formula.pesoIpf].every(Number.isFinite) ||
                ira < 0 || ira > 5 || ipfPercentual < 0 || ipfPercentual > 100) return null;
            return { padronizado: null, final: ira * formula.pesoIra + ipfPercentual / 100 * formula.pesoIpf };
        }
        if (![ira, ipfPercentual, media, desvio, formula?.pesoIra, formula?.pesoIpf].every(Number.isFinite) ||
            ira < 0 || ira > 5 || ipfPercentual < 0 || ipfPercentual > 100 || desvio <= 0) return null;
        const padronizado = (ira - media) / desvio;
        return { padronizado, final: padronizado * formula.pesoIra + ipfPercentual / 100 * formula.pesoIpf };
    }

    function cursoBase(nome) { return nome.replace(/\s*[-–—]\s*(DIURNO|NOTURNO)\s*$/i, '').trim(); }
    function normalizar(texto) { return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
    function alocado(texto) {
        const valor = normalizar(texto).trim();
        return Boolean(valor && valor !== 'n/a' && valor !== '-' && !valor.startsWith('nao alocado') &&
            !valor.startsWith('inscricao nao homologada') && !valor.startsWith('nao consta na alocacao') &&
            !valor.startsWith('desistente') && !valor.startsWith('vide '));
    }
    return { creditos, mencoes, horasPorCredito, historico, nota, cursoBase, normalizar, alocado };
})();
if (typeof module !== 'undefined') module.exports = CalculosUnB;
