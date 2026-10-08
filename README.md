# Calculadora de Notas e MP — UnB

Uma ferramenta simples, rápida e 100% focada na Universidade de Brasília (UnB) para o cálculo das **Notas (antigo IRA)** e da **Média Ponderada (MP)**, além de fornecer métricas importantes para editais de intercâmbio (IPF e Nota Padronizada).

## ✨ Funcionalidades
- **100% Estático:** Todo o cálculo e salvamento (via `localStorage`) ocorre no seu próprio navegador. Hospedagem gratuita e instantânea.
- **Modo Escuro Nativo:** Interface pensada no conforto visual.
- **Módulo Livre (§2º):** Opção individual por matéria para excluí-la da MP e mantê-la nas Notas, espelhando perfeitamente a matemática oficial do SIGAA.
- **Seletor de Cursos:** Mais de 70 cursos pré-cadastrados com Média e Desvio Padrão oficiais para o cálculo exato da Nota Padronizada.
- **Offline First:** Possui um script Python opcional (`route.py`) para quem deseja salvar cópias físicas locais (`dados.json`).

## 🛠 Tecnologias Usadas
* HTML5 Semântico
* CSS3
* Vanilla JavaScript
* Bootstrap 5

## 📚 Atualizar os dados dos cursos

As médias e os desvios padrão usados na Nota Padronizada ficam em [`js/cursos.js`](js/cursos.js), separados dos cálculos. A cada semestre, edite os valores `media` e `desvio` do curso correspondente nesse arquivo. Para incluir um curso, acrescente uma entrada com `nome`, `media` e `desvio`.

O seletor usa o nome do curso para manter a escolha salva no navegador mesmo se a ordem da lista mudar. Campos travados recebem os valores atualizados ao abrir a página; campos destravados preservam os valores digitados. Se alterar o nome de um curso, será preciso selecioná-lo novamente. Confira os dados do edital vigente antes de atualizá-los.

## 💻 Como Usar Offline

Caso queira usar o projeto localmente no seu próprio computador e salvar suas notas num arquivo físico (`dados.json`), basta seguir esses passos:

1. Certifique-se de ter o Python instalado.
2. Abra o terminal na pasta do projeto e instale o pacote Bottle: `pip install bottle`
3. Inicie o servidor rodando: `python route.py`
4. Acesse no seu navegador: **[http://localhost:8080](http://localhost:8080)**

Sempre que você alterar suas notas pelo navegador rodando localmente, elas serão salvas na hora no seu arquivo `dados.json`.

---
*Este projeto não possui vínculos oficiais com a Universidade de Brasília.*
