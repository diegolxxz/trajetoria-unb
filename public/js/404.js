(() => {
    'use strict';

    const scene = document.getElementById('cena404');
    const canvas = document.getElementById('particulas404');
    const context = canvas?.getContext('2d');
    if (!scene || !canvas || !context) return;

    const mask = document.createElement('canvas');
    mask.width = 600;
    mask.height = 300;
    const maskContext = mask.getContext('2d', { willReadFrequently: true });
    if (!maskContext) return;
    maskContext.font = '800 280px Arial, sans-serif';
    maskContext.textAlign = 'center';
    maskContext.textBaseline = 'middle';
    maskContext.fillText('404', 290, 159);
    const pixels = maskContext.getImageData(0, 0, mask.width, mask.height).data;
    const particles = [];
    for (let y = 20; y < 280; y += 5) {
        for (let x = 10; x < 590; x += 5) {
            if (pixels[(y * mask.width + x) * 4 + 3] < 100) continue;
            const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            const phase = (seed - Math.floor(seed)) * Math.PI * 2;
            particles.push({ x: x - 290, y: y - 150, phase });
        }
    }

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = { x: -1000, y: -1000 };
    let paused = motionPreference.matches;
    let width = 0;
    let height = 0;
    let scale = 1;
    let frame = 0;
    let elapsed = 0;
    let previousTime = 0;
    let colors = [];

    function readColor(value) {
        const hex = value.trim().slice(1);
        return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
    }

    function resize() {
        const bounds = scene.getBoundingClientRect();
        width = bounds.width;
        height = bounds.height;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        scale = Math.min((width * 0.9) / 540, (height * 0.82) / 250);
        const styles = getComputedStyle(document.documentElement);
        const blue = readColor(styles.getPropertyValue('--erro-azul'));
        const green = readColor(styles.getPropertyValue('--erro-verde'));
        colors = Array.from({ length: 21 }, (_, index) => {
            const fraction = index / 20;
            const channels = blue.map((channel, i) => Math.round(channel + (green[i] - channel) * fraction));
            return `rgb(${channels.join(',')})`;
        });
        draw();
        scene.dataset.pronta = '';
    }

    function draw() {
        context.clearRect(0, 0, width, height);
        const time = elapsed / 1000;
        const angle = -0.065;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        const mobile = width < 600;
        const amplitude = mobile ? 4 : 9;
        for (const particle of particles) {
            const wave = Math.sin(particle.x * 0.012 + time * 0.65);
            const depth = 0.9 + Math.sin(particle.x * 0.009 + particle.y * 0.012 + time * 0.4) * 0.12;
            const baseX = particle.x * scale;
            const baseY = (particle.y + wave * amplitude) * scale;
            let x = width * 0.5 + baseX * cosine - baseY * sine;
            let y = height * 0.49 + baseX * sine + baseY * cosine;
            if (!paused && !motionPreference.matches) {
                x += Math.sin(time * 0.7 + particle.phase) * scale * 1.8;
                y += Math.cos(time * 0.6 + particle.phase) * scale * 1.8;
                const distanceX = x - pointer.x;
                const distanceY = y - pointer.y;
                const distance = Math.hypot(distanceX, distanceY);
                const radius = mobile ? 55 : 100;
                if (distance > 0 && distance < radius) {
                    const push = ((radius - distance) / radius) ** 2 * 25;
                    x += (distanceX / distance) * push;
                    y += (distanceY / distance) * push;
                }
            }
            const colorIndex = Math.max(0, Math.min(20, Math.round(((particle.x + 250) / 500) * 20)));
            context.fillStyle = colors[colorIndex];
            context.globalAlpha = 0.38 + depth * 0.53;
            const size = Math.max(1, scale * depth * 1.45);
            // Small timetable blocks make the numerals, with occasional dots along the route.
            if (particle.phase > 5.3) {
                context.beginPath();
                context.arc(x, y, size * 0.75, 0, Math.PI * 2);
                context.fill();
            } else {
                context.fillRect(x, y, size * 1.8, size);
            }
        }
        context.globalAlpha = 1;
    }

    function animate(time) {
        elapsed += previousTime ? Math.min(time - previousTime, 50) : 0;
        previousTime = time;
        draw();
        frame = requestAnimationFrame(animate);
    }

    function syncMotion() {
        cancelAnimationFrame(frame);
        previousTime = 0;
        if (!paused && !document.hidden) frame = requestAnimationFrame(animate);
    }

    motionPreference.addEventListener('change', () => {
        paused = motionPreference.matches;
        pointer.x = -1000;
        pointer.y = -1000;
        syncMotion();
        draw();
    });
    document.addEventListener('visibilitychange', syncMotion);
    scene.addEventListener(
        'pointermove',
        (event) => {
            if (event.pointerType !== 'mouse' || paused) return;
            const bounds = scene.getBoundingClientRect();
            pointer.x = event.clientX - bounds.left;
            pointer.y = event.clientY - bounds.top;
        },
        { passive: true },
    );
    scene.addEventListener('pointerleave', () => {
        pointer.x = -1000;
        pointer.y = -1000;
    });
    new ResizeObserver(resize).observe(scene);
    resize();
    syncMotion();
})();
