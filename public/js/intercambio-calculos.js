/* global module, require */
const IntercambioCalculos = (() => {
    const calculos = typeof module !== 'undefined' ? require('./calculos.js') : CalculosUnB;
    function cursoChave(nome) {
        return calculos
            .cursoBase(
                String(nome ?? '')
                    .replace(/\s+/g, ' ')
                    .trim(),
            )
            .normalize('NFC')
            .toLocaleUpperCase('pt-BR');
    }
    function numero(valor, maximo) {
        if (valor == null || String(valor).trim() === '') return null;
        const n = Number(valor);
        return Number.isFinite(n) && n >= 0 && n <= maximo ? n : null;
    }
    function comparar(editais, { curso = '', ira, ipf } = {}) {
        ira = numero(ira, 5);
        ipf = numero(ipf, 100);
        return editais.map((edital) => {
            const referencias = edital.cursos.filter((c) => cursoChave(c.nome) === cursoChave(curso));
            const encontradas = referencias.flatMap((c) => c.variantes);
            const variantes = encontradas.length ? encontradas : [{}];
            return {
                slug: edital.slug,
                titulo: edital.titulo,
                temCurso: referencias.length > 0,
                mobilidade: edital.mobilidade,
                fontes: edital.fontes,
                formula: edital.formula,
                metodoReferencias: edital.metodoReferencias,
                referencias: variantes.map((v, indice) => ({
                    ...v,
                    indice: indice + 1,
                    media: Number.isFinite(v.media) ? v.media : null,
                    desvio: Number.isFinite(v.desvio) ? v.desvio : null,
                    diferenca: ira !== null && Number.isFinite(v.media) ? ira - v.media : null,
                    nota: v.motivo ? null : calculos.nota(ira, ipf, v.media, v.desvio, edital.formula),
                })),
                alocados: edital.resultados.filter((r) => r.alocacao != null && calculos.alocado(r.alocacao)),
            };
        });
    }
    return { comparar, numero, cursoChave };
})();
if (typeof module !== 'undefined') module.exports = IntercambioCalculos;
