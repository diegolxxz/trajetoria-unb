# Apresentação da página inicial

A abertura mantém o nó de partículas e os acessos diretos às ferramentas.
A rolagem nativa conduz um palco fixo: primeiro a passagem pelo portal,
depois demonstrações do funcionamento do site. Os textos trocam no mesmo
palco, sem simular o deslocamento vertical de uma página inteira.

## Sequência

| Trecho | O que o scroll mostra |
| --- | --- |
| Abertura e portal | A assinatura original se aproxima e abre a passagem. |
| Turmas e grade | Blocos dispersos se organizam em uma semana ilustrativa. |
| IRA e MP | A troca de MM por MS em uma disciplina altera a média do exemplo de 4,2 para 4,4. |
| Intercâmbio | IRA e IPF encontram a referência do curso e revelam a nota simulada. |
| Saída | O último acesso permanece disponível e a rolagem retoma o fluxo do glossário. |

As composições variam: grade à direita, exemplo de médias à esquerda e
simulação de intercâmbio centralizada em uma faixa mais ampla. Entrada do
texto, leitura, demonstração e saída têm intervalos próprios. Durante a leitura,
o scroll avança a demonstração; não há animação contínua em repouso.

Os exemplos são ilustrativos e estão identificados no HTML. Não representam
oferta de disciplinas, histórico do visitante ou candidatos publicados.
Os valores de médias e nota usam `CalculosUnB` e `AppUnB.numero`; não leem nem
gravam o perfil ou histórico. O exemplo independente de intercâmbio usa IRA
4,2, IPF 65%, média 4,0 e desvio 0,8 na fórmula padronizada, resultando em 1,55.
Os editais reais continuam com suas próprias regras.

## Implementação

- `landing-timeline.js`: estados puros para entrada, leitura, demonstração e
  saída. O mesmo progresso produz o mesmo resultado ao avançar ou voltar.
- `landing.js`: sincroniza as propriedades visuais, o foco, os atalhos e o
  canvas, limitado ao nó e ao portal da abertura.
- `landing.css`: palco sticky, composição responsiva e demonstrações em HTML.
  A primeira cena após o portal entra por revelação circular; as demais usam
  transformações e opacidade. Menções e médias deslizam em janelas recortadas.
  Os efeitos acompanham o scroll, sem alterar o layout por quadro.

O percurso ocupa 7,2 unidades de 85% da altura do palco, com mínimo de 340 px
por unidade. O seguimento usa tempo entre quadros, com constante de 140 ms.
A roda do mouse e os gestos não são interceptados. Não há GSAP, Three.js,
áudio ou dependências adicionais. No palco fixo, o WebGL deixa de desenhar
na unidade 2,05, depois do portal.

Somente o capítulo ativo recebe foco. Os demais ficam inertes enquanto
sobrepostos. Botões permitem saltar aos estados concluídos e um link pula a
apresentação. Com movimento reduzido, JavaScript desativado ou viewport sem
altura suficiente, as seções voltam ao fluxo normal e os exemplos aparecem
concluídos. Sem WebGL, uma órbita CSS acompanha a abertura.

No celular, texto e demonstração ficam empilhados; os benefícios detalhados
continuam no fluxo sem pinning, e a apresentação fixa prioriza resumo, exemplo
e acesso. A composição completa é medida antes de ativar o palco. A resolução
do canvas e o número de partículas são limitados; quadros param em repouso e
em abas ocultas. Testes de emulação não substituem um celular físico.

## Referência observada

Referência: https://emotion-agency.com/, observada em 29/10/2026 com REA 6.7.0.
A captura selecionou “Enter without audio” e avançou dez vezes com PageDown.
Evidência: `ev_c9065017a6b103b5f26411d56ce653630e90e0423943e871c420c10b63d2b00d`.
Capturas locais ficam em `.playwright-mcp/`, fora da publicação.

Observado: cenário contínuo, câmera e partículas mudando com o avanço,
títulos trocados na cena e navegação estável. A evidência não identifica
bibliotecas ou shaders. A implementação do Trajetória usa conteúdo e código
próprios; nenhum modelo, imagem ou código foi copiado da referência.
