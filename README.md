# Calculadoras UnB

Calculadora de IRA e média ponderada, com uma área para simular notas de intercâmbio e consultar os resultados dos editais da INT.

Na calculadora de IRA, você organiza as disciplinas por período, informa os créditos e as menções. Na área de intercâmbio, pode filtrar os candidatos por curso e comparar sua nota usando as médias e os desvios de cada edital. Seu IRA e IPF ficam salvos no navegador para usar nos outros editais.

O projeto é independente e não tem vínculo oficial com a UnB.

## Como rodar

Com Python instalado:

```sh
pip install -r requirements.txt
python route.py
```

Abra [localhost:8080](http://localhost:8080). A calculadora fica em `/ira/` e os editais em `/intercambio/`.

O servidor carrega o histórico de disciplinas de `dados.json`, quando disponível, e salva as alterações nesse arquivo e no navegador. Também é possível servir o site com `python -m http.server 8080`; nesse caso, o histórico fica apenas no navegador.

## Editais

Estão disponíveis os editais **1/2025**, **1/2026** e **7/2026**. Os dados vêm das publicações oficiais da INT, com links para as fontes em cada página.

Os arquivos ficam em `data/editais/`. Cada edital tem seu próprio script de extração, porque as publicações nem sempre seguem o mesmo formato. Para atualizar os dados:

```sh
python scripts/extrair_edital_1_2025.py
python scripts/extrair_edital_1_2026.py
python scripts/extrair_edital_7_2026.py
```

Execute o script do edital que quiser atualizar. Nos editais 1/2025 e 1/2026, homologação e alocação são cruzadas pela matrícula. Médias e desvios são específicos de cada seleção; quando há mais de uma referência para o curso, a calculadora mostra as alternativas.

Para incluir um novo edital, crie o extrator em `scripts/`, os dados em `data/editais/` e a página em `intercambio/`. Depois, adicione a entrada em `data/editais/index.json`.

## Código

O site usa HTML, CSS e JavaScript, com Bootstrap. O servidor local é feito com Bottle.

- `ira/` e `intercambio/`: páginas do site.
- `js/` e `css/`: cálculos, filtros e estilos.
- `scripts/`: extração dos dados publicados pela INT.
- `tests/`: testes dos cálculos, das extrações e das rotas.

Para rodar os testes, é necessário ter Python e Node.js:

```sh
node --test tests/calculos.test.cjs
python -m unittest discover -s tests -p "test_*.py"
```
