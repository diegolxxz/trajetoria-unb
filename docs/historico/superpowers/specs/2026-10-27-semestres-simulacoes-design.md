# Semestres, IRA e simulações gerais
Autorizado na conversa em 27/10/2026, incluindo implementação com subagentes e regressões em tests/.

- Substituir textos visíveis de período por semestre na calculadora, preservando formato e chaves de armazenamento.
- Adicionar modo Somente IRA independente de Detalhado/Resumido: esconder MP e controles ML sem apagar marcações; retornar ao modo IRA e MP restaura ambos.
- Exibir total de horas aprovadas ao final (créditos × 15 somente MM/MS/SS). Verificar MP por créditos, excluindo ML e sem peso temporal.
- Na página geral de intercâmbio oferecer ambas as visões: comparação do IRA com médias/desvios históricos do curso por seleção; simulação por curso, IRA, IPF com fórmula de cada edital e consulta conjunta dos alocados, identificando cada edital.
- Preservar variantes, fontes, estimativas e ausências. Não inventar média/turno/probabilidade de aprovação ou ranking conjunto de notas incomparáveis.
- Rejeitar semestre vazio/null/inexistente em Turmas e Grade sem alterar planos válidos nem buscar arquivos inválidos; aceitar futuros semestres publicados.
- public/ é raiz publicada, dist/ gerado. Preservar local/dados.json e localStorage, usar AppUnB.numero/pt-BR até quatro casas, precisão interna intacta; sem novas dependências.

Abordagem: reaproveitar cálculos/estilos e adicionar módulo puro para agregação e interface no catálogo. Alternativas: duplicar calculadoras ou combinar notas entre fórmulas diferentes; descartadas por manutenção e comparabilidade.
Ruling: usuário não localizou seletor inválido; verificar ambos Turmas e Grade. Nomes internos período permanecem para compatibilidade.
Não inclui coleta ou deploy. Worktree separado preserva alterações não commitadas da Grade no checkout original.
