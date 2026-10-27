# Dados públicos

## Editais de intercâmbio

Os editais disponíveis são 3/2024, 10/2024, 1/2025, 1/2026 e 7/2026. Cada um tem
um extrator em `scripts/scrapers/`, pois os documentos da INT não seguem um
formato único. Os scripts gravam JSON e CSV em `public/data/editais/`.

Nos editais 1/2025 e 1/2026, homologação e alocação são cruzadas pela matrícula.
Médias e desvios pertencem à seleção correspondente; cursos com mais de uma
referência devem manter todas as alternativas, sem inventar nomes de turnos.

O 3/2024 usa `IRA + 2 × (IPF / 100)`, sem média ou desvio por curso. As opções de
destino não constam nas tabelas consultadas.

No 10/2024, as opções de destino também não foram encontradas. As médias e os
desvios são estimados a partir do IRA e do escore publicado. O JSON registra o
método e as matrículas usadas. Quando não é possível distinguir uma referência,
a simulação fica indisponível.

Para incluir um edital:

1. Crie o extrator em `scripts/scrapers/`, registrando as fontes e a fórmula.
2. Gere os dados em `public/data/editais/` e acrescente o edital ao `index.json`.
3. Crie sua página em `public/intercambio/`, mantendo o slug oficial.
4. Adicione o link em `public/intercambio/index.html` e a URL ao sitemap.
5. Execute as verificações do README e confira a calculadora com valores publicados.

## Turmas

### Semestre atual

`config/coleta.json` guarda um único campo: `semestre`, por exemplo `2026.2`.
Os três comandos leem esse valor; não recebem `--semestre`. Para consultar outro
semestre, edite a configuração e atualize o cadastro completo e a seleção antes
de coletar suas turmas. Configuração ausente ou inválida interrompe a execução.

### Cadastro completo — atualização ocasional

`coletar_classroom_code_units.py` lê a lista oficial e consulta **cada unidade**,
incluindo pós-graduação e unidades antes vazias, sem filtro de nível no SIGAA.
Verifica se há pelo menos uma turma e reconstrói as associações de prefixos a
unidades a partir dos códigos encontrados. Não deduz oferta pelo nome.

O resultado é `public/data/turmas/classroom_code_units.json`. Seus campos são:

- `source` e `generated_at`: fonte e data da consulta completa.
- `semesters`: lista contendo o semestre verificado nesta execução.
- `units`: todos os IDs e nomes oficiais, inclusive unidades sem oferta.
- `units_without_classes`: IDs que não retornaram turmas nesse semestre.
- `prefixes`: prefixo do código de disciplina e IDs das unidades onde apareceu.

O cadastro completo representa a última consulta, não um histórico de semestres.
Mantém os nomes dos campos do JSON original, que foi movido de `references/`.

### Seleção de unidades — sem acesso à rede

`coletar_unidades.py` lê o cadastro completo, exclui nomes contendo
“pós-graduação” (ignorando acentos e variações de hífen/espaço) e unidades sem
oferta. Grava `unidades.json`, com a seleção, fonte, data, semestre verificado,
IDs excluídos e data do cadastro de origem.

Esse passo não consulta o SIGAA. Refaça-o depois de atualizar o cadastro completo.
O semestre do cadastro deve coincidir com o configurado, evitando aplicar a
seleção de um semestre antigo ao novo.

### Coleta frequente das turmas

`coletar_turmas.py turmas` consulta somente os IDs de `unidades.json`.
O campo de nível de ensino no SIGAA fica vazio. A seleção é por unidade;
uma unidade selecionada pode publicar componentes de diferentes níveis.
A seleção deve corresponder ao semestre configurado.

As consultas usam duas sessões públicas independentes, até três tentativas por
unidade e uma pausa entre consultas, sem login. Falhas não são tratadas como
unidades vazias. Uma falha de consulta, semestre inesperado ou coleta inteiramente
vazia impede substituir o arquivo anterior. Cada JSON é gravado de forma atômica,
com indentação de dois espaços, após concluir sua coleta.

### Formato dos arquivos

| Arquivo em `public/data/turmas/` | Conteúdo |
| --- | --- |
| `classroom_code_units.json` | Cadastro completo, unidades sem oferta e prefixos |
| `unidades.json` | Seleção usada nas consultas frequentes |
| `index.json` | Uma entrada por semestre, com arquivo, fonte, data e contagens |
| `2026-2.json` | Disciplinas e turmas de um semestre |

Reexecutar 2026.2 substitui somente sua entrada no índice e seu arquivo. Semestres
anteriores permanecem disponíveis, ordenados do mais recente para o mais antigo.

O arquivo do semestre contém apenas `disciplinas`: código, nome e lista de
`turmas`. Cada turma guarda `numero` como texto, `professores` como lista de
nomes, `horarios`, `local`, `vagas`, `matriculados` e IDs das `unidades` de origem.
Os nomes das unidades ficam no cadastro completo; fonte, data e contagens ficam
no índice. Cargas horárias dos professores e hashes internos não são exportados.
`null` representa informação ausente; zero representa um valor publicado.

O SIGAA publica números como `02A` e linhas com o mesmo número, mas dados
diferentes. Essas variantes são preservadas, sem presumir cancelamento. Somente
linhas idênticas na origem são unificadas, mantendo as unidades de origem.
Nomes diferentes para o mesmo código ficam em `nomesAlternativos`.

### Inclusão futura dos dados avançados

A coleta desses campos ainda não está implementada. Quando for adicionada, cada
turma poderá receber um bloco opcional `avancado`, com `solicitacoesMatricula`,
`solicitacoesRematricula` e `reservas` (lista de códigos de curso e vagas).
Campos indisponíveis devem ficar ausentes ou `null`, nunca receber zero inventado.
Não é necessário preencher esse bloco nas turmas atuais.

A implementação deverá coletar os detalhes públicos no scraper, associá-los à
turma correta e gerar o JSON novamente. Código da disciplina e número da turma
sozinhos não bastam quando há variantes: prefira o ID oficial, se disponível,
ou confirme os demais dados da linha antes de associar. Depois, o frontend
poderá mostrar esses campos ao ativar o modo avançado. O semestre continuará
sendo escolhido em `config/coleta.json`, com uma entrada por semestre no índice.

O fluxo e o parser foram adaptados do Followw UnB, do mesmo autor. Não é
necessário instalar o projeto de referência.

### Carga curricular para a grade

`componentes.json` é um cadastro separado da oferta. Contém `fonte`,
`atualizadoEm` e `componentes`, com os códigos associados a `nome` e
`cargaHoraria`. O scraper `coletar_componentes.py` consulta a coluna **CH Total**
do catálogo público do SIGAA, usando os prefixos encontrados no semestre de
`config/coleta.json`. Pode ser atualizado com menos frequência que as turmas;
`--codigo MAT0026` permite uma consulta pontual e `--nivel L` complementa
componentes publicados no catálogo de especialização.

Essa carga não é a carga do professor nem uma estimativa pelos horários. Campos
sem fonte publicada continuam ausentes. A interface converte horas/aula em
créditos pela equivalência de 15 horas/aula por crédito. O funcionamento dos
planos e das exportações está em [grade.md](grade.md).
