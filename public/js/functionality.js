/* ============================================================
   CALCULADORA IRA UNB — LÓGICA PRINCIPAL
   Histórico de disciplinas, IRA e MP
   ============================================================ */

// ===========================
// CONSTANTES
// ===========================

const HORAS_POR_CREDITO = CalculosUnB.horasPorCredito;
const OPCOES_CREDITOS = [
    { texto: 'Créditos', valor: -1 },
    ...[1, 2, 3, 4, 6, 8, 10, 12].map((creditos) => ({
        texto: `${creditos} (${creditos * HORAS_POR_CREDITO}h)`,
        valor: creditos,
    })),
];

const OPCOES_MENCOES = [
    { texto: 'Menção', valor: -1 },
    { texto: 'SS', valor: 5 },
    { texto: 'MS', valor: 4 },
    { texto: 'MM', valor: 3 },
    { texto: 'MI', valor: 2 },
    { texto: 'II', valor: 1 },
    { texto: 'SR', valor: 0 },
];

const CHAVE_DADOS = 'calculadora-ira-unb';
let contadorDisciplina = 0;
let sincronizarArquivo = false;
let filaSalvamento = Promise.resolve();

document.addEventListener('DOMContentLoaded', inicializar);

async function inicializar() {
    const modo = AppUnB.ler('calculadora-unb:visualizacao-ira', 'expandido');
    document.querySelector(
        `[name="visualizacaoIra"][value="${modo === 'compacto' ? 'compacto' : 'expandido'}"]`,
    ).checked = true;
    document.body.classList.toggle('ira-compacto', modo === 'compacto');
    document.querySelectorAll('[name="visualizacaoIra"]').forEach((input) =>
        input.addEventListener('change', () => {
            document.body.classList.toggle('ira-compacto', input.value === 'compacto');
            AppUnB.salvar('calculadora-unb:visualizacao-ira', input.value);
        }),
    );
    const dadosNavegador = AppUnB.ler(CHAVE_DADOS, {});
    let dadosArquivo = null;
    if (document.querySelector('meta[name="sincronizar-arquivo"]')?.content === 'true') {
        try {
            const resposta = await fetch(new URL('load', AppUnB.raiz), { cache: 'no-store' });
            if (resposta.ok) {
                const recebido = await resposta.json();
                if (recebido && typeof recebido === 'object' && !Array.isArray(recebido)) {
                    dadosArquivo = recebido;
                    sincronizarArquivo = true;
                }
            }
        } catch {
            /* Continua usando os dados do navegador se o servidor estiver indisponível. */
        }
    }
    const temPeriodos = (dados) => Object.keys(dados).some((chave) => /^\d+$/.test(chave));
    const extrasNavegador = Object.fromEntries(
        Object.entries(dadosNavegador).filter(([chave]) => !/^\d+$/.test(chave)),
    );
    const dados = dadosArquivo && temPeriodos(dadosArquivo) ? { ...extrasNavegador, ...dadosArquivo } : dadosNavegador;
    AppUnB.salvar(CHAVE_DADOS, dados);
    Object.keys(dados)
        .filter((k) => /^\d+$/.test(k))
        .sort((a, b) => Number(a) - Number(b))
        .forEach((chave) => {
            criarPeriodo(true);
            const periodo = document.getElementById('periodos').lastElementChild;
            Object.keys(dados[chave] || {})
                .sort((a, b) => Number(a) - Number(b))
                .forEach((d) => {
                    adicionarDisciplina(periodo, dados[chave][d]);
                });
            if (!periodo.querySelector('.disciplina-row')) adicionarDisciplina(periodo);
        });
    if (!document.querySelector('.periodo')) criarPeriodo();
    document.getElementById('periodos').addEventListener('change', () => {
        calcularIra();
        salvarDados();
    });
    document.getElementById('periodos').addEventListener('input', salvarDados);
    calcularIra();
}

function coletarDados() {
    const anterior = AppUnB.ler(CHAVE_DADOS, {});
    const dados = {};
    document.querySelectorAll('#periodos .periodo').forEach((periodo, i) => {
        dados[i + 1] = {};
        periodo.querySelectorAll('.disciplina-row').forEach((disc, j) => {
            dados[i + 1][j + 1] = [
                disc.querySelector('.input-nome').value,
                disc.querySelector('.sel-creditos').selectedIndex,
                disc.querySelector('.sel-mencao').selectedIndex,
                disc.querySelector('.chk-modulo-livre').checked,
            ];
        });
    });
    if (anterior.intercambio) dados.intercambio = anterior.intercambio;
    if (anterior.horasCurso !== undefined) dados.horasCurso = anterior.horasCurso;
    return dados;
}

function salvarDados() {
    const dados = coletarDados();
    AppUnB.salvar(CHAVE_DADOS, dados);
    if (!sincronizarArquivo) return;
    filaSalvamento = filaSalvamento
        .catch(() => {})
        .then(async () => {
            const resposta = await fetch(new URL('save', AppUnB.raiz), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados),
            });
            if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        })
        .catch(() => {
            const aviso = document.getElementById('avisoPersistencia');
            aviso.hidden = false;
            aviso.textContent = 'Alterações salvas no navegador, mas não foi possível atualizar dados.json.';
        });
}

function calcularIra() {
    const resultado = CalculosUnB.historico(coletarDados());
    document
        .getElementById('ira-mp')
        .replaceChildren(
            AppUnB.elemento('span', '', `IRA: ${AppUnB.numero(resultado.ira)}`),
            AppUnB.elemento('span', '', `MP: ${AppUnB.numero(resultado.mp)}`),
        );
    const periodos = [...document.querySelectorAll('#periodos .periodo')];
    document.querySelectorAll('#periodos .ira-parcial').forEach((elemento) => elemento.remove());
    periodos.forEach((periodo, indice) => {
        const parcial = resultado.parciais[indice];
        if (!parcial) return;
        const cartao = document.createElement('div');
        cartao.className = 'ira-parcial';
        cartao.setAttribute('aria-live', 'polite');
        cartao.setAttribute('aria-label', `Acumulado até o ${parcial.periodo}º período`);
        cartao.title = `Acumulado até o ${parcial.periodo}º período`;
        cartao.append(
            AppUnB.elemento('span', 'ira-parcial-rotulo', 'Acumulado'),
            AppUnB.elemento('strong', '', `IRA ${AppUnB.numero(parcial.ira)} · MP ${AppUnB.numero(parcial.mp)}`),
        );
        periodo.querySelector('.periodo-rodape').append(cartao);
    });
}

function criarPeriodo(salvo = false) {
    const container = document.getElementById('periodos');
    const numeroPeriodo = container.querySelectorAll('.periodo').length + 1;

    const divPeriodo = document.createElement('div');
    divPeriodo.className = 'periodo';
    divPeriodo.dataset.periodo = numeroPeriodo;

    divPeriodo.innerHTML = `
        <div class="periodo-header">
            <h4>${numeroPeriodo}º Período</h4>
        </div>
        <div class="periodo-disciplinas"></div>
        <div class="periodo-rodape"><button type="button" class="btn btn-sm btn-outline-primary btn-add-disc"
                onclick="adicionarDisciplina(this.closest('.periodo'))">
            + Adicionar Disciplina
        </button></div>
    `;

    container.appendChild(divPeriodo);

    if (!salvo) {
        adicionarDisciplina(divPeriodo);
        calcularIra();
        salvarDados();
    }
}

function reindexarPeriodos() {
    const periodos = document.querySelectorAll('#periodos .periodo');
    periodos.forEach((periodo, indice) => {
        periodo.dataset.periodo = indice + 1;
        const titulo = periodo.querySelector('.periodo-header h4');
        if (titulo) titulo.textContent = `${indice + 1}º Período`;
    });
}

// ===========================
// DISCIPLINAS
// ===========================

function gerarOpcoesHtml(opcoes, indiceSelecionado = 0) {
    return opcoes
        .map((op, i) => {
            let attrs = [];
            if (op.valor === -1) {
                attrs.push('value=""', 'disabled', 'hidden');
                if (indiceSelecionado === 0) attrs.push('selected');
            } else {
                attrs.push(`value="${op.valor}"`);
                if (i === indiceSelecionado) attrs.push('selected');
            }
            return `<option ${attrs.join(' ')}>${op.texto}</option>`;
        })
        .join('');
}

function adicionarDisciplina(periodoEl, dados = null) {
    contadorDisciplina++;
    const id = `disc-${contadorDisciplina}`;
    const containerDisc = periodoEl.querySelector('.periodo-disciplinas');

    // Extrair dados (compatível com formato antigo de 2 ou 3 elementos)
    let nome = '';
    let indiceCred = 0;
    let indiceMenc = 0;
    let moduloLivre = false;

    if (dados) {
        if (dados.length >= 4) {
            nome = dados[0] || '';
            indiceCred = dados[1] || 0;
            indiceMenc = dados[2] || 0;
            moduloLivre = dados[3] || false;
        } else if (dados.length === 3) {
            nome = dados[0] || '';
            indiceCred = dados[1] || 0;
            indiceMenc = dados[2] || 0;
        } else if (dados.length === 2) {
            indiceCred = dados[0] || 0;
            indiceMenc = dados[1] || 0;
        }
    }

    const div = document.createElement('div');
    div.className = 'disciplina-row';
    div.dataset.discId = id;

    div.innerHTML = `
        <div class="row g-2 align-items-center">
            <div class="col-lg-4 col-md-4 col-sm-12 ira-nome-campo">
                <input type="text" class="form-control form-control-sm input-nome"
                       placeholder="Nome ou código da disciplina" aria-label="Nome ou código da disciplina"
                       title="Sugestões a partir de 3 caracteres. Você também pode escrever livremente."
                       role="combobox" aria-autocomplete="list" aria-expanded="false"
                       aria-controls="sugestoesDisciplinas" autocomplete="off" >
            </div>
            <div class="col-lg-2 col-md-2 col-4">
                <select class="form-select form-select-sm sel-creditos" aria-label="Créditos da disciplina" required>
                    ${gerarOpcoesHtml(OPCOES_CREDITOS, indiceCred)}
                </select>
            </div>
            <div class="col-lg-2 col-md-2 col-4">
                <select class="form-select form-select-sm sel-mencao" aria-label="Menção da disciplina" required>
                    ${gerarOpcoesHtml(OPCOES_MENCOES, indiceMenc)}
                </select>
            </div>
            <div class="col-lg-3 col-md-3 col-3 d-flex align-items-center">
                <div class="form-check m-0">
                    <input class="form-check-input chk-modulo-livre" type="checkbox" id="ml-${id}" ${moduloLivre ? 'checked' : ''}>
                    <label class="form-check-label small" style="color: var(--text-secondary);" for="ml-${id}" title="Não contabiliza na MP">Mód. Livre</label>
                </div>
            </div>
            <div class="col-lg-1 col-md-1 col-1 text-end">
                <button type="button" class="btn btn-sm btn-outline-danger btn-remover-disc"
                        onclick="removerDisciplina(this)" title="Remover disciplina" aria-label="Remover disciplina">×</button>
            </div>
        </div>
    `;

    div.querySelector('.input-nome').value = nome;
    containerDisc.appendChild(div);
    if (!dados) salvarDados();
}

function removerDisciplina(botao) {
    const discRow = botao.closest('.disciplina-row');
    const periodoEl = botao.closest('.periodo');
    const containerDisc = periodoEl.querySelector('.periodo-disciplinas');
    const todosPeridos = document.querySelectorAll('#periodos .periodo');

    // Não permite remover a única disciplina do único período (apenas limpa os campos)
    if (todosPeridos.length === 1 && containerDisc.children.length === 1) {
        discRow.querySelector('.input-nome').value = '';
        discRow.querySelector('.sel-creditos').selectedIndex = 0;
        discRow.querySelector('.sel-mencao').selectedIndex = 0;
        discRow.querySelector('.chk-modulo-livre').checked = false;
        calcularIra();
        salvarDados();
        return;
    }

    discRow.remove();

    // Se o período ficou sem disciplinas, remove o período
    if (containerDisc.children.length === 0) {
        periodoEl.remove();
        reindexarPeriodos();
    }

    calcularIra();
    salvarDados();
}
