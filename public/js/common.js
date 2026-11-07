const AppUnB = (() => {
    const chavePerfil = 'calculadora-unb:perfil-intercambio:v1';
    const botoesCurso = [];
    const raiz = new URL('/', location.href);
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
        const salvo = salvar(chavePerfil, { ...perfil(), ...campos });
        atualizarCursos();
        return salvo;
    }
    function opcaoCurso(select, nome) {
        const chave = (valor) =>
            CalculosUnB.normalizar(CalculosUnB.cursoBase(String(valor).trim().replace(/\s+/g, ' ')));
        return [...select.options].find((o) => o.value && chave(o.value) === chave(nome || ''));
    }
    function preencherCurso(select, nome) {
        select.value = opcaoCurso(select, nome)?.value || '';
    }
    function atualizarCursos() {
        botoesCurso.forEach((atualizar) => atualizar());
    }
    function iniciarCurso(select, persistir = true, botao = null) {
        botao ||= elemento('button', 'usar-curso-salvo', 'Usar meu curso');
        botao.type = 'button';
        botao.setAttribute('aria-controls', select.id);
        const grupo = elemento('div', 'seletor-curso');
        const campo = select.closest('label') || select;
        campo.replaceWith(grupo);
        grupo.append(campo, botao);
        const atualizar = () => {
            const opcao = opcaoCurso(select, perfil().curso);
            botao.hidden = !opcao || select.value === opcao.value;
        };
        botoesCurso.push(atualizar);
        select.addEventListener('change', () => {
            if (persistir && select.value) salvarPerfil({ curso: select.value });
            atualizarCursos();
        });
        botao.addEventListener('click', () => {
            preencherCurso(select, perfil().curso);
            select.dispatchEvent(new document.defaultView.Event('change', { bubbles: true }));
        });
        atualizar();
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
    const numerosDosInputs = new WeakMap();
    function casasNumero(input) {
        const casas = input.getAttribute('data-casas');
        return casas === null || casas === undefined
            ? ((input.getAttribute('step') || '0.0001').split('.')[1]?.length ?? 0)
            : Number(casas);
    }
    function preencherNumero(input, valor) {
        const bruto = valor == null ? '' : String(valor);
        const n = bruto.trim() === '' ? NaN : Number(bruto);
        const casas = casasNumero(input);
        const escala = 10 ** casas;
        let exibido = bruto;
        if (Number.isFinite(n)) {
            // Arredonda valores fora do intervalo para fora, sem torná-los válidos na borda.
            const limitado =
                n < Number(input.getAttribute('min'))
                    ? Math.floor(n * escala) / escala
                    : n > Number(input.getAttribute('max'))
                      ? Math.ceil(n * escala) / escala
                      : n;
            exibido = String(Number(limitado.toFixed(casas)));
        }
        input.value = exibido;
        // O valor original só é substituído quando este campo recebe uma edição.
        numerosDosInputs.set(input, { bruto, exibido: input.value });
    }
    function valorNumero(input) {
        const salvo = numerosDosInputs.get(input);
        return salvo?.exibido === input.value ? salvo.bruto : input.value;
    }
    function editarNumero(input) {
        // Não reatribui valores curtos: preserva o cursor e o separador decimal em edição.
        const decimais = input.value.split('.')[1]?.length ?? 0;
        if (/[eE]/.test(input.value) || decimais > casasNumero(input)) preencherNumero(input, input.value);
        numerosDosInputs.set(input, { bruto: input.value, exibido: input.value });
        return input.value;
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
    return {
        raiz,
        ler,
        salvar,
        perfil,
        salvarPerfil,
        preencherCurso,
        iniciarCurso,
        atualizarCursos,
        chavePerfil,
        numero,
        preencherNumero,
        valorNumero,
        editarNumero,
        idiomas,
        elemento,
    };
})();
