# Escolhas para o montador

Estas opções traduzem os seis grupos principais da revisão em decisões de uso.
As escolhas **1A, 2A, 3A, 4A, 5A e 6A foram aprovadas pelo usuário**. Ainda não
foram implementadas. As alternativas B ficam registradas apenas como histórico.

As decisões aprovadas foram incorporadas em [concepts_brief.md](concepts_brief.md).

## 1. Quando verificar se uma turma encaixa

Nas duas opções, uma turma só é compatível quando existe uma combinação incluindo
essa turma e todas as matérias necessárias ativadas. Ao testar uma turma de uma
dessas matérias, ela substitui temporariamente as outras alternativas da mesma
matéria. Uma matéria fora do gerador é acrescentada temporariamente para esse
teste; as extras não precisam entrar todas juntas.

- **A — Verificar ao filtrar a lista.** Com “Só as que encaixam” ativo, a lista
  mostra as turmas comprovadamente compatíveis e as que ainda não foi possível
  verificar, identificadas como tal. É mais automático, mas exige limitar o
  trabalho e cancelar verificações antigas quando as escolhas mudarem.
- **B — Verificar ao clicar.** Você organiza a seleção e aperta “Verificar
  encaixe” para atualizar a lista. Enquanto uma alteração não for verificada,
  nenhum resultado anterior pode continuar sendo apresentado como atual.
  Exige uma ação extra, mas evita repetir buscas a cada mudança.

## 2. O efeito de “Com vagas”

- **A — Vale para a lista e para a geração.** Com o filtro ligado, turmas
  lotadas ou com vagas desconhecidas não entram nos resultados gerados. Desligar
  restaura sua elegibilidade, respeitando as turmas que você permitiu.
- **B — Vale apenas para consultar a lista.** O controle deve se chamar
  “Mostrar apenas turmas com vagas” e informar que não restringe a geração.
  Para o gerador usar apenas turmas com vagas, haverá um controle separado.

Nenhuma opção apaga as turmas permitidas ou desativa uma matéria silenciosamente.
O gerador continua respeitando as restrições que você confirmou manualmente.

## 3. “Selecionar todas” dentro da escolha de turmas

- **A — Todas as visíveis.** Se a busca do editor mostra as turmas de um
  professor, seleciona apenas essas. O botão se chama “Selecionar todas as
  visíveis”. Confirmar substitui a lista permitida pelas turmas marcadas.
- **B — Todas as ofertadas.** Seleciona todas as turmas da matéria, incluindo
  as que estão escondidas pelos filtros. O botão informa isso explicitamente.

Nas duas opções, a matéria começa aceitando todas as turmas. Ao restringir uma
matéria ainda irrestrita, o editor permite marcar poucas turmas por inclusão,
sem exigir desmarcar todas as demais. Restrições já existentes reaparecem ao editar.
Cancelar preserva a escolha anterior. A sugestão comum é impedir confirmar uma
restrição vazia: para não usar a matéria, desmarque “Usar no gerador”. Não interpretar
zero turmas como “todas”. Filtros ativos ainda limitam a elegibilidade conforme o
tópico 2, independentemente de quais turmas foram salvas como permitidas.

## 4. Planos salvos antes desta mudança

- **A — Preservar o comportamento antigo.** A grade manual salva continua igual,
  com suas matérias e prioridades. Todas as matérias antigas continuam ativadas
  no gerador e começam permitindo todas as turmas, como o gerador fazia antes.
  Você pode restringi-las depois.
- **B — Usar as turmas antigas como restrições iniciais.** Uma turma escolhida
  manualmente passa a ser a única permitida daquela matéria. Matérias antigas
  sem escolha manual continuam aceitando todas. As restrições podem ser ampliadas.

A opção B muda as possibilidades do gerador antigo e deve mostrar um aviso.
Nas duas opções, não apagar escolhas indisponíveis, não trocar professores
automaticamente e não ampliar uma restrição quando uma turma desaparecer.
Guardar tudo no navegador e manter backup, importação e desfazer/refazer.

## 5. Como escolher professores quando os horários são iguais

Nas duas opções há uma única grade por distribuição de matérias nos horários.
Trocar os horários de duas matérias produz outra grade, mesmo ocupando os mesmos
blocos. Turmas equivalentes continuam acessíveis; seus horários não são duplicados
na lista de resultados.

- **A — Escolha dentro do próprio resultado.** A grade informa, por exemplo,
  “Cálculo 2: 3 turmas neste horário”. Você expande essa matéria e escolhe a
  turma/professor ali mesmo antes de aplicar.
- **B — Escolha numa segunda etapa.** Primeiro você escolhe a distribuição de
  horários. Depois, uma etapa na mesma página apresenta as turmas equivalentes
  para definir os professores e confirmar a grade final.

Não guardar nem enumerar todas as combinações de professores desnecessariamente.
Limitar o trabalho e deixar explícito quando uma contagem se refere apenas às
opções encontradas, sem prometer que todas foram verificadas.

## 6. Quando não der para incluir todas as necessárias

- **A — Explicar e oferecer alternativas parciais.** Mostrar os motivos conhecidos
  e um botão “Ver alternativas parciais”. Cada resultado informa quais matérias
  ficaram de fora, e nada substitui sua escolha automaticamente.
- **B — Explicar e deixar o ajuste com você.** Não gerar parciais automaticamente
  nem oferecer essa busca; você altera matérias ou turmas e tenta novamente.
  É mais simples, mas exige mais tentativas manuais.

Nas duas opções, distinguir “sem turmas elegíveis”, “não existe combinação para
este conjunto” e “a busca parou antes de conseguir concluir”. Um conflito pode
envolver três ou mais matérias; o aviso não precisa prometer a menor explicação
possível. As extras escolhidas são tentadas quando couberem, sem retirar matérias
necessárias para abrir espaço para elas.
