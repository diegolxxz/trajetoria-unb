# Landing com narrativa de rolagem

A página inicial usa o cabeçalho, as cores e os links existentes. Apresenta o
planejamento da semana, médias e intercâmbio em uma sequência vertical, seguida
do glossário em preparação e das perguntas frequentes.

## Referência e evidência

Referência: https://emotion-agency.com/, observada em 29/10/2026 com REA 6.7.0.
A primeira captura ficou na tela de entrada; a segunda selecionou explicitamente
“Enter without audio” antes de rolar duas vezes com PageDown.

Evidência REA: `ev_7e4d56dfcb4b5cde03a4af922f59435d3b11ef6db8937bcf89b3291c78d10fb4`.
As capturas locais de investigação ficam em `.playwright-mcp/`, fora da publicação.

Observado: cena 3D persistente com partículas, títulos grandes, composição que
muda durante a rolagem e escolha inicial de áudio. Não foi identificada por esta
captura a biblioteca exata ou o código dos shaders. A implementação daqui é
original; não reutiliza código, imagens, modelos, marcas ou áudio da referência.

## Escolhas

A peça central é uma malha de partículas gerada em WebGL puro. A rolagem a
transforma de um laço em uma grade, uma hélice e um globo. Sem dependência de
Three.js, GSAP ou APIs externas. O conteúdo HTML e os links funcionam sem WebGL
ou JavaScript. Não há bloqueio de entrada, áudio ou rolagem artificial.

O renderizador limita densidade e resolução no celular e desenha somente quando
há mudança. Suspende quadros em abas ocultas. `prefers-reduced-motion` e o botão
“Reduzir movimento” mantêm uma forma estática. A falha ou perda do contexto
WebGL deixa uma órbita CSS simples de alternativa. O botão atua na animação
espacial; as ferramentas e seus dados não são alterados.

A conferência automatizada de responsividade não substitui conferir toque,
rolagem e consumo de bateria em um celular físico.
