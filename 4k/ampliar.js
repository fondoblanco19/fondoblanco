/* Ampliador de imágenes — Fondo Blanco
 * Real-ESRGAN (realesr-general-x4v3) ejecutado en el navegador con ONNX Runtime Web.
 * WebGPU si existe; si no, WASM (CPU). La imagen nunca sale del equipo. */
(() => {
  'use strict';
  // carpeta con model/ y ort/ (por defecto, junto a la página). En el sitio: data-engine="/4k/" para compartirlos con el botón 4K
  const _s = document.currentScript;
  const ENGINE = new URL(_s?.dataset.engine || './', _s?.src || location.href).href;
  const MODEL_URL = ENGINE + 'model/realesr-general-x4v3.onnx';
  const ORT_DIR = ENGINE + 'ort/';
  // Safari en iPhone/iPad no admite lienzos de más de 16,7 MP y la IA trabaja a ×4: ahí la entrada máxima es 1 MP.
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const MAX_PIXELS = IOS ? 1.0e6 : 2.25e6;   // entrada máxima: ~1500×1500 → salida ≤ 36 MP (iOS: ≤ 16 MP)
  const MAX_BYTES = 25 * 1024 * 1024;
  const PAD = 16;                    // píxeles de contexto alrededor de cada bloque

  const $ = id => document.getElementById(id);
  const el = {
    stage: $('stage'), drop: $('drop'), view: $('view'), cmp: $('cmp'),
    before: $('imgBefore'), after: $('imgAfter'), afterWrap: $('afterWrap'),
    bar: $('bar'), knob: $('knob'), tagR: $('tagR'), slider: $('slider'),
    working: $('working'), pct: $('pct'), bar2: $('bar2'), stageTxt: $('stageTxt'), eta: $('eta'),
    cancel: $('cancel'), go: $('go'), dl: $('dl'), again: $('again'),
    sharp: $('sharp'), sharpOut: $('sharpOut'), qual: $('qual'), qualOut: $('qualOut'), qField: $('qField'),
    sizeHint: $('sizeHint'), note: $('note'), meta: $('meta'), engine: $('engine'), engineTxt: $('engineTxt'),
  };

  const state = { file: null, bitmap: null, w: 0, h: 0, scaledDown: false, beforeUrl: null, afterUrl: null,
                  busy: false, cancel: false, backend: null, session: null, ort: null, gpu: false };

  /* ---------- utilidades ---------- */
  const radio = name => document.querySelector(`input[name="${name}"]:checked`).value;
  const fmtBytes = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
  const fmtTime = s => s < 60 ? Math.round(s) + ' s' : Math.floor(s / 60) + ' min ' + Math.round(s % 60) + ' s';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const showNote = msg => { el.note.textContent = msg || ''; el.note.hidden = !msg; };

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  /* ---------- detección de motor ---------- */
  (async () => {
    try {
      if (navigator.gpu && !new URLSearchParams(location.search).has('cpu')) { const a = await navigator.gpu.requestAdapter(); state.gpu = !!a; }
    } catch { state.gpu = false; }
    el.engine.classList.add(state.gpu ? 'fast' : 'slow');
    el.engineTxt.textContent = state.gpu ? 'Tarjeta gráfica (WebGPU) · rápido' : 'Procesador (sin WebGPU) · lento';
  })();

  /* ---------- ajustes ---------- */
  el.sharp.addEventListener('input', () => { el.sharpOut.textContent = el.sharp.value; });
  el.qual.addEventListener('input', () => { el.qualOut.textContent = el.qual.value; });
  const syncFmt = () => { el.qField.hidden = radio('fmt') === 'png'; };
  document.querySelectorAll('input[name="fmt"]').forEach(r => r.addEventListener('change', syncFmt));
  document.querySelectorAll('input[name="scale"]').forEach(r => r.addEventListener('change', updateHint));
  syncFmt();

  function updateHint() {
    if (!state.bitmap) return;
    const s = +radio('scale');
    el.sizeHint.textContent = `${state.w}×${state.h} px → ${state.w * s}×${state.h * s} px`;
  }

  /* ---------- carga de imagen ---------- */
  el.drop.addEventListener('click', pick);
  el.drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  ['dragenter', 'dragover'].forEach(t => el.stage.addEventListener(t, e => { e.preventDefault(); el.drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => el.stage.addEventListener(t, e => { e.preventDefault(); el.drop.classList.remove('over'); }));
  el.stage.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) setFile(f); });
  window.addEventListener('paste', e => {
    const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
    if (f) setFile(f);
  });
  function pick() {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = 'image/jpeg,image/png,image/webp';
    i.onchange = () => i.files[0] && setFile(i.files[0]);
    i.click();
  }

  async function setFile(file) {
    if (state.busy) return;
    showNote('');
    if (!file.type.startsWith('image/')) return showNote('Ese archivo no es una imagen.');
    if (file.size > MAX_BYTES) return showNote('La imagen pesa más de 25 MB.');
    let bmp;
    try { bmp = await createImageBitmap(file); } catch { return showNote('No pude leer esa imagen. Prueba con JPG, PNG o WebP.'); }
    let { width: w, height: h } = bmp;
    state.scaledDown = false;
    if (w * h > MAX_PIXELS) {
      const k = Math.sqrt(MAX_PIXELS / (w * h));
      w = Math.max(1, Math.floor(w * k)); h = Math.max(1, Math.floor(h * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, w, h);
      bmp = await createImageBitmap(c);
      state.scaledDown = true;
    }
    state.file = file; state.bitmap = bmp; state.w = w; state.h = h;
    if (state.beforeUrl) URL.revokeObjectURL(state.beforeUrl);
    if (state.afterUrl) { URL.revokeObjectURL(state.afterUrl); state.afterUrl = null; }
    state.beforeUrl = URL.createObjectURL(file);
    el.before.src = state.beforeUrl;
    resetCompare();
    el.drop.hidden = true; el.view.hidden = false;
    el.go.textContent = 'Ampliar imagen'; el.go.className = 'btn primary'; el.go.disabled = false; el.dl.hidden = true; el.again.hidden = false; el.meta.hidden = true;
    updateHint();
    if (state.scaledDown) showNote(`Tu imagen era muy grande: la reduje a ${w}×${h} px antes de ampliar.`);
  }

  el.again.addEventListener('click', () => {
    if (state.busy) return;
    resetCompare(); el.view.hidden = true; el.drop.hidden = false;
    el.go.hidden = false; el.go.textContent = 'Ampliar imagen'; el.go.className = 'btn primary'; el.go.disabled = true; el.dl.hidden = true; el.again.hidden = true; el.meta.hidden = true;
    el.sizeHint.textContent = 'Elige una imagen para ver el tamaño resultante.';
    state.bitmap = null; showNote('');
  });

  /* ---------- comparador ---------- */
  function resetCompare() {
    el.afterWrap.hidden = el.bar.hidden = el.knob.hidden = el.tagR.hidden = el.slider.hidden = true;
    el.cmp.style.setProperty('--pos', '50%');
    el.slider.value = 50;
  }
  el.slider.addEventListener('input', () => el.cmp.style.setProperty('--pos', el.slider.value + '%'));

  /* ---------- motor ONNX ---------- */
  async function ensureSession() {
    if (state.session) return;
    el.stageTxt.textContent = 'Descargando el modelo de IA (solo la primera vez)…';
    const useGpu = state.gpu;
    await loadScript(ORT_DIR + (useGpu ? 'ort.webgpu.min.js' : 'ort.wasm.min.js'));
    const ort = window.ort; state.ort = ort;
    ort.env.wasm.wasmPaths = new URL(ORT_DIR, document.baseURI).href;  // absoluta: los import() se resuelven respecto al script
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(navigator.hardwareConcurrency || 4, 8) : 1;
    ort.env.wasm.proxy = false;     // el modo proxy se cuelga en algunos navegadores; usamos bloques pequeños para no congelar la página
    const mr = await fetch(MODEL_URL);
    if (!mr.ok) throw new Error('no se pudo descargar el modelo de IA. Revisa tu conexión.');
    const buf = await mr.arrayBuffer();
    const make = eps => ort.InferenceSession.create(buf, { executionProviders: eps, graphOptimizationLevel: 'all' });
    try {
      state.session = await make(useGpu ? ['webgpu'] : ['wasm']);
      state.backend = useGpu ? 'webgpu' : 'wasm';
    } catch (e) {
      console.warn('WebGPU falló, uso CPU', e);
      state.session = await make(['wasm']);
      state.backend = 'wasm';
      el.engine.classList.remove('fast'); el.engine.classList.add('slow');
      el.engineTxt.textContent = 'Procesador (WebGPU falló) · lento';
    }
  }

  /* ---------- ampliación por bloques ---------- */
  async function upscale(bitmap, hasAlphaOut) {
    const { w, h } = state;
    const src = document.createElement('canvas'); src.width = w; src.height = h;
    const sg = src.getContext('2d', { willReadFrequently: true }); sg.drawImage(bitmap, 0, 0);
    const sd = sg.getImageData(0, 0, w, h).data;

    let hasAlpha = false;
    for (let i = 3; i < sd.length; i += 4) if (sd[i] < 255) { hasAlpha = true; break; }

    const fast = state.backend === 'webgpu';
    const core = fast ? 224 : 96, T = core + PAD * 2, OT = T * 4;
    const out = document.createElement('canvas'); out.width = w * 4; out.height = h * 4;
    const og = out.getContext('2d');
    const input = new Float32Array(3 * T * T), plane = T * T, oplane = OT * OT;
    const tilesX = Math.ceil(w / core), tilesY = Math.ceil(h / core), total = tilesX * tilesY;
    const t0 = performance.now();
    let done = 0;

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        if (state.cancel) throw new Error('cancelado');
        const x0 = tx * core, y0 = ty * core;
        const cw = Math.min(core, w - x0), ch = Math.min(core, h - y0);
        // entrada con bordes replicados (sin costuras en los límites de la imagen)
        for (let j = 0; j < T; j++) {
          let sy = y0 - PAD + j; sy = sy < 0 ? 0 : sy >= h ? h - 1 : sy;
          for (let i = 0; i < T; i++) {
            let sx = x0 - PAD + i; sx = sx < 0 ? 0 : sx >= w ? w - 1 : sx;
            const p = (sy * w + sx) * 4, o = j * T + i;
            input[o] = sd[p] / 255; input[plane + o] = sd[p + 1] / 255; input[2 * plane + o] = sd[p + 2] / 255;
          }
        }
        const res = await state.session.run({ input: new state.ort.Tensor('float32', input, [1, 3, T, T]) });
        const od = res.output.data;
        const ow = cw * 4, oh = ch * 4, img = new ImageData(ow, oh), px = img.data, off = PAD * 4;
        for (let j = 0; j < oh; j++) {
          const row = (j + off) * OT + off;
          for (let i = 0; i < ow; i++) {
            const o = row + i, q = (j * ow + i) * 4;
            let r = od[o] * 255 + .5, g = od[oplane + o] * 255 + .5, b = od[2 * oplane + o] * 255 + .5;
            px[q] = r < 0 ? 0 : r > 255 ? 255 : r;
            px[q + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
            px[q + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
            px[q + 3] = 255;
          }
        }
        if (hasAlpha && hasAlphaOut) {          // el canal alfa se amplía de forma bilineal
          for (let j = 0; j < oh; j++) {
            const fy = Math.min(h - 1, Math.max(0, (y0 * 4 + j + .5) / 4 - .5)), iy = fy | 0, dy = fy - iy, iy2 = Math.min(h - 1, iy + 1);
            for (let i = 0; i < ow; i++) {
              const fx = Math.min(w - 1, Math.max(0, (x0 * 4 + i + .5) / 4 - .5)), ix = fx | 0, dx = fx - ix, ix2 = Math.min(w - 1, ix + 1);
              const a = sd[(iy * w + ix) * 4 + 3] * (1 - dx) + sd[(iy * w + ix2) * 4 + 3] * dx;
              const b = sd[(iy2 * w + ix) * 4 + 3] * (1 - dx) + sd[(iy2 * w + ix2) * 4 + 3] * dx;
              px[(j * ow + i) * 4 + 3] = a * (1 - dy) + b * dy;
            }
          }
        }
        og.putImageData(img, x0 * 4, y0 * 4);
        done++;
        const frac = done / total, el_s = (performance.now() - t0) / 1000;
        setProgress(frac * 92, `Ampliando con IA · bloque ${done} de ${total}`,
          done >= 2 ? `Quedan ≈ ${fmtTime(el_s / frac - el_s)}` : 'Calculando tiempo…');
        await sleep(0);
      }
    }
    return { canvas: out, hasAlpha };
  }

  function setProgress(p, txt, eta) {
    el.pct.textContent = Math.round(p) + '%';
    el.bar2.style.width = p + '%';
    if (txt) el.stageTxt.textContent = txt;
    if (eta !== undefined) el.eta.textContent = eta;
  }

  /* ---------- toque final: nitidez suave ---------- */
  async function sharpen(canvas, amount) {
    if (amount <= 0) return canvas;
    const a = amount / 100 * 0.35, W = canvas.width, H = canvas.height;
    const dst = document.createElement('canvas'); dst.width = W; dst.height = H;
    const sg = canvas.getContext('2d', { willReadFrequently: true }), dg = dst.getContext('2d');
    const STRIP = 192;
    for (let y = 0; y < H; y += STRIP) {
      const y1 = Math.min(H, y + STRIP), top = Math.max(0, y - 1), bot = Math.min(H, y1 + 1);
      const s = sg.getImageData(0, top, W, bot - top), sp = s.data;
      const o = new ImageData(W, y1 - y), op = o.data;
      for (let j = y; j < y1; j++) {
        const rj = j - top, ru = Math.max(0, rj - 1), rd = Math.min(bot - top - 1, rj + 1);
        for (let i = 0; i < W; i++) {
          const il = i > 0 ? i - 1 : 0, ir = i < W - 1 ? i + 1 : W - 1;
          const c = (rj * W + i) * 4, u = (ru * W + i) * 4, d = (rd * W + i) * 4, l = (rj * W + il) * 4, r = (rj * W + ir) * 4;
          const q = ((j - y) * W + i) * 4;
          for (let k = 0; k < 3; k++) {
            const v = sp[c + k] * (1 + 4 * a) - a * (sp[u + k] + sp[d + k] + sp[l + k] + sp[r + k]);
            op[q + k] = v < 0 ? 0 : v > 255 ? 255 : v;
          }
          op[q + 3] = sp[c + 3];
        }
      }
      dg.putImageData(o, 0, y);
      await sleep(0);
    }
    return dst;
  }

  /* ---------- flujo principal ---------- */
  el.go.addEventListener('click', run);
  el.cancel.addEventListener('click', () => { state.cancel = true; el.cancel.disabled = true; el.stageTxt.textContent = 'Cancelando…'; });

  async function run() {
    if (!state.bitmap || state.busy) return;
    state.busy = true; state.cancel = false; showNote('');
    el.go.disabled = true; el.again.disabled = true; el.cancel.disabled = false;
    el.working.hidden = false; setProgress(0, 'Preparando…', '');
    const scale = +radio('scale'), fmt = radio('fmt'), quality = +el.qual.value / 100, sharpAmt = +el.sharp.value;
    const t0 = performance.now();
    try {
      await ensureSession();
      const { canvas: big, hasAlpha } = await upscale(state.bitmap, fmt !== 'jpg');

      setProgress(93, 'Ajustando tamaño…', '');
      let work = big;
      if (scale < 4) {
        const tw = state.w * scale, th = state.h * scale;
        const c = document.createElement('canvas'); c.width = tw; c.height = th;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(big, 0, 0, tw, th);
        work = c;
      }
      setProgress(95, 'Afinando nitidez…', '');
      work = await sharpen(work, sharpAmt);

      setProgress(98, 'Generando archivo…', '');
      let outCanvas = work;
      if (fmt === 'jpg' && hasAlpha) {
        const c = document.createElement('canvas'); c.width = work.width; c.height = work.height;
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(work, 0, 0);
        outCanvas = c;
      }
      const mime = { jpg: 'image/jpeg', webp: 'image/webp', png: 'image/png' }[fmt];
      const blob = await new Promise(r => outCanvas.toBlob(r, mime, quality));
      if (!blob) throw new Error('No pude generar el archivo (¿imagen demasiado grande para este equipo?).');

      if (state.afterUrl) URL.revokeObjectURL(state.afterUrl);
      state.afterUrl = URL.createObjectURL(blob);
      el.after.src = state.afterUrl;
      await el.after.decode().catch(() => {});
      const base = state.file.name.replace(/\.[^.]+$/, '') || 'imagen';
      el.dl.href = state.afterUrl; el.dl.download = `${base}-${scale}x-fondoblanco.${fmt}`;
      el.afterWrap.hidden = el.bar.hidden = el.knob.hidden = el.tagR.hidden = el.slider.hidden = false;
      el.dl.hidden = false; el.go.textContent = 'Ampliar de nuevo'; el.go.className = 'btn ghost'; el.go.disabled = false;
      const secs = (performance.now() - t0) / 1000;
      el.meta.innerHTML = `<span><b>${state.w}×${state.h}</b> → <b>${outCanvas.width}×${outCanvas.height}</b> px</span>` +
        `<span><b>${fmtBytes(blob.size)}</b></span><span><b>${fmtTime(secs)}</b> · ${state.backend === 'webgpu' ? 'WebGPU' : 'CPU'}</span>`;
      el.meta.hidden = false;
      if (hasAlpha && fmt === 'jpg') showNote('Tu imagen tiene transparencia; en JPG se rellenó de blanco. Usa PNG o WebP para conservarla.');
    } catch (e) {
      if (e.message !== 'cancelado') { console.error(e); showNote('Algo falló: ' + e.message); }
      el.go.disabled = false;
    } finally {
      state.busy = false; el.working.hidden = true; el.again.disabled = false;
    }
  }
})();
