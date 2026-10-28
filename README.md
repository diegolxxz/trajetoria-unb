# Trajetória Unb

O Trajetória Unb reúne ferramentas para acompanhar a vida acadêmica na
Universidade de Brasília. É um projeto independente, sem vínculo oficial com a
Unb.

## O que tem no site

- **IRA e MP:** calcule seus resultados a partir das disciplinas e acompanhe os
  períodos em uma mesma página. O histórico fica salvo no navegador.
- **Intercâmbio:** consulte editais, filtre os resultados e simule sua nota com
  os dados publicados em cada seleção. As regras podem variar entre editais.
- **Turmas:** procure disciplinas por nome, código, professor ou departamento e
  confira horários, locais e vagas do semestre disponível. Ao expandir uma
  disciplina, veja também suas horas e créditos, quando publicados.
- **Grade:** escolha turmas, visualize sua semana e encontre combinações sem
  conflitos. Guarde planos por semestre, desfaça escolhas e exporte os planos
  em JSON, a grade em imagem ou os horários para seu calendário.

As páginas funcionam em computador e celular. Os dados de editais e turmas são
organizados por seleção e semestre para facilitar as atualizações. A
calculadora de IRA pode ser usada sem criar conta. Seu histórico fica neste
navegador; ao rodar o servidor local, uma cópia também é guardada em
`local/dados.json`.

A grade usa a mesma oferta da consulta de turmas. Os planos ficam no navegador;
para transferi-los ou fazer backup, baixe o JSON em “Plano”. A
geração inclui todas as disciplinas marcadas como obrigatórias e permite
deixar opcionais de fora, com limites para manter a página responsiva. A
exportação de calendário pede o primeiro e o último dia das aulas e não exclui
feriados ou recessos. Horas e créditos vêm da carga curricular do SIGAA, quando
disponível; não são deduzidos dos horários do professor.

## Rodar no computador

Instale [Python](https://www.python.org/) e [uv](https://docs.astral.sh/uv/).
Na pasta do projeto, execute:

```sh
uv sync --frozen
uv run python server/route.py
```

Abra o endereço exibido no terminal. Para encerrar, use `Ctrl+C`.

## Atualizar os dados

Os dados de turmas são coletados manualmente. Para atualizar o semestre, ajuste
`config/coleta.json`. Em seguida, execute:

```sh
uv run python scripts/scrapers/coletar_classroom_code_units.py
uv run python scripts/scrapers/coletar_unidades.py
uv run python scripts/scrapers/coletar_turmas.py turmas
```

O primeiro comando atualiza o cadastro de unidades e departamentos; o segundo
seleciona as unidades com oferta de graduação; o terceiro coleta as turmas
dessas unidades. Na atualização rotineira do mesmo semestre, normalmente basta
executar o terceiro comando.

Para atualizar a carga curricular usada na grade, execute separadamente:

```sh
uv run python scripts/scrapers/coletar_componentes.py
```

Essa consulta muda com menos frequência que a oferta de turmas. Componentes sem
carga publicada ficam como “não informado”.

Se houver códigos do catálogo de especialização na oferta, complemente com
`uv run python scripts/scrapers/coletar_componentes.py --nivel L`. O comando
preserva os componentes já coletados. Detalhes dos planos e exportações estão
em [docs/grade.md](docs/grade.md).

Para atualizar um edital, rode o extrator correspondente. Por exemplo:

```sh
uv run python scripts/scrapers/extrair_edital_7_2026.py
```

Cada edital tem fontes e regras próprias. Antes de atualizar ou incluir um,
consulte [docs/dados.md](docs/dados.md), que registra essas particularidades e o
formato dos dados.
