# Grade pessoal

A lista usa uma apresentação compacta: a caixa de seleção inclui a matéria no
gerador e “Escolher turmas” abre suas alternativas. Prioridade, remoção e escolha
manual ficam em “Opções”, que abre um painel em toda a largura sem deslocar seus
botões. A prioridade e a turma da grade salva aparecem diretamente, sem outra
abertura. A escolha manual não limita as turmas permitidas no gerador. As
combinações geradas já mostram suas turmas e professores abertas. “Ocultar extras
fora do plano” mantém visíveis as extras ativadas no gerador, com turma na grade
ou ainda em edição.
Filtros são recolhidos com um contador de opções ativas;
criação de planos, histórico e arquivos ficam em “Plano”. A geração tem um botão
direto e “Ver grade” aparece quando existe uma grade escolhida. Essa organização
não altera as escolhas salvas nem as regras de geração.

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
participação e escolha manual no mesmo plano. Reabrir o editor não as apaga.
Antes de editar outra matéria, aplique ou cancele o rascunho atual. Aplicar,
cancelar, permitir todas para essa matéria, remover a matéria, trocar de plano
ou semestre, usar o histórico ou importar um backup encerram a edição. Os
rascunhos não entram no arquivo salvo. Ao concluir a edição, o foco retorna ao
botão da matéria ou à busca, se a matéria deixou de aparecer pelos filtros.

“Com vagas” afeta a consulta e a geração, sem apagar escolhas salvas. “Só as
turmas que encaixam” testa cada candidata junto às matérias necessárias ativadas.
As verificações rodam num Worker separado; mudar escolhas cancela a verificação
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

O fluxo começa pelas escolhas: adicione disciplinas e selecione turmas ou use
uma combinação gerada. “Montar grade” abre a semana de segunda a sábado e as
exportações. “Voltar às escolhas” permite editar o mesmo plano sem perder os
dados. A semana não aparece automaticamente ao abrir a página ou trocar de plano.

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
