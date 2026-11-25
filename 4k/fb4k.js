/* Fondo Blanco · botón "Descargar en 4K" (gratis por ahora)
 * Se pega en las páginas /foto/<slug>/. Busca el botón "Descargar gratis", añade debajo el de 4K y,
 * al pulsarlo, amplía la foto con Real-ESRGAN dentro del navegador (WebGPU o CPU) y descarga el JPG.
 *
 * Uso:   <script src="/4k/fb4k.js" defer data-engine="/4k/"></script>
 *   data-engine = carpeta que contiene  model/realesr-general-x4v3.onnx  y  ort/  (por defecto, la del script).
 *
 * PAGO FUTURO: reemplaza FB4K.authorize (más abajo). Debe devolver {ok:true} para dejar descargar.
 * IMPORTANTE: mientras el 4K se genere en el navegador, un bloqueo por pago se puede saltar. Para cobrar de verdad,
 * las fotos 4K deben generarse antes y entregarse desde el servidor (ver DISENO-4K.md). */
(() => {
  'use strict';
  const S = document.currentScript;
  const ENGINE = new URL(S?.dataset.engine || '.', S?.src || location.href).href;
  const CONFIG = {
    targetWidth: 3840,        // 4K UHD
    maxInputPixels: 1.3e6,    // la foto se reduce a este tamaño antes de la IA: más rápido, y la IA rehace el detalle
    sharpen: 12,              // 0-100
    quality: 0.92,
    pad: 16,
  };
  // Safari en iPhone/iPad no admite lienzos de más de 16,7 MP; la IA trabaja en un lienzo ×4, así que ahí la entrada va a ≤ 1 MP.
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const maxIn = () => IOS ? Math.min(CONFIG.maxInputPixels, 1.0e6) : CONFIG.maxInputPixels;
  const FB4K = window.FB4K = {
    config: CONFIG,
    /* Gancho de pago. Hoy: todo gratis. Mañana: consultar al servidor créditos/compra de {slug}. */
    authorize: async (/* photo */) => ({ ok: true }),
  };

  const slug = S?.dataset.slug || (location.pathname.match(/\/foto\/([^/]+)/) || [])[1];
  const freeBtn = document.querySelector('a.btn.primary[download], a.btn.primary[href*="/descargas/"]');
  if (!slug || !freeBtn) return;

  /* ---------- estilos (con prefijo fb4k- para no chocar con los del sitio) ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .fb4k-btn{font:inherit;font-weight:600;border:0;border-radius:999px;padding:14px 22px;cursor:pointer;display:flex;gap:10px;align-items:center;justify-content:center;width:100%;background:var(--ink,#151513);color:var(--paper,#fafaf7);transition:transform .15s cubic-bezier(.23,1,.32,1),opacity .2s}
  .fb4k-btn:active{transform:scale(.98)}
  .fb4k-btn small{font-weight:400;opacity:.8;font-size:12px}
  .fb4k-tag{font-family:var(--f-mono,ui-monospace,monospace);font-size:11px;font-weight:600;background:var(--paper,#fafaf7);color:var(--ink,#151513);padding:2px 8px;border-radius:999px;letter-spacing:.04em}
  .fb4k-scrim{position:fixed;inset:0;background:rgba(21,21,19,.55);display:grid;place-items:center;padding:16px;z-index:1000}
  .fb4k-modal{background:var(--paper,#fafaf7);color:var(--ink,#151513);border:1px solid var(--line-2,#cfcec6);width:min(480px,100%);padding:clamp(18px,3vw,28px);font-family:var(--f-text,system-ui,sans-serif);border-radius:2px}
  .fb4k-modal h2{font-family:var(--f-display,'Arial Black',sans-serif);font-weight:400;text-transform:uppercase;font-size:clamp(24px,4vw,34px);line-height:1;margin:6px 0 12px}
  .fb4k-mono{font-family:var(--f-mono,ui-monospace,monospace);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2,#55554f)}
  .fb4k-pct{font-family:var(--f-display,'Arial Black',sans-serif);font-size:clamp(48px,10vw,84px);line-height:1;margin:8px 0}
  .fb4k-bar{height:6px;background:var(--line,#e0dfd8);border-radius:999px;overflow:hidden;margin:10px 0}
  .fb4k-bar i{display:block;height:100%;width:0;background:var(--ink,#151513);border-radius:999px;transition:width .3s}
  .fb4k-modal p{color:var(--ink-2,#55554f);font-size:14px;margin:6px 0}
  .fb4k-row{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}
  .fb4k-row button{font:inherit;font-weight:600;border:0;border-radius:999px;padding:11px 18px;cursor:pointer;background:var(--ink,#151513);color:var(--paper,#fafaf7)}
  .fb4k-row button.sec{background:transparent;color:var(--ink,#151513);box-shadow:inset 0 0 0 1px var(--line-2,#cfcec6)}
  .fb4k-err{color:var(--signal-ink,#b8260f);background:var(--signal-soft,#fde9e5);padding:10px 12px;border-radius:2px;font-size:13.5px}
  `;
  document.head.appendChild(css);

  /* ---------- botón ---------- */
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'fb4k-btn';
  btn.innerHTML = 'Ampliar a 4K <span class="fb4k-tag">GRATIS</span>';
  freeBtn.insertAdjacentElement('afterend', btn);
  btn.addEventListener('click', start);

  /* ---------- ventana ---------- */
  let ui = null, cancelled = false, busy = false;
  function openUI() {
    ui = document.createElement('div'); ui.className = 'fb4k-scrim';
    ui.innerHTML = `<div class="fb4k-modal" role="dialog" aria-modal="true" aria-labelledby="fb4k-t">
      <span class="fb4k-mono">Ampliación con IA · 4K</span><h2 id="fb4k-t">Preparando tu foto</h2>
      <div class="fb4k-pct" id="fb4k-pct">0%</div><div class="fb4k-bar"><i id="fb4k-bar"></i></div>
      <p id="fb4k-txt">Empezando…</p><p class="fb4k-mono" id="fb4k-eta"></p>
      <p id="fb4k-err" class="fb4k-err" hidden></p>
      <div class="fb4k-row"><button class="sec" id="fb4k-cancel">Cancelar</button></div></div>`;
    document.body.appendChild(ui);
    ui.querySelector('#fb4k-cancel').onclick = () => { cancelled = true; if (!busy) closeUI(); else set(null, 'Cancelando…'); };
  }
  const closeUI = () => { ui?.remove(); ui = null; };
  function set(p, txt, eta, title) {
    if (!ui) return;
    if (p != null) { ui.querySelector('#fb4k-pct').textContent = Math.round(p) + '%'; ui.querySelector('#fb4k-bar').style.width = p + '%'; }
    if (txt != null) ui.querySelector('#fb4k-txt').textContent = txt;
    if (eta != null) ui.querySelector('#fb4k-eta').textContent = eta;
    if (title) ui.querySelector('#fb4k-t').textContent = title;
  }
  function fail(msg) {
    if (!ui) return;
    const e = ui.querySelector('#fb4k-err'); e.hidden = false; e.textContent = msg;
    ui.querySelector('#fb4k-cancel').textContent = 'Cerrar';
    set(null, '', '', 'No se pudo');
  }

  /* ---------- flujo ---------- */
  async function start() {
    if (busy) return;
    const auth = await FB4K.authorize({ slug });
    if (!auth.ok) return;              // aquí se abrirá la compra de créditos cuando exista el pago
    busy = true; cancelled = false; openUI();
    try {
      set(2, 'Descargando la foto original…');
      const okImg = x => x && x.ok && !/text\/html/.test(x.headers.get('content-type') || '');   // una página 404 llega como HTML
      let r = await fetch(freeBtn.href).catch(() => null);
      if (!okImg(r) && S?.dataset.fallback) r = await fetch(S.dataset.fallback).catch(() => null);   // si falta el JPG original
      if (!okImg(r)) throw new Error('No pudimos descargar la foto original. Revisa tu conexión e inténtalo de nuevo.');
      const bmp = await createImageBitmap(await r.blob());
      const blob = await upscaleTo4K(bmp);
      if (cancelled) throw new Error('cancelado');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `fondo-blanco-${slug}-4k.jpg`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);   // libera la memoria del 4K cuando ya se descargó
      set(100, 'Listo. Tu descarga empezó. Recuerda dar crédito: «Foto: Fondo Blanco».', '', '¡Lista en 4K!');
      ui.querySelector('#fb4k-cancel').textContent = 'Cerrar';
    } catch (e) {
      if (e.message === 'cancelado') closeUI(); else { console.error(e); fail(e.message || 'Algo falló.'); }
    } finally { busy = false; }
  }

  /* ---------- motor ---------- */
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar el motor de IA.')); document.head.appendChild(s); });
  let enginePromise = null;
  function engine() {
    return enginePromise ||= (async () => {
      let gpu = false;
      try { gpu = !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch { /* sin WebGPU */ }
      await loadScript(ENGINE + 'ort/' + (gpu ? 'ort.webgpu.min.js' : 'ort.wasm.min.js'));
      const ort = window.ort;
      ort.env.wasm.wasmPaths = ENGINE + 'ort/';
      ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(navigator.hardwareConcurrency || 4, 8) : 1;
      ort.env.wasm.proxy = false;
      const mr = await fetch(ENGINE + 'model/realesr-general-x4v3.onnx');
      if (!mr.ok) throw new Error('No se pudo descargar el modelo de IA. Revisa tu conexión e inténtalo de nuevo.');
      const buf = await mr.arrayBuffer();
      const make = eps => ort.InferenceSession.create(buf, { executionProviders: eps, graphOptimizationLevel: 'all' });
      let session, backend;
      try { session = await make(gpu ? ['webgpu'] : ['wasm']); backend = gpu ? 'webgpu' : 'wasm'; }
      catch { session = await make(['wasm']); backend = 'wasm'; }
      return { ort, session, backend };
    })();
  }
  const fmtTime = s => s < 60 ? Math.round(s) + ' s' : Math.floor(s / 60) + ' min ' + Math.round(s % 60) + ' s';

  async function upscaleTo4K(bitmap) {
    set(6, 'Cargando la IA (la primera vez descarga ~5 MB y el motor)…');
    const { ort, session, backend } = await engine();
    if (cancelled) throw new Error('cancelado');

    // 1) tamaño de trabajo
    let w = bitmap.width, h = bitmap.height;
    if (w * h > maxIn()) { const k = Math.sqrt(maxIn() / (w * h)); w = Math.round(w * k); h = Math.round(h * k); }
    const src = document.createElement('canvas'); src.width = w; src.height = h;
    const sg = src.getContext('2d', { willReadFrequently: true }); sg.imageSmoothingQuality = 'high'; sg.drawImage(bitmap, 0, 0, w, h);
    const sd = sg.getImageData(0, 0, w, h).data;

    // 2) IA por bloques
    const fast = backend === 'webgpu', core = fast ? 224 : 96, PAD = CONFIG.pad, T = core + PAD * 2, OT = T * 4;
    const big = document.createElement('canvas'); big.width = w * 4; big.height = h * 4;
    const bg = big.getContext('2d');
    const input = new Float32Array(3 * T * T), plane = T * T, oplane = OT * OT;
    const tx = Math.ceil(w / core), ty = Math.ceil(h / core), total = tx * ty, t0 = performance.now();
    let done = 0;
    for (let j0 = 0; j0 < ty; j0++) for (let i0 = 0; i0 < tx; i0++) {
      if (cancelled) throw new Error('cancelado');
      const x0 = i0 * core, y0 = j0 * core, cw = Math.min(core, w - x0), ch = Math.min(core, h - y0);
      for (let j = 0; j < T; j++) {
        let sy = y0 - PAD + j; sy = sy < 0 ? 0 : sy >= h ? h - 1 : sy;
        for (let i = 0; i < T; i++) {
          let sx = x0 - PAD + i; sx = sx < 0 ? 0 : sx >= w ? w - 1 : sx;
          const p = (sy * w + sx) * 4, o = j * T + i;
          input[o] = sd[p] / 255; input[plane + o] = sd[p + 1] / 255; input[2 * plane + o] = sd[p + 2] / 255;
        }
      }
      const out = (await session.run({ input: new ort.Tensor('float32', input, [1, 3, T, T]) })).output.data;
      const ow = cw * 4, oh = ch * 4, img = new ImageData(ow, oh), px = img.data, off = PAD * 4;
      for (let j = 0; j < oh; j++) {
        const row = (j + off) * OT + off;
        for (let i = 0; i < ow; i++) {
          const o = row + i, q = (j * ow + i) * 4;
          const r = out[o] * 255 + .5, g = out[oplane + o] * 255 + .5, b = out[2 * oplane + o] * 255 + .5;
          px[q] = r < 0 ? 0 : r > 255 ? 255 : r; px[q + 1] = g < 0 ? 0 : g > 255 ? 255 : g; px[q + 2] = b < 0 ? 0 : b > 255 ? 255 : b; px[q + 3] = 255;
        }
      }
      bg.putImageData(img, x0 * 4, y0 * 4);
      done++;
      const el = (performance.now() - t0) / 1000;
      set(8 + 82 * done / total, `Ampliando con IA · bloque ${done} de ${total}`, done >= 2 ? `Quedan ≈ ${fmtTime(el / (done / total) - el)} · ${fast ? 'tarjeta gráfica' : 'procesador'}` : 'Calculando tiempo…', 'Ampliando a 4K');
      await new Promise(r => setTimeout(r, 0));
    }

    // 3) ajuste a 3840 px de ancho + nitidez + JPG
    set(92, 'Ajustando a 4K…');
    const tw = CONFIG.targetWidth, th = Math.round(bitmap.height * tw / bitmap.width);
    let cur = big;
    while (cur.width / 2 > tw) {            // reducción en pasos de ½ para conservar nitidez
      const c = document.createElement('canvas'); c.width = Math.round(cur.width / 2); c.height = Math.round(cur.height / 2);
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, c.width, c.height); cur = c;
    }
    const fin = document.createElement('canvas'); fin.width = tw; fin.height = th;
    const fg = fin.getContext('2d', { willReadFrequently: true }); fg.imageSmoothingQuality = 'high'; fg.drawImage(cur, 0, 0, tw, th);
    set(95, 'Afinando nitidez…');
    sharpen(fg, tw, th, CONFIG.sharpen);
    set(98, 'Generando el archivo…');
    const jpg = await new Promise((res, rej) => fin.toBlob(b => b ? res(b) : rej(new Error('No pude generar el archivo.')), 'image/jpeg', CONFIG.quality));
    try { return await marcarIA(jpg); } catch { return jpg; }
  }

  /* Metadatos «generado con IA» (IPTC trainedAlgorithmicMedia), igual que los JPG de /descargas/ */
  async function marcarIA(blob) {
    const b = new Uint8Array(await blob.arrayBuffer());
    if (b[0] !== 0xff || b[1] !== 0xd8) return blob;
    let pos = 2, ins = 2;
    while (pos + 4 <= b.length && b[pos] === 0xff && b[pos + 1] >= 0xe0 && b[pos + 1] <= 0xef) {
      const len = (b[pos + 2] << 8) | b[pos + 3];
      if (b[pos + 1] === 0xe0 || b[pos + 1] === 0xe1) ins = pos + 2 + len;
      pos += 2 + len;
    }
    const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/" Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia" photoshop:Credit="Fondo Blanco (fondoblanco.co)" xmpRights:Marked="True" xmpRights:WebStatement="https://fondoblanco.co/aviso-ia/"><dc:creator><rdf:Seq><rdf:li>Fondo Blanco</rdf:li></rdf:Seq></dc:creator><dc:rights><rdf:Alt><rdf:li xml:lang="x-default">Fondo Blanco - fondoblanco.co - CC BY 4.0. Imagen generada con inteligencia artificial, sin garantías.</rdf:li></rdf:Alt></dc:rights><dc:source>${location.origin}/foto/${slug}/</dc:source></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
    const body = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0' + xmp);
    const seg = new Uint8Array(4 + body.length);
    seg.set([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff]); seg.set(body, 4);
    return new Blob([b.slice(0, ins), seg, b.slice(ins)], { type: 'image/jpeg' });
  }

  function sharpen(g, W, H, amount) {
    if (amount <= 0) return;
    const a = amount / 100 * 0.35, im = g.getImageData(0, 0, W, H), s = im.data, d = new Uint8ClampedArray(s);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const c = (y * W + x) * 4, u = c - W * 4, dn = c + W * 4;
      for (let k = 0; k < 3; k++) d[c + k] = s[c + k] * (1 + 4 * a) - a * (s[u + k] + s[dn + k] + s[c - 4 + k] + s[c + 4 + k]);
    }
    im.data.set(d); g.putImageData(im, 0, 0);
  }
})();
