/* global GradeCalculos, module, require */
const GradeArquivos = (() => {
    const calculos = typeof module !== 'undefined' && module.exports ? require('./grade-calculos.js') : GradeCalculos;
    const copiar = (valor) => JSON.parse(JSON.stringify(valor));
    const falhar = () => {
        throw new Error('Backup ou plano inválido: confira os campos, limites e datas.');
    };
    const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    function texto(v, max = 200, vazio = false) {
        if (typeof v !== 'string' || v.length > max || (!vazio && !v.trim()) || v.includes(String.fromCharCode(0)))
            falhar();
        return v;
    }
    function lista(v, max) {
        if (!Array.isArray(v) || v.length > max) falhar();
        return v;
    }
    function data(v) {
        if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) falhar();
        const d = new Date(v + 'T00:00:00Z');
        if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== v) falhar();
        return d;
    }
    function turma(v) {
        if (!objeto(v)) falhar();
        const textos = (valores, max, tamanho) => lista(valores, max).map((s) => texto(s, tamanho));
        for (const campo of ['vagas', 'matriculados']) {
            if (v[campo] !== null && (!Number.isSafeInteger(v[campo]) || v[campo] < 0 || v[campo] > 1000000)) falhar();
        }
        const professores = lista(v.professores, 100).map((p) => {
            if (typeof p === 'string') return texto(p, 300);
            if (
                !objeto(p) ||
                (p.cargaHoraria !== null &&
                    (!Number.isFinite(p.cargaHoraria) || p.cargaHoraria < 0 || p.cargaHoraria > 10000))
            )
                falhar();
            return { nome: texto(p.nome, 300), cargaHoraria: p.cargaHoraria };
        });
        return {
            numero: texto(v.numero, 40),
            horarios: textos(v.horarios, 100, 200),
            professores,
            local: v.local === null ? null : texto(v.local, 1000, true),
            vagas: v.vagas,
            matriculados: v.matriculados,
            unidades: textos(v.unidades, 100, 300),
        };
    }
    function normalizarPlano(p) {
        if (!objeto(p)) falhar();
        const id = texto(p.id, 100);
        const nome = texto(p.nome);
        if (typeof p.semestre !== 'string' || !/^20\d{2}\.[12]$/.test(p.semestre)) falhar();
        const codigos = new Set();
        const disciplinas = lista(p.disciplinas, 20).map((d) => {
            if (!objeto(d) || typeof d.obrigatoria !== 'boolean') falhar();
            const codigo = texto(d.codigo, 40);
            if (codigos.has(codigo)) falhar();
            codigos.add(codigo);
            const disciplina = { codigo, obrigatoria: d.obrigatoria };
            if (d.ativa !== undefined) {
                if (typeof d.ativa !== 'boolean') falhar();
                disciplina.ativa = d.ativa;
            }
            if (d.permitidas !== undefined) {
                if (d.permitidas === null) disciplina.permitidas = null;
                else {
                    const permitidas = lista(d.permitidas, 500).map((id) => texto(id, 4000));
                    if (!permitidas.length || new Set(permitidas).size !== permitidas.length) falhar();
                    disciplina.permitidas = permitidas;
                }
            }
            return disciplina;
        });
        const escolhidas = new Set();
        const selecionadas = lista(p.selecionadas, 20).map((s) => {
            if (!objeto(s)) falhar();
            const codigo = texto(s.codigo, 40);
            if (!codigos.has(codigo) || escolhidas.has(codigo)) falhar();
            escolhidas.add(codigo);
            return { codigo, nome: texto(s.nome, 500), turma: turma(s.turma) };
        });
        for (const campo of ['inicio', 'fim']) if (p[campo] !== '') data(p[campo]);
        const plano = { id, nome, semestre: p.semestre, disciplinas, selecionadas, inicio: p.inicio, fim: p.fim };
        if (p.filtros !== undefined) {
            if (!objeto(p.filtros)) falhar();
            plano.filtros = {};
            for (const campo of ['vagas', 'encaixe', 'extras']) {
                if (typeof p.filtros[campo] !== 'boolean') falhar();
                plano.filtros[campo] = p.filtros[campo];
            }
        }
        return plano;
    }
    function validarBackup(b) {
        if (!objeto(b) || b.versao !== 1) falhar();
        const planos = lista(b.planos, 20).map(normalizarPlano);
        const ids = new Set(planos.map((p) => p.id));
        if (ids.size !== planos.length || (planos.length ? !ids.has(b.ativo) : b.ativo !== '')) falhar();
        return { versao: 1, ativo: b.ativo, planos };
    }
    function criarHistorico(inicial) {
        return { passado: [], atual: copiar(inicial), futuro: [] };
    }
    function registrar(h, proximo) {
        if (JSON.stringify(h.atual) === JSON.stringify(proximo)) return copiar(h);
        return copiar({ passado: [...h.passado, h.atual].slice(-50), atual: proximo, futuro: [] });
    }
    function desfazer(h) {
        if (!h.passado.length) return copiar(h);
        return copiar({
            passado: h.passado.slice(0, -1),
            atual: h.passado.at(-1),
            futuro: [h.atual, ...h.futuro].slice(0, 50),
        });
    }
    function refazer(h) {
        if (!h.futuro.length) return copiar(h);
        return copiar({ passado: [...h.passado, h.atual].slice(-50), atual: h.futuro[0], futuro: h.futuro.slice(1) });
    }
    const escapar = (v) =>
        String(v)
            .replace(/\\/g, '\\\\')
            .replace(/\r\n|\r|\n/g, '\\n')
            .replace(/,/g, '\\,')
            .replace(/;/g, '\\;');
    function dobrar(linha) {
        let atual = '';
        let octetos = 0;
        const partes = [];
        for (const letra of linha) {
            const tamanho = new TextEncoder().encode(letra).length;
            if (octetos + tamanho > 75) {
                partes.push(atual);
                atual = ' ';
                octetos = 1;
            }
            atual += letra;
            octetos += tamanho;
        }
        partes.push(atual);
        return partes.join('\r\n');
    }
    const stamp = (d) =>
        d
            .toISOString()
            .replace(/[-:]/g, '')
            .replace(/\.\d{3}Z$/, 'Z');
    const diaCompacto = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
    const hora = (m) => String(Math.floor(m / 60)).padStart(2, '0') + String(m % 60).padStart(2, '0') + '00';
    function calendario(plano) {
        const p = normalizarPlano(plano);
        const inicio = data(p.inicio);
        const fim = data(p.fim);
        if (inicio.getUTCFullYear() < 2020 || fim < inicio || (fim - inicio) / 86400000 > 366) falhar();
        const linhas = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Trajetoria UnB//Grade//PT-BR',
            'CALSCALE:GREGORIAN',
            'BEGIN:VTIMEZONE',
            'TZID:America/Sao_Paulo',
            'BEGIN:STANDARD',
            'DTSTART:20200101T000000',
            'TZOFFSETFROM:-0300',
            'TZOFFSETTO:-0300',
            'TZNAME:-03',
            'END:STANDARD',
            'END:VTIMEZONE',
        ];
        const ate = stamp(new Date(fim.getTime() + 86400000 + 3 * 3600000 - 1000));
        const agora = stamp(new Date());
        for (const selecionada of p.selecionadas) {
            const parse = calculos.parseHorario(selecionada.turma.horarios);
            if (!parse.valido) throw new Error('Horário inválido: não é possível exportar o calendário.');
            const intervalos = [];
            for (const bloco of parse.blocos) {
                const ultimo = intervalos.at(-1);
                if (ultimo && ultimo.dia === bloco.dia && ultimo.fim === bloco.inicio) ultimo.fim = bloco.fim;
                else intervalos.push({ ...bloco });
            }
            for (const bloco of intervalos) {
                const primeiro = new Date(inicio);
                primeiro.setUTCDate(primeiro.getUTCDate() + ((bloco.dia - 1 - primeiro.getUTCDay() + 7) % 7));
                if (primeiro > fim) continue;
                const uid =
                    [p.id, selecionada.codigo, selecionada.turma.numero, bloco.dia, bloco.inicio, bloco.fim]
                        .map((v) => encodeURIComponent(v))
                        .join('-') + '@trajetoria.unb';
                linhas.push(
                    'BEGIN:VEVENT',
                    'UID:' + uid,
                    'DTSTAMP:' + agora,
                    'DTSTART;TZID=America/Sao_Paulo:' + diaCompacto(primeiro) + 'T' + hora(bloco.inicio),
                    'DTEND;TZID=America/Sao_Paulo:' + diaCompacto(primeiro) + 'T' + hora(bloco.fim),
                    'RRULE:FREQ=WEEKLY;UNTIL=' + ate,
                    'SUMMARY:' +
                        escapar(selecionada.codigo + ' — ' + selecionada.nome + ' — Turma ' + selecionada.turma.numero),
                    'LOCATION:' + escapar(selecionada.turma.local ?? ''),
                    'DESCRIPTION:' +
                        escapar(
                            selecionada.turma.professores.map((p) => (typeof p === 'string' ? p : p.nome)).join(', '),
                        ),
                    'END:VEVENT',
                );
            }
        }
        linhas.push('END:VCALENDAR');
        return linhas.map(dobrar).join('\r\n') + '\r\n';
    }
    return { validarBackup, criarHistorico, registrar, desfazer, refazer, calendario };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = GradeArquivos;
