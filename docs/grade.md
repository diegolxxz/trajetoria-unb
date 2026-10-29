# Grade pessoal

“Disciplinas da grade” é a lista comum às duas formas de montagem. Disciplina
é a matéria; turma é uma das opções de professor e horário daquela matéria.
A busca serve para adicionar disciplinas, escolhendo Obrigatória ou Extra antes
de adicionar. Em “Escolher turmas”, todas ficam abertas em tabelas com professor,
horário e local; + verde escolhe a turma e − vermelho retira a escolha. A carga
em créditos não aparece nessa lista. Obrigatórias vêm antes das extras, e o botão
de prioridade no cabeçalho permite mudar a classificação depois. A coluna de
vagas mostra matriculados/total e some por disciplina quando todas
as turmas exibidas têm zero matriculados e total de vagas conhecido e positivo.
Cada disciplina tem contorno próprio e código junto ao nome. O seletor de semestre
fica no topo, sem repetir o semestre no nome dos planos. Os controles de
inclusão, prioridade e restrições também ficam dentro da disciplina nas
combinações, mantendo os cabeçalhos recolhidos simples.

“Escolher turmas” abre por padrão e permite
adicionar uma disciplina, comparar professores/horários e escolher uma turma.
A semana de segunda a sábado aparece abaixo após a primeira escolha e acompanha
as alterações, sem sair da lista. Trocar ou retirar uma turma atualiza a semana.
“Gerar combinações” mostra participação, o botão Obrigatória/Extra e o editor de
turmas permitidas. As combinações já aparecem expandidas; usar uma delas atualiza
a mesma grade salva. Alternar o modo não muda os dados nem ocupa o histórico.
As duas formas aparecem no topo, separadas dos filtros. Os filtros ficam sempre
visíveis junto à busca: “Ocultar conflitos de horário”, “Apenas turmas com vagas”
e “Ocultar extras não usadas”. A lista não exibe os antigos textos de orientação.

O seletor contém “Criar nova grade”. Novas grades recebem um nome local como
“Grade · 28/10 14:35”, com sufixo se necessário; nomes de backups antigos são
preservados. Semestre é mostrado junto ao nome no seletor. Desfazer, Refazer,
Importar, Exportar e Excluir ficam visíveis na barra. O JSON contém todas as
grades; imagem e calendário continuam nas exportações da semana atual.
Ctrl/Cmd+Z desfaz, Ctrl/Cmd+Shift+Z ou Ctrl/Cmd+Y refaz. Os atalhos não interferem
na edição de inputs, selects, textareas ou conteúdo editável. Limites de 20
disciplinas e 20 planos continuam valendo, sem contador permanente na interface.

“Ocultar extras fora do plano” mantém as extras ativadas no gerador, com turma
na grade ou ainda em edição. Filtros ficam recolhidos com contador de opções ativas.

A página `/grade/` reutiliza o índice de semestres e a oferta em
`public/data/turmas/`. Não faz buscas ao SIGAA durante o uso. Uma alteração na
oferta só aparece após nova coleta e publicação do site.

Cada matéria tem três escolhas independentes: ficar na lista de comparação,
participar do gerador e ser necessária ou extra. Desmarcar “Usar no gerador” não
remove a matéria da lista. “Ocultar extras” só muda a exibição. Ao adicionar uma
matéria, todas as turmas são permitidas; “Escolher turmas” permite marcar apenas
as desejadas. Aplicar substitui a restrição; cancelar preserva a anterior. Uma
restrição vazia não pode ser aplicada. “Permitir todas no gerador” remove a
restrição sem alterar a turma da grade salva.

As marcações ainda não aplicadas sobrevivem a mudanças de filtros, prioridade,
participação e escolha manual no mesmo plano, inclusive ao alternar modos.
Reabrir o editor não as apaga. Recolher a seta também mantém as marcações, sem
aplicar mudanças automaticamente.
Antes de editar outra matéria, aplique ou cancele o rascunho atual. Aplicar,
cancelar, permitir todas para essa matéria, remover a matéria, trocar de plano
ou semestre, usar o histórico ou importar um backup encerram a edição. Os
rascunhos não entram no arquivo salvo. Ao concluir a edição, o foco retorna ao
botão da matéria ou à busca, se a matéria deixou de aparecer pelos filtros.

“Com vagas” afeta a consulta e a geração, sem apagar escolhas salvas. No modo
manual, “Ocultar conflitos de horário” compara a candidata com as turmas já escolhidas
das outras matérias, incluindo extras e matérias desativadas no gerador. Ignora
a própria matéria para permitir trocas. Horários incompletos continuam disponíveis
com aviso; restrições do gerador não limitam as alternativas manuais. Uma escolha
salva continua acessível mesmo se seus filtros não mostrarem nenhuma alternativa.

No gerador, o mesmo filtro testa cada candidata junto às matérias necessárias
ativadas. Essas verificações rodam num Worker separado; mudar escolhas cancela a verificação
antiga. Há um orçamento agregado de 25 mil tentativas, contando a preparação;
até 500 candidatas são verificadas por atualização. Turmas ainda desconhecidas
permanecem visíveis e identificadas, em vez de serem consideradas incompatíveis.

O gerador primeiro tenta incluir todas as matérias ativadas; só se não encontrar
uma solução e ainda tiver orçamento permite omitir extras. Horários iguais da
mesma matéria são agrupados antes da busca, com suas opções de professor/turma
dentro do resultado. Há até 20 grades distintas e até 500 variantes retidas por
matéria; o aviso de busca parcial indica limites atingidos. O botão de alternativas
parciais só gera prévias mediante pedido, identificando as matérias omitidas.

O formato de backup continua na versão 1 e aceita campos opcionais nas matérias:
`ativa` (ausente equivale a true) e `permitidas` (ausente ou null equivale a todas;
uma lista não vazia guarda as identidades estáveis das turmas aceitas). Os filtros
podem ser guardados no plano em `filtros`. Backups antigos mantêm seus campos e
suas escolhas manuais, que não passam a ser restrições do gerador automaticamente.

Adicionar disciplinas sem escolher turmas mantém a semana recolhida. Ao abrir
uma grade já salva, a semana aparece com suas escolhas. Trocar planos e usar o
histórico também atualiza a prévia. Nenhum modo exige uma etapa separada para
montar ou voltar à edição.

- `grade-calculos.js`: interpreta os códigos SIGAA, identifica variantes de
  turma, detecta conflitos e gera combinações. Não depende do DOM.
- `grade-arquivos.js`: valida backups, mantém até 50 passos de histórico e
  exporta calendário com recorrência semanal.
- `grade.js`: busca disciplinas, controla os planos e desenha a semana e o PNG.
- `grade-worker.js`: executa a busca fora da interface, limitada a 20 resultados
  e 25 mil tentativas. Cancelar encerra o Worker.

Os planos ficam na chave `trajetoria-unb:grade:v1` do localStorage. Cada plano
tem semestre, disciplinas desejadas, prioridade de cada disciplina, snapshot
das turmas escolhidas e datas opcionais das aulas. Uma atualização de vagas
não muda a identidade da turma. Mudanças de professor, local ou horário podem
tornar uma escolha ausente da oferta atual: o snapshot é preservado e a
interface informa a diferença.

“Obrigatória” significa que a disciplina deve aparecer nas combinações daquele
plano; não indica sua classificação no currículo do curso. Turmas sem horário
válido podem ser escolhidas manualmente, com aviso, mas não entram no gerador.
O filtro de vagas exclui turmas lotadas e vagas desconhecidas quando marcado.
As sugestões não são um ranking e a busca limitada não garante encontrar
todas as possibilidades.

Backups JSON são validados antes de substituir os planos. Há limite de 1 MB,
20 planos e 20 disciplinas por plano. A importação também entra no histórico
para permitir desfazer. Não há sincronização entre dispositivos.

## Horas, créditos e calendário

A carga curricular vem da consulta pública de componentes do SIGAA e fica em
`public/data/turmas/componentes.json`, separada da oferta. O comando
`uv run python scripts/scrapers/coletar_componentes.py` atualiza o cadastro.
O mesmo cadastro aparece na consulta de Turmas, dentro de cada disciplina expandida.
Ausências não recebem carga inventada. Carga de professor e quantidade de
blocos semanais não são usadas para deduzir a carga da disciplina.

A conversão exibida é de 15 horas/aula por crédito, conforme a seção sobre
créditos nas [dúvidas frequentes do Portal SIG](https://portalsig.unb.br/duvidas-frequentes/).
Valores são mostrados com até quatro casas decimais e somados apenas quando
todas as disciplinas escolhidas têm carga informada.

Os horários dos blocos seguem as tabelas oficiais da Unb, incluindo os turnos
matutino, vespertino e noturno. Referências:
[tabela do PPG-CDC](https://cdc.unb.br/wp-content/uploads/2024/09/OFERTA_DE_DISCIPLINAS_PPG-CDC_2024_1_-_23_de_fev.pdf)
e [salas da Prefeitura](https://prefeitura.unb.br/images/phocadownload/Contempladas.pdf).

A exportação ICS usa o fuso `America/Sao_Paulo`, começa na primeira ocorrência
de cada dia a partir da data indicada e repete semanalmente até o último dia
inclusive. Blocos separados por intervalos geram eventos separados. Exige
datas reais, em ordem, a partir de 2020 e com intervalo máximo de 366 dias.
Não conhece feriados, recessos ou aulas canceladas.

## Verificação

`bun test` inclui os testes puros da grade, arquivos e histórico. Os testes
Python verificam a rota e o scraper de componentes. `bun run build:verified`
verifica a página e seus recursos para a publicação estática. Testes no
navegador devem usar contexto isolado, sem tocar nos planos pessoais.
