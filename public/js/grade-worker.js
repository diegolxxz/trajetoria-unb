/* global importScripts, GradeCalculos */
importScripts('grade-calculos.js');
self.onmessage = (evento) => {
    try {
        self.postMessage({
            resultado: GradeCalculos.gerarCombinacoes(evento.data, { maxResultados: 20, maxNos: 25000 }),
        });
    } catch (erro) {
        self.postMessage({ erro: erro.message });
    }
};
