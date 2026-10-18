# Trajetória Unb

Calculadora de IRA e média ponderada, simulação de intercâmbio e consulta de turmas da Unb.
Projeto independente, sem vínculo oficial com a universidade.

## Rodar localmente

Na raiz do projeto:

```sh
uv sync --frozen
uv run python server/route.py
```

Abra [localhost:8080](http://localhost:8080). As páginas ficam em `/`, `/ira/`,
`/intercambio/` e `/turmas/`. Para usar outra porta:

```sh
uv run python server/route.py --port 8081
```

`uv run` usa o ambiente Python do projeto. Também funciona com
`python server/route.py`, desde que o Python usado tenha as dependências
instaladas. A alternativa por pip continua disponível:

```sh
python -m pip install -r requirements.txt
python server/route.py
```

Recarregue a página após editar HTML, CSS ou JavaScript. Ao alterar Python,
reinicie o servidor. Use Ctrl+C para encerrar.

## Onde fica cada coisa

| Pasta | Conteúdo |
| --- | --- |
| `public/` | Site completo: páginas, CSS, JavaScript, ícones e dados públicos |
| `server/` | Servidor local Bottle |
| `scripts/` | Build, validação e scrapers em `scripts/scrapers/` |
| `local/` | Histórico pessoal; fora do Git e da publicação |
| `config/` | Semestre atual usado pelos scrapers |
| `tests/` | Testes de cálculos, scrapers e servidor |
| `docs/` | Detalhes dos dados e de sua atualização |

`dist/` é gerado pelo build. Edite os arquivos em `public/`.
As configurações, `bun.lock` e `uv.lock` permanecem na raiz.

## Dados e histórico

A calculadora salva o histórico no navegador. No servidor local, também lê e
salva `local/dados.json`. Esse arquivo não vai para o Git nem para a Vercel.
IRA, IPF e preferências de intercâmbio ficam no navegador; são separados por
origem, então localhost e o site publicado têm armazenamentos distintos.

Para servir apenas os arquivos estáticos, sem sincronizar o histórico local:

```sh
python -m http.server 8080 --directory public
```

### Atualizar turmas

Defina o semestre em `config/coleta.json`:

```json
{
  "semestre": "2026.2"
}
```

Todos os comandos abaixo leem esse arquivo. Não existe mais a opção `--semestre`.
Ao mudar de semestre ou revisar as unidades, execute:

```sh
uv run python scripts/scrapers/coletar_classroom_code_units.py
uv run python scripts/scrapers/coletar_unidades.py
uv run python scripts/scrapers/coletar_turmas.py turmas
```

O primeiro consulta todos os departamentos e registra a oferta e os prefixos em
`public/data/turmas/classroom_code_units.json`. O segundo gera `unidades.json`
localmente, excluindo pós-graduação e unidades sem turmas. O terceiro consulta
somente a seleção e atualiza o JSON do semestre e o `index.json`.

No dia a dia, basta o terceiro comando. O filtro de nível de ensino do SIGAA fica
vazio. Os arquivos são gravados com indentação para facilitar a leitura.
O `index.json` mantém uma entrada por semestre, sem duplicar ao atualizar.

Os campos avançados e a integração dos dados com a interface de Turmas ainda
estão pendentes. Veja o formato dos arquivos em [docs/dados.md](docs/dados.md).

### Atualizar editais

Execute somente o extrator do edital desejado, por exemplo:

```sh
uv run python scripts/scrapers/extrair_edital_7_2026.py
```

Os dados ficam em `public/data/editais/`. Veja as fontes, particularidades das
fórmulas e o procedimento para incluir um edital em [docs/dados.md](docs/dados.md).
Esse documento também explica o formato e os cuidados da coleta de turmas.

## Verificar o projeto

Com uv, Bun e Node.js 24 instalados, execute na raiz:

```sh
uv sync --frozen
bun install --frozen-lockfile
uv run pytest
uv run ruff check .
uv run ruff format --check .
bun check
bun run build:verified
```

`bun check` confere JavaScript, CSS, HTML, formatação, links, sitemap e dados.
`build:verified` também executa os testes JavaScript, gera `dist/` e confere o
resultado. Os testes Python usam arquivos temporários para testar a gravação;
o histórico pessoal não deve ser usado como fixture.

Para aplicar a formatação:

```sh
uv run ruff format .
bun run format
```

O GitHub Actions roda as verificações em pushes e pull requests, com testes
Python em Linux (3.11 e 3.13) e Windows (3.13). Para exigir aprovação dos checks
antes do merge, configure o status **Verificações obrigatórias** na proteção da
`main`; o workflow sozinho não ativa essa regra.

## Publicar

A Vercel executa `bun run build:verified` e publica `dist/`, que recebe somente o
conteúdo de `public/`. Python e scrapers não rodam na Vercel. Atualize os dados
localmente e envie os JSONs por commit e push quando quiser publicá-los.

A formatação de `vercel.json` é conferida localmente por `bun check` e no GitHub.
Na checagem de deploy, somente esse arquivo é excluído do Prettier.

O endereço configurado é [trajetoriaunb.vercel.app](https://trajetoriaunb.vercel.app/).
Ao adicionar páginas, atualize `public/sitemap.xml` e os links de navegação.
Ícones, `robots.txt` e sitemap ficam em `public/`, mas continuam acessíveis na
raiz do site. Após publicar, envie o sitemap ao Google Search Console; a
indexação depende do buscador.

A página `public/404.html` é usada pelo servidor local e publicada junto do site
para rotas inexistentes. Ela fica fora do sitemap e tem `noindex`.

`node_modules/` contém as ferramentas de lint, testes JavaScript e build. É
recriado por `bun install --frozen-lockfile`, fica fora do Git e não é publicado.
