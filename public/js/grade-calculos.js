/* Cálculos de grade sem dependência da interface ou da rede. */
const GradeCalculos = (() => {
    const periodos = [
        ['M1', 480, 535],
        ['M2', 535, 590],
        ['M3', 600, 655],
        ['M4', 655, 710],
        ['M5', 720, 775],
        ['T1', 775, 830],
        ['T2', 840, 895],
        ['T3', 895, 950],
        ['T4', 960, 1015],
        ['T5', 1015, 1070],
        ['T6', 1080, 1135],
        ['N1', 1140, 1190],
        ['N2', 1190, 1240],
        ['N3', 1250, 1300],
        ['N4', 1300, 1350],
    ].map(([periodo, inicio, fim]) => Object.freeze({ periodo, inicio, fim }));
    Object.freeze(periodos);
    const porPeriodo = new Map(periodos.map((p) => [p.periodo, p]));

    function parseHorario(entrada) {
        const partes = Array.isArray(entrada) ? entrada : [entrada];
        const invalidos = [];
        const unicos = new Map();
        for (const parte of partes) {
            if (typeof parte !== 'string' || !parte.trim()) {
                invalidos.push(typeof parte === 'string' ? parte : String(parte ?? ''));
                continue;
            }
            for (const token of parte.split(/[\s·]+/).filter(Boolean)) {
                const match = /^([1-7]+)([MTN])([1-6]+)$/i.exec(token);
                if (!match || [...match[3]].some((s) => !porPeriodo.has(match[2].toUpperCase() + s))) {
                    invalidos.push(token);
                    continue;
                }
                for (const dia of match[1]) {
                    for (const slot of match[3]) {
                        const periodo = match[2].toUpperCase() + slot;
                        unicos.set(dia + periodo, { dia: Number(dia), ...porPeriodo.get(periodo) });
                    }
                }
            }
        }
        const blocos = [...unicos.values()].sort((a, b) => a.dia - b.dia || a.inicio - b.inicio);
        return { valido: blocos.length > 0 && invalidos.length === 0, blocos, invalidos };
    }

    function haConflito(aHorarios, bHorarios) {
        const ocupados = new Set(parseHorario(aHorarios).blocos.map((b) => b.dia + b.periodo));
        return parseHorario(bHorarios).blocos.some((b) => ocupados.has(b.dia + b.periodo));
    }

    function normalizar(valor) {
        return String(valor ?? '')
            .trim()
            .replace(/\s+/g, ' ');
    }

    function idTurma(codigo, turma) {
        const ordenar = (valores) => (Array.isArray(valores) ? valores : [valores]).map(normalizar).sort();
        return JSON.stringify([
            normalizar(codigo),
            normalizar(turma.numero),
            ordenar(turma.horarios),
            ordenar((turma.professores || []).map((professor) => professor?.nome ?? professor)),
            normalizar(turma.local),
        ]);
    }

    function gerarCombinacoes(pedidos, opcoes = {}) {
        if (!Array.isArray(pedidos) || pedidos.length > 20) {
            throw new Error('Informe até 20 pedidos de disciplinas.');
        }
        const codigos = new Set();
        const grupos = pedidos.map((pedido) => {
            const codigo = normalizar(pedido?.codigo);
            if (!codigo || codigos.has(codigo)) throw new Error('Cada pedido precisa de um código único.');
            if (!Array.isArray(pedido.turmas)) throw new Error('Informe as turmas de cada pedido.');
            codigos.add(codigo);
            return { ...pedido, codigo };
        });
        const maxResultados = opcoes.maxResultados ?? 20;
        const maxNos = opcoes.maxNos ?? 25000;
        if (![maxResultados, maxNos].every((n) => Number.isSafeInteger(n) && n > 0)) {
            throw new Error('Os limites devem ser números inteiros positivos.');
        }
        const combinacoes = [];
        const escolhidas = [];
        const ocupados = new Set();
        let explorados = 0;
        let truncado = false;

        function visitar(indice) {
            if (indice === grupos.length) {
                if (escolhidas.length) combinacoes.push([...escolhidas]);
                return;
            }
            const pedido = grupos[indice];
            const quantidade = pedido.turmas.length + (pedido.obrigatoria ? 0 : 1);
            for (let i = 0; i < quantidade; i++) {
                if (explorados >= maxNos || combinacoes.length >= maxResultados) {
                    truncado = true;
                    return;
                }
                explorados++;
                if (i === pedido.turmas.length) {
                    visitar(indice + 1);
                } else {
                    const turma = pedido.turmas[i];
                    const horario = parseHorario(turma?.horarios);
                    if (!horario.valido) continue;
                    const chaves = horario.blocos.map((b) => b.dia + b.periodo);
                    if (chaves.some((chave) => ocupados.has(chave))) continue;
                    chaves.forEach((chave) => ocupados.add(chave));
                    escolhidas.push({ codigo: pedido.codigo, turma });
                    visitar(indice + 1);
                    escolhidas.pop();
                    chaves.forEach((chave) => ocupados.delete(chave));
                }
                if (truncado) return;
            }
        }

        visitar(0);
        return { combinacoes, truncado, explorados };
    }

    return { parseHorario, haConflito, idTurma, gerarCombinacoes, periodos };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = GradeCalculos;
