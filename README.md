# Calculadora de IRA e MP — UnB

Uma ferramenta simples, rápida e 100% focada na Universidade de Brasília (UnB) para o cálculo do **Índice de Rendimento Acadêmico (IRA)** e da **Média Ponderada (MP)**, além de fornecer métricas importantes para editais de intercâmbio (IPF e IRA Padronizado).

## ✨ Funcionalidades
- **100% Estático:** Todo o cálculo e salvamento (via `localStorage`) ocorre no seu próprio navegador. Hospedagem gratuita e instantânea.
- **Modo Escuro Nativo:** Interface pensada no conforto visual.
- **Módulo Livre (§2º):** Opção individual por matéria para excluí-la da MP e mantê-la no IRA, espelhando perfeitamente a matemática oficial do SIGAA.
- **Seletor de Cursos:** Mais de 70 cursos pré-cadastrados com Média e Desvio Padrão oficiais para o cálculo exato do IRA Padronizado.
- **Offline First:** Possui um script Python opcional (`route.py`) para quem deseja salvar cópias físicas locais (`dados.json`), embora não seja necessário para hospedar no GitHub Pages/Vercel.

## 💻 Como Usar Offline

Caso queira usar o projeto localmente no seu próprio computador e salvar suas notas num arquivo físico (`dados.json`), basta seguir esses passos:

1. Certifique-se de ter o Python instalado.
2. Abra o terminal na pasta do projeto e instale o pacote Bottle: `pip install bottle`
3. Inicie o servidor rodando: `python route.py`
4. Acesse no seu navegador: **[http://localhost:8080](http://localhost:8080)**

Sempre que você alterar suas notas pelo navegador rodando localmente, elas serão salvas na hora no seu arquivo `dados.json`.

---
*Este projeto não possui vínculos oficiais com a Universidade de Brasília.*
