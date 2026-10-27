---
target: "Tela inicial e outras abas: IRA, Intercâmbio e Turmas"
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
target_identity: "file:C:\\Users\\diego\\Documents\\code\\trajetoria-unb\\public\\index.html"
target_fingerprint: "sha256:1c2463f180d2093ea76741fbbc0c5a28b2e6dba7ad8f3fecc11efb2e3b8c85d3"
target_path: "C:\\Users\\diego\\Documents\\code\\trajetoria-unb\\public\\index.html"
timestamp: 2026-10-26T23-16-22Z
slug: public-index-html
---
Method: dual-agent (A: critique_design_a · B: critique_evidence_b).

Alvo: página inicial e abas IRA, Intercâmbio (listagem e Edital INT 7/2026), Turmas.
Versão local: http://127.0.0.1:8768; desktop1440×900 e celular simulado390×844. Sem aparelho físico. Nenhum código de interface foi alterado.

A identidade escura está coesa e as ferramentas têm conteúdo próprio da Unb. A inicial é a parte mais genérica: repete os três destinos na navegação, nos botões e nos cards, com bastante texto para escolhas simples. Nas abas, a principal oportunidade é equilibrar compactação e leitura.

## Avaliação heurística: 28/40 — boa base

| Critério | Nota /4 | Observação |
| --- | ---: | --- |
| Visibilidade do estado | 3 | Contagens e resultados claros; calculadora vazia já apresenta zero. |
| Linguagem familiar | 3 | Vocabulário acadêmico adequado; referências do intercâmbio ambíguas. |
| Controle do usuário | 2 | Remover disciplina salva a exclusão imediatamente. |
| Consistência | 3 | Componentes coerentes; inicial anuncia função retirada. |
| Prevenção de erros | 3 | Seleções e validações funcionam; exclusão merece recuperação. |
| Reconhecimento | 3 | Autocomplete e filtros ajudam; comparação exige memorizar notas. |
| Eficiência | 3 | Busca por professor, filtros e preferências salvas funcionam. |
| Clareza visual | 3 | Boa contenção visual; texto pequeno nas turmas do celular. |
| Recuperação de erros | 3 | Mensagens úteis; falta desfazer exclusões. |
| Ajuda contextual | 2 | FAQ útil, distante das dúvidas sobre IPF e referências. |

## O que funciona

- IRA no cabeçalho e acumulados por período mantêm feedback próximo da tarefa.
- Busca por professor abre as matérias relevantes automaticamente.
- Editais em ordem cronológica e resultados compactos têm boa organização.
- Nenhum estouro horizontal da página nos estados examinados.

## Prioridades

1. **[P2] Densidade das tabelas no celular.** Turmas usa dados de11,2px e cabeçalhos10px (public/css/interface.css:1535,1538), comprimindo nomes e horários. No edital,317 registros empilhados alcançam cerca de74milpx de documento. Dar espaço aos campos essenciais, usar duas linhas quando necessário e concentrar detalhes na expansão, preservando tabelas compactas. Comandos: /impeccable adapt e /impeccable typeset.
2. **[P2] Estados e recuperação na calculadora.** Sem créditos e menção, o IRA e a MP já apresentam zero; usar traço até uma entrada válida. O × remove dados e salva imediatamente; oferecer Desfazer breve, inclusive quando a última disciplina é limpa. É ambiguidade de apresentação e recuperação; não foi observado erro na fórmula. Evidência: public/js/functionality.js, public/ira/index.html. Comandos: /impeccable clarify e /impeccable harden.
3. **[P2] Inicial repetitiva e desatualizada.** public/index.html:152 promete solicitações de matrícula e reservas por curso no modo avançado, retirado por decisão do projeto. Corrigir a promessa, sem restaurar o modo. Reduzir repetição entre navegação, três botões e três cards; mostrar benefícios específicos ou uma prévia real de uso. Comandos: /impeccable clarify e /impeccable distill.
4. **[P2] Referências do intercâmbio pouco explicadas.** Direito mostra Referência1/2 como resultados igualmente autoritativos. IRA4,2/IPF55 gera1,3542 e1,2972. Preservar ambas, explicar apenas a distinção sustentada pelas fontes e a eventual impossibilidade de identificar turno. Aproximar nota simulada da comparação com candidatos. Evidência: public/js/intercambio.js:70,126. Comando: /impeccable clarify.

## Carga de leitura e percurso

Carga baixa na calculadora e no índice de editais; moderada no edital preenchido. Simular e interpretar referências requer memória ao comparar a nota na tabela. Repetir as mesmas três ferramentas na inicial cria rolagem, não nove escolhas independentes. Chegada calma e feedback imediato geram confiança; notas alternativas sem contexto e funções anunciadas ausentes interrompem essa confiança.

## Perfis

- Primeiro acesso: zero parece resultado válido; referências ambíguas dificultam interpretar a simulação.
- Uso distraído no celular: exclusão imediata e texto11,2px exigem cuidado adicional.
- Uso frequente: busca e cache ajudam; promessa de modo avançado causa procura inútil.

## Detector e observações menores

CLI:26 alertas —10 undersized-ui-text,12 cramped-padding,2 side-tab,1 border-accent-on-rounded,1 flat-type-hierarchy. Há repetição e falsos positivos: os10 textos são o selo compartilhado Unb de9,6px (contraste14,94:1); wrappers compactos contêm controles/células espaçados; a borda arredondada é sobrescrita por CSS vigente; o alerta de hierarquia ignora o hero52pxdesktop/32pxmobile. Não são26 defeitos independentes.

Injeção em5abas com mutação prévia confirmada: contagens1/2/1/1/1 (home/IRA/editais/edital7/turmas), selo e salto semântico h1→h4 nos períodos do IRA (public/js/functionality.js:168). Capturas headless, sem sobreposição apresentada em aba visível ao usuário. Não foi feita auditoria completa de acessibilidade. Contraste de amostras visíveis do tema escuro foi adequado; controles amostrados têm44px de altura.

Direção: inicial objetiva e ferramentas compactas com leitura confortável, preservando identidade. Começar por Turmas no celular e estados da calculadora. A listagem de editais já está resolvida e pede poucas mudanças.

## Evidências

Capturas e JSONs em C:/Users/diego/.codex/visualizations/2026/10/17/01a14864-a953-7ad1-92f2-520e867bc36a/:
critique-a-desktop-home.png, critique-a-mobile-ira-empty.png, critique-a-mobile-ira-filled.png, critique-a-desktop-edital-law-filtered.png, critique-a-mobile-turmas-professor.png, critique-a-evidence.json, critique-b-cli.json, critique-b-injection.json, critique-b-browser.json, critique-b-report.txt.

Questões de direção: quando a calculadora deve mostrar um resultado? Que distinção entre referências a fonte realmente permite? Cada texto da inicial ajuda a escolher uma ferramenta?
