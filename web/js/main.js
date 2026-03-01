
  // ─── State ────────────────────────────────────────────────────────
  let logoDataUrl = null;
  let currentEC = 'Q';

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
  }
  function syncHex(w) {
      const v = document.getElementById(w + '-hex').value;
      if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
          document.getElementById(w + '-color').value = v;
          document.getElementById(w + '-preview').style.background = v;
      }
  }

  // ─── EC level ─────────────────────────────────────────────────────
  function setEC(val, btn) {
      currentEC = val;
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
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
      };
      r.readAsDataURL(file);
  }
  function removeLogo() {
      logoDataUrl = null;
      document.getElementById('logo-file').value = '';
      document.getElementById('upload-preview').style.display = 'none';
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
  function drawFinder(ctx, r0, c0, ms, style, fg, bg) {
      const x = c0 * ms, y = r0 * ms, S = 7 * ms;
      const p = ms * 0.1; // small inset

      ctx.fillStyle = fg;

      if (style === 'circle') {
          // Outer ring as annulus
          const cx = x + S / 2, cy = y + S / 2;
          const rOut = S / 2 - p, rIn = S / 2 - ms + p;
          ctx.beginPath();
          ctx.arc(cx, cy, rOut, 0, Math.PI * 2, false);
          ctx.arc(cx, cy, rIn, 0, Math.PI * 2, true);
          ctx.fill();
          // Inner dot
          ctx.beginPath();
          ctx.arc(cx, cy, ms * 1.5 - p, 0, Math.PI * 2);
          ctx.fill();

      } else if (style === 'rounded') {
          const ro = ms * 1.5, ri = ms;
          // Outer filled rounded rect
          rrPath(ctx, x + p, y + p, S - p * 2, S - p * 2, ro);
          ctx.fill();
          // Punch out middle in bg
          ctx.fillStyle = bg;
          rrPath(ctx, x + ms + p, y + ms + p, S - ms * 2 - p * 2, S - ms * 2 - p * 2, ri);
          ctx.fill();
          // Inner dot
          ctx.fillStyle = fg;
          rrPath(ctx, x + ms * 2 + p, y + ms * 2 + p, ms * 3 - p * 2, ms * 3 - p * 2, ri * 0.6);
          ctx.fill();

      } else {
          // Square outer ring
          ctx.fillRect(x + p, y + p, S - p * 2, S - p * 2);
          ctx.fillStyle = bg;
          ctx.fillRect(x + ms + p, y + ms + p, S - ms * 2 - p * 2, S - ms * 2 - p * 2);
          ctx.fillStyle = fg;
          ctx.fillRect(x + ms * 2 + p, y + ms * 2 + p, ms * 3 - p * 2, ms * 3 - p * 2);
      }
  }

  function isFinderZone(r, c, n) {
      return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  }

  function drawDot(ctx, x, y, ms, style) {
      const p = ms * 0.1, xp = x + p, yp = y + p, wp = ms - p * 2;
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

  // ─── Main generate ────────────────────────────────────────────────
  function generateQR() {
      const fg = document.getElementById('fg-color').value;
      const bg = document.getElementById('bg-color').value;
      const canvasSize = parseInt(document.getElementById('qr-size').value);
      const dotStyle = document.querySelector('input[name="dot-style"]:checked').value;
      const cornerStyle = document.querySelector('input[name="corner-style"]:checked').value;
      const text = getContent();

      let matrix;
      try {matrix = getMatrix(text, currentEC);}
      catch (e) {alert('Failed to generate QR code. Check your input.'); return;}

      const n = matrix.length;
      const ms = canvasSize / n;

      const container = document.getElementById('qr-container');
      container.innerHTML = '';
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = canvasSize;
      container.appendChild(canvas);
      const ctx = canvas.getContext('2d');

      // Fill background
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvasSize, canvasSize);

      // Draw the 3 finder patterns
      [[0, 0], [0, n - 7], [n - 7, 0]].forEach(([r, c]) => drawFinder(ctx, r, c, ms, cornerStyle, fg, bg));

      // Draw data dots (skip finder zones)
      ctx.fillStyle = fg;
      for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
              if (!matrix[r][c] || isFinderZone(r, c, n)) continue;
              drawDot(ctx, c * ms, r * ms, ms, dotStyle);
          }
      }

      // Composite logo on top (async)
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
          const lw = canvasSize * pct, lh = lw;
          const lx = (canvasSize - lw) / 2, ly = (canvasSize - lh) / 2;
          const pad = ms * 0.6;
          const rPx = (rad / 100) * (lw / 2);

          const img = new Image();
          img.onload = () => {
              // White backing behind logo
              ctx.fillStyle = '#ffffff';
              rrPath(ctx, lx - pad, ly - pad, lw + pad * 2, lh + pad * 2, rPx + pad * 0.5);
              ctx.fill();
              // Clip to rounded shape and draw logo
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

  // ─── Download ─────────────────────────────────────────────────────
  function downloadQR() {
      const c = document.querySelector('#qr-container canvas');
      if (!c) return;
      const a = document.createElement('a');
      a.download = 'qr-code.png';
      a.href = c.toDataURL('image/png');
      a.click();
  }
