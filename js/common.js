const AppUnB = (() => {
    const chavePerfil = 'calculadora-unb:perfil-intercambio:v1';
    const raiz = new URL(document.querySelector('meta[name="app-root"]').content, location.href);
    function ler(chave, fallback = null) {
        try {
            return JSON.parse(localStorage.getItem(chave)) ?? fallback;
        } catch {
            return fallback;
        }
    }
    function salvar(chave, dados) {
        try {
            localStorage.setItem(chave, JSON.stringify(dados));
            return true;
        } catch {
            const aviso = document.getElementById('avisoPersistencia');
            if (aviso) {
                aviso.hidden = false;
                aviso.textContent =
                    'O navegador não permitiu salvar seus dados. Você pode calcular, mas precisará digitá-los novamente ao sair.';
            }
            return false;
        }
    }
    function perfil() {
        const atual = ler(chavePerfil);
        if (atual && typeof atual === 'object') return atual;
        const legado = ler('calculadora-ira-unb', {});
        const inter = legado.intercambio || {};
        const calculado = CalculosUnB.historico(legado);
        const horasCurso = Number(legado.horasCurso ?? inter.horasCurso);
        return {
            ira: inter.modoManual ? (inter.iraManual ?? '') : calculado.temDisciplinas ? String(calculado.ira) : '',
            ipf: inter.modoManual
                ? (inter.ipfManual ?? '')
                : horasCurso > 0 && calculado.temDisciplinas
                  ? String((100 * calculado.horas) / horasCurso)
                  : '',
            curso:
                typeof inter.cursoSelecionado === 'string' &&
                !/^\d+$/.test(inter.cursoSelecionado) &&
                inter.cursoSelecionado !== 'manual'
                    ? CalculosUnB.cursoBase(inter.cursoSelecionado)
                    : '',
        };
    }
    function salvarPerfil(campos) {
        return salvar(chavePerfil, { ...perfil(), ...campos });
    }
    function tema() {
        let valor = 'escuro';
        try {
            valor = localStorage.getItem('calculadora-ira-tema') || valor;
        } catch {}
        document.documentElement.dataset.tema = valor;
        const metaTema = document.querySelector('meta[name="theme-color"]');
        if (metaTema) metaTema.content = valor === 'escuro' ? '#1b1d21' : '#ffffff';
        iconeTema();
    }
    function iconeTema() {
        const botao = document.getElementById('btnTema');
        const escuro = document.documentElement.dataset.tema === 'escuro';
        if (botao) {
            botao.textContent = escuro ? '☀️' : '🌙';
            botao.setAttribute('aria-label', escuro ? 'Ativar tema claro' : 'Ativar tema escuro');
        }
    }
    function alternarTema() {
        const novo = document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro';
        document.documentElement.dataset.tema = novo;
        try {
            localStorage.setItem('calculadora-ira-tema', novo);
        } catch {}
        iconeTema();
    }
    function numero(valor, casas = 4) {
        return Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: Math.min(4, casas) });
    }
    function idiomas(valor) {
        const linhas = [];
        String(valor ?? '')
            .replace(/\bHSK\s+level\s+(\d+)\b/gi, 'HSK $1')
            .split(/[,;\n]+|\s+e\s+/i)
            .map((v) => v.trim())
            .filter(Boolean)
            .forEach((parte) => {
                // Algumas publicações separam o nível do idioma por ponto e vírgula.
                if (/^(?:[ABC][12]|N[1-5])$/i.test(parte) && linhas.length) linhas[linhas.length - 1] += ` ${parte}`;
                else linhas.push(parte);
            });
        return linhas.join('\n');
    }
    function elemento(tag, classe, texto) {
        const el = document.createElement(tag);
        if (classe) el.className = classe;
        if (texto !== undefined) el.textContent = texto;
        return el;
    }
    document.addEventListener('DOMContentLoaded', () => {
        tema();
        document.getElementById('btnTema')?.addEventListener('click', alternarTema);
    });
    return { raiz, ler, salvar, perfil, salvarPerfil, chavePerfil, numero, idiomas, elemento };
})();
