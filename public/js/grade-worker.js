/* global importScripts, GradeCalculos */
importScripts('grade-calculos.js');
self.onmessage = (evento) => {
    try {
        const { tipo, pedidos, candidatos, parcial } = evento.data;
        self.postMessage({
            resultado:
                tipo === 'compatibilidade'
                    ? GradeCalculos.compatibilidades(pedidos, candidatos, { maxNos: 25000 })
                    : GradeCalculos.gerarGrades(pedidos, { maxResultados: 20, maxNos: 25000, parcial: !!parcial }),
        });
    } catch (erro) {
        self.postMessage({ erro: erro.message });
    }
};
