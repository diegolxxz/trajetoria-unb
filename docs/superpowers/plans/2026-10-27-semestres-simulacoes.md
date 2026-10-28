# Semestres e simulações Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Semestres, IRA simplificado, horas aprovadas, comparação de médias e simulação de todos os editais.
**Architecture:** HTML/JS estático; cálculos puros compartilhados e testes DOM com linkedom.
**Tech Stack:** Node test, Bun, Python/Bottle.
**Spec:** docs/superpowers/specs/2026-10-27-semestres-simulacoes-design.md

## Global Constraints
- Preserve local/dados.json e chaves/formato de localStorage existentes.
- public/ é a raiz publicada; dist/ é gerado. Não adicionar dependências.
- Formate números com AppUnB.numero, pt-BR, até quatro casas, preservando precisão interna.
- Use fórmula/referências específicas de cada edital; preserve variantes sem inventar turnos e identifique estimativas/ausências.
- Testes de regressão ficam em tests/, usam armazenamento e dados isolados. Não faça push, merge ou deploy.
- Implemente apenas a tarefa atribuída. Não despache subagentes. Não altere o checkout original.

## Review Focus
- ML marcado sobrevive à alternância dos modos (Task 1).
- Incompletas/reprovações não somam horas; SR válido participa da MP (Task 1).
- Referências múltiplas/ausentes e fórmula direta não inventam médias/escores (Task 2).
- Falha parcial de fetch preserva editais disponíveis (Task 2).
- Semestre inválido não cria planos/fetch; futuro válido funciona (Task 3).

### Task 1: Semestres, modo Somente IRA e horas aprovadas
**Files:** public/ira/index.html, public/js/functionality.js, public/js/calculos.js se necessário, public/css/interface.css, tests/ira-interface.test.cjs novo, tests/calculos.test.cjs.
**Interfaces:** preserve CalculosUnB.historico e campos; use resultado.horas. Nova preferência calculadora-unb:modo-ira = completo/ira. Preserve visualizacaoIra e calculadora-ira-unb.
- [ ] Escreva testes RED antes de implementar: criação 1,2,3 com acumulados, carga legada, modo Somente IRA no resumido/detalhado, retorno com ML intacto, preferência persistida, total de horas após editar/remover/desfazer. MP=(4*5+2*0)/6 com ML excluído e sem peso por semestre. Seis menções com 2 créditos cada somam 90h apenas MM/MS/SS; incompletas não somam.
- [ ] Troque textos visíveis período por semestre na calculadora. Adicione seletor acessível Somente IRA / IRA e MP, esconda MP e controles ML no primeiro, incluindo resumo acumulado/cabeçalho/ajuda; nunca apague dados ML. Exiba horas aprovadas ao final, atualizadas após alterações.
- [ ] Confira fórmula MP com resolução CEG 0001/2020 (https://deg.unb.br/wp-content/uploads/resolucao_ceg_0001_2020.pdf). Sem peso temporal; reprovações contam conforme menção. Registre evidência.
- [ ] Rode testes focados, lint/formato dos arquivos tocados e suíte JS completa; commit somente seus arquivos e escreva relatório com RED/GREEN, comandos, resultados e revisão própria.

### Task 2: Comparação histórica e simulação geral dos editais
**Files:** public/intercambio/index.html, public/js/intercambio-geral.js novo DOM, public/js/intercambio-calculos.js novo módulo puro com export Node, public/css/interface.css, tests/intercambio-geral.test.cjs novo, docs/dados.md se necessário.
**Interfaces:** CalculosUnB.nota/alocado/cursoBase; AppUnB.perfil/salvarPerfil; data/editais/index.json + JSON por slug. Export IntercambioCalculos.comparar(editais, {curso,ira,ipf}) com dados por edital/referência: média, desvio, diferença de IRA, nota simulada ou null, metadados/fonte e alocados. Estrutura mínima decidida na implementação. Carregue scripts apenas no catálogo; preserve intercambio.js em páginas existentes.
- [ ] Leia docs/dados.md e schemas reais. Escreva testes RED: comparação de médias independe de IPF, fórmulas por edital, variantes, curso ausente, zeros versus vazios/inválidos, somente alocados com identificação, falha parcial de fetch.
- [ ] Adicione ambas as visões no catálogo: curso/IRA/IPF com perfil persistido; referências históricas por mobilidade/edital com média/desvio e diferença do IRA, estimativas explícitas. Não confundir média do curso com média dos candidatos.
- [ ] Mostre nota simulada por edital/variante e tabela geral de alocados dos editais carregados, identificando edital, curso, IRA, IPF, nota original, alocação e link. Filtre por curso e por edital (incluindo todos), sem ranking conjunto de notas incomparáveis ou promessa de aprovação.
- [ ] Valide números finitos IRA 0..5 e IPF 0..100, vazio não é zero. Mostre ausências; fórmula direta sem média deve funcionar; desvio não positivo não simula padronização; não invente turnos. Falha parcial mantém restantes + aviso; falha total mostra erro.
- [ ] Teste DOM com scripts reais/linkedom, input/filtros/tabelas e fixtures isoladas. Rode testes focados, lint/formatação e suíte JS completa. Commit e relatório com RED/GREEN e revisão própria.

### Task 3: Seletores de semestre válidos e extensíveis
**Files:** public/js/turmas.js, public/js/grade.js, tests/turmas-interface.test.cjs, tests/grade-interface.test.cjs.
**Interfaces:** catálogo semestres [{semestre:'2026.2',arquivo:'2026-2.json'}], futuros anos sem teto; preserve backups históricos suportados, não redesenhe Grade.
- [ ] Acrescente testes RED para change com vazio/null literal/inexistente e itens inválidos no catálogo; sem fetch inválido e planos válidos mantidos/seleção restaurada. Teste índice com 2027.1 e alternância válida.
- [ ] Valide itens: semestre ano quatro dígitos .1/.2, arquivo simples .json sem traversal, campos não nulos. Filtre inválidos e confirme pertinência antes de carregar/trocar. Grade continua restaurando backup histórico indisponível, mas não cria plano inválido; Turmas restaura seleção válida anterior. Catálogo vazio deixa seleção desabilitada.
- [ ] Testes focados, suíte JS, lint/formato e bun run build:verified; testes Python conforme README/ambiente. Commit apenas tarefa e relatório de evidências; falhas preexistentes devem ser identificadas.

