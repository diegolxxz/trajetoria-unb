(() => {
    const canvas = document.getElementById('canvasTrajetoria');
    const cenas = [...document.querySelectorAll('[data-cena]')];
    const botao = document.getElementById('movimentoInicio');
    if (!canvas || !cenas.length) return;
    const preferencia = matchMedia('(prefers-reduced-motion: reduce)');
    let reduzido = preferencia.matches;
    let manual = false;
    let frame = 0;
    let atual = 0;
    let alvo = 0;
    let centros = [];
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
            uniform float uStage;
            uniform float uAspect;
            uniform float uRatio;
            uniform float uMobile;
            varying float vLuz;
            const float PI = 3.14159265359;
            vec3 forma(float cena, vec2 uv) {
                float u = uv.x * 2.0 * PI;
                float v = uv.y * 2.0 * PI;
                if(cena < 0.5) {
                    float raio = 0.78 + 0.24*cos(3.0*u);
                    return vec3(raio*cos(2.0*u)+0.16*cos(v), raio*sin(2.0*u)+0.16*sin(v), 0.5*sin(3.0*u)+0.18*cos(v));
                }
                if(cena < 1.5) {
                    return vec3((uv.x-.5)*2.2,(uv.y-.5)*2.0,.18*sin(u+v));
                }
                if(cena < 2.5) {
                    float raio = .42 + uv.y*.55;
                    return vec3(raio*cos(u+uv.y*PI), (uv.y-.5)*2.1, raio*sin(u+uv.y*PI));
                }
                return vec3(sin(v*.5)*cos(u),cos(v*.5),sin(v*.5)*sin(u));
            }
            void main() {
                float trecho = floor(uStage);
                float t = smoothstep(0.0,1.0,fract(uStage));
                vec3 p = mix(forma(trecho,aCoord),forma(min(trecho+1.0,3.0),aCoord),t);
                float giro = .3 + uStage*.42;
                p.xz = mat2(cos(giro),-sin(giro),sin(giro),cos(giro))*p.xz;
                p.xy = mat2(cos(-.2),-sin(-.2),sin(-.2),cos(-.2))*p.xy;
                float perspectiva = 2.9/(3.2-p.z);
                vec2 xy = p.xy*perspectiva*.76;
                xy.x /= uAspect;
                xy.x += mix(.49,.4,uMobile);
                xy.y += mix(.05,.32,uMobile);
                gl_Position = vec4(xy,0.0,1.0);
                gl_PointSize = (1.2 + (p.z+1.1)*1.0)*uRatio;
                vLuz = clamp(.4+(p.z+1.0)*.3,.25,1.0);
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
        for (let i = 0; i < colunas; i++) for (let j = 0; j < 38; j++) pontos.push(i / colunas, j / 38);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pontos), gl.STATIC_DRAW);
        const atributo = gl.getAttribLocation(programa, 'aCoord');
        gl.enableVertexAttribArray(atributo);
        gl.vertexAttribPointer(atributo, 2, gl.FLOAT, false, 0, 0);
        const uniforms = Object.fromEntries(
            ['uStage', 'uAspect', 'uRatio', 'uMobile', 'uColor', 'uOpacity'].map((n) => [
                n,
                gl.getUniformLocation(programa, n),
            ]),
        );
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        document.body.classList.add('webgl-pronto');
        return (progresso) => {
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
            gl.uniform1f(uniforms.uStage, progresso);
            gl.uniform1f(uniforms.uAspect, rect.width / Math.max(1, rect.height));
            gl.uniform1f(uniforms.uRatio, ratio);
            gl.uniform1f(uniforms.uMobile, mobile ? 1 : 0);
            gl.uniform3f(uniforms.uColor, claro ? 0.1 : 0.5, claro ? 0.35 : 0.71, claro ? 0.72 : 1);
            gl.uniform1f(uniforms.uOpacity, mobile ? 0.25 : 0.9);
            gl.drawArrays(gl.POINTS, 0, pontos.length / 2);
        };
    }
    function renderizar() {
        frame = 0;
        if (document.hidden) return;
        atual = reduzido ? 0 : atual + (alvo - atual) * 0.16;
        if (document.querySelector('.jornada-experiencia').getBoundingClientRect().bottom > 0) renderer?.(atual);
        for (const cena of cenas) {
            const r = cena.getBoundingClientRect();
            const deslocamento = clamp((r.top + r.height / 2 - innerHeight / 2) / innerHeight, -1, 1);
            const texto = cena.querySelector('.jornada-texto');
            texto.style.transform = reduzido ? '' : `translateY(${deslocamento * 22}px)`;
        }
        if (!reduzido && Math.abs(alvo - atual) > 0.001) frame = requestAnimationFrame(renderizar);
    }
    function agendar() {
        if (!frame && !document.hidden) frame = requestAnimationFrame(renderizar);
    }
    function rolar() {
        const y = scrollY;
        alvo = 0;
        for (let i = 0; i < centros.length - 1; i++)
            if (y >= centros[i]) alvo = i + clamp((y - centros[i]) / Math.max(1, centros[i + 1] - centros[i]));
        agendar();
    }
    function medir() {
        centros = cenas.map((c) => {
            const r = c.getBoundingClientRect();
            return scrollY + r.top + r.height / 2 - innerHeight / 2;
        });
        rolar();
    }
    function atualizarBotao() {
        botao.hidden = false;
        botao.textContent = 'Reduzir movimento';
        botao.setAttribute('aria-pressed', String(reduzido));
        agendar();
    }
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
    botao.addEventListener('click', () => {
        manual = true;
        reduzido = !reduzido;
        atualizarBotao();
    });
    preferencia.addEventListener('change', (event) => {
        if (!manual) {
            reduzido = event.matches;
            atualizarBotao();
        }
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
    document.fonts?.ready.then(medir);
    atualizarBotao();
    medir();
})();
