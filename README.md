# Trajetória Unb

Calculadora de IRA e média ponderada, com uma área para simular notas de intercâmbio e consultar os resultados dos editais da INT.

Na calculadora de IRA, você organiza as disciplinas por período, informa os créditos e as menções. Na área de intercâmbio, pode filtrar os candidatos por curso e comparar sua nota usando as médias e os desvios de cada edital. Seu IRA e IPF ficam salvos no navegador para usar nos outros editais.

O projeto é independente e não tem vínculo oficial com a UnB.

## Como rodar

Com Python instalado:

```sh
pip install -r requirements.txt
python route.py
```

Abra [localhost:8080](http://localhost:8080). A apresentação fica em `/`, a calculadora em `/ira/` e os editais em `/intercambio/`.

O servidor carrega o histórico de disciplinas de `dados.json`, quando disponível, e salva as alterações nesse arquivo e no navegador. Também é possível servir o site com `python -m http.server 8080`; nesse caso, o histórico fica apenas no navegador.

## Editais

Estão disponíveis os editais **3/2024**, **10/2024**, **1/2025**, **1/2026** e **7/2026**. Os dados vêm das publicações oficiais da INT, com links para as fontes em cada página.

Os arquivos ficam em `data/editais/`. Cada edital tem seu próprio script de extração, porque as publicações nem sempre seguem o mesmo formato. Para atualizar os dados:

```sh
python scripts/extrair_edital_3_2024.py
python scripts/extrair_edital_10_2024.py
python scripts/extrair_edital_1_2025.py
python scripts/extrair_edital_1_2026.py
python scripts/extrair_edital_7_2026.py
```

Execute o script do edital que quiser atualizar. Nos editais 1/2025 e 1/2026, homologação e alocação são cruzadas pela matrícula. Médias e desvios são específicos de cada seleção; quando há mais de uma referência para o curso, a calculadora mostra as alternativas.

O 3/2024 usa o IRA diretamente: `IRA + 2 × (IPF / 100)`, sem média ou desvio por curso. As opções de destino não constam nas tabelas consultadas.

No 10/2024, as opções de destino não foram encontradas nas publicações consultadas. As médias e os desvios são estimados pelo IRA e pelo escore publicado, sem atribuir turnos. Quando os dados não permitem distinguir uma referência, a simulação fica indisponível. O JSON registra o método e as matrículas usadas em cada estimativa.

Para incluir um novo edital, crie o extrator em `scripts/`, os dados em `data/editais/` e a página em `intercambio/`. Depois, adicione a entrada em `data/editais/index.json`.

## Código

O site usa HTML, CSS e JavaScript, com Bootstrap. O servidor local é feito com Bottle.

- `ira/` e `intercambio/`: páginas do site.
- `js/` e `css/`: cálculos, filtros e estilos.
- `scripts/`: extração dos dados publicados pela INT.
- `tests/`: testes dos cálculos, das extrações e das rotas.

## Verificações

Com [uv](https://docs.astral.sh/uv/) e [Bun](https://bun.sh/) instalados, rode na raiz do projeto:

```sh
uv sync --frozen
bun install --frozen-lockfile

uv run pytest
uv run ruff check .
uv run ruff format --check .
bun check
bun run test
bun run build
```

Para aplicar a formatação: `uv run ruff format .` e `bun run format`.
`bun check` apenas confere os arquivos, sem alterá-los. ESLint verifica o JavaScript,
Stylelint verifica o CSS, HTML Validate verifica a marcação HTML e Prettier confere a formatação de HTML, CSS, JavaScript e configurações JSON/YAML.
Os arquivos de dados, `dados.json`, dependências e a saída de build ficam fora da formatação.

`bun check` também valida links e arquivos internos (incluindo diferenças de maiúsculas/minúsculas),
sitemap, URLs canônicas e integridade dos dados dos editais: matrículas únicas, cursos, opções e campos numéricos.
Use `bun run check:site` para executar só essa etapa.

O GitHub Actions executa essas verificações em cada push e pull request, além dos testes Python em Linux
(Python 3.11 e 3.13) e Windows (3.13). O site gerado fica disponível como artefato por sete dias.
Para bloquear merges com falhas, adicione o status **Verificações obrigatórias** às regras de proteção da `main` no GitHub,
depois que o workflow tiver rodado. O arquivo de workflow sozinho não ativa essa proteção.

Na Vercel, o comando configurado é `bun run build:verified`: lint, formatação, HTML, links, dados,
testes JavaScript, build e uma segunda conferência sobre `dist/`. Qualquer falha interrompe a publicação.
Os testes do servidor Python ficam no GitHub, pois a Vercel publica apenas os arquivos estáticos.
A formatação de `vercel.json` é conferida por `bun check` e pelo GitHub. No deploy,
`bun run format:check:deploy` exclui somente esse arquivo da checagem de formatação;
as demais verificações continuam obrigatórias.
Mantenha `bun.lock` e `uv.lock` no repositório para instalações reproduzíveis.
O `pyproject.toml` define as dependências usadas por uv; `requirements.txt` mantém a instalação por pip disponível.

## Publicação

O domínio configurado nos links canônicos, `robots.txt` e `sitemap.xml` é `https://trajetoriaunb.vercel.app/`. Ao adicionar uma página pública, inclua sua URL no sitemap. Os favicons ficam na raiz, em SVG, ICO e PNG.

### Servidor local

```sh
python route.py --port 8081
```

A execução padrão usa `127.0.0.1:8080`. Use `--quiet` para ocultar as requisições ou `--debug` para investigar erros. HTML, CSS e JavaScript são atualizados ao recarregar a página; alterações em Python exigem reiniciar o servidor. Encerre com Ctrl+C.

### Vercel e indexação

`vercel.json` configura a publicação estática com `bun run build:verified`, que confere o projeto e gera `dist/` somente com arquivos públicos. O histórico pessoal e `route.py` ficam fora da publicação. No site público, o histórico é salvo no navegador; a sincronização com `dados.json` é exclusiva do servidor local.

Depois de publicar:

- Use o domínio de produção `https://trajetoriaunb.vercel.app/`, com acesso público.
- Confira se páginas, `robots.txt`, `sitemap.xml` e favicons respondem normalmente, sem `noindex` nas páginas de produção.
- Cadastre a propriedade de prefixo de URL no Google Search Console, conclua a verificação de propriedade e envie `sitemap.xml`.
- Solicite a inspeção da página inicial. A descoberta e a indexação são decisões do buscador; sitemap e metadados não garantem inclusão.

Ao adicionar um edital, mantenha também seus links no HTML inicial de `intercambio/index.html`, para que possam ser encontrados antes de executar JavaScript.
