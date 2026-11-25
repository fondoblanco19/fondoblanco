/* Asistente de preguntas frecuentes — Fondo Blanco
 * Sin servidor y sin IA generativa: busca la respuesta preparada más parecida a lo que escribe la persona.
 * Las preguntas y respuestas están en _src/asistente.json; build.mjs las inyecta en window.__FBA.
 * No envía ni guarda ningún mensaje. */
(() => {
  'use strict';
  const D = (typeof window !== 'undefined' && window.__FBA) || null;
  if (!D) return;

  /* ================= motor de búsqueda de respuestas ================= */
  const STOP = new Set(('de la el los las un una unos unas y o en que es son para por con se al del mi me tu te lo le les a como cual cuales ' +
    'donde cuando quien quienes si no muy mas pero hay ha he esta este esto estos estas puedo puede pueden podria podrian quiero quisiera ' +
    'necesito saber tengo tiene tienen tener hacer hago hace ser soy sobre sus su nos ya tambien solo todo todas todos cosa cosas favor ' +
    'porfavor hola buenas buenos dias tardes noches blanco fondoblanco pagina sitio web sirve sirven servir').split(' '));
  const GRUPOS = {
    gratis: 'gratis gratuito gratuita gratuitas gratuitos',
    precio: 'precio costo costos cuesta cuestan cobran cobrar pagar pago valor tarifa',
    foto: 'foto fotos imagen imagenes fotografia fotografias picture pic',
    descargar: 'descargar descargo descarga descargas bajar bajo bajan download guardar guardo',
    uso: 'usar uso utilizar usarlas usarla usarlos usan usado',
    comercial: 'comercial comerciales comercio negocio negocios empresa empresas vender venta vendo publicidad tienda campana',
    credito: 'credito creditos atribucion citar cito mencionar menciono mencion',
    licencia: 'licencia licencias permiso permisos cc by',
    derecho: 'derecho derechos autor copyright legal legales abogado',
    ia: 'ia inteligencia artificial generada generadas generado generados sintetica',
    real: 'real reales verdad verdaderas verdadera autentica',
    quitar: 'quitar quito recortar recorto recorte eliminar elimino borrar borro remover sacar saco',
    ampliar: 'ampliar amplio agrandar agrando aumentar aumento escalar mejorar mejoro 4k',
    resolucion: 'resolucion calidad tamano pixeles dimensiones',
    formato: 'formato jpg jpeg',
    banner: 'banner instagram facebook youtube miniatura historia reel post publicacion portada',
    contacto: 'contacto contactar contactarlos escribirles correo email mail soporte ayuda reportar reporto retirar denunciar',
    privacidad: 'privacidad cookies cookie rastreo analitica datos informacion',
    coleccion: 'coleccion colecciones temas tema categoria categorias tipos',
    buscar: 'buscar busco busca encontrar encuentro filtrar filtro buscador',
  };
  const SIN = {};
  for (const [canon, lista] of Object.entries(GRUPOS)) for (const w of lista.split(' ')) SIN[w] = canon;

  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const canon = t => SIN[t] || (t.length > 3 && t.endsWith('s') && SIN[t.slice(0, -1)]) || (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t);
  // «Fondo Blanco» (el nombre del sitio) se trata como una sola palabra para no confundirlo con «quitar fondo»
  const tokens = s => { const out = []; for (const w of norm(s).replace(/\bfondo ?blanco\b/g, 'fbmarca').split(' ')) { if (!w || STOP.has(w)) continue; const c = canon(w); if (c.length > 1 && !out.includes(c)) out.push(c); } return out; };

  // Cada entrada: bolsa de palabras con peso (palabras clave 3, preguntas 2). Menos frecuente en el conjunto = más peso (IDF).
  const entradas = D.entradas.map(e => {
    const m = new Map();
    const add = (txt, w) => tokens(txt).forEach(t => m.set(t, Math.max(m.get(t) || 0, w)));
    add(e.t, 2); (e.p || []).forEach(p => add(p, 2)); (e.k || []).forEach(k => add(k, 3));
    return Object.assign({}, e, { m });
  });
  const porId = Object.fromEntries(entradas.map(e => [e.id, e]));
  const df = new Map();
  entradas.forEach(e => e.m.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
  const idf = t => Math.log(1 + entradas.length / (df.get(t) || 0.5));
  entradas.forEach(e => { let p = 0; e.m.forEach((w, t) => { p += idf(t) * w; }); e.pesoTotal = p; });

  function puntuar(q) {
    let qt = tokens(q);
    if (qt.length > 1) qt = qt.filter(t => t !== 'fbmarca');      // mencionar el nombre del sitio de pasada no cambia el tema
    if (!qt.length) return [];
    const den = qt.reduce((s, t) => s + idf(t) * 3, 0);
    // cobertura de la pregunta + un pequeño desempate a favor de la entrada más específica
    return entradas.map(e => { let hit = 0; for (const t of qt) if (e.m.has(t)) hit += idf(t) * e.m.get(t); return { e, s: hit / den + 0.25 * (hit / e.pesoTotal) }; }).sort((a, b) => b.s - a.s);
  }

  const SALUDOS = [[/^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|saludos)\b/, 'hola'], [/^(gracias|muchas gracias|mil gracias|ok gracias|listo gracias)\b/, 'gracias'], [/^(adios|chao|chau|hasta luego|nos vemos|hasta pronto)\b/, 'adios']];
  const UMBRAL = 0.42;

  // «fotos de café», «busco playa», «tienen imágenes de oficina»: lleva a la página de esa búsqueda
  function intencionFotos(q) {
    const n = norm(q);
    let m = n.match(/^(?:(?:busco|buscando|necesito|quiero|tienen|tienes|hay|muestrame|ensename)\s+)?(?:fotos?|imagenes|imagen|fotografias?)\s+(?:de|del|sobre|con)\s+(.+)$/);
    let raw = m && m[1];
    if (!m) {
      m = n.match(/^(?:busco|buscando|necesito|quiero|tienen|tienes|hay)\s+(?:algo\s+)?(?:de\s+)?(.+)$/);
      raw = m && m[1];
      if (m && raw.split(' ').length > 2 && !/\b(foto|fotos|imagen|imagenes)\b/.test(n)) return null;
    }
    if (!m) return null;
    const palabras = raw.split(' ').filter(w => w && !STOP.has(w) && (!SIN[w] || w === 'ia'));
    const term = palabras.join(' ').trim();
    if (!term || term.length < 2 || palabras.length > 3) return null;
    const desconocido = palabras.some(w => !df.has(canon(w)));
    const sing = s => s.split(' ').map(w => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w)).join(' ');
    const ts = sing(term);
    const tag = (D.etiquetas || []).find(t => sing(norm(t.n)) === ts) || (D.etiquetas || []).find(t => ts.split(' ').includes(sing(norm(t.n))));
    if (tag) return { firme: true, texto: `Tenemos **${tag.c} fotos** de «${tag.n}»: [ver fotos de ${tag.n}](${tag.u}).` };
    const col = (D.colecciones || []).find(c => norm(c.n).split(' ').some(w => w.length > 3 && ts.split(' ').includes(sing(w))));
    if (col) return { firme: true, texto: `Eso está en la colección [${col.n}](${col.u}) (${col.c} fotos).` };
    return { firme: false, desconocido, texto: `No tengo una página exacta para «${term}», pero puedes [buscarlo en la portada](/?q=${encodeURIComponent(term)}#fotos). También puedes explorar las [búsquedas populares](/fotos/).` };
  }

  function responder(q) {
    const n = norm(q);
    if (!n) return null;
    for (const [re, k] of SALUDOS) if (re.test(n) && D.saludos[k]) return { texto: D.saludos[k], rel: [] };
    const fo = intencionFotos(q);
    if (fo && fo.firme) return { texto: fo.texto, rel: [] };                       // hay una página exacta: va primero
    const ps = puntuar(q), top = ps[0];
    if (top && top.s >= UMBRAL && !(fo && fo.desconocido)) return { texto: top.e.r, id: top.e.id, rel: ps.slice(1, 3).filter(x => x.s >= 0.2).map(x => x.e) };
    if (fo) return { texto: fo.texto, rel: [] };                                    // palabra desconocida: se manda al buscador
    const cerca = ps.slice(0, 3).filter(x => x.s >= 0.1).map(x => x.e);
    return { texto: 'No encontré una respuesta exacta a eso. ¿Te sirve alguna de estas? Si es otra cosa, escríbenos desde [contacto](/contacto/).', rel: cerca.length ? cerca : (D.sugeridas || []).slice(0, 3).map(i => porId[i]).filter(Boolean), sinRespuesta: true };
  }

  const motor = { responder, puntuar, tokens, norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = motor;
  if (typeof document === 'undefined') return;

  /* ================= interfaz ================= */
  const CSS = `
.fba-btn{position:fixed;right:16px;bottom:var(--fba-b,16px);z-index:90;display:flex;align-items:center;gap:8px;background:var(--ink);color:var(--paper);border:0;border-radius:999px;padding:12px 18px;font:600 14px var(--f-text);cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.22);transition:bottom .25s var(--ease-out,ease)}
.fba-btn svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.fba-btn:hover{background:var(--signal);color:#fff}
.fba{position:fixed;right:16px;bottom:calc(var(--fba-b,16px) + 56px);z-index:90;width:min(390px,calc(100vw - 32px));height:min(600px,calc(100vh - var(--fba-b,16px) - 84px));display:flex;flex-direction:column;background:var(--paper);color:var(--ink);border:1px solid var(--line-2);border-radius:14px;box-shadow:0 12px 48px rgba(0,0,0,.3);overflow:hidden;transition:bottom .25s var(--ease-out,ease)}
.fba[hidden]{display:none}
.fba-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:14px 16px;background:var(--ink);color:var(--paper)}
.fba-head h2{font:400 17px var(--f-display);text-transform:uppercase;margin:0;letter-spacing:.02em}
.fba-head p{margin:3px 0 0;font-size:12.5px;opacity:.75;line-height:1.3}
.fba-x{background:none;border:0;color:inherit;font-size:24px;line-height:1;cursor:pointer;padding:0 4px;border-radius:6px}
.fba-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}
.fba-m{max-width:90%;padding:10px 13px;border-radius:14px;font-size:15px;line-height:1.45;overflow-wrap:anywhere}
.fba-m a{color:inherit;text-decoration:underline;text-underline-offset:2px}
.fba-bot{align-self:flex-start;background:var(--paper-3);border-bottom-left-radius:4px}
.fba-user{align-self:flex-end;background:var(--ink);color:var(--paper);border-bottom-right-radius:4px}
.fba-chips{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start}
.fba-chip{border:1px solid var(--line-2);background:var(--paper);color:var(--ink);border-radius:999px;padding:7px 12px;font:500 13px var(--f-text);cursor:pointer;text-align:left}
.fba-chip:hover{border-color:var(--ink);background:var(--paper-2)}
.fba-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--line);background:var(--paper-2)}
.fba-form input{flex:1;min-width:0;font:inherit;font-size:15px;padding:10px 12px;border:1px solid var(--line-2);border-radius:10px;background:var(--paper);color:var(--ink)}
.fba-form button{background:var(--signal);color:#fff;border:0;border-radius:10px;padding:0 16px;font:600 14px var(--f-text);cursor:pointer}
.fba-note{font-size:11.5px;color:var(--ink-3);padding:0 14px 10px;background:var(--paper-2);margin:0;line-height:1.35}
.fba-note a{color:inherit}
.cc-need{--fba-b:222px}
@media (max-width:700px){.cc-need{--fba-b:252px}}
@media (max-width:520px){.fba{right:8px;left:8px;width:auto}.fba-btn{right:12px}.fba-btn span{display:none}.fba-btn{padding:13px}}
@media print{.fba,.fba-btn{display:none}}
@media (prefers-reduced-motion:reduce){.fba-btn,.fba{transition:none}.fba-msgs{scroll-behavior:auto}}`;

  function rico(texto) {
    const f = document.createDocumentFragment();
    for (const p of texto.split(/(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*|\n)/)) {
      if (!p) continue;
      let m;
      if (p === '\n') f.appendChild(document.createElement('br'));
      else if ((m = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)) && /^(\/|https:\/\/co\.pinterest\.com\/)/.test(m[2])) {
        const a = document.createElement('a'); a.href = m[2]; a.textContent = m[1];
        if (m[2][0] !== '/') { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        f.appendChild(a);
      } else if ((m = p.match(/^\*\*([^*]+)\*\*$/))) { const b = document.createElement('strong'); b.textContent = m[1]; f.appendChild(b); }
      else f.appendChild(document.createTextNode(p));
    }
    return f;
  }
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  let panel, msgs, input, boton, abierto = false;

  function chips(lista) {
    const c = h('div', 'fba-chips');
    lista.forEach(e => { const b = h('button', 'fba-chip', e.t); b.type = 'button'; b.addEventListener('click', () => preguntar(e.t, e)); c.appendChild(b); });
    return c;
  }
  const bajar = () => { msgs.scrollTop = msgs.scrollHeight; };
  function decir(texto, quien) { const m = h('div', 'fba-m fba-' + quien); if (quien === 'bot') m.appendChild(rico(texto)); else m.textContent = texto; msgs.appendChild(m); bajar(); return m; }

  function preguntar(texto, entrada) {
    texto = String(texto).trim().slice(0, 200);
    if (!texto) return;
    decir(texto, 'user');
    const r = entrada
      ? { texto: entrada.r, rel: puntuar(entrada.t).filter(x => x.e.id !== entrada.id && x.s >= 0.2).slice(0, 2).map(x => x.e) }
      : responder(texto);
    if (!r) return;
    const m = decir(r.texto, 'bot');
    if (r.rel && r.rel.length) msgs.appendChild(chips(r.rel));
    // respuesta larga: se muestra desde su inicio; corta: se baja hasta el final
    if (m.offsetHeight > msgs.clientHeight * 0.5) msgs.scrollTop = m.offsetTop - msgs.offsetTop - 10; else bajar();
  }

  function crear() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    boton = h('button', 'fba-btn'); boton.type = 'button'; boton.setAttribute('aria-expanded', 'false'); boton.setAttribute('aria-controls', 'fba');
    boton.setAttribute('aria-label', 'Abrir el asistente de preguntas frecuentes');
    boton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z"/></svg><span>¿Dudas?</span>';
    boton.addEventListener('click', () => (abierto ? cerrar() : abrir()));
    panel = h('section', 'fba'); panel.id = 'fba'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-labelledby', 'fba-t');
    const cab = h('div', 'fba-head'), tt = h('div');
    const t = h('h2', null, 'Asistente'); t.id = 'fba-t';
    tt.append(t, h('p', null, 'Respuestas preparadas sobre Fondo Blanco'));
    const x = h('button', 'fba-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar el asistente'); x.addEventListener('click', cerrar);
    cab.append(tt, x);
    msgs = h('div', 'fba-msgs'); msgs.setAttribute('role', 'log'); msgs.setAttribute('aria-live', 'polite');
    msgs.addEventListener('click', e => { if (e.target.closest('a')) cerrar(); });
    const form = h('form', 'fba-form'); form.autocomplete = 'off';
    input = h('input'); input.type = 'text'; input.maxLength = 200; input.placeholder = 'Escribe tu pregunta…'; input.setAttribute('aria-label', 'Escribe tu pregunta');
    const env = h('button', null, 'Enviar'); env.type = 'submit';
    form.append(input, env);
    form.addEventListener('submit', e => { e.preventDefault(); const v = input.value; input.value = ''; preguntar(v); });
    const nota = h('p', 'fba-note'); nota.append('Este asistente no usa IA generativa ni guarda tus mensajes. Para otros temas, ', Object.assign(h('a', null, 'escríbenos'), { href: '/contacto/' }), '.');
    panel.append(cab, msgs, form, nota);
    document.body.append(panel, boton);
    decir('Hola, soy el asistente de Fondo Blanco. Puedo resolver dudas sobre las fotos, la licencia y las herramientas. Elige una pregunta o escribe la tuya.', 'bot');
    msgs.appendChild(chips((D.sugeridas || []).map(i => porId[i]).filter(Boolean)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && abierto) { cerrar(); boton.focus(); } });
  }
  function abrir() { if (!panel) crear(); panel.hidden = false; abierto = true; boton.setAttribute('aria-expanded', 'true'); boton.setAttribute('aria-label', 'Cerrar el asistente'); setTimeout(() => input.focus({ preventScroll: true }), 30); }
  function cerrar() { if (!panel) return; panel.hidden = true; abierto = false; boton.setAttribute('aria-expanded', 'false'); boton.setAttribute('aria-label', 'Abrir el asistente de preguntas frecuentes'); }

  const iniciar = () => { crear(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
