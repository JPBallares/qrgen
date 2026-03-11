// ─── State ────────────────────────────────────────────────────────
let logoDataUrl = null;
let currentEC = 'Q';
let debounceTimer = null;

// ─── Type switching ───────────────────────────────────────────────
function handleTypeChange() {
    const type = document.getElementById('content-type').value;
    ['url', 'text', 'email', 'phone', 'wifi', 'vcard'].forEach(f => {
        const el = document.getElementById('field-' + f);
        if (el) el.style.display = (f === type) ? '' : 'none';
    });
}

// ─── Color helpers ────────────────────────────────────────────────
function syncColor(w) {
    const v = document.getElementById(w + '-color').value;
    document.getElementById(w + '-hex').value = v;
    document.getElementById(w + '-preview').style.background = v;
    updateContrast();
    scheduleLivePreview();
}
function syncHex(w) {
    const v = document.getElementById(w + '-hex').value;
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
        document.getElementById(w + '-color').value = v;
        document.getElementById(w + '-preview').style.background = v;
        updateContrast();
        scheduleLivePreview();
    }
}

// ─── Contrast ratio ────────────────────────────────────────────────
function getLuminance(hex) {
    const rgb = parseInt(hex.slice(1), 16);
    const r = ((rgb >> 16) & 255) / 255;
    const g = ((rgb >> 8) & 255) / 255;
    const b = (rgb & 255) / 255;
    const [rs, gs, bs] = [r, g, b].map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
function getContrastRatio(fg, bg) {
    const l1 = getLuminance(fg);
    const l2 = getLuminance(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function updateContrast() {
    const fg = document.getElementById('fg-color').value;
    const bg = document.getElementById('bg-color').value;
    const ratio = getContrastRatio(fg, bg);
    const percent = Math.min(100, (ratio / 7) * 100);
    const fill = document.getElementById('contrast-fill');
    const val = document.getElementById('contrast-val');
    fill.style.width = percent + '%';
    fill.style.background = ratio >= 3 ? '#e8ff5a' : ratio >= 2 ? '#ffaa00' : '#ff5a5a';
    val.textContent = ratio.toFixed(1) + ':1';
}

// ─── DPI Warning ───────────────────────────────────────────────────
function checkDPIWarning() {
    const size = parseInt(document.getElementById('qr-size').value);
    const warning = document.getElementById('dpi-warning');
    warning.style.display = size < 900 ? 'block' : 'none';
    document.getElementById('size-val').textContent = size;
}

// ─── Color Presets ────────────────────────────────────────────────
function applyPreset(fg, bg) {
    document.getElementById('fg-color').value = fg;
    document.getElementById('fg-hex').value = fg;
    document.getElementById('fg-preview').style.background = fg;
    document.getElementById('bg-color').value = bg;
    document.getElementById('bg-hex').value = bg;
    document.getElementById('bg-preview').style.background = bg;
    document.getElementById('bg-transparent').checked = false;
    updateContrast();
    scheduleLivePreview();
}

// ─── Save/Load Presets ────────────────────────────────────────────
function savePreset() {
    const preset = {
        fg: document.getElementById('fg-color').value,
        bg: document.getElementById('bg-color').value,
        transparent: document.getElementById('bg-transparent').checked,
        gradient: document.getElementById('gradient-type').value,
        size: document.getElementById('qr-size').value,
        quietZone: document.getElementById('quiet-zone').value,
        dotStyle: document.querySelector('input[name="dot-style"]:checked').value,
        cornerStyle: document.querySelector('input[name="corner-style"]:checked').value,
        ec: currentEC,
        logoSize: document.getElementById('logo-size').value,
        logoRadius: document.getElementById('logo-radius').value,
        logoQuiet: document.getElementById('logo-quiet').value,
        cta: document.getElementById('cta-text').value
    };
    const blob = new Blob([JSON.stringify(preset, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'qr-preset.json';
    a.click();
}
function loadPreset(e) {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
        const p = JSON.parse(ev.target.result);
        if (p.fg) applyPreset(p.fg, p.bg || '#ffffff');
        if (p.gradient) document.getElementById('gradient-type').value = p.gradient;
        if (p.size) document.getElementById('qr-size').value = p.size;
        if (p.quietZone) document.getElementById('quiet-zone').value = p.quietZone;
        if (p.dotStyle) document.querySelector(`input[name="dot-style"][value="${p.dotStyle}"]`).checked = true;
        if (p.cornerStyle) document.querySelector(`input[name="corner-style"][value="${p.cornerStyle}"]`).checked = true;
        if (p.ec) { currentEC = p.ec; document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active')); document.querySelector(`.toggle-btn[onclick*="'${p.ec}'"]`).classList.add('active'); }
        if (p.logoSize) document.getElementById('logo-size').value = p.logoSize;
        if (p.logoRadius) document.getElementById('logo-radius').value = p.logoRadius;
        if (p.logoQuiet) document.getElementById('logo-quiet').value = p.logoQuiet;
        if (p.cta !== undefined) document.getElementById('cta-text').value = p.cta;
        checkDPIWarning();
        updateContrast();
    };
    r.readAsText(file);
}

// ─── Live Preview ─────────────────────────────────────────────────
function scheduleLivePreview() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(generateQR, 300);
}
document.querySelectorAll('#content-type, #input-url, #input-text, #input-email, #input-email-sub, #input-email-body, #input-phone, #wifi-ssid, #wifi-pass, #vc-first, #vc-last, #vc-phone, #vc-email, #vc-org, #vc-url, #cta-text').forEach(el => {
    el.addEventListener('input', scheduleLivePreview);
});

// ─── EC level ─────────────────────────────────────────────────────
function setEC(val, btn) {
    currentEC = val;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    scheduleLivePreview();
}

// ─── Logo upload ──────────────────────────────────────────────────
function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (file) readFile(file);
}
function readFile(file) {
    const r = new FileReader();
    r.onload = e => {
        logoDataUrl = e.target.result;
        document.getElementById('upload-thumb').src = logoDataUrl;
        document.getElementById('upload-name').textContent = file.name;
        document.getElementById('upload-preview').style.display = 'flex';
        scheduleLivePreview();
    };
    r.readAsDataURL(file);
}
function removeLogo() {
    logoDataUrl = null;
    document.getElementById('logo-file').value = '';
    document.getElementById('upload-preview').style.display = 'none';
    scheduleLivePreview();
}

// Drag-and-drop
const zone = document.getElementById('upload-zone');
zone.addEventListener('dragover', e => {e.preventDefault(); zone.classList.add('drag-over');});
zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) readFile(file);
});

// ─── Build content string ─────────────────────────────────────────
function getContent() {
    switch (document.getElementById('content-type').value) {
        case 'url': return document.getElementById('input-url').value || 'https://example.com';
        case 'text': return document.getElementById('input-text').value || 'Hello World';
        case 'email': {
            const e = document.getElementById('input-email').value,
                s = document.getElementById('input-email-sub').value,
                b = document.getElementById('input-email-body').value;
            return `mailto:${e}?subject=${encodeURIComponent(s)}&body=${encodeURIComponent(b)}`;
        }
        case 'phone': return `tel:${document.getElementById('input-phone').value}`;
        case 'wifi': {
            const s = document.getElementById('wifi-ssid').value,
                p = document.getElementById('wifi-pass').value,
                t = document.getElementById('wifi-sec').value;
            return `WIFI:T:${t};S:${s};P:${p};;`;
        }
        case 'vcard': {
            const f = document.getElementById('vc-first').value,
                l = document.getElementById('vc-last').value;
            return ['BEGIN:VCARD', 'VERSION:3.0', `FN:${f} ${l}`, `N:${l};${f}`,
                `TEL:${document.getElementById('vc-phone').value}`,
                `EMAIL:${document.getElementById('vc-email').value}`,
                `ORG:${document.getElementById('vc-org').value}`,
                `URL:${document.getElementById('vc-url').value}`,
                'END:VCARD'].join('\n');
        }
    }
}

// ─── Get raw module matrix from qrcodejs internals ────────────────
function getMatrix(text, ec) {
    const ecMap = {
        L: QRCode.CorrectLevel.L, M: QRCode.CorrectLevel.M,
        Q: QRCode.CorrectLevel.Q, H: QRCode.CorrectLevel.H
    };
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;visibility:hidden;left:-9999px';
    document.body.appendChild(div);
    const qr = new QRCode(div, {text, width: 10, height: 10, correctLevel: ecMap[ec]});
    const oQR = qr._oQRCode;
    const n = oQR.getModuleCount();
    const m = [];
    for (let r = 0; r < n; r++) {m[r] = []; for (let c = 0; c < n; c++) m[r][c] = oQR.isDark(r, c);}
    document.body.removeChild(div);
    return m;
}

// ─── Drawing helpers ──────────────────────────────────────────────
function rrPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// Draw one finder pattern (7×7) starting at row r0, col c0
function drawFinder(ctx, r0, c0, ms, style, fg, bg, gradient) {
    const x = c0 * ms, y = r0 * ms, S = 7 * ms;
    const p = ms * 0.1;

    ctx.fillStyle = gradient || fg;

    if (style === 'circle') {
        const cx = x + S / 2, cy = y + S / 2;
        const rOut = S / 2 - p, rIn = S / 2 - ms + p;
        ctx.beginPath();
        ctx.arc(cx, cy, rOut, 0, Math.PI * 2, false);
        ctx.arc(cx, cy, rIn, 0, Math.PI * 2, true);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, ms * 1.5 - p, 0, Math.PI * 2);
        ctx.fill();

    } else if (style === 'rounded') {
        const ro = ms * 1.5, ri = ms;
        rrPath(ctx, x + p, y + p, S - p * 2, S - p * 2, ro);
        ctx.fill();
        ctx.fillStyle = bg;
        rrPath(ctx, x + ms + p, y + ms + p, S - ms * 2 - p * 2, S - ms * 2 - p * 2, ri);
        ctx.fill();
        ctx.fillStyle = gradient || fg;
        rrPath(ctx, x + ms * 2 + p, y + ms * 2 + p, ms * 3 - p * 2, ms * 3 - p * 2, ri * 0.6);
        ctx.fill();

    } else {
        ctx.fillRect(x + p, y + p, S - p * 2, S - p * 2);
        ctx.fillStyle = bg;
        ctx.fillRect(x + ms + p, y + ms + p, S - ms * 2 - p * 2, S - ms * 2 - p * 2);
        ctx.fillStyle = gradient || fg;
        ctx.fillRect(x + ms * 2 + p, y + ms * 2 + p, ms * 3 - p * 2, ms * 3 - p * 2);
    }
}

function isFinderZone(r, c, n) {
    return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
}

function drawDot(ctx, x, y, ms, style, gradient) {
    const p = ms * 0.1, xp = x + p, yp = y + p, wp = ms - p * 2;
    ctx.fillStyle = gradient || ctx.fillStyle;
    if (style === 'round') {
        ctx.beginPath(); ctx.arc(xp + wp / 2, yp + wp / 2, wp / 2, 0, Math.PI * 2); ctx.fill();
    } else if (style === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(xp + wp / 2, yp); ctx.lineTo(xp + wp, yp + wp / 2);
        ctx.lineTo(xp + wp / 2, yp + wp); ctx.lineTo(xp, yp + wp / 2);
        ctx.closePath(); ctx.fill();
    } else {
        ctx.fillRect(xp, yp, wp, wp);
    }
}

// ─── SVG Export ───────────────────────────────────────────────────
function generateSVG(matrix, n, ms, fg, bg, dotStyle, cornerStyle, quietZone, transparent) {
    const totalSize = n * ms + quietZone * 2 * ms;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}">`;
    if (!transparent) {
        svg += `<rect width="100%" height="100%" fill="${bg}"/>`;
    }
    const offset = quietZone * ms;
    svg += `<g transform="translate(${offset},${offset})">`;
    [[0, 0], [0, n - 7], [n - 7, 0]].forEach(([r, c]) => {
        svg += generateFinderSVG(r, c, ms, cornerStyle, fg, bg);
    });
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (!matrix[r][c] || isFinderZone(r, c, n)) continue;
            svg += generateDotSVG(c * ms, r * ms, ms, dotStyle, fg);
        }
    }
    svg += '</g></svg>';
    return svg;
}
function generateFinderSVG(x, y, ms, style, fg, bg) {
    const S = 7 * ms, p = ms * 0.1;
    let d = '';
    if (style === 'circle') {
        const cx = x + S / 2, cy = y + S / 2, rOut = S / 2 - p, rIn = S / 2 - ms + p;
        d = `M${cx},${cy - rOut} A${rOut},${rOut} 0 1,1 ${cx},${cy + rOut} A${rOut},${rOut} 0 1,1 ${cx},${cy - rOut} M${cx},${cy - rIn} A${rIn},${rIn} 0 1,0 ${cx},${cy + rIn} A${rIn},${rIn} 0 1,0 ${cx},${cy - rIn} M${cx},${cy - ms * 1.5 + p} a${ms * 1.5 - p},${ms * 1.5 - p} 0 1,0 ${ms * 3 - p * 2},0 a${ms * 1.5 - p},${ms * 1.5 - p} 0 1,0 -${ms * 3 - p * 2},0`;
    } else if (style === 'rounded') {
        const ro = ms * 1.5, ri = ms;
        d = `M${x + p + ro},${y + p} h${S - p * 2 - ro * 2} q${ro},0 ${ro},${ro} v${S - p * 2 - ro * 2} q0,${ro} -${ro},${ro} h-${S - p * 2 - ro * 2} q-${ro},0 -${ro},-${ro} v-${S - p * 2 - ro * 2} q0,-${ro} ${ro},-${ro} z`;
        d += ` M${x + ms + p + ri},${y + ms + p} h${S - ms * 2 - p * 2 - ri * 2} q${ri},0 ${ri},${ri} v${S - ms * 2 - p * 2 - ri * 2} q0,${ri} -${ri},${ri} h-${S - ms * 2 - p * 2 - ri * 2} q-${ri},0 -${ri},-${ri} v-${S - ms * 2 - p * 2 - ri * 2} q0,-${ri} ${ri},-${ri} z`;
        d += ` M${x + ms * 2 + p + ri * 0.6},${y + ms * 2 + p} h${ms * 3 - p * 2 - ri * 1.2} q${ri * 0.6},0 ${ri * 0.6},${ri * 0.6} v${ms * 3 - p * 2 - ri * 1.2} q0,${ri * 0.6} -${ri * 0.6},${ri * 0.6} h-${ms * 3 - p * 2 - ri * 1.2} q-${ri * 0.6},0 -${ri * 0.6},-${ri * 0.6} v-${ms * 3 - p * 2 - ri * 1.2} q0,-${ri * 0.6} ${ri * 0.6},-${ri * 0.6} z`;
    } else {
        d = `M${x + p},${y + p} h${S - p * 2} v${S - p * 2} h-${S - p * 2} z M${x + ms + p},${y + ms + p} h${S - ms * 2 - p * 2} v${S - ms * 2 - p * 2} h-${S - ms * 2 - p * 2} z M${x + ms * 2 + p},${y + ms * 2 + p} h${ms * 3 - p * 2} v${ms * 3 - p * 2} h-${ms * 3 - p * 2} z`;
    }
    return `<path d="${d}" fill="${fg}"${bg !== '#ffffff' ? ` fill-rule="evenodd"/><path d="${d.replace(/fill="[^"]*"/g, '')}" fill="${bg}" fill-rule="evenodd"/>` : ''}/>`;
}
function generateDotSVG(x, y, ms, style, fg) {
    const p = ms * 0.1, xp = x + p, wp = ms - p * 2;
    let d = '';
    if (style === 'round') {
        d = `M${xp + wp / 2},${yp} a${wp / 2},${wp / 2} 0 1,0 ${wp},0 a${wp / 2},${wp / 2} 0 1,0 -${wp},0`;
    } else if (style === 'diamond') {
        d = `M${xp + wp / 2},${yp} L${xp + wp},${yp + wp / 2} L${xp + wp / 2},${yp + wp} L${xp},${yp + wp / 2} Z`;
    } else {
        d = `M${xp},${yp} h${wp} v${wp} h-${wp} Z`;
    }
    return `<path d="${d}" fill="${fg}"/>`;
}

// ─── Main generate ────────────────────────────────────────────────
function generateQR() {
    const fg = document.getElementById('fg-color').value;
    const bg = document.getElementById('bg-color').value;
    const transparent = document.getElementById('bg-transparent').checked;
    const gradientType = document.getElementById('gradient-type').value;
    const canvasSize = parseInt(document.getElementById('qr-size').value);
    const quietZone = parseInt(document.getElementById('quiet-zone').value);
    const dotStyle = document.querySelector('input[name="dot-style"]:checked').value;
    const cornerStyle = document.querySelector('input[name="corner-style"]:checked').value;
    const text = getContent();

    let gradient = null;
    if (gradientType !== 'none') {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = canvasSize;
        const ctx = canvas.getContext('2d');
        let grd;
        if (gradientType === 'linear-h') {
            grd = ctx.createLinearGradient(0, 0, canvasSize, 0);
        } else if (gradientType === 'linear-v') {
            grd = ctx.createLinearGradient(0, 0, 0, canvasSize);
        } else if (gradientType === 'linear-d') {
            grd = ctx.createLinearGradient(0, 0, canvasSize, canvasSize);
        } else if (gradientType === 'radial') {
            grd = ctx.createRadialGradient(canvasSize/2, canvasSize/2, 0, canvasSize/2, canvasSize/2, canvasSize/2);
        }
        grd.addColorStop(0, fg);
        grd.addColorStop(1, adjustColor(fg, -40));
        gradient = grd;
    }

    let matrix;
    try {matrix = getMatrix(text, currentEC);}
    catch (e) {alert('Failed to generate QR code. Check your input.'); return;}

    const n = matrix.length;
    const ms = canvasSize / n;
    const cta = document.getElementById('cta-text').value;
    const ctaHeight = cta ? ms * 1.5 : 0;
    const totalSize = canvasSize + quietZone * 2 * ms;
    const fullHeight = totalSize + ctaHeight;

    const container = document.getElementById('qr-container');
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = fullHeight;
    canvas.height = fullHeight;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    if (!transparent) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, fullHeight, fullHeight);
    }

    const offset = quietZone * ms;
    ctx.translate(offset, offset);

    if (gradient) {
        const grd = ctx.createLinearGradient(0, 0, gradientType.includes('h') || gradientType === 'linear-d' ? totalSize : 0, gradientType.includes('v') || gradientType === 'linear-d' ? totalSize : 0);
        grd.addColorStop(0, fg);
        grd.addColorStop(1, adjustColor(fg, -40));
        ctx.fillStyle = grd;
    }

    [[0, 0], [0, n - 7], [n - 7, 0]].forEach(([r, c]) => drawFinder(ctx, r, c, ms, cornerStyle, fg, bg, gradient));

    ctx.fillStyle = gradient || fg;
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (!matrix[r][c] || isFinderZone(r, c, n)) continue;
            drawDot(ctx, c * ms, r * ms, ms, dotStyle, gradient);
        }
    }

    canvas.matrix = matrix;
    canvas.n = n;
    canvas.ms = ms;
    canvas.fg = fg;
    canvas.bg = bg;
    canvas.quietZone = quietZone;
    canvas.dotStyle = dotStyle;
    canvas.cornerStyle = cornerStyle;
    canvas.gradient = gradient;
    canvas.text = text;
    canvas.gradientType = gradientType;

    canvas.cta = cta;

    if (cta) {
        ctx.translate(-offset, -offset);
        ctx.font = `bold ${Math.max(14, ms * 0.5)}px "DM Mono", monospace`;
        ctx.fillStyle = fg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(cta, fullHeight / 2, totalSize + ms * 0.3);
    }

    const show = () => {
        document.getElementById('qr-placeholder').style.display = 'none';
        container.style.display = 'block';
        document.getElementById('btn-download').style.display = 'block';
        canvas.style.opacity = '0'; canvas.style.transform = 'scale(0.92)';
        canvas.style.transition = 'all .35s cubic-bezier(.34,1.56,.64,1)';
        requestAnimationFrame(() => {canvas.style.opacity = '1'; canvas.style.transform = 'scale(1)';});
    };

    if (logoDataUrl) {
        const pct = parseInt(document.getElementById('logo-size').value) / 100;
        const rad = parseInt(document.getElementById('logo-radius').value);
        const logoQuiet = parseFloat(document.getElementById('logo-quiet').value);
        const lw = canvasSize * pct, lh = lw;
        const lx = (canvasSize - lw) / 2, ly = (canvasSize - lh) / 2;
        const pad = ms * logoQuiet;
        const rPx = (rad / 100) * (lw / 2);

        const img = new Image();
        img.onload = () => {
            ctx.fillStyle = transparent ? 'rgba(255,255,255,0)' : (document.getElementById('bg-color').value || '#ffffff');
            rrPath(ctx, lx - pad, ly - pad, lw + pad * 2, lh + pad * 2, rPx + pad * 0.5);
            ctx.fill();
            ctx.save();
            rrPath(ctx, lx, ly, lw, lh, rPx);
            ctx.clip();
            ctx.drawImage(img, lx, ly, lw, lh);
            ctx.restore();
            show();
        };
        img.onerror = show;
        img.src = logoDataUrl;
    } else {
        show();
    }
}

function adjustColor(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return '#' + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}

// ─── Download ─────────────────────────────────────────────────────
function downloadQR() {
    const c = document.querySelector('#qr-container canvas');
    if (!c) return;
    const format = document.getElementById('download-format').value;
    const a = document.createElement('a');

    if (format === 'svg') {
        const svg = generateSVG(c.matrix, c.n, c.ms, c.fg, c.bg, c.dotStyle, c.cornerStyle, c.quietZone, document.getElementById('bg-transparent').checked);
        const blob = new Blob([svg], {type: 'image/svg+xml'});
        a.href = URL.createObjectURL(blob);
        a.download = 'qr-code.svg';
    } else if (format === 'jpeg') {
        a.href = c.toDataURL('image/jpeg', 0.95);
        a.download = 'qr-code.jpg';
    } else {
        a.href = c.toDataURL('image/png');
        a.download = 'qr-code.png';
    }
    a.click();
}

// Initialize
checkDPIWarning();
updateContrast();
