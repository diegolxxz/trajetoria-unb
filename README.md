# Calculadoras UnB — IRA e intercâmbio

Aplicação estática em HTML, CSS e JavaScript, com Bootstrap 5. Os dados pessoais ficam no `localStorage` do navegador, compartilhado pelas páginas da mesma origem.

## Páginas

- `/ira/`: disciplinas por período, IRA e MP.
- `/intercambio/`: catálogo de editais implementados.
- `/intercambio/edital-int-n-7-2026/`: calculadora e tabela do resultado definitivo do Edital INT nº 7/2026. O identificador acompanha o caminho da página oficial da INT.
- `/intercambio/edital-int-n-1-2026-processo-de-pre-selecao-de-alunos-de-graduacao-da-unb-ao-intercambio-para-mobilidade-no-periodo-de-agosto-a-dezembro-de-2026/`: calculadora e tabela do Edital INT nº 1/2026, usando o identificador da página oficial.
- `/`: encaminha para `/ira/`.

Cada pasta contém `index.html`, permitindo hospedagem estática, inclusive em subpastas como GitHub Pages, sem regras de SPA. O servidor local aceita os caminhos com e sem barra final.

## Rodar localmente

```sh
pip install -r requirements.txt
python route.py
```

Acesse `http://localhost:8080`. Também é possível usar `python -m http.server 8080`. É necessário servir por HTTP para carregar os arquivos JSON; abrir o HTML por `file://` não é suficiente. Bootstrap vem de CDN.

Ao abrir `/ira/` pelo servidor Bottle, os períodos são carregados de `dados.json` quando o arquivo contém dados. Alterações são salvas no navegador e enviadas a `/save` para atualizar o arquivo. Sem o servidor, a calculadora usa os dados do navegador.

## Dados do Edital INT nº 7/2026

- [Página oficial](https://int.unb.br/edital-int-n-7-2026/)
- [Resultado definitivo de 31/08/2026](https://sei.unb.br/sei/publicacoes/controlador_publicacoes.php?acao=publicacao_visualizar&id_documento=16862911&id_orgao_publicacao=0)
- `data/editais/edital-int-n-7-2026.json`: fontes, fórmula, referências por curso e registros.
- `data/editais/edital-int-n-7-2026.csv`: as 14 colunas solicitadas, separadas por `;`, com números no formato brasileiro.

Na página, todos os resultados aparecem sem paginação. A tabela tem 12 colunas compactas no computador e organiza cada candidato em um bloco de duas colunas no celular. Ao filtrar por curso, o IRA médio e o desvio padrão ficam acima da tabela; cursos com mais de um par recebem referências numeradas também nas linhas. O CSV conserva as 14 colunas da fonte.

O extrator seleciona as duas tabelas com a coluna **Alocação Definitiva** (317 registros, 66 cursos). A lista separada de bolsas Savoie é descartada porque repete inscrições. DDS, situação, observações, CHTP, CHTE e escore Z não são armazenados. Matrículas permanecem texto e campos vazios continuam vazios.

As médias e os desvios são copiados da publicação, não calculados a partir da amostra de candidatos. Pares numericamente iguais são agrupados mesmo quando diferem apenas em zeros à direita. Há 10 cursos com dois pares distintos. Quando a fonte não identifica turno, a interface mostra “Referência 1/2 · turno não informado”. Sufixos explícitos `- DIURNO` e `- NOTURNO` são agrupados no curso principal e preservados nas variantes e na tabela.

A nota simulada deste edital é `(IRA − média) / desvio + 2 × IPF`, com IPF convertido de percentual para fração. A nota final da tabela é preservada; o IPF publicado está arredondado e pode causar diferença nas últimas casas da simulação.

“Somente alocados” considera quem possui um destino no campo final; exclui `Não alocado…`, `n/a` e campos vazios. Não significa aceitação garantida pela universidade estrangeira.

### Atualizar a extração

```sh
python scripts/extrair_edital_7_2026.py
# Ou processar uma cópia já baixada:
python scripts/extrair_edital_7_2026.py --html caminho/resultado.html
```

O script valida cabeçalhos, quantidade de células, matrículas únicas e valores numéricos antes de gravar. Registra data e SHA-256 do HTML de origem. O HTML completo não é incluído no site.

## Dados do Edital INT nº 1/2026

A extração cruza pela matrícula a [homologação definitiva](https://sei.unb.br/sei/modulos/pesquisa/md_pesq_documento_consulta_externa.php?1XQweiWbpuyJUe5JOteiAz9uez3vQ1IVgO2H4YBOBecXQDfdSPFMRJe5zpQZqw_lu9UhViNnhBrwc_eZZGT3ZBFRKEUPd7-hM935MbQmPoOFB3ctuHQ7Hjn2QqNYAJum) com a [correção da alocação definitiva](https://sei.unb.br/sei/modulos/pesquisa/md_pesq_documento_consulta_externa.php?1XQweiWbpuyJUe5JOteiAz9uez3vQ1IVgO2H4YBOBed_5LP9RoSVOzgHMO4bDOnWYz-CKYrrABq3M2jCPwS69sHQOKlTMBJPyrJZRMxYHL-7tDQp7FNZQRO6DkU9mXbT). As [médias e desvios oficiais](https://int.unb.br/wp-content/uploads/2026/07/Informao-de-Mdias-e-Desvios-Padro.pdf) são lidos do PDF, sem inferência a partir dos candidatos.

O JSON gerado contém 407 inscrições (380 homologadas e 27 não homologadas), 101 alocações e 70 cursos com média publicada; 69 desses cursos têm inscritos. Cada registro preserva a nota final da homologação e recebe destino, classificação e recurso da alocação quando encontrados. Uma inscrição homologada sem destino aparece como “Não alocado”; uma não homologada é identificada separadamente. A tabela do site usa as mesmas 12 colunas do Edital 7/2026.

```sh
python scripts/extrair_edital_1_2026.py
```

O script aceita `--homologacao-html`, `--alocacao-html` e `--medias-pdf` para processar cópias já baixadas. É necessário instalar as dependências de `requirements.txt`, incluindo `pypdf`.

## Adicionar outro edital

1. Examinar suas fontes e regras; não presumir que formato ou fórmula sejam iguais.
2. Criar um extrator específico e um JSON em `data/editais/` seguindo o esquema atual. `ipf` é percentual de 0 a 100; `opcoes` tem cinco posições, inclusive vazias. Turnos sem comprovação ficam `null`.
3. Criar `intercambio/<slug-oficial>/index.html`, adaptando título, datas, links, fórmula visível e `data-edital`. Manter a raiz relativa em `meta[name="app-root"]`.
4. Adicionar o edital ao catálogo `data/editais/index.json`. O motor atual aceita pesos de IRA padronizado e IPF; fórmulas diferentes precisam de implementação específica.

`js/cursos.js` conserva a tabela antiga somente como referência histórica; ela não alimenta as calculadoras dos editais.

## Persistência

- `calculadora-ira-unb`: histórico das disciplinas no formato anterior e carga horária total.
- `calculadora-unb:perfil-intercambio:v1`: IRA, IPF percentual e curso compartilhados entre editais.
- `calculadora-unb:filtros:<slug>`: filtros próprios de cada edital.
- `calculadora-ira-tema`: tema claro/escuro.

Na primeira visita ao intercâmbio, o painel antigo é recuperado quando disponível, inclusive calculando a partir das disciplinas e da carga total. O perfil compartilhado passa a ter prioridade. A página de IRA salva apenas o histórico acadêmico; IRA e IPF da simulação são editados na página do edital.

## Verificações

```sh
node --test tests/calculos.test.cjs
python -m unittest discover -s tests -p "test_*.py"
```

Este projeto não possui vínculos oficiais com a Universidade de Brasília.
