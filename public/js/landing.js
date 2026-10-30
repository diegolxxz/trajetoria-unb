(() => {
    const canvas = document.getElementById('canvasTrajetoria');
    const cenas = [...document.querySelectorAll('[data-cena]')];
    const experiencia = document.querySelector('.jornada-experiencia');
    const visual = document.querySelector('.jornada-visual');
    const palco = document.querySelector('.jornada-palco');
    const controles = document.querySelector('.jornada-controles');
    const capitulos = [...document.querySelectorAll('[data-destino]')];
    const status = document.getElementById('capituloAtual');
    const orbita = document.querySelector('.jornada-orbita');
    const mousePermitido = matchMedia('(hover: hover) and (pointer: fine)');
    if (!canvas || !cenas.length) return;
    const preferencia = matchMedia('(prefers-reduced-motion: reduce)');
    let reduzido = preferencia.matches;
    const mouse = { x: 0, y: 0, alvoX: 0, alvoY: 0 };
    let frame = 0;
    let ultimoQuadro = 0;
    let atual = 0;
    let alvo = 0;
    let fixo = false;
    let inicio = 0;
    let passo = 1;
    let ativo = -2;
    let renderer = null;
    const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
    // A malha é gerada localmente. Nenhum modelo, imagem ou dado do visitante é carregado.
    function criarRenderer() {
        const gl = canvas.getContext('webgl', {
            alpha: true,
            antialias: false,
            depth: false,
            powerPreference: 'low-power',
        });
        if (!gl) return null;
        const vertex = `
            attribute vec2 aCoord;
            uniform float uAspect;
            uniform float uRatio;
            uniform float uMobile;
            uniform vec2 uPointer;
            uniform float uPortal;
            varying float vLuz;
            const float PI = 3.14159265359;
            vec3 forma(vec2 uv) {
                float u = uv.x * 2.0 * PI;
                float v = uv.y * 2.0 * PI;
                    float raio = 0.78 + 0.24*cos(3.0*u);
                    return vec3(raio*cos(2.0*u)+0.16*cos(v), raio*sin(2.0*u)+0.16*sin(v), 0.5*sin(3.0*u)+0.18*cos(v));
            }
            void main() {
                vec3 p = forma(aCoord);
                float portalMix = smoothstep(0.0,.4,uPortal);
                float anguloPortal = aCoord.x*2.0*PI;
                float raioPortal = .82+.035*sin(6.0*anguloPortal+aCoord.y*4.0*PI);
                vec3 anel = vec3(raioPortal*cos(anguloPortal),raioPortal*sin(anguloPortal),-7.2*aCoord.y);
                p = mix(p,anel,portalMix);
                float giro = (.3 + uPointer.x*.35)*(1.0-portalMix);
                float inclinacao = uPointer.y*.22;
                p.yz = mat2(cos(inclinacao),-sin(inclinacao),sin(inclinacao),cos(inclinacao))*p.yz;
                float influencia = exp(-3.0*length(aCoord-vec2(.5)-uPointer*.2));
                p.z += influencia * .16 * (abs(uPointer.x)+abs(uPointer.y));
                p.xz = mat2(cos(giro),-sin(giro),sin(giro),cos(giro))*p.xz;
                p.xy = mat2(cos(-.2),-sin(-.2),sin(-.2),cos(-.2))*p.xy;
                float perspectiva = 2.9/(3.2-p.z);
                float escala = .76;
                vec2 xy = p.xy*perspectiva*escala*exp(log(8.0)*smoothstep(0.0,1.0,uPortal));
                xy.x /= uAspect;
                xy.x += mix(.49,.4,uMobile)*(1.0-portalMix);
                xy.y += mix(.05,.32,uMobile)*(1.0-portalMix);
                gl_Position = vec4(xy,0.0,1.0);
                gl_PointSize = (1.2 + (p.z+1.1)*1.0)*uRatio;
                vLuz = clamp(.4+(p.z+1.0)*.3,.25,1.0);
                vLuz = mix(vLuz,.45+.4*(1.0-aCoord.y),portalMix);

            }`;
        const fragment = `
            precision mediump float;
            varying float vLuz;
            uniform vec3 uColor;
            uniform float uOpacity;
            void main() {
                float d = length(gl_PointCoord-vec2(.5));
                float alpha = (1.0-smoothstep(.2,.5,d))*vLuz*uOpacity;
                gl_FragColor = vec4(uColor,alpha);
            }`;
        const recursos = [];
        function shader(tipo, fonte) {
            const s = gl.createShader(tipo);
            recursos.push(s);
            gl.shaderSource(s, fonte);
            gl.compileShader(s);
            return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
        }
        const vs = shader(gl.VERTEX_SHADER, vertex);
        const fs = shader(gl.FRAGMENT_SHADER, fragment);
        if (!vs || !fs) {
            recursos.forEach((s) => gl.deleteShader(s));
            return null;
        }
        const programa = gl.createProgram();
        gl.attachShader(programa, vs);
        gl.attachShader(programa, fs);
        gl.linkProgram(programa);
        recursos.forEach((s) => gl.deleteShader(s));
        if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
            gl.deleteProgram(programa);
            return null;
        }
        gl.useProgram(programa);
        const pontos = [];
        const colunas = matchMedia('(max-width: 600px)').matches ? 96 : 160;
        const linhas = 38;
        for (let i = 0; i < colunas; i++) for (let j = 0; j < linhas; j++) pontos.push(i / colunas, j / linhas);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pontos), gl.STATIC_DRAW);
        const atributo = gl.getAttribLocation(programa, 'aCoord');
        gl.enableVertexAttribArray(atributo);
        gl.vertexAttribPointer(atributo, 2, gl.FLOAT, false, 0, 0);
        const uniforms = Object.fromEntries(
            ['uAspect', 'uRatio', 'uMobile', 'uColor', 'uOpacity', 'uPointer', 'uPortal'].map((n) => [
                n,
                gl.getUniformLocation(programa, n),
            ]),
        );
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        document.body.classList.add('webgl-pronto');
        return (pointer, portal, opacidade) => {
            if (opacidade <= 0) return;
            const rect = canvas.getBoundingClientRect();
            const mobile = rect.width < 601;
            const ratio = Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5);
            const w = Math.round(rect.width * ratio),
                h = Math.round(rect.height * ratio);
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
                gl.viewport(0, 0, w, h);
            }
            const claro = document.documentElement.dataset.tema === 'claro';
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.uniform1f(uniforms.uPortal, portal);
            gl.uniform2f(uniforms.uPointer, pointer.x, pointer.y);
            gl.uniform1f(uniforms.uAspect, rect.width / Math.max(1, rect.height));
            gl.uniform1f(uniforms.uRatio, ratio);
            gl.uniform1f(uniforms.uMobile, mobile ? 1 : 0);
            gl.uniform3f(uniforms.uColor, claro ? 0.1 : 0.5, claro ? 0.35 : 0.71, claro ? 0.72 : 1);
            gl.uniform1f(uniforms.uOpacity, (mobile ? 0.25 : 0.9) * opacidade);
            gl.drawArrays(gl.POINTS, 0, pontos.length / 2);
        };
    }
    function mostrarPaineis(estado) {
        cenas.forEach((cena, i) => {
            const painel = estado.paineis[i];
            cena.style.setProperty('--painel-opacidade', String(painel.opacidade));
            cena.style.setProperty('--texto-opacidade', String(painel.texto));
            cena.style.setProperty('--entrada', String(painel.entrada));
            cena.style.setProperty('--saida', String(painel.saida));
            cena.style.setProperty('--demonstracao', String(painel.demonstracao));
            cena.style.setProperty('--conclusao', String(clamp((painel.demonstracao - 0.4) / 0.6)));
            cena.toggleAttribute('data-painel-visivel', painel.opacidade > 0.005);
            cena.toggleAttribute('data-painel-ativo', estado.ativo === i);
            if (estado.ativo !== i && cena.contains(document.activeElement))
                capitulos[i].focus({ preventScroll: true });
            cena.inert = estado.ativo !== i;
            cena.setAttribute('aria-hidden', String(estado.ativo !== i));
        });
        controles.style.setProperty('--progresso-narrativa', String(estado.progresso));
        if (ativo !== estado.ativo) {
            ativo = estado.ativo;
            capitulos.forEach((botao, i) => {
                if (i === ativo) botao.setAttribute('aria-current', 'step');
                else botao.removeAttribute('aria-current');
            });
            status.textContent =
                ativo < 0
                    ? estado.portal > 0
                        ? 'Passagem pelo portal'
                        : 'Transição entre capítulos'
                    : `Capítulo: ${capitulos[ativo].textContent}`;
        }
    }
    function restaurarFluxo() {
        controles.hidden = true;
        ativo = -2;
        cenas.forEach((cena) => {
            cena.inert = false;
            cena.removeAttribute('aria-hidden');
            cena.removeAttribute('data-painel-ativo');
            cena.removeAttribute('data-painel-visivel');
            cena.style.removeProperty('--painel-opacidade');
            for (const nome of ['--texto-opacidade', '--entrada', '--saida', '--demonstracao', '--conclusao'])
                cena.style.removeProperty(nome);
        });
        visual.style.opacity = '';
        orbita.style.transform = '';
    }
    function renderizar(tempo) {
        frame = 0;
        if (document.hidden) return;
        const delta = ultimoQuadro ? Math.min(64, Math.max(0, tempo - ultimoQuadro)) : 1000 / 60;
        ultimoQuadro = tempo;
        const seguir = 1 - Math.exp(-delta / 140);
        const seguirMouse = 1 - Math.exp(-delta / 100);
        atual = reduzido || !fixo ? 0 : atual + (alvo - atual) * seguir;
        mouse.x = reduzido ? 0 : mouse.x + (mouse.alvoX - mouse.x) * seguirMouse;
        mouse.y = reduzido ? 0 : mouse.y + (mouse.alvoY - mouse.y) * seguirMouse;
        const estado = LandingTimeline.estado(atual);
        const area = experiencia.getBoundingClientRect();
        if (fixo) {
            mostrarPaineis(estado);
            orbita.style.transform = `translate(-50%,-50%) scale(${Math.exp(Math.log(8) * (estado.portal * estado.portal * (3 - 2 * estado.portal)))})`;
            visual.style.opacity = String(estado.opacidade);
        }
        if (area.bottom > 0 && area.top < innerHeight) renderer?.(mouse, estado.portal, fixo ? estado.opacidade : 1);
        const movendo =
            Math.abs(alvo - atual) > 0.001 ||
            Math.abs(mouse.alvoX - mouse.x) > 0.001 ||
            Math.abs(mouse.alvoY - mouse.y) > 0.001;
        if (!reduzido && area.bottom > 0 && movendo) frame = requestAnimationFrame(renderizar);
    }
    function agendar() {
        if (!frame && !document.hidden) {
            ultimoQuadro = 0;
            frame = requestAnimationFrame(renderizar);
        }
    }
    function rolar() {
        alvo = fixo ? clamp((scrollY - inicio) / passo, 0, LandingTimeline.duracao) : 0;
        agendar();
    }
    function medir() {
        const eraFixo = fixo;
        const anterior = ativo;
        const alturaCabecalho = document.querySelector('.cabecalho').getBoundingClientRect().height;
        experiencia.style.setProperty('--altura-cabecalho', `${alturaCabecalho}px`);
        document.body.classList.toggle('jornada-fixa', !reduzido);
        let altura = palco.getBoundingClientRect().height;
        fixo =
            !reduzido &&
            cenas.every((cena) => {
                const css = getComputedStyle(cena);
                return (
                    cena.querySelector('.jornada-texto').scrollHeight +
                        ((innerWidth <= 760 || cena.dataset.cena === '3') && cena.querySelector('.jornada-previa')
                            ? cena.querySelector('.jornada-previa').scrollHeight + 16
                            : 0) +
                        parseFloat(css.paddingTop) +
                        parseFloat(css.paddingBottom) <=
                    altura
                );
            });
        document.body.classList.toggle('jornada-fixa', fixo);
        controles.hidden = !fixo;
        if (fixo) {
            altura = palco.getBoundingClientRect().height;
            passo = Math.max(340, altura * 0.85);
            experiencia.style.setProperty('--distancia-narrativa', `${altura + passo * LandingTimeline.duracao}px`);
            inicio = experiencia.getBoundingClientRect().top + scrollY - alturaCabecalho;
        } else {
            restaurarFluxo();
            if (eraFixo && anterior >= 0) cenas[anterior].scrollIntoView({ block: 'start', behavior: 'instant' });
        }
        rolar();
    }
    function navegar(destino, suave = true) {
        if (!fixo) return;
        window.scrollTo({ top: inicio + destino * passo, behavior: suave ? 'smooth' : 'instant' });
    }
    const exemplo = { 1: { a: ['', 4, 1], b: ['', 4, 2], c: ['', 2, 3] } };
    const mediaAntes = CalculosUnB.historico(exemplo).ira;
    exemplo[1].c[2] = 2;
    const mediaDepois = CalculosUnB.historico(exemplo).ira;
    const notaExemplo = CalculosUnB.nota(mediaAntes, 65, 4, 0.8, { pesoIra: 1, pesoIpf: 2 }).final;
    document.querySelector('[data-media-antes]').textContent = AppUnB.numero(mediaAntes);
    document.querySelector('[data-media-depois]').textContent = AppUnB.numero(mediaDepois);
    document.querySelector('[data-nota-exemplo]').textContent = AppUnB.numero(notaExemplo);
    try {
        renderer = criarRenderer();
    } catch {
        document.body.classList.remove('webgl-pronto');
    }
    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        renderer = null;
        document.body.classList.remove('webgl-pronto');
    });
    canvas.addEventListener('webglcontextrestored', () => {
        try {
            renderer = criarRenderer();
            agendar();
        } catch {
            renderer = null;
        }
    });
    preferencia.addEventListener('change', (event) => {
        reduzido = event.matches;
        mouse.alvoX = 0;
        mouse.alvoY = 0;
        medir();
    });
    capitulos.forEach((botao) => botao.addEventListener('click', () => navegar(Number(botao.dataset.destino))));
    document.querySelector('.jornada-base a').addEventListener('click', (event) => {
        if (!fixo) return;
        event.preventDefault();
        navegar(LandingTimeline.destinos[1]);
    });
    addEventListener(
        'pointermove',
        (event) => {
            if (reduzido || !mousePermitido.matches || experiencia.getBoundingClientRect().bottom <= 0) return;
            mouse.alvoX = clamp((event.clientX / innerWidth) * 2 - 1, -1, 1);
            mouse.alvoY = clamp(1 - (event.clientY / innerHeight) * 2, -1, 1);
            agendar();
        },
        { passive: true },
    );
    document.documentElement.addEventListener('pointerleave', () => {
        mouse.alvoX = 0;
        mouse.alvoY = 0;
        agendar();
    });
    addEventListener('scroll', rolar, { passive: true });
    addEventListener('resize', medir, { passive: true });
    addEventListener('pageshow', medir);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cancelAnimationFrame(frame);
            frame = 0;
        } else medir();
    });
    const resolverAncora = () => {
        if (fixo && location.hash === '#planejar') navegar(LandingTimeline.destinos[1], false);
    };
    addEventListener('hashchange', resolverAncora);
    document.fonts?.ready.then(() => {
        medir();
        resolverAncora();
    });
    medir();
})();
