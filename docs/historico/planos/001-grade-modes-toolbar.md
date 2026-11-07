# /grade: barra de planos e dois modos de montagem

Data: 28/10/2026. Base verificada pelo executor: 75771cb, incluindo alterações locais existentes.
Escopo selecionado pelo usuário; implementação autorizada, sem commit ou push.
Status: concluído e verificado em 28/10/2026.

Refinamento de interface no mesmo dia: lista única “Disciplinas da grade”,
distinção explícita entre matéria e turma, métodos “Eu escolho” e “O site combina”.
Setas abrem as turmas sem busca interna nos dois métodos. Controles de inclusão,
prioridade e restrições aparecem dentro da disciplina; recolher preserva o
rascunho. Novo ciclo de testes reproduziu as falhas antes da correção e verificou
as interações no navegador isolado em 1440, 768, 390 e 320 px.

## Direção e limites

Manter o visual do site e o formato de backup v1. A página abre em “Escolher
turmas”, com as escolhas acima da semana e atualização imediata. “Gerar
combinações” usa o mesmo plano, mas mostra as restrições e participação do gerador.
Alternar o modo não altera dados nem histórico. Um rascunho do gerador permanece
guardado em memória ao trocar de modo. Não adicionar dependências, rotas ou campos
persistidos. Preservar validações atuais de catálogo e semestres históricos.

Remover data da oferta após carregamento, contador n/20, botão Novo plano,
renomeação e texto longo de backup. Manter loading/erro e limites reais. Seletor
ganha “Criar nova grade”; nomes novos usam data e hora locais, com sufixo para
evitar duplicatas. Não renomear planos já salvos. A opção de criação deve usar
um marcador próprio e valor que não colida com IDs importados.

Desfazer/Refazer, importar e exportar ficam fora de disclosures. Atalhos usam a
mesma ação do histórico: Ctrl/Cmd+Z, Shift+Z e Y. Não interceptar inputs,
textareas, selects, contenteditable, composição ou eventos já tratados. Excluir
grade continua acessível e reversível. JSON exporta todas as grades, PNG/ICS a
semana atual, com nomes acessíveis que deixam esse escopo claro.

## Evidência da improve

O consultor leu o projeto sem editar código. Apontou cinco riscos confirmados:

- `grade.js:224–271`: encaixe global do gerador não corresponde a conflito com
  as turmas salvas da montagem manual.
- `grade.js:403–412`: filtros podem esconder a matéria com snapshot escolhido.
- `grade.js:713–720`: a semana está vinculada à tela exclusiva antiga.
- `grade.js:163,403,914`: remover HTML sem remover os acessos quebra renderização.
- `grade.js:953–970`: atalhos devem compartilhar a ação existente de histórico.

## Execução

1. Escrever regressões em `tests/grade-interface.test.cjs` e observar RED para
   criação pelo seletor, nomes, atalhos, alternância de prioridade, modos e
   semana manual. Preservar testes de catálogo, rascunho, histórico e backups.
2. Modificar `public/grade/index.html`, `public/js/grade.js` e
   `public/css/grade.css`. Barra compacta com quebra natural no celular; dois
   botões de modo com estado anunciado. Prioridade vira botão Obrigatória/Extra.
   A montagem manual usa seleção direta de turma e permite retirar/substituir
   a escolha. A semana aparece abaixo após a primeira escolha. Sem tela separada.
3. Encaixe manual compara com snapshots das outras matérias, inclusive extras
   e desativadas, ignorando a própria matéria. Conflitos conhecidos são ocultos
   pelo filtro; horários desconhecidos continuam com aviso. Restrições do gerador
   não limitam alternativas manuais. Filtros não apagam escolhas nem escondem a
   matéria já escolhida. Manter a compatibilidade global/Worker para o gerador.
4. Reutilizar a transação `alterar`/`registrar` e funções atuais de conflito,
   semana, exportação e histórico. Encerrar/inutilizar Workers ao trocar de modo
   para impedir respostas tardias. Não mudar algoritmos, orçamentos, schema ou
   módulos `grade-calculos`, `grade-arquivos`, `grade-worker`.
5. Atualizar `docs/grade.md` e apenas o trecho de Grade do README. Conferir
   navegador isolado em desktop, 768, 390 e 320 px, escuro/claro, teclado,
   importação/exportação, carga longa e snapshot fora da oferta. Uma rodada de
   inspeção agrupada e no máximo uma confirmação após os ajustes.

## Verificação e conclusão

- `node --test tests/grade-interface.test.cjs`: regressões RED → GREEN.
- `bun run build:verified`: lint JS/CSS/HTML, Prettier, todos os testes JS,
  validação de fontes e de dist, exit 0.
- `uv run pytest`: testes Python, exit 0.
- `uv run ruff check .` e `uv run ruff format --check .`: exit 0.
- `git diff --check`: exit 0.
- Navegador: escolhas manuais atualizam semana e conflitos, alterações podem
  ser desfeitas/refeitas, modos não alteram backup, importação é reversível,
  botões são alcançáveis e não há overflow da página. Rolagem da semana permanece
  contida. Não alegar teste em aparelho físico quando apenas emulado.

Se aparecer necessidade de mudar schema/engine ou validações de backup, manter
os contratos e comunicar a limitação. Não corrigir outras páginas. A análise
improve foi limitada a este fluxo, sem auditoria de segurança ou dependências.

## Resultado da execução

- Retirados data da oferta, contador permanente, renomeação, botão de criação
  separado e parágrafo longo de backup. Estados de loading/erro foram mantidos.
- Barra com seletor/criação, histórico, importação/exportação e exclusão visíveis.
  Nomes novos: `Grade · 28/10 14:35`, com sufixos para duplicatas.
- Modos manual e gerador separados, semana abaixo das escolhas e prioridade
  alternada por botão. Planos, snapshots e restrições existentes preservados.
- Histórico por botões e atalhos compartilhados; edição nativa e composição
  respeitadas. Worker tardio não interfere no outro modo.
- Navegador Edge/Chromium isolado em 1440, 768, 390 e 320 px: seleção, semana,
  atalhos, rascunhos entre modos, encaixe manual, criação e round-trip de JSON
  conferidos. Sem overflow de página ou erros de console; controles com 44 px.
- Tema claro e escuro inspecionados. A inspeção identificou contraste insuficiente
  nos eventos e códigos do tema claro; corrigido com cores locais em grade.css.
- `bun run build:verified`: passou, incluindo 89 testes JS, lint, formatação,
  validação das 11 páginas e build estático.
- `uv run pytest`: 36 testes passaram; Ruff check e format --check passaram.
- `git diff --check`: passou. Arquivos temporários de QA ficaram fora do projeto.
- Limite da verificação: celular emulado; sem teste em aparelho físico.

Artefatos: `grade-modes-manual-*`, `grade-modes-choices-*`,
`grade-modes-generator-*`, `grade-modes-week-*` e `grade-modes-verification.json`
na pasta de visualizações desta conversa. As imagens claras precedem a correção
final de contraste; os contrastes das cores finais foram conferidos por cálculo.
