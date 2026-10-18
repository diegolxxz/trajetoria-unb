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
  confira horários, locais e vagas do semestre disponível.

As páginas funcionam em computador e celular. Os dados de editais e turmas são
organizados por seleção e semestre para facilitar as atualizações. A
calculadora de IRA pode ser usada sem criar conta. Seu histórico fica neste
navegador; ao rodar o servidor local, uma cópia também é guardada em
`local/dados.json`.

## Rodar no computador

Instale [Python](https://www.python.org/) e [uv](https://docs.astral.sh/uv/).
Na pasta do projeto, execute:

```sh
uv sync --frozen
uv run python server/route.py
```

Abra [http://localhost:8080](http://localhost:8080). Para encerrar, use
`Ctrl+C` no terminal.

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

Para atualizar um edital, rode o extrator correspondente. Por exemplo:

```sh
uv run python scripts/scrapers/extrair_edital_7_2026.py
```

Cada edital tem fontes e regras próprias. Antes de atualizar ou incluir um,
consulte [docs/dados.md](docs/dados.md), que registra essas particularidades e o
formato dos dados.
