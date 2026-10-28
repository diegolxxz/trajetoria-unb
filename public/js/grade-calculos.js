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

    function validarPedidos(pedidos) {
        if (!Array.isArray(pedidos) || pedidos.length > 20) {
            throw new Error('Informe até 20 pedidos de disciplinas.');
        }
        const codigos = new Set();
        return pedidos.map((pedido) => {
            const codigo = normalizar(pedido?.codigo);
            if (!codigo || codigos.has(codigo)) throw new Error('Cada pedido precisa de um código único.');
            if (!Array.isArray(pedido.turmas)) throw new Error('Informe as turmas de cada pedido.');
            codigos.add(codigo);
            return { ...pedido, codigo, obrigatoria: pedido.obrigatoria !== false };
        });
    }

    function limitesBusca(opcoes) {
        const maxNos = opcoes.maxNos ?? 25000;
        const maxResultados = opcoes.maxResultados ?? 20;
        if (![maxNos, maxResultados].every((n) => Number.isSafeInteger(n) && n > 0)) {
            throw new Error('Os limites devem ser números inteiros positivos.');
        }
        return { maxNos: Math.min(maxNos, 25000), maxResultados: Math.min(maxResultados, 20) };
    }

    function buscarGrades(pedidos, opcoes, orcamento) {
        const grupos = [];
        const escolhas = [];
        const ocupados = new Set();
        let truncado = false;
        let horarioDesconhecido = false;
        function consumir() {
            if (orcamento.explorados >= orcamento.maxNos) {
                truncado = true;
                return false;
            }
            orcamento.explorados++;
            return true;
        }

        const preparados = pedidos.map((pedido) => {
            const horarios = new Map();
            // shortcut: retemos até 500 turmas por disciplina; ampliar só com paginação das variantes.
            const quantidade = Math.min(pedido.turmas.length, 500);
            if (pedido.turmas.length > quantidade) truncado = true;
            for (let i = 0; i < quantidade; i++) {
                if (!consumir()) break;
                const turma = pedido.turmas[i];
                const horario = parseHorario(turma?.horarios);
                if (!horario.valido) {
                    horarioDesconhecido = true;
                    continue;
                }
                const chaves = horario.blocos.map((b) => b.dia + b.periodo);
                const chave = chaves.join(',');
                if (!horarios.has(chave)) horarios.set(chave, { chaves, turmas: [] });
                horarios.get(chave).turmas.push(turma);
            }
            return { ...pedido, horarios: [...horarios.values()] };
        });

        let exigirTodas = !opcoes.parcial;
        function visitar(indice) {
            if (indice === preparados.length) {
                if (escolhas.length) grupos.push([...escolhas]);
                return;
            }
            const pedido = preparados[indice];
            const quantidade =
                pedido.horarios.length + ((pedido.obrigatoria && !opcoes.parcial) || exigirTodas ? 0 : 1);
            for (let i = 0; i < quantidade; i++) {
                if (grupos.length >= opcoes.maxResultados) {
                    truncado = true;
                    return;
                }
                if (!consumir()) return;
                if (i === pedido.horarios.length) {
                    visitar(indice + 1);
                } else {
                    const horario = pedido.horarios[i];
                    if (horario.chaves.some((chave) => ocupados.has(chave))) continue;
                    horario.chaves.forEach((chave) => ocupados.add(chave));
                    escolhas.push({ codigo: pedido.codigo, turmas: horario.turmas });
                    visitar(indice + 1);
                    escolhas.pop();
                    horario.chaves.forEach((chave) => ocupados.delete(chave));
                }
                if (orcamento.explorados >= orcamento.maxNos || grupos.length >= opcoes.maxResultados) {
                    // Só há truncamento quando ainda resta uma tentativa neste ramo.
                    if (i + 1 < quantidade) truncado = true;
                    if (truncado) return;
                }
            }
        }

        visitar(0);
        if (!opcoes.parcial && !grupos.length && preparados.some((p) => !p.obrigatoria)) {
            if (orcamento.explorados >= orcamento.maxNos) {
                truncado = true;
            } else {
                exigirTodas = false;
                visitar(0);
            }
        }
        grupos.sort((a, b) => b.length - a.length);
        const semTurmas = pedidos.filter((p) => p.obrigatoria && !p.turmas.length && !opcoes.parcial);
        let diagnostico = '';
        if (!grupos.length) {
            if (semTurmas.length) {
                diagnostico = 'Sem turmas elegíveis para: ' + semTurmas.map((p) => p.codigo).join(', ') + '.';
            } else if (truncado) {
                diagnostico = 'Busca inconclusiva: o limite foi atingido antes de verificar todas as alternativas.';
            } else if (horarioDesconhecido) {
                diagnostico = 'Não foi possível verificar todas as alternativas: há turmas sem horário válido.';
            } else {
                const obrigatorias = pedidos.filter((p) => p.obrigatoria && !opcoes.parcial).map((p) => p.codigo);
                diagnostico = obrigatorias.length
                    ? 'O conjunto de disciplinas obrigatórias não cabe em uma mesma grade: ' +
                      obrigatorias.join(', ') +
                      '.'
                    : 'Nenhuma grade não vazia foi encontrada.';
            }
        }
        return { grupos, truncado, diagnostico, horarioDesconhecido };
    }

    function gerarGrades(pedidos, opcoes = {}) {
        const normalizados = validarPedidos(pedidos);
        const limites = limitesBusca(opcoes);
        const orcamento = { maxNos: limites.maxNos, explorados: 0 };
        const { grupos, truncado, diagnostico } = buscarGrades(normalizados, { ...opcoes, ...limites }, orcamento);
        return { grupos, truncado, explorados: orcamento.explorados, diagnostico };
    }

    function compatibilidades(pedidos, candidatos, opcoes = {}) {
        const obrigatorias = validarPedidos(pedidos).filter((p) => p.obrigatoria);
        const limites = limitesBusca(opcoes);
        if (!Array.isArray(candidatos) || candidatos.length > 500) {
            throw new Error('Informe até 500 candidatas por verificação.');
        }
        const orcamento = { maxNos: limites.maxNos, explorados: 0 };
        let truncado = false;
        const estados = candidatos.map((candidata) => {
            const codigo = normalizar(candidata?.codigo);
            if (!codigo || !candidata?.turma || typeof candidata.turma !== 'object') {
                throw new Error('Cada candidata precisa de código e turma.');
            }
            const id = idTurma(codigo, candidata.turma);
            if (orcamento.explorados >= orcamento.maxNos) {
                truncado = true;
                return { codigo, id, estado: 'desconhecido' };
            }
            const forcar = obrigatorias.filter((p) => p.codigo !== codigo);
            forcar.push({ codigo, obrigatoria: true, turmas: [candidata.turma] });
            const resultado = buscarGrades(forcar, { maxResultados: 1 }, orcamento);
            let estado = 'desconhecido';
            if (resultado.grupos.length) {
                estado = 'compativel';
            } else if (!resultado.truncado && !resultado.horarioDesconhecido) {
                estado = 'incompativel';
            }
            if (resultado.truncado && !resultado.grupos.length) truncado = true;
            return { codigo, id, estado };
        });
        return { estados, truncado, explorados: orcamento.explorados };
    }

    return { parseHorario, haConflito, idTurma, gerarCombinacoes, gerarGrades, compatibilidades, periodos };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = GradeCalculos;
