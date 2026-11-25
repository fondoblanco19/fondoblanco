/* Quitar fondo — Fondo Blanco
 * U²-Netp (Apache-2.0) ejecutado en el navegador con ONNX Runtime Web (WASM, CPU).
 * La imagen nunca sale del equipo. El modelo pesa 4,4 MB y se descarga una sola vez. */
(() => {
  'use strict';
  const _s = document.currentScript;
  const ENGINE = new URL(_s?.dataset.engine || './', _s?.src || location.href).href;
  const MODEL_URL = ENGINE + 'model/u2netp.onnx';
  const ORT_DIR = ENGINE + 'ort/';
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const MAX_LADO = IOS ? 1400 : 2000;          // lado mayor de trabajo (px): más grande se reduce antes de procesar
  const MAX_BYTES = 25 * 1024 * 1024;
  const S = 320;                               // entrada del modelo
  const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];

  const $ = id => document.getElementById(id);
  const el = {
    stage: $('stage'), drop: $('drop'), view: $('view'), canvas: $('lienzo'), working: $('working'), pct: $('pct'),
    bar2: $('bar2'), stageTxt: $('stageTxt'), go: $('go'), dl: $('dl'), again: $('again'), orig: $('orig'),
    sens: $('sens'), sensOut: $('sensOut'), soft: $('soft'), softOut: $('softOut'), refine: $('refine'),
    bgColor: $('bgcolor'), note: $('note'), meta: $('meta'),
  };
  const state = { file: null, w: 0, h: 0, src: null, px: null, mask: null, alpha: null, session: null, ort: null, busy: false, raf: 0, showOrig: false };
  const radio = n => document.querySelector(`input[name="${n}"]:checked`).value;
  const showNote = m => { el.note.textContent = m || ''; el.note.hidden = !m; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  const progress = (p, txt) => { el.pct.textContent = Math.round(p) + '%'; el.bar2.style.width = p + '%'; if (txt) el.stageTxt.textContent = txt; };

  /* ---------- carga de imagen ---------- */
  el.drop.addEventListener('click', pick);
  el.drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  ['dragenter', 'dragover'].forEach(t => el.stage.addEventListener(t, e => { e.preventDefault(); el.drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => el.stage.addEventListener(t, e => { e.preventDefault(); el.drop.classList.remove('over'); }));
  el.stage.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) setFile(f); });
  window.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/')); if (f) setFile(f); });
  function pick() {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/jpeg,image/png,image/webp';
    i.onchange = () => i.files[0] && setFile(i.files[0]); i.click();
  }

  async function setFile(file) {
    if (state.busy) return;
    showNote('');
    if (!file.type.startsWith('image/')) return showNote('Ese archivo no es una imagen.');
    if (file.size > MAX_BYTES) return showNote('La imagen pesa más de 25 MB.');
    let bmp;
    try { bmp = await createImageBitmap(file); } catch { return showNote('No pude leer esa imagen. Prueba con JPG, PNG o WebP.'); }
    let w = bmp.width, h = bmp.height, reducida = false;
    const k = Math.min(1, MAX_LADO / Math.max(w, h));
    if (k < 1) { w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k)); reducida = true; }
    const src = document.createElement('canvas'); src.width = w; src.height = h;
    const g = src.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, w, h);
    Object.assign(state, { file, w, h, src, px: g.getImageData(0, 0, w, h), mask: null, alpha: null });
    el.canvas.width = w; el.canvas.height = h; el.canvas.getContext('2d').putImageData(state.px, 0, 0);
    el.drop.hidden = true; el.view.hidden = false;
    el.go.hidden = false; el.go.disabled = false; el.dl.hidden = true; el.again.hidden = false; el.orig.hidden = true; el.meta.hidden = true;
    if (reducida) showNote(`Tu imagen era muy grande: la reduje a ${w}×${h} px para procesarla.`);
  }

  el.again.addEventListener('click', () => {
    if (state.busy) return;
    el.view.hidden = true; el.drop.hidden = false; el.go.hidden = false; el.go.disabled = true; el.dl.hidden = true; el.again.hidden = true; el.orig.hidden = true; el.meta.hidden = true;
    Object.assign(state, { file: null, px: null, mask: null, alpha: null }); showNote('');
  });

  /* ---------- motor ONNX ---------- */
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); });
  async function ensureSession() {
    if (state.session) return;
    progress(8, 'Descargando el modelo de IA (4 MB, solo la primera vez)…');
    await loadScript(ORT_DIR + 'ort.wasm.min.js');
    const ort = window.ort; state.ort = ort;
    ort.env.wasm.wasmPaths = new URL(ORT_DIR, document.baseURI).href;
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(navigator.hardwareConcurrency || 4, 4) : 1;
    ort.env.wasm.proxy = false;
    const r = await fetch(MODEL_URL);
    if (!r.ok) throw new Error('no se pudo descargar el modelo de IA. Revisa tu conexión.');
    const buf = await r.arrayBuffer();
    progress(35, 'Preparando el motor…');
    state.session = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  }

  /* ---------- máscara ---------- */
  async function segmentar() {
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(state.src, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S).data, n = S * S, x = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) x[k * n + i] = (d[i * 4 + k] / 255 - MEAN[k]) / STD[k];
    const ort = state.ort, ses = state.session;
    const out = await ses.run({ [ses.inputNames[0]]: new ort.Tensor('float32', x, [1, 3, S, S]) });
    const y = out[ses.outputNames[0]].data;
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < n; i++) { if (y[i] < mn) mn = y[i]; if (y[i] > mx) mx = y[i]; }
    const m8 = new Uint8ClampedArray(n * 4), dv = Math.max(mx - mn, 1e-6);
    for (let i = 0; i < n; i++) { const v = ((y[i] - mn) / dv) * 255; m8[i * 4] = m8[i * 4 + 1] = m8[i * 4 + 2] = v; m8[i * 4 + 3] = 255; }
    g.putImageData(new ImageData(m8, S, S), 0, 0);
    // se escala a la imagen con suavizado de alta calidad y se lee el canal rojo
    const big = document.createElement('canvas'); big.width = state.w; big.height = state.h;
    const bg = big.getContext('2d', { willReadFrequently: true }); bg.imageSmoothingEnabled = true; bg.imageSmoothingQuality = 'high'; bg.drawImage(c, 0, 0, state.w, state.h);
    const bd = bg.getImageData(0, 0, state.w, state.h).data, p = new Float32Array(state.w * state.h);
    for (let i = 0; i < p.length; i++) p[i] = bd[i * 4] / 255;
    return p;
  }

  /* ---------- filtro guiado (He et al.): ajusta el borde de la máscara a los bordes de la foto ---------- */
  function box(src, w, h, r) {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = y * w; let sum = 0;
      for (let x = 0; x <= r && x < w; x++) sum += src[row + x];
      for (let x = 0; x < w; x++) {
        if (x > 0) { const hi = x + r, lo = x - r - 1; if (hi < w) sum += src[row + hi]; if (lo >= 0) sum -= src[row + lo]; }
        tmp[row + x] = sum / (Math.min(w - 1, x + r) - Math.max(0, x - r) + 1);
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = 0; y <= r && y < h; y++) sum += tmp[y * w + x];
      for (let y = 0; y < h; y++) {
        if (y > 0) { const hi = y + r, lo = y - r - 1; if (hi < h) sum += tmp[hi * w + x]; if (lo >= 0) sum -= tmp[lo * w + x]; }
        out[y * w + x] = sum / (Math.min(h - 1, y + r) - Math.max(0, y - r) + 1);
      }
    }
    return out;
  }
  function guiado(p, w, h) {
    const n = w * h, d = state.px.data, I = new Float32Array(n);
    for (let i = 0; i < n; i++) I[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    const r = Math.max(4, Math.round(Math.max(w, h) * 0.005)), eps = 0.0008;
    const Ip = new Float32Array(n), II = new Float32Array(n);
    for (let i = 0; i < n; i++) { Ip[i] = I[i] * p[i]; II[i] = I[i] * I[i]; }
    const mI = box(I, w, h, r), mp = box(p, w, h, r), mIp = box(Ip, w, h, r), mII = box(II, w, h, r);
    const a = Ip, b = II;                         // se reutiliza memoria
    for (let i = 0; i < n; i++) { const v = mII[i] - mI[i] * mI[i], c = mIp[i] - mI[i] * mp[i]; a[i] = c / (v + eps); b[i] = mp[i] - a[i] * mI[i]; }
    const ma = box(a, w, h, r), mb = box(b, w, h, r), q = new Float32Array(n);
    for (let i = 0; i < n; i++) q[i] = Math.min(1, Math.max(0, ma[i] * I[i] + mb[i]));
    return q;
  }

  /* ---------- composición ---------- */
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / Math.max(b - a, 1e-6))); return t * t * (3 - 2 * t); };
  function render() {
    if (!state.px) return;
    const ctx = el.canvas.getContext('2d');
    if (!state.alpha || state.showOrig) { ctx.putImageData(state.px, 0, 0); return; }
    const c = 0.8 - 0.6 * (el.sens.value / 100), s = 0.02 + 0.38 * (el.soft.value / 100);
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) lut[i] = Math.round(smooth(c - s, c + s, i / 255) * 255);
    const bg = radio('bg'), col = bg === 'white' ? [255, 255, 255] : bg === 'color' ? hex(el.bgColor.value) : null;
    const o = new ImageData(new Uint8ClampedArray(state.px.data), state.w, state.h), d = o.data, a = state.alpha;
    for (let i = 0, n = a.length; i < n; i++) {
      const al = lut[a[i]];
      if (!col) { d[i * 4 + 3] = al; }
      else { const k = al / 255, j = i * 4; d[j] = d[j] * k + col[0] * (1 - k); d[j + 1] = d[j + 1] * k + col[1] * (1 - k); d[j + 2] = d[j + 2] * k + col[2] * (1 - k); d[j + 3] = 255; }
    }
    ctx.putImageData(o, 0, 0);
  }
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const pedir = () => { if (!state.raf) state.raf = requestAnimationFrame(() => { state.raf = 0; render(); }); };
  const aplicarAlpha = () => {
    const base = el.refine.checked ? state.refinada : state.cruda;
    if (!base) return;
    const a = new Uint8Array(base.length);
    for (let i = 0; i < a.length; i++) a[i] = base[i] * 255 + 0.5;
    state.alpha = a; pedir();
  };
  el.sens.addEventListener('input', () => { el.sensOut.textContent = el.sens.value; pedir(); });
  el.soft.addEventListener('input', () => { el.softOut.textContent = el.soft.value; pedir(); });
  el.refine.addEventListener('change', aplicarAlpha);
  document.querySelectorAll('input[name="bg"]').forEach(r => r.addEventListener('change', () => { el.bgColor.disabled = radio('bg') !== 'color'; pedir(); }));
  el.bgColor.addEventListener('input', () => { if (radio('bg') === 'color') pedir(); });
  const ver = on => { state.showOrig = on; render(); };
  el.orig.addEventListener('pointerdown', e => { e.preventDefault(); ver(true); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.orig.addEventListener(t, () => ver(false)));

  /* ---------- proceso principal ---------- */
  el.go.addEventListener('click', async () => {
    if (state.busy || !state.px) return;
    state.busy = true; showNote(''); el.working.hidden = false; el.go.disabled = true; progress(3, 'Preparando…');
    try {
      await frame(); await ensureSession();
      progress(50, 'Quitando el fondo…'); await frame();
      const t0 = performance.now();
      state.cruda = await segmentar();
      progress(75, 'Afinando los bordes…'); await frame();
      state.refinada = guiado(state.cruda, state.w, state.h);
      progress(100, 'Listo'); await sleep(120);
      aplicarAlpha();
      const seg = ((performance.now() - t0) / 1000).toFixed(1);
      el.go.hidden = true; el.dl.hidden = false; el.orig.hidden = false;
      el.meta.hidden = false; el.meta.textContent = `${state.w}×${state.h} px · listo en ${seg} s · se procesó en tu equipo`;
    } catch (e) {
      console.error(e); showNote('No pude quitar el fondo: ' + (e.message || e)); el.go.disabled = false;
    } finally { state.busy = false; el.working.hidden = true; }
  });

  el.dl.addEventListener('click', e => {
    e.preventDefault();
    render();
    el.canvas.toBlob(b => {
      const a = document.createElement('a'), nombre = (state.file?.name || 'imagen').replace(/\.[^.]+$/, '');
      a.href = URL.createObjectURL(b); a.download = nombre + '-sin-fondo.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    }, 'image/png');
  });
})();
