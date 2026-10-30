# Apresentação da página inicial

A abertura e os acessos às ferramentas usam a identidade do Trajetória Unb.
Na apresentação animada, a roda do mouse ou o gesto de rolar avançam uma linha
do tempo: o palco permanece fixo, a câmera atravessa um portal e os capítulos
Grade, IRA/MP e Intercâmbio aparecem no mesmo espaço. Os blocos não sobem pela
tela. Ao terminar, Glossário, perguntas e rodapé seguem no fluxo normal.

## Referência observada

Referência: https://emotion-agency.com/, observada em 29/10/2026 com REA 6.7.0.
A captura selecionou “Enter without audio” e avançou dez vezes com PageDown.
Evidência: `ev_c9065017a6b103b5f26411d56ce653630e90e0423943e871c420c10b63d2b00d`.
Capturas locais ficam em `.playwright-mcp/`, fora da publicação.

Observado: cenário 3D contínuo, câmera e partículas mudando com o avanço,
títulos trocados na cena e navegação no topo estável. A captura não identifica
a biblioteca ou os shaders usados. O portal e os capítulos do Trajetória são
uma implementação original do comportamento solicitado, sem modelos, imagens,
textos ou código copiados. Nenhum áudio é carregado.

## Implementação

- `landing-timeline.js`: função pura com as janelas de entrada, leitura, saída
  e portal; o mesmo progresso produz o mesmo estado ao avançar ou voltar.
- `landing.js`: WebGL de partículas gerado localmente, interpolação do progresso,
  interação com ponteiros precisos e seleção do capítulo acessível.
- `landing.css`: palco sticky com painéis absolutos e revelação por recorte e
  opacidade. O movimento vertical do documento só conduz o progresso.

A animação usa rolagem nativa: não captura wheel ou touchmove, não bloqueia o
body e não depende de GSAP, Three.js ou serviço externo. O percurso começa
na altura do cabeçalho e termina com os painéis e a figura apagados, antes
de o palco sair da tela. Capítulos podem ser acessados por botões; existe
um link para pular a apresentação.

Somente o capítulo ativo recebe foco e participa da árvore acessível. Os
outros ficam inertes enquanto sobrepostos. Com movimento reduzido, JavaScript
desativado ou viewport baixo demais para o conteúdo, as seções ficam visíveis
no fluxo de documento normal. Sem WebGL, uma órbita CSS oferece a passagem
visual; a narrativa não depende de renderização 3D. Os textos continuam no HTML
para leitura e indexação.

A resolução e a quantidade de partículas são limitadas no celular. A
interpolação para em repouso e quadros são suspensos em abas ocultas. Testes de
emulação não substituem verificar toque e fluidez em celular físico.

## Ritmo e suavização

O percurso animado ocupa 7,2 unidades, cada uma com 85% da altura do palco:
cerca de 82% mais rolagem que a versão de 4,8 unidades a 70%. Entradas e saídas
têm aproximadamente o dobro do intervalo na linha do tempo, mantendo pausas
para leitura. A interpolação usa o tempo entre quadros (140 ms de seguimento),
para manter comportamento próximo em telas de 60 e 120 Hz. O morphing aplica
uma única curva de suavização; a câmera do portal amplia de forma exponencial
contínua, substituindo a aceleração concentrada no final.
