/* ============================================================
   CALCULADORA IRA UNB — LÓGICA PRINCIPAL
   Reescrita completa: mais limpo, localStorage, seletor de cursos
   ============================================================ */

// ===========================
// CONSTANTES
// ===========================

const OPCOES_CREDITOS = [
    { texto: 'Créditos', valor: -1 },
    { texto: '1',  valor: 1 },
    { texto: '2',  valor: 2 },
    { texto: '3',  valor: 3 },
    { texto: '4',  valor: 4 },
    { texto: '6',  valor: 6 },
    { texto: '8',  valor: 8 },
    { texto: '10', valor: 10 },
    { texto: '12', valor: 12 },
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

const CURSOS = [
    { nome: 'ADMINISTRAÇÃO', media: 3.478086994, desvio: 0.913469746 },
    { nome: 'AGRONOMIA', media: 3.251711192, desvio: 0.737009302 },
    { nome: 'ARQUITETURA E URBANISMO', media: 4.001342377, desvio: 0.750879614 },
    { nome: 'ARTES CÊNICAS', media: 4.131679452, desvio: 1.117962677 },
    { nome: 'ARTES CÊNICAS - INTERPRETAÇÃO TEATRAL', media: 4.291934328, desvio: 1.051549668 },
    { nome: 'ARTES VISUAIS', media: 4.045295693, desvio: 1.058940409 },
    { nome: 'BIBLIOTECONOMIA', media: 3.983608669, desvio: 0.823589686 },
    { nome: 'BIOTECNOLOGIA', media: 3.623256856, desvio: 0.885530046 },
    { nome: 'CIÊNCIA DA COMPUTAÇÃO', media: 3.73551684, desvio: 0.7197099 },
    { nome: 'CIÊNCIA POLÍTICA', media: 3.96155, desvio: 0.822594377 },
    { nome: 'CIÊNCIAS AMBIENTAIS', media: 3.3641625, desvio: 0.981824159 },
    { nome: 'CIÊNCIAS BIOLÓGICAS', media: 3.504735513, desvio: 1.061462754 },
    { nome: 'CIÊNCIAS CONTÁBEIS', media: 3.302135708, desvio: 0.903540657 },
    { nome: 'CIÊNCIAS ECONÔMICAS', media: 3.482919815, desvio: 0.790552073 },
    { nome: 'CIÊNCIAS NATURAIS', media: 3.716037908, desvio: 0.758114731 },
    { nome: 'CIÊNCIAS SOCIAIS', media: 3.81294062, desvio: 1.05849745 },
    { nome: 'CIÊNCIAS SOCIAIS - SOCIOLOGIA', media: 4.056052747, desvio: 1.03104698 },
    { nome: 'COMUNICAÇÃO SOCIAL - AUDIOVISUAL', media: 4.399426182, desvio: 0.610346047 },
    { nome: 'COMUNICAÇÃO SOCIAL - COMUNICAÇÃO ORGANIZACIONAL', media: 4.489382369, desvio: 0.656220437 },
    { nome: 'COMUNICAÇÃO SOCIAL - PUBLICIDADE E PROPAGANDA', media: 4.429347034, desvio: 0.477521013 },
    { nome: 'DESIGN - PROGRAMAÇÃO VISUAL', media: 4.473523474, desvio: 0.479613888 },
    { nome: 'DESIGN - PROJETO DO PRODUTO', media: 4.093415385, desvio: 1.251853416 },
    { nome: 'DIREITO', media: 4.201930121, desvio: 0.700511682 },
    { nome: 'EDUCAÇÃO FÍSICA', media: 3.817175291, desvio: 0.623397951 },
    { nome: 'ENFERMAGEM', media: 3.939373526, desvio: 0.64477753 },
    { nome: 'ENGENHARIA', media: 3.20655859, desvio: 1.123768983 },
    { nome: 'ENGENHARIA AEROESPACIAL', media: 3.42285549, desvio: 0.762583345 },
    { nome: 'ENGENHARIA AMBIENTAL', media: 3.247862214, desvio: 0.668902884 },
    { nome: 'ENGENHARIA CIVIL', media: 3.425058647, desvio: 0.75436304 },
    { nome: 'ENGENHARIA DE COMPUTAÇÃO', media: 3.363616216, desvio: 0.790953799 },
    { nome: 'ENGENHARIA DE ENERGIA', media: 3.259977143, desvio: 0.699993918 },
    { nome: 'ENGENHARIA DE PRODUÇÃO', media: 3.298870916, desvio: 0.713470615 },
    { nome: 'ENGENHARIA DE REDES DE COMUNICAÇÃO', media: 3.037918269, desvio: 0.795966401 },
    { nome: 'ENGENHARIA DE SOFTWARE', media: 3.494431727, desvio: 0.561967758 },
    { nome: 'ENGENHARIA ELÉTRICA', media: 3.157985533, desvio: 0.863056528 },
    { nome: 'ENGENHARIA ELETRÔNICA', media: 3.368536559, desvio: 0.625692828 },
    { nome: 'ENGENHARIA FLORESTAL', media: 3.260703806, desvio: 0.810105163 },
    { nome: 'ENGENHARIA MECÂNICA', media: 3.193472423, desvio: 0.742878496 },
    { nome: 'ENGENHARIA MECATRÔNICA - CONTROLE E AUTOMAÇÃO', media: 3.286072857, desvio: 0.794820257 },
    { nome: 'ENGENHARIA QUÍMICA', media: 3.198266549, desvio: 0.888523502 },
    { nome: 'ESTATÍSTICA', media: 3.183331287, desvio: 0.906287259 },
    { nome: 'FARMÁCIA', media: 3.737438718, desvio: 0.767847659 },
    { nome: 'FILOSOFIA', media: 3.703983364, desvio: 1.083731105 },
    { nome: 'FÍSICA', media: 3.007174868, desvio: 1.135298971 },
    { nome: 'FISIOTERAPIA', media: 4.020478189, desvio: 0.618053379 },
    { nome: 'FONOAUDIOLOGIA', media: 3.874749638, desvio: 0.84505506 },
    { nome: 'GEOGRAFIA', media: 3.528634591, desvio: 1.214160111 },
    { nome: 'GESTÃO DE POLÍTICAS PÚBLICAS', media: 3.836621898, desvio: 0.939227214 },
    { nome: 'HISTÓRIA', media: 4.030774876, desvio: 0.905058747 },
    { nome: 'JORNALISMO', media: 4.133850206, desvio: 0.807999761 },
    { nome: 'LETRAS - LÍNGUA ESPANHOLA E LITERATURA ESPANHOLA E HISPANO-AMERICANA', media: 3.891349296, desvio: 0.925122178 },
    { nome: 'LETRAS - LÍNGUA INGLESA E RESPECTIVA LITERATURA', media: 4.271855508, desvio: 0.789750778 },
    { nome: 'LETRAS - LÍNGUA PORTUGUESA E RESPECTIVA LITERATURA', media: 3.903281601, desvio: 1.241006833 },
    { nome: 'LETRAS - PORTUGUÊS DO BRASIL COMO SEGUNDA LÍNGUA', media: 4.022797333, desvio: 0.958602432 },
    { nome: 'LETRAS - TRADUÇÃO - FRANCÊS', media: 3.768155556, desvio: 1.364407857 },
    { nome: 'LETRAS - TRADUÇÃO - INGLÊS', media: 4.143661244, desvio: 0.800160714 },
    { nome: 'LÍNGUAS ESTRANGEIRAS APLICADAS - MSI', media: 3.984853469, desvio: 0.998815321 },
    { nome: 'MEDICINA', media: 4.190889784, desvio: 0.696158583 },
    { nome: 'MEDICINA VETERINÁRIA', media: 3.814644703, desvio: 0.685390381 },
    { nome: 'MUSEOLOGIA', media: 3.930540719, desvio: 1.0554084 },
    { nome: 'NUTRIÇÃO', media: 3.844901935, desvio: 0.786479801 },
    { nome: 'ODONTOLOGIA', media: 3.916707458, desvio: 0.675032385 },
    { nome: 'PEDAGOGIA', media: 4.17987235, desvio: 1.00070316 },
    { nome: 'PSICOLOGIA', media: 4.495435702, desvio: 0.883910679 },
    { nome: 'QUÍMICA TECNOLÓGICA', media: 3.140338053, desvio: 0.842927823 },
    { nome: 'RELAÇÕES INTERNACIONAIS', media: 4.194942484, desvio: 0.71787958 },
    { nome: 'SAÚDE COLETIVA', media: 3.720839096, desvio: 1.114897901 },
    { nome: 'SERVIÇO SOCIAL', media: 3.894714179, desvio: 1.014927572 },
    { nome: 'TEORIA, CRÍTICA E HISTÓRIA DA ARTE', media: 4.046142128, desvio: 1.193218559 },
    { nome: 'TERAPIA OCUPACIONAL', media: 4.01959867, desvio: 0.615369 },
];

const CHAVE_DADOS = 'calculadora-ira-unb';
const CHAVE_TEMA = 'calculadora-ira-tema';

// ===========================
// ESTADO GLOBAL
// ===========================

let contadorDisciplina = 0;

// ===========================
// INICIALIZAÇÃO
// ===========================

document.addEventListener('DOMContentLoaded', inicializar);

async function inicializar() {
    carregarTema();
    popularSeletorCursos();
    await carregarDados();
    configurarEventos();
}

// ===========================
// TEMA (ESCURO / CLARO)
// ===========================

function carregarTema() {
    const temaSalvo = localStorage.getItem(CHAVE_TEMA) || 'escuro';
    document.documentElement.setAttribute('data-tema', temaSalvo);
    atualizarIconeTema(temaSalvo);
}

function alternarTema() {
    const temaAtual = document.documentElement.getAttribute('data-tema');
    const novoTema = temaAtual === 'escuro' ? 'claro' : 'escuro';
    document.documentElement.setAttribute('data-tema', novoTema);
    localStorage.setItem(CHAVE_TEMA, novoTema);
    atualizarIconeTema(novoTema);
}

function atualizarIconeTema(tema) {
    const botao = document.getElementById('btnTema');
    if (!botao) return;
    botao.textContent = tema === 'escuro' ? '☀️' : '🌙';
    botao.title = tema === 'escuro' ? 'Mudar para modo claro' : 'Mudar para modo escuro';
}

// ===========================
// SELETOR DE CURSOS
// ===========================

function popularSeletorCursos() {
    const seletor = document.getElementById('seletorCurso');
    if (!seletor) return;

    CURSOS.forEach((curso, indice) => {
        const opcao = document.createElement('option');
        opcao.value = String(indice);
        opcao.textContent = curso.nome;
        seletor.appendChild(opcao);
    });
}

function selecionarCurso() {
    const seletor = document.getElementById('seletorCurso');
    const valor = seletor.value;
    const inputMedia = document.getElementById('mediaCurso');
    const inputDesvio = document.getElementById('desvioPadrao');
    const lockMedia = document.getElementById('lockMedia');
    const lockDesvio = document.getElementById('lockDesvio');

    if (valor === '' || valor === 'manual') {
        // Placeholder ou manual: libera campos
        inputMedia.disabled = false;
        inputDesvio.disabled = false;
        lockMedia.checked = false;
        lockDesvio.checked = false;

        if (valor === '') {
            inputMedia.value = '0.0000';
            inputDesvio.value = '1.0000';
        }
    } else {
        // Curso selecionado: preenche e trava
        const curso = CURSOS[parseInt(valor)];
        if (curso) {
            inputMedia.value = curso.media;
            inputDesvio.value = curso.desvio;
            inputMedia.disabled = true;
            inputDesvio.disabled = true;
            lockMedia.checked = true;
            lockDesvio.checked = true;
        }
    }

    calcularIra();
    salvarDados();
}

// ===========================
// PERÍODOS
// ===========================

function criarPeriodo(salvo = false) {
    const container = document.getElementById('periodos');
    const numeroPeriodo = container.children.length + 1;

    const divPeriodo = document.createElement('div');
    divPeriodo.className = 'periodo';
    divPeriodo.dataset.periodo = numeroPeriodo;

    divPeriodo.innerHTML = `
        <div class="periodo-header">
            <h4>${numeroPeriodo}º Período</h4>
        </div>
        <div class="periodo-disciplinas"></div>
        <button type="button" class="btn btn-sm btn-outline-primary btn-add-disc"
                onclick="adicionarDisciplina(this.closest('.periodo'))">
            + Adicionar Disciplina
        </button>
    `;

    container.appendChild(divPeriodo);

    if (!salvo) {
        adicionarDisciplina(divPeriodo);
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
    return opcoes.map((op, i) => {
        let attrs = [];
        if (op.valor === -1) {
            attrs.push('value=""', 'disabled', 'hidden');
            if (indiceSelecionado === 0) attrs.push('selected');
        } else {
            attrs.push(`value="${op.valor}"`);
            if (i === indiceSelecionado) attrs.push('selected');
        }
        return `<option ${attrs.join(' ')}>${op.texto}</option>`;
    }).join('');
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
            <div class="col-lg-4 col-md-4 col-sm-12">
                <input type="text" class="form-control form-control-sm input-nome"
                       placeholder="Nome da Disciplina (Opcional)" value="${escapeHtml(nome)}">
            </div>
            <div class="col-lg-2 col-md-2 col-4">
                <select class="form-select form-select-sm sel-creditos" required>
                    ${gerarOpcoesHtml(OPCOES_CREDITOS, indiceCred)}
                </select>
            </div>
            <div class="col-lg-2 col-md-2 col-4">
                <select class="form-select form-select-sm sel-mencao" required>
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
                        onclick="removerDisciplina(this)" title="Remover disciplina">✕</button>
            </div>
        </div>
    `;

    containerDisc.appendChild(div);
}

function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function removerDisciplina(botao) {
    const discRow = botao.closest('.disciplina-row');
    const periodoEl = botao.closest('.periodo');
    const containerDisc = periodoEl.querySelector('.periodo-disciplinas');
    const todosPeridos = document.querySelectorAll('#periodos .periodo');

    // Não permite remover a única disciplina do único período
    if (todosPeridos.length === 1 && containerDisc.children.length === 1) {
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

// ===========================
// CÁLCULO DO IRA E MP
// ===========================

function calcularIra() {
    const periodos = document.querySelectorAll('#periodos .periodo');
    let somaPesadaIra = 0;
    let somaPesosIra = 0;
    let somaPesadaMp = 0;
    let somaPesosMp = 0;

    periodos.forEach((periodoEl, indice) => {
        const semestre = Math.min(6, indice + 1);
        const disciplinas = periodoEl.querySelectorAll('.disciplina-row');

        disciplinas.forEach(disc => {
            const creditos = parseInt(disc.querySelector('.sel-creditos').value);
            const mencao = parseInt(disc.querySelector('.sel-mencao').value);
            const moduloLivre = disc.querySelector('.chk-modulo-livre').checked;

            if (mencao !== -1 && creditos !== -1) {
                somaPesadaIra += mencao * creditos * semestre;
                somaPesosIra += creditos * semestre;
                
                if (!moduloLivre) {
                    somaPesadaMp += mencao * creditos;
                    somaPesosMp += creditos;
                }
            }
        });
    });

    let ira = 0;
    let mp = 0;

    if (somaPesosIra > 0) {
        ira = somaPesadaIra / somaPesosIra;
        mp = somaPesadaMp / somaPesosMp;
    }

    const display = document.getElementById('ira-mp');
    if (display) {
        if (somaPesosIra > 0) {
            display.textContent = `IRA: ${ira.toFixed(4)}   MP: ${mp.toFixed(4)}`;
        } else {
            display.textContent = 'IRA: 0.0000   MP: 0.0000';
        }
    }

    calcularIntercambio(ira);
}

// ===========================
// CÁLCULO DE INTERCÂMBIO
// ===========================

function calcularIntercambio(iraAtual) {
    const modoManual = document.getElementById('modoManual') && document.getElementById('modoManual').checked;
    
    let ira = 0;
    let ipf = 0;

    if (modoManual) {
        // Usa os valores digitados (ipf vem em %, dividimos por 100)
        ira = parseFloat(document.getElementById('iraManual').value) || 0;
        let ipfInput = parseFloat(document.getElementById('ipfManual').value) || 0;
        ipf = ipfInput / 100;
        document.getElementById('horasAcumuladas').textContent = '-';
    } else {
        // Usa os valores calculados das disciplinas
        ira = iraAtual !== undefined ? iraAtual : (parseFloat(document.getElementById('ira-mp').textContent.match(/Notas: ([\d.]+)/)?.[1]) || 0);
        
        let horasAcumuladas = 0;
        const periodos = document.querySelectorAll('#periodos .periodo');
        periodos.forEach(periodoEl => {
            periodoEl.querySelectorAll('.disciplina-row').forEach(disc => {
                const creditos = parseInt(disc.querySelector('.sel-creditos').value);
                const mencao = parseInt(disc.querySelector('.sel-mencao').value);

                if (mencao >= 3 && creditos > 0) {
                    horasAcumuladas += creditos * 15;
                }
            });
        });

        document.getElementById('horasAcumuladas').textContent = horasAcumuladas;

        const horasCurso = parseFloat(document.getElementById('horasCurso').value) || 0;
        ipf = horasCurso > 0 ? horasAcumuladas / horasCurso : 0;
    }
    
    document.getElementById('ipfCalc').textContent = ipf.toFixed(4);

    // 3. IRA Padronizado: (IRA do Aluno - Média do Curso) / Desvio Padrão
    const mediaCurso = parseFloat(document.getElementById('mediaCurso').value) || 0;
    let desvioPadrao = parseFloat(document.getElementById('desvioPadrao').value) || 1;
    if (desvioPadrao === 0) desvioPadrao = 1; // Evita divisão por zero

    const iraPadronizado = (ira - mediaCurso) / desvioPadrao;
    document.getElementById('iraPadrao').textContent = iraPadronizado.toFixed(4);

    // 4. NF = IRA Padronizado + 2 × IPF
    const nf = iraPadronizado + (2 * ipf);
    document.getElementById('nfCalc').textContent = nf.toFixed(4);
}

function alternarModoManual() {
    const isManual = document.getElementById('modoManual').checked;
    document.getElementById('divInputsManuais').style.display = isManual ? 'flex' : 'none';
    calcularIntercambio();
    salvarDados();
}

// ===========================
// PERSISTÊNCIA (localStorage + fallback servidor)
// ===========================

function coletarDados() {
    const dados = {};
    const periodos = document.querySelectorAll('#periodos .periodo');

    periodos.forEach((periodoEl, indice) => {
        const periodoDados = {};
        const disciplinas = periodoEl.querySelectorAll('.disciplina-row');

        disciplinas.forEach((disc, j) => {
            periodoDados[j + 1] = [
                disc.querySelector('.input-nome').value,
                disc.querySelector('.sel-creditos').selectedIndex,
                disc.querySelector('.sel-mencao').selectedIndex,
                disc.querySelector('.chk-modulo-livre').checked
            ];
        });

        dados[indice + 1] = periodoDados;
    });

    dados['intercambio'] = {
        horasCurso: document.getElementById('horasCurso').value,
        lockHoras: document.getElementById('lockHoras').checked,
        mediaCurso: document.getElementById('mediaCurso').value,
        lockMedia: document.getElementById('lockMedia').checked,
        desvioPadrao: document.getElementById('desvioPadrao').value,
        lockDesvio: document.getElementById('lockDesvio').checked,
        cursoSelecionado: document.getElementById('seletorCurso').value,
        modoManual: document.getElementById('modoManual') ? document.getElementById('modoManual').checked : false,
        iraManual: document.getElementById('iraManual') ? document.getElementById('iraManual').value : '0.0000',
        ipfManual: document.getElementById('ipfManual') ? document.getElementById('ipfManual').value : '0.0000',
    };

    return dados;
}

function salvarDados() {
    const dados = coletarDados();

    // Salvar no localStorage (persistência principal)
    try {
        localStorage.setItem(CHAVE_DADOS, JSON.stringify(dados));
    } catch (e) {
        console.warn('Erro ao salvar no localStorage:', e);
    }

}

async function carregarDados() {
    let dados = null;

    // 1. Tenta carregar do localStorage
    const dadosLocal = localStorage.getItem(CHAVE_DADOS);
    if (dadosLocal) {
        try {
            dados = JSON.parse(dadosLocal);
        } catch (e) {
            console.warn('Erro ao parsear localStorage:', e);
        }
    }


    // 3. Restaurar dados ou criar estado inicial
    if (dados) {
        const chavesPeriodos = Object.keys(dados)
            .filter(k => k !== 'intercambio')
            .sort((a, b) => parseInt(a) - parseInt(b));

        if (chavesPeriodos.length > 0) {
            chavesPeriodos.forEach((chavePeriodo) => {
                criarPeriodo(true);
                const periodos = document.querySelectorAll('#periodos .periodo');
                const periodoEl = periodos[periodos.length - 1];
                const periodoDados = dados[chavePeriodo];

                Object.keys(periodoDados)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .forEach(chaveDisc => {
                        adicionarDisciplina(periodoEl, periodoDados[chaveDisc]);
                    });
            });
        } else {
            criarPeriodo();
        }

        // Restaurar dados de intercâmbio
        if (dados['intercambio']) {
            const inter = dados['intercambio'];
            document.getElementById('horasCurso').value = inter.horasCurso || 0;
            document.getElementById('lockHoras').checked = inter.lockHoras || false;
            document.getElementById('mediaCurso').value = inter.mediaCurso || 0;
            document.getElementById('lockMedia').checked = inter.lockMedia || false;
            document.getElementById('desvioPadrao').value = inter.desvioPadrao || 1;
            document.getElementById('lockDesvio').checked = inter.lockDesvio || false;

            // Restaurar curso selecionado
            if (inter.cursoSelecionado !== undefined && inter.cursoSelecionado !== null) {
                document.getElementById('seletorCurso').value = inter.cursoSelecionado;
            }
            
            if (inter.modoManual !== undefined) {
                document.getElementById('modoManual').checked = inter.modoManual;
                document.getElementById('iraManual').value = inter.iraManual || '0.0000';
                document.getElementById('ipfManual').value = inter.ipfManual || '0.0000';
                alternarModoManual(); // atualiza a interface
            }

            // Aplicar travas
            alternarTrava('horasCurso', 'lockHoras');
            alternarTrava('mediaCurso', 'lockMedia');
            alternarTrava('desvioPadrao', 'lockDesvio');
        }
    } else {
        // Sem dados — estado inicial
        criarPeriodo();
    }

    calcularIra();
}

// ===========================
// TRAVA (LOCK)
// ===========================

function alternarTrava(inputId, lockId) {
    const input = document.getElementById(inputId);
    const lock = document.getElementById(lockId);
    if (input && lock) {
        input.disabled = lock.checked;
    }
    salvarDados();
}

// ===========================
// EVENTOS (DELEGAÇÃO)
// ===========================

function configurarEventos() {
    const containerPeriodos = document.getElementById('periodos');

    // Quando alterar selects (créditos/menções) nos períodos
    containerPeriodos.addEventListener('change', () => {
        calcularIra();
        salvarDados();
    });

    // Quando digitar em inputs (nome da disciplina)
    containerPeriodos.addEventListener('input', () => {
        salvarDados();
    });

    // Quando alterar campos do painel de intercâmbio
    const painel = document.getElementById('painelIntercambio');
    painel.addEventListener('change', () => {
        calcularIra();
        salvarDados();
    });

    painel.addEventListener('input', () => {
        calcularIra();
        salvarDados();
    });
}
