// Generador estático de fondoblanco.co
// Lee _src/*.json y escribe HTML listo para GitHub Pages. Uso: npm run build
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import sharp from 'sharp';
import { paginasLegales, TERMS_VERSION } from './legal.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const sitio = read('_src/sitio.json');
const { colecciones, fotos: fotosRaw } = read('_src/fotos.json');
const meta = read('_src/meta.json');
const seoCol = read('_src/colecciones-seo.json');
const legado = fs.existsSync(path.join(ROOT, '_src/legado.json')) ? read('_src/legado.json') : [];
const CSS = (fs.readFileSync(path.join(ROOT, '_build/estilos.css'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, '_build/estilos-extra.css'), 'utf8'))
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();
const HOY = new Date().toISOString().slice(0, 10);
const URL = sitio.url;
let ASIS_V = '';   // huella de /asistente.js (la fija asistente()); sirve para que el navegador no use una copia vieja

// ---------- datos ----------
const colMap = Object.fromEntries(colecciones.map((c) => [c.slug, c]));
const fotos = fotosRaw.map((f, i) => {
  const m = meta[f.slug];
  if (!m) throw new Error(`Falta meta de ${f.slug}: ejecuta npm run imagenes`);
  return { ...f, ...m, i, code: 'FB-' + String(i + 1).padStart(3, '0'), col: colMap[f.coleccion],
    url: `/foto/${f.slug}/`, dl: `/descargas/fondo-blanco-${f.slug}.jpg` };
});
for (const c of colecciones) c.fotos = fotos.filter((f) => f.coleccion === c.slug);

// ---------- utilidades ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const mb = (b) => (b / 1048576).toLocaleString('es', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' MB';
// Títulos (≤ 65 caracteres) y descripciones (≤ 160) que no se corten en Google
const fit = (largo, corto, max = 65) => (largo.length <= max ? largo : corto);
const cortar = (s, max) => (s.length <= max ? s : s.slice(0, max - 1).replace(/[\s,;:.]+\S*$/, '') + '…');
const slugify = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const lista = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

// ---------- etiquetas: una página por búsqueda (/fotos/<etiqueta>/) ----------
// Solo etiquetas con al menos MIN_ETIQUETA fotos, para no crear páginas pobres que Google ignore.
const MIN_ETIQUETA = 5;
const etiquetas = (() => {
  const m = new Map();
  for (const f of fotos) for (const t of f.tags) {
    const slug = slugify(t);
    if (!slug) continue;
    if (!m.has(slug)) m.set(slug, { slug, nombre: t, url: `/fotos/${slug}/`, fotos: [] });
    const e = m.get(slug);
    if (!e.fotos.includes(f)) e.fotos.push(f);
  }
  return [...m.values()].filter((e) => e.fotos.length >= MIN_ETIQUETA)
    .sort((a, b) => b.fotos.length - a.fotos.length || a.nombre.localeCompare(b.nombre, 'es'));
})();
const etiquetaPorSlug = Object.fromEntries(etiquetas.map((e) => [e.slug, e]));
const tagHref = (t) => (etiquetaPorSlug[slugify(t)] || {}).url || `/?q=${encodeURIComponent(t)}`;
// Etiquetas con página que más se repiten dentro de un grupo de fotos (para enlaces internos)
function etiquetasDe(grupo, { excluir = '', max = 12 } = {}) {
  const n = new Map();
  for (const f of grupo) for (const t of new Set(f.tags.map(slugify))) if (etiquetaPorSlug[t] && t !== excluir) n.set(t, (n.get(t) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([s]) => etiquetaPorSlug[s]);
}
const chipsEtiquetas = (es) => `<ul class="tags">${es.map((e) => `<li><a href="${e.url}">${esc(e.nombre)} <small>${e.fotos.length}</small></a></li>`).join('')}</ul>`;

function write(rel, html) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}
const ICON = {
  reg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="6.5"/><path d="M12 1.5v21M1.5 12h21"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m6.5 10 5.5 5.5 5.5-5.5"/><path d="M4 20h16"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
};

function picture(f, { widths = [480, 960, 1600], sizes, eager = false, high = false, cls = '' } = {}) {
  const set = (ext) => widths.map((w) => `/img/${f.slug}-${w}.${ext} ${w}w`).join(', ');
  const mid = widths.includes(960) ? 960 : widths[widths.length - 1];
  return `<picture><source type="image/avif" srcset="${set('avif')}" sizes="${sizes}"><source type="image/webp" srcset="${set('webp')}" sizes="${sizes}"><img src="/img/${f.slug}-${mid}.webp" width="${f.w}" height="${f.h}" alt="${esc(f.desc)}"${cls ? ` class="${cls}"` : ''} loading="${eager ? 'eager' : 'lazy'}" decoding="async"${high ? ' fetchpriority="high"' : ''}></picture>`;
}

// ---------- plantilla ----------
// Aviso de cookies y términos de uso. La respuesta se guarda en una cookie técnica (fb_terms=<versión>, 12 meses).
// Si cambia TERMS_VERSION (en legal.mjs), el aviso vuelve a salir para todos.
// En /terminos/, /aviso-ia/, /privacidad/ y /licencia/ se muestra como barra inferior para poder leerlas antes de aceptar.
const CC_HEAD = `(function(d){if(!/(?:^|; )fb_terms=${TERMS_VERSION}(?:;|$)/.test(d.cookie))d.documentElement.classList.add('cc-need')})(document)`;
const CC_HTML = `<div class="cc" id="cc" role="dialog" aria-modal="true" aria-labelledby="cc-t" aria-describedby="cc-d">
<div class="cc-box"><p class="label">Antes de seguir</p><h2 id="cc-t">Cookies y términos de uso</h2>
<p id="cc-d">Todas las imágenes de Fondo Blanco están generadas con inteligencia artificial y se ofrecen sin garantías: el uso que hagas de ellas es tu responsabilidad. No usamos cookies de seguimiento ni publicidad; solo una cookie técnica, durante 12 meses, para recordar tu respuesta.</p>
<p>Al seguir usando el sitio aceptas los&nbsp;<a href="/terminos/">Términos de uso</a>, el <a href="/aviso-ia/">Aviso sobre imágenes de IA</a> y la <a href="/privacidad/">Política de privacidad</a>.</p>
<div class="cc-act"><button class="btn primary" type="button" id="cc-ok">Aceptar y continuar</button></div></div></div>`;
const CC_SCRIPT = `(()=>{const h=document.documentElement,cc=document.getElementById('cc');if(!cc)return;const soft=true,parts=['.top','main','.foot'].map(s=>document.querySelector(s)).filter(Boolean);
function open(){h.classList.add('cc-need');if(soft){h.classList.add('cc-soft');cc.setAttribute('aria-modal','false')}else{h.classList.add('cc-lock');parts.forEach(e=>{e.inert=true})}if(!soft)cc.querySelector('button').focus({preventScroll:true})}
function close(){h.classList.remove('cc-need','cc-lock','cc-soft');parts.forEach(e=>{e.inert=false})}
document.getElementById('cc-ok').addEventListener('click',()=>{document.cookie='fb_terms=${TERMS_VERSION}; Max-Age=31536000; Path=/; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');document.cookie='fb_consent=; Max-Age=0; Path=/';close()});
document.querySelectorAll('[data-cookies]').forEach(b=>b.addEventListener('click',()=>{document.cookie='fb_terms=; Max-Age=0; Path=/';open()}));
if(h.classList.contains('cc-need'))open()})();`;

// ---------- seguridad ----------
// GitHub Pages no deja poner cabeceras HTTP, así que la política de seguridad (CSP) va en una etiqueta <meta>.
// Solo se ejecutan los scripts del propio sitio y los scripts en línea cuya huella SHA-256 calcula este build:
// si alguien lograra inyectar un script en una página, el navegador lo bloquearía.
// 'wasm-unsafe-eval' es necesario para el motor de IA (ONNX Runtime en WebAssembly) de /4k/.
const sha = (s) => `'sha256-${crypto.createHash('sha256').update(s, 'utf8').digest('base64')}'`;
const csp = (inline) => [
  "default-src 'self'",
  `script-src 'self' 'wasm-unsafe-eval' ${inline.map(sha).join(' ')}`,
  "style-src 'self' 'unsafe-inline' https://use.typekit.net https://p.typekit.net",
  "font-src 'self' data: https://use.typekit.net",
  "img-src 'self' data: blob: https://p.typekit.net",
  "connect-src 'self' https://formsubmit.co",
  "worker-src 'self' blob:",
  "form-action 'self' https://formsubmit.co",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

function layout({ title, desc, canon, og, ogAlt, body, jsonld = [], script = '', nav = '', noindex = false, type = 'website', ext = '' }) {
  const ogImg = og || `${URL}/img/og/sitio.jpg`;
  const inline = [CC_HEAD, CC_SCRIPT, ...(script ? [script] : [])];
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp(inline)}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex,follow">' : `<link rel="canonical" href="${URL}${canon}">`}
<meta name="theme-color" content="#fafaf7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121110" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="alternate" type="application/rss+xml" title="Fondo Blanco: fotos nuevas" href="/feed.xml">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Fondo Blanco">
<meta property="og:locale" content="es_CO">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${URL}${canon}">
<meta property="og:image" content="${ogImg}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(ogAlt || title)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://use.typekit.net" crossorigin>
<link rel="preconnect" href="https://p.typekit.net" crossorigin>
<link rel="stylesheet" href="https://use.typekit.net/${sitio.adobeKit}.css">
<style>${CSS}</style>
<script>${CC_HEAD}</script>
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body>
<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="top"><div class="wrap">
<a class="brand" href="/" aria-label="Fondo Blanco, inicio"><span>Fondo Blanco</span></a>
<nav class="nav" aria-label="Principal">
<a href="/#colecciones" class="hide-s"${nav === 'colecciones' ? ' aria-current="page"' : ''}>Colecciones</a>
<a href="/ampliar/"${nav === 'ampliar' ? ' aria-current="page"' : ''}>Ampliar<span class="hide-s"> imagen</span></a>
<a href="/quitar-fondo/" class="hide-s"${nav === 'quitar' ? ' aria-current="page"' : ''}>Quitar<span class="hide-s"> fondo</span></a>
<a href="/licencia/" class="hide-s"${nav === 'licencia' ? ' aria-current="page"' : ''}>Licencia</a>
<a href="/contacto/"${nav === 'contacto' ? ' aria-current="page"' : ''}>Contacto</a>
</nav>
</div></header>
<main id="contenido">
${body}
</main>
${footer()}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
${CC_HTML}
${script ? `<script>${script}</script>` : ''}
<script>${CC_SCRIPT}</script>
${ASIS_V ? `<script src="/asistente.js?v=${ASIS_V}" defer></script>` : ''}
${ext}
</body>
</html>
`;
}

function footer() {
  return `<footer class="foot"><div class="wrap">
<div class="foot-grid">
<div><h2>Fondo Blanco</h2><p>Banco de imágenes gratis en alta resolución. Descarga y usa: así de simple.</p></div>
<div><h2>Colecciones</h2><ul>${colecciones.slice(0, 4).map((c) => `<li><a href="/coleccion/${c.slug}/">${esc(c.nombre)}</a></li>`).join('')}</ul></div>
<div><h2>Más</h2><ul>${colecciones.slice(4).map((c) => `<li><a href="/coleccion/${c.slug}/">${esc(c.nombre)}</a></li>`).join('')}</ul></div>
<div><h2>Sitio</h2><ul><li><a href="/ampliar/">Ampliar imagen</a></li><li><a href="/quitar-fondo/">Quitar fondo</a></li><li><a href="/banner/">Hacer un banner</a></li><li><a href="/licencia/">Licencia y uso</a></li><li><a href="/terminos/">Términos de uso</a></li><li><a href="/aviso-ia/">Imágenes de IA</a></li><li><a href="/privacidad/">Privacidad</a></li><li><button class="linkbtn" type="button" data-cookies>Preferencias de cookies</button></li><li><a href="/contacto/">Contacto</a></li></ul></div>
</div>
<div class="foot-mark" aria-hidden="true">Fondo Blanco</div>
<div class="foot-legal"><span>© ${new Date().getFullYear()} Fondo Blanco · Imágenes de uso libre</span><span>Tipografía: Archivo Black, Acumin Pro y Source Code Pro vía Adobe Fonts</span></div>
</div></footer>`;
}

function card(f, { eager = false } = {}) {
  const q = norm([f.titulo, f.desc, f.col.nombre, ...f.tags].join(' '));
  return `<li class="card" data-c="${f.coleccion}" data-e="${f.espacio ? 1 : 0}" data-q="${esc(q)}">
<a href="${f.url}" title="${esc(f.titulo)}" aria-label="${esc(f.titulo)} (${f.code})"><figure class="print" style="--c:${f.color}">${picture(f, { sizes: '(max-width:600px) 50vw, (max-width:1024px) 33vw, 25vw', eager })}</figure></a>
</li>`;
}

const SCRIPT_COMUN = `const toast=(m)=>{const t=document.getElementById('toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2200)};const copy=async(v,m)=>{try{await navigator.clipboard.writeText(v);toast(m)}catch(e){toast(v)}};`;

// Rotación temporal: cada 8 h el orden de la cuadrícula se desplaza, para que no salgan siempre las mismas primero.
const ROTAR = `(()=>{const g=document.querySelector('#grid,.grid');if(!g)return;const c=[...g.children],n=c.length;if(n<2)return;const k=(Math.floor(Date.now()/28800000)*9)%n;if(!k)return;c.slice(k).concat(c.slice(0,k)).forEach(e=>g.appendChild(e));g.querySelectorAll('img').forEach((im,i)=>{im.loading=i<3?'eager':'lazy'})})();`;

// ---------- portada ----------
function portada() {
  const total = fotos.length;
  const conEsp = fotos.filter((f) => f.espacio).length;
  const body = `<section class="hero"><div class="wrap">
<p class="eyebrow mono"><span><b>●</b> Banco de imágenes</span><span>Gratis</span><span>Alta resolución</span><span>${sitio.licencia.nombre}</span></p>
<h1 class="wordmark"><span>Fondo</span><span>Blanco</span><span class="reg">${ICON.reg}</span><span class="sr">: fotos de stock gratis</span></h1>
<div class="hero-row">
<div>
<p class="lead">Fotos de stock gratis para tu web, tus redes y tus presentaciones. <em>Revisadas una a una, listas para descargar.</em></p>
<form class="search" role="search" action="/" method="get" id="buscar">
${ICON.search}<label class="sr" for="q">Buscar fotos</label>
<input id="q" name="q" type="search" placeholder="Busca: café, playa, oficina, navidad…" autocomplete="off" enterkeyhint="search">
<button type="submit">Buscar</button>
</form>
</div>
<div class="stats">
<div><strong>${total}</strong><span>fotos</span></div>
<div><strong>${colecciones.length}</strong><span>colecciones</span></div>
<div><strong>2688</strong><span>px de ancho</span></div>
</div>
</div>
</div></section>

<section class="wrap" id="colecciones" aria-labelledby="h-col">
<div class="section-head"><h2 id="h-col">Colecciones</h2><p class="mono">${colecciones.length} temas</p></div>
<div class="strip">
${colecciones.map((c) => `<a href="/coleccion/${c.slug}/"><figure class="print" style="--c:${c.fotos[0].color}">${picture(c.fotos[0], { widths: [480, 960], sizes: '(max-width:600px) 60vw, 240px' })}</figure><h3>${esc(c.nombre)}</h3><span class="mono">${c.fotos.length} fotos</span></a>`).join('\n')}
</div>
</section>

<section class="wrap" aria-labelledby="h-pop">
<div class="section-head"><h2 id="h-pop">Búsquedas populares</h2><a class="mono" href="/fotos/">Ver las ${etiquetas.length} →</a></div>
${chipsEtiquetas(etiquetas.slice(0, 24))}
</section>

<section class="wrap" aria-labelledby="h-amp">
<div class="section-head"><h2 id="h-amp">Ampliar imagen</h2><p class="mono">Herramienta gratis</p></div>
<div class="amp-promo">
<div><p class="amp-big">¿Tienes una imagen pequeña?</p><p>Súbela y la ampliamos hasta 4 veces con inteligencia artificial, con más nitidez y menos píxeles visibles. Se procesa en tu equipo: tu imagen no se sube a ningún servidor.</p><a class="btn primary" href="/ampliar/">Ampliar mi imagen →</a></div>
<ol class="amp-steps"><li><b>01</b><span>Arrastra o pega tu imagen (JPG, PNG o WebP).</span></li><li><b>02</b><span>Elige 2×, 3× o 4× y compara el antes y el después.</span></li><li><b>03</b><span>Descárgala sin marcas de agua.</span></li></ol>
</div>
</section>

<section class="wrap" id="fotos" aria-labelledby="h-fotos">
<div class="section-head"><h2 id="h-fotos">Todas las fotos</h2><p class="mono">Toca una foto para ver su información y descargarla</p></div>
<div class="toolbar"><div class="toolbar-in" role="group" aria-label="Filtrar por colección">
<button class="chip" data-filter="todas" aria-pressed="true">Todas <small>${total}</small></button>
${colecciones.map((c) => `<button class="chip" data-filter="${c.slug}" aria-pressed="false">${esc(c.nombre)} <small>${c.fotos.length}</small></button>`).join('\n')}
<span class="sep" aria-hidden="true"></span>
<button class="chip signal" id="esp" aria-pressed="false">Con espacio para texto <small>${conEsp}</small></button>
</div></div>
<p class="count mono" id="count" aria-live="polite">${total} fotos</p>
<ul class="grid" id="grid">
${fotos.map((f, i) => card(f, { eager: i < 3 })).join('\n')}
</ul>
<div class="empty" id="empty" hidden><p>No encontramos fotos con esa búsqueda.</p><button class="chip" id="reset">Ver todas las fotos</button></div>
</section>

<section class="wrap" aria-labelledby="h-como">
<h2 class="sr" id="h-como">Cómo funciona</h2>
<div class="steps">
<div><div class="num">01</div><h3>Busca</h3><p>Filtra por colección o busca por palabra. Usa «Con espacio para texto» si necesitas lugar para tu mensaje.</p></div>
<div><div class="num">02</div><h3>Descarga</h3><p>Cada foto se descarga en JPG de ${fotos[0].w}×${fotos[0].h} px, sin registro y sin marcas de agua.</p></div>
<div><div class="num">03</div><h3>Úsala donde quieras</h3><p>Úsala en proyectos personales o comerciales, sin necesidad de dar crédito. <a href="/licencia/">Ver licencia</a>.</p></div>
</div>
</section>

<section class="wrap" aria-labelledby="h-sobre-fb"><div class="prose seo-text"><h2 id="h-sobre-fb">Fotos de stock gratis en alta resolución</h2>${seoCol._portada.texto.map((t) => `<p>${esc(t)}</p>`).join('')}
<h2>Preguntas frecuentes</h2>${seoCol._portada.faqs.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}</div></section>`;

  const script = `${SCRIPT_COMUN}${ROTAR}(()=>{const q=document.getElementById('q'),cards=[...document.querySelectorAll('#grid .card')],chips=[...document.querySelectorAll('[data-filter]')],esp=document.getElementById('esp'),count=document.getElementById('count'),empty=document.getElementById('empty');
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');let col='todas',soloEsp=false;
function apply(){const t=norm(q.value.trim()).split(/\\s+/).filter(Boolean);let n=0;for(const c of cards){const ok=(col==='todas'||c.dataset.c===col)&&(!soloEsp||c.dataset.e==='1')&&t.every(w=>c.dataset.q.includes(w));c.hidden=!ok;if(ok)n++}
count.textContent=n+(n===1?' foto':' fotos')+(q.value.trim()?' para «'+q.value.trim()+'»':'');empty.hidden=n>0;chips.forEach(b=>b.setAttribute('aria-pressed',b.dataset.filter===col));esp.setAttribute('aria-pressed',soloEsp);
const p=new URLSearchParams();if(q.value.trim())p.set('q',q.value.trim());if(col!=='todas')p.set('c',col);if(soloEsp)p.set('espacio','1');history.replaceState(null,'',location.pathname+(p.toString()?'?'+p:'')+location.hash)}
const p=new URLSearchParams(location.search);q.value=p.get('q')||'';col=chips.some(b=>b.dataset.filter===p.get('c'))?p.get('c'):'todas';soloEsp=p.get('espacio')==='1';
if(p.toString()){apply();document.getElementById('fotos').scrollIntoView()}
let tm;q.addEventListener('input',()=>{clearTimeout(tm);tm=setTimeout(apply,120)});
document.getElementById('buscar').addEventListener('submit',e=>{e.preventDefault();apply();document.getElementById('fotos').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})});
chips.forEach(b=>b.addEventListener('click',()=>{col=b.dataset.filter;apply()}));esp.addEventListener('click',()=>{soloEsp=!soloEsp;apply()});
document.getElementById('reset').addEventListener('click',()=>{q.value='';col='todas';soloEsp=false;apply()});
document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement!==q&&!/input|textarea/i.test(document.activeElement.tagName)){e.preventDefault();q.focus()}})})();`;

  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Fondo Blanco', url: URL + '/', inLanguage: 'es',
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${URL}/?q={search_term_string}` }, 'query-input': 'required name=search_term_string' } },
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'Fondo Blanco', url: URL + '/', logo: `${URL}/icon-512.png` },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: seoCol._portada.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
  write('index.html', layout({ title: 'Fondo Blanco — Fotos de stock gratis en alta resolución', desc: cortar(`Banco de imágenes gratis: ${total} fotos de stock en alta resolución en ${colecciones.length} colecciones, como negocios, naturaleza, viajes y gastronomía. Descarga sin registro.`, 165), canon: '/', body, script, jsonld }));
}

// ---------- ficha de foto ----------
function ficha(f) {
  const prev = fotos[(f.i - 1 + fotos.length) % fotos.length];
  const next = fotos[(f.i + 1) % fotos.length];
  const rel = f.col.fotos.filter((x) => x.slug !== f.slug).slice(0, 6);
  const extra = rel.length < 3 ? fotos.filter((x) => x.coleccion !== f.coleccion).slice(0, 3 - rel.length) : [];
  const usos = (seoCol[f.coleccion] || {}).usos || 'proyectos web, redes sociales y presentaciones';
  const contexto = `${f.titulo} es una foto gratis de la colección ${f.col.nombre.toLowerCase()}, en formato ${f.w >= f.h ? 'horizontal' : 'vertical'} de ${f.w}×${f.h} px. Sirve para ${usos}.${f.espacio ? ' Tiene espacio libre para añadir texto.' : ''} Se descarga sin registro.`;
  const body = `<div class="wrap">
<nav class="crumbs mono" aria-label="Ruta"><a href="/">Inicio</a><span aria-hidden="true">/</span><a href="/coleccion/${f.coleccion}/">${esc(f.col.nombre)}</a><span aria-hidden="true">/</span><span aria-current="page">${f.code}</span></nav>
<article class="photo">
<div class="table"><figure class="print" style="--c:${f.color}">${picture(f, { widths: [960, 1600], sizes: '(max-width:960px) calc(100vw - 64px), min(58vw, 860px)', eager: true, high: true })}</figure></div>
<div class="sheet">
<p class="label">${f.code} · ${esc(f.col.nombre)}</p>
<h1>${esc(f.titulo)}</h1>
<p class="desc">${esc(f.desc)}</p>
<p class="ctx">${esc(contexto)}</p>
<div class="actions">
<a class="btn primary" href="${f.dl}" download>${ICON.dl}<span>Descargar gratis <small>· JPG ${mb(f.bytes)}</small></span></a>
<div class="row"><button class="btn ghost" type="button" id="enlace">Copiar enlace</button></div>
</div>
<p class="banner-cta"><a class="btn ghost" href="/banner/?foto=${f.slug}">Hacer un banner con esta foto →</a></p>
<p class="note ia-note">Imagen generada con IA. Se ofrece sin garantías y su uso es tu responsabilidad. <a href="/aviso-ia/">Lee el aviso</a>.</p>
<table class="specs"><tbody>
<tr><th scope="row">Dimensiones</th><td>${f.w} × ${f.h} px</td></tr>
<tr><th scope="row">Formato</th><td>JPG · ${mb(f.bytes)}</td></tr>
<tr><th scope="row">Orientación</th><td>${f.w >= f.h ? 'Horizontal' : 'Vertical'}</td></tr>
<tr><th scope="row">Espacio para texto</th><td>${f.espacio ? 'Sí' : 'No'}</td></tr>
<tr><th scope="row">Licencia</th><td><a href="/licencia/">${sitio.licencia.nombre}</a> · uso comercial permitido</td></tr>
<tr><th scope="row">Origen</th><td>Imagen generada con IA y revisada a mano · <a href="/aviso-ia/">qué significa</a></td></tr>
</tbody></table>
<p class="label">Paleta · toca para copiar</p>
<div class="palette">${f.paleta.slice(0, 5).map((h) => `<button class="swatch" type="button" style="--s:${h}" data-v="${h}" aria-label="Copiar color ${h}"><i></i><span>${h}</span></button>`).join('')}</div>
<p class="label">Etiquetas</p>
<ul class="tags">${f.tags.map((t) => `<li><a href="${tagHref(t)}">${esc(t)}</a></li>`).join('')}</ul>
</div>
</article>
<nav class="pager" aria-label="Otras fotos"><a href="${prev.url}" rel="prev"><span class="mono">← Anterior</span><strong>${esc(prev.titulo)}</strong></a><a href="${next.url}" rel="next"><span class="mono">Siguiente →</span><strong>${esc(next.titulo)}</strong></a></nav>
<section aria-labelledby="h-rel"><div class="section-head"><h2 id="h-rel">Más de ${esc(f.col.nombre)}</h2><a class="mono" href="/coleccion/${f.coleccion}/">Ver colección →</a></div>
<ul class="grid">${[...rel, ...extra].map((x) => card(x)).join('\n')}</ul></section>
</div>`;
  const script = `${SCRIPT_COMUN}document.getElementById('enlace').addEventListener('click',()=>copy(location.href.split('#')[0],'Enlace copiado'));document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>copy(b.dataset.v,'Color '+b.dataset.v+' copiado')));`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'ImageObject', name: f.titulo, description: f.desc, contentUrl: URL + f.dl,
      thumbnailUrl: `${URL}/img/${f.slug}-480.webp`, url: URL + f.url, width: f.w, height: f.h, encodingFormat: 'image/jpeg',
      keywords: f.tags.join(', '), license: sitio.licencia.url, acquireLicensePage: `${URL}/licencia/`, creator: { '@type': 'Organization', name: 'Fondo Blanco', url: URL + '/' },
      isAccessibleForFree: true, digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia', inLanguage: 'es' },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: URL + '/' },
      { '@type': 'ListItem', position: 2, name: f.col.nombre, item: `${URL}/coleccion/${f.coleccion}/` },
      { '@type': 'ListItem', position: 3, name: f.titulo, item: URL + f.url }] },
  ];
  write(`foto/${f.slug}/index.html`, layout({ title: fit(`${f.titulo} — Foto gratis en alta resolución | Fondo Blanco`, fit(`${f.titulo} — Foto gratis | Fondo Blanco`, `${f.titulo} | Fondo Blanco`)), desc: cortar(`${f.desc} Descarga gratis en JPG ${f.w}×${f.h}.`, 165), canon: f.url,
    og: `${URL}/img/og/${f.slug}.jpg`, ogAlt: f.desc, body, script, jsonld, type: 'article',
    // Botón «Ampliar a 4K»: usa el JPG original; si no existe, la versión de 1600 px.
    ext: `<script src="/4k/fb4k.js" defer data-engine="/4k/" data-slug="${f.slug}" data-fallback="/img/${f.slug}-1600.webp"></script>` }));
}

// ---------- colección ----------
function coleccion(c) {
  const sc = seoCol[c.slug] || { texto: [], faqs: [] };
  const otras = colecciones.filter((x) => x.slug !== c.slug);
  const textoHtml = sc.texto.length ? `<section class="prose seo-text" aria-labelledby="h-sobre"><h2 id="h-sobre">Sobre esta colección</h2>${sc.texto.map((t) => `<p>${esc(t)}</p>`).join('')}
<h2>Preguntas frecuentes</h2>${sc.faqs.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}
<h2>Más colecciones</h2><ul>${otras.map((x) => `<li><a href="/coleccion/${x.slug}/">${esc(x.nombre)}</a></li>`).join('')}</ul></section>` : '';
  const body = `<div class="wrap">
<header class="page-head"><nav class="crumbs mono" aria-label="Ruta" style="margin:0"><a href="/">Inicio</a><span aria-hidden="true">/</span><a href="/#colecciones">Colecciones</a></nav>
<h1>${esc(sc.h1 || c.nombre)}</h1><p>${esc(c.desc)}</p></header>
<div class="toolbar" style="margin-top:0"><div class="toolbar-in">
${colecciones.map((x) => `<a class="chip" href="/coleccion/${x.slug}/"${x.slug === c.slug ? ' aria-current="page"' : ''}>${esc(x.nombre)} <small>${x.fotos.length}</small></a>`).join('\n')}
</div></div>
<p class="count mono">${c.fotos.length} fotos</p>
<ul class="grid">${c.fotos.map((f, i) => card(f, { eager: i < 3 })).join('\n')}</ul>
${(() => { const es = etiquetasDe(c.fotos); return es.length ? `<section aria-labelledby="h-busq"><div class="section-head"><h2 id="h-busq">Búsquedas relacionadas</h2><a class="mono" href="/fotos/">Todas las búsquedas →</a></div>${chipsEtiquetas(es)}</section>` : ''; })()}
${textoHtml}
</div>`;
  const jsonld = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: URL + '/' },
      { '@type': 'ListItem', position: 2, name: c.nombre, item: `${URL}/coleccion/${c.slug}/` }] },
    ...(sc.faqs.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: sc.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : []),
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${c.nombre} — Fondo Blanco`, description: c.desc, url: `${URL}/coleccion/${c.slug}/`,
    mainEntity: { '@type': 'ItemList', numberOfItems: c.fotos.length, itemListElement: c.fotos.map((f, i) => ({ '@type': 'ListItem', position: i + 1, url: URL + f.url, name: f.titulo })) } }];
  const tCol = sc.h1 || 'Fotos gratis de ' + c.nombre.toLowerCase();
  write(`coleccion/${c.slug}/index.html`, layout({ title: fit(`${tCol} en alta resolución — Fondo Blanco`, `${tCol} — Fondo Blanco`), desc: cortar(`${c.desc} ${c.fotos.length} fotos en alta resolución para descargar gratis.`, 160),
    canon: `/coleccion/${c.slug}/`, og: `${URL}/img/og/${c.fotos[0].slug}.jpg`, body, jsonld, nav: 'colecciones', script: ROTAR }));
}

// ---------- páginas de texto ----------
function pagina(slug, { title, h1, intro, html, desc, nav, script = '' }) {
  const body = `<div class="wrap"><header class="page-head"><p class="mono" style="color:var(--signal-ink);margin:0">Fondo Blanco</p><h1>${h1}</h1><p>${intro}</p></header><div class="prose">${html}</div></div>`;
  write(`${slug}/index.html`, layout({ title, desc, canon: `/${slug}/`, body, nav, script: script ? SCRIPT_COMUN + script : '' }));
}

function paginas() {
  paginasLegales({ pagina, sitio, HOY });

  const tok = sitio.formToken;
  const form = tok ? `<form class="cform" id="cform" action="https://formsubmit.co/${esc(tok)}" method="POST">
<div class="f"><label for="cn">Nombre</label><input id="cn" name="name" required autocomplete="name" maxlength="80"></div>
<div class="f"><label for="ce">Tu correo (para responderte)</label><input id="ce" name="email" type="email" required autocomplete="email" maxlength="120"></div>
<div class="f"><label for="cm">Motivo</label><select id="cm" name="motivo"><option>Soporte</option><option>Reportar una foto</option><option>Retirar una imagen</option><option>Duda sobre la licencia</option><option>Mis datos personales</option><option>Sugerir fotos</option><option>Otro</option></select></div>
<div class="f"><label for="cx">Mensaje</label><textarea id="cx" name="message" rows="6" required minlength="10" maxlength="3000"></textarea></div>
<input type="text" name="_honey" tabindex="-1" autocomplete="off" style="display:none">
<input type="hidden" name="_subject" value="Mensaje desde fondoblanco.co">
<input type="hidden" name="_template" value="table">
<input type="hidden" name="_next" value="${URL}/contacto/?enviado=1">
<button class="btn primary" type="submit"><span>Enviar mensaje</span></button>
<p class="note" id="cnote" role="status" aria-live="polite"></p>
</form>` : '<div class="callout"><p>El formulario de contacto estará disponible pronto.</p></div>';
  const formScript = `(()=>{const f=document.getElementById('cform'),n=document.getElementById('cnote');if(!f)return;if(location.search.includes('enviado=1')){n.textContent='¡Gracias! Recibimos tu mensaje y te responderemos pronto.'}
f.addEventListener('submit',async e=>{e.preventDefault();const b=f.querySelector('button');b.disabled=true;n.textContent='Enviando…';try{const r=await fetch('https://formsubmit.co/ajax/${tok}',{method:'POST',headers:{Accept:'application/json'},body:new FormData(f)});const d=await r.json();if(d.success==='true'||d.success===true){f.reset();n.textContent='¡Gracias! Recibimos tu mensaje y te responderemos pronto.'}else throw 0}catch(_){n.textContent='No se pudo enviar. Inténtalo de nuevo en un momento.'}b.disabled=false})})();`;
  pagina('contacto', {
    title: 'Contacto y soporte — Fondo Blanco', h1: 'Contacto y soporte', nav: 'contacto', script: tok ? formScript : '',
    desc: 'Escríbenos para pedir soporte, reportar una foto, sugerir imágenes o preguntar por la licencia de Fondo Blanco.',
    intro: '¿Necesitas ayuda, encontraste un error o tienes una duda sobre la licencia? Escríbenos y te respondemos.',
    html: `${form}<h2>Antes de escribir</h2><ul><li>Para dudas de uso, revisa primero la <a href="/licencia/">licencia</a>.</li><li>Si reportas una foto o pides retirarla, incluye su código (por ejemplo <code>FB-001</code>) y el motivo. Revisamos cada solicitud y, si corresponde, la retiramos lo antes posible.</li><li>Para consultar, corregir o borrar tus datos personales, elige el motivo «Mis datos personales».</li></ul>` });

  write('404.html', layout({ title: 'Página no encontrada — Fondo Blanco', desc: 'Esta página no existe.', canon: '/404.html', noindex: true,
    body: `<div class="wrap"><header class="page-head"><p class="mono" style="color:var(--signal-ink);margin:0">Error 404</p><h1>Fuera de cuadro</h1><p>Esta página no existe o cambió de lugar. Las fotos del sitio anterior se reorganizaron en colecciones nuevas.</p></header>
<div class="prose"><p><a class="btn ghost" href="/">Ver todas las fotos</a></p></div>
<div class="section-head"><h2>Colecciones</h2></div><div class="strip">${colecciones.map((c) => `<a href="/coleccion/${c.slug}/"><figure class="print" style="--c:${c.fotos[0].color}">${picture(c.fotos[0], { widths: [480, 960], sizes: '240px' })}</figure><h3>${esc(c.nombre)}</h3></a>`).join('')}</div></div>` }));
}

// ---------- Ampliar imagen (herramienta para imágenes propias) ----------
// El motor corre en el navegador (Real-ESRGAN con ONNX Runtime Web) desde /4k/. Ver 4k/ampliar.js.
function ampliar() {
  const radio = (name, id, val, label, on) => `<input type="radio" name="${name}" id="${id}" value="${val}"${on ? ' checked' : ''}><label for="${id}">${label}</label>`;
  const body = `<div class="wrap">
<header class="page-head"><p class="mono" style="color:var(--signal-ink);margin:0">Herramienta gratis</p><h1>Ampliar imagen</h1><p>¿Tienes una imagen pequeña o borrosa? Súbela y aumenta su resolución y su nitidez con inteligencia artificial, hasta 4 veces. Todo ocurre en tu equipo: tu imagen no se sube a ningún servidor.</p></header>
<section class="amp" aria-label="Ampliador de imágenes">
<div class="amp-stage" id="stage">
<div class="amp-drop" id="drop" tabindex="0" role="button" aria-label="Elegir una imagen"><div>
<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 34V12M14 21l10-10 10 10M8 38h32"/></svg>
<p class="amp-big">Suelta tu imagen aquí</p><p>o toca para elegir un archivo. También puedes pegarla con Ctrl+V.</p><span class="mono">JPG · PNG · WebP · hasta 25 MB</span><p class="amp-legal">Usa solo imágenes que tengas derecho a modificar. El resultado lo genera una IA y se ofrece sin garantías. <a href="/terminos/">Términos</a></p></div></div>
<div class="amp-view" id="view" hidden><div class="amp-cmp" id="cmp">
<img id="imgBefore" alt="Imagen original"><div class="amp-after" id="afterWrap" hidden><img id="imgAfter" alt="Imagen ampliada"></div>
<div class="amp-bar" id="bar" hidden></div><div class="amp-knob" id="knob" hidden>↔</div>
<span class="amp-tag" id="tagL">Original</span><span class="amp-tag r" id="tagR" hidden>Ampliada</span>
<input type="range" id="slider" min="0" max="100" value="50" aria-label="Comparar original y ampliada" hidden></div></div>
<div class="amp-working" id="working" hidden role="status" aria-live="polite"><div class="amp-wbox">
<div class="amp-pct" id="pct">0%</div><div class="amp-progress"><i id="bar2"></i></div><p id="stageTxt">Preparando…</p><p class="mono" id="eta"></p><button class="btn ghost" type="button" id="cancel">Cancelar</button></div></div>
</div>
<aside class="amp-panel" aria-label="Ajustes">
<div class="amp-engine" id="engine"><i></i><span id="engineTxt">Detectando equipo…</span></div>
<div class="amp-field"><p class="label">Tamaño final</p><div class="amp-seg" role="radiogroup" aria-label="Escala">${radio('scale', 's2', 2, '2×')}${radio('scale', 's3', 3, '3×')}${radio('scale', 's4', 4, '4×', true)}</div><p class="amp-hint" id="sizeHint">Elige una imagen para ver el tamaño resultante.</p></div>
<div class="amp-field"><label class="label" for="sharp">Nitidez final <output id="sharpOut">20</output></label><input class="amp-range" type="range" id="sharp" min="0" max="100" value="20"><p class="amp-hint">Un toque suave de enfoque. Súbelo solo si la imagen sigue viéndose blanda.</p></div>
<div class="amp-field"><p class="label">Formato</p><div class="amp-seg" role="radiogroup" aria-label="Formato">${radio('fmt', 'fj', 'jpg', 'JPG', true)}${radio('fmt', 'fw', 'webp', 'WebP')}${radio('fmt', 'fp', 'png', 'PNG')}</div></div>
<div class="amp-field" id="qField"><label class="label" for="qual">Calidad <output id="qualOut">92</output></label><input class="amp-range" type="range" id="qual" min="60" max="100" value="92"></div>
<p class="amp-note" id="note" hidden></p>
<div class="amp-row"><button class="btn primary" id="go" type="button" disabled>Ampliar imagen</button><a class="btn primary" id="dl" hidden download>Descargar resultado</a><button class="btn ghost" id="again" type="button" hidden>Elegir otra imagen</button></div>
<div class="amp-meta" id="meta" hidden></div>
</aside>
<noscript><p class="amp-note">Para ampliar imágenes necesitas activar JavaScript en tu navegador.</p></noscript>
</section>
<div class="steps">
<div><div class="num">01</div><h3>Elige</h3><p>Arrastra o pega una imagen. Funciona mejor con imágenes pequeñas, borrosas o con compresión visible.</p></div>
<div><div class="num">02</div><h3>Amplía</h3><p>Una red neuronal (Real-ESRGAN) reconstruye detalle y bordes. Se ejecuta en la tarjeta gráfica de tu equipo.</p></div>
<div><div class="num">03</div><h3>Compara y descarga</h3><p>Desliza la barra para ver el antes y el después. Descarga en JPG, WebP o PNG, sin marcas de agua.</p></div>
</div>
<div class="prose seo-text"><h2>Preguntas frecuentes</h2>
<h3>¿Se sube mi imagen a algún servidor?</h3><p>No. El modelo se descarga una sola vez a tu navegador y la imagen se procesa en tu propio equipo. Nada sale de tu dispositivo.</p>
<h3>¿Por qué a veces tarda?</h3><p>Con una tarjeta gráfica compatible con WebGPU tarda segundos o pocos minutos. Si tu navegador no la tiene, usa el procesador y puede tardar bastante más. Verás el avance y el tiempo estimado, y puedes cancelar.</p>
<h3>¿Qué tamaño máximo admite?</h3><p>Hasta unos 2,2 megapíxeles de entrada (por ejemplo 1500×1500 px). Si tu imagen es más grande se reduce antes de ampliar, porque ampliar algo ya grande no aporta detalle nuevo.</p>
<h3>¿Inventa detalles?</h3><p>La IA reconstruye texturas plausibles, no recupera información perdida. Funciona muy bien en paisajes, objetos y fotos de stock; en rostros pequeños o texto muy borroso puede dar resultados irregulares.</p>
<h3>¿Tiene costo?</h3><p>No, es gratis y no necesitas registrarte. Al usarla aceptas los <a href="/terminos/">Términos de uso</a>.</p></div>
</div>`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Ampliar imagen — Fondo Blanco', url: `${URL}/ampliar/`, applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Cualquiera con navegador moderno', inLanguage: 'es', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'COP' },
      description: 'Amplía y mejora la resolución de tus imágenes con inteligencia artificial, gratis y sin subir nada: todo ocurre en tu navegador.' },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Ampliar imagen', item: `${URL}/ampliar/` }] },
  ];
  write('ampliar/index.html', layout({ title: 'Ampliar imagen con IA gratis — Fondo Blanco', canon: '/ampliar/', nav: 'ampliar', body, jsonld,
    desc: 'Amplía y mejora la calidad de tus imágenes hasta 4 veces con inteligencia artificial. Gratis, sin registro y sin subir nada: todo ocurre en tu navegador.',
    ext: '<script src="/4k/ampliar.js" defer data-engine="/4k/"></script>' }));
}

// ---------- quitar fondo (/quitar-fondo/) ----------
// U²-Netp (Apache-2.0) en el navegador con ONNX Runtime Web. La lógica está en 4k/quitar.js (se sirve tal cual).
function quitarFondo() {
  const radio = (name, id, val, label, on) => `<input type="radio" name="${name}" id="${id}" value="${val}"${on ? ' checked' : ''}><label for="${id}">${label}</label>`;
  const faqs = [
    ['¿Con qué imágenes funciona?', 'Solo está pensada para imágenes sencillas: un producto, objeto o plato fotografiado sobre un fondo de un solo color, como el blanco. Con fondos complejos, escenas cargadas, vidrio, pelo muy fino o personas el recorte puede salir incompleto. Si el objeto es del mismo color que el fondo (por ejemplo, blanco sobre blanco) pueden quedar restos claros; prueba los controles de sensibilidad y suavidad.'],
    ['¿Se sube mi imagen a algún servidor?', 'No. El modelo (4 MB) se descarga una sola vez a tu navegador y la imagen se procesa en tu propio equipo. Nada sale de tu dispositivo.'],
    ['¿Qué tamaño máximo admite?', 'Hasta 25 MB. Si el lado mayor pasa de 2000 px se reduce antes de procesar, para que funcione bien en cualquier equipo.'],
    ['¿Qué formato descargo?', 'PNG con fondo transparente, o con el color de fondo que elijas. Sin marcas de agua.'],
    ['¿Tiene costo?', 'No, es gratis y no necesitas registrarte. Al usarla aceptas los <a href="/terminos/">Términos de uso</a>.'],
  ];
  const body = `<div class="wrap">
<header class="page-head"><p class="mono" style="color:var(--signal-ink);margin:0">Herramienta gratis</p><h1>Quitar fondo</h1><p>Sube una imagen y descarga el recorte con fondo transparente. <strong>Solo para imágenes sencillas: un objeto sobre un fondo de un solo color, como el blanco.</strong> Todo ocurre en tu equipo: tu imagen no se sube a ningún servidor.</p></header>
<section class="amp" aria-label="Quitar fondo de imágenes">
<div class="amp-stage" id="stage">
<div class="amp-drop" id="drop" tabindex="0" role="button" aria-label="Elegir una imagen"><div>
<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 34V12M14 21l10-10 10 10M8 38h32"/></svg>
<p class="amp-big">Suelta tu imagen aquí</p><p>o toca para elegir un archivo. También puedes pegarla con Ctrl+V.</p><span class="mono">JPG · PNG · WebP · hasta 25 MB</span>
<p class="amp-legal"><strong>Solo para imágenes sencillas, con fondo de un solo color como el blanco.</strong> Con fondos complejos, escenas cargadas o personas puede fallar.</p>
<p class="amp-legal">Usa solo imágenes que tengas derecho a modificar. El resultado lo genera una IA y se ofrece sin garantías. <a href="/terminos/">Términos</a></p></div></div>
<div class="amp-view" id="view" hidden><canvas id="lienzo" class="qf-canvas" role="img" aria-label="Imagen con el fondo quitado"></canvas></div>
<div class="amp-working" id="working" hidden role="status" aria-live="polite"><div class="amp-wbox">
<div class="amp-pct" id="pct">0%</div><div class="amp-progress"><i id="bar2"></i></div><p id="stageTxt">Preparando…</p></div></div>
</div>
<aside class="amp-panel" aria-label="Ajustes">
<div class="amp-field"><p class="label">Fondo del resultado</p><div class="amp-seg" role="radiogroup" aria-label="Fondo">${radio('bg', 'bt', 'transparent', 'Transparente', true)}${radio('bg', 'bw', 'white', 'Blanco')}${radio('bg', 'bc', 'color', 'Color')}</div><p class="amp-hint"><input type="color" id="bgcolor" value="#ffffff" disabled aria-label="Color de fondo"> Elige «Color» para usar otro fondo.</p></div>
<div class="amp-field"><label class="label" for="sens">Sensibilidad <output id="sensOut">50</output></label><input class="amp-range" type="range" id="sens" min="0" max="100" value="50"><p class="amp-hint">Súbela si el recorte se comió partes del objeto; bájala si quedan restos de fondo.</p></div>
<div class="amp-field"><label class="label" for="soft">Suavidad del borde <output id="softOut">35</output></label><input class="amp-range" type="range" id="soft" min="0" max="100" value="35"></div>
<div class="amp-field"><label class="qf-check"><input type="checkbox" id="refine" checked> Afinar los bordes con la foto</label></div>
<p class="amp-note" id="note" hidden></p>
<div class="amp-row"><button class="btn primary" id="go" type="button" disabled>Quitar fondo</button><a class="btn primary" id="dl" href="#" hidden>Descargar PNG</a><button class="btn ghost" id="orig" type="button" hidden>Mantén pulsado para ver el original</button><button class="btn ghost" id="again" type="button" hidden>Elegir otra imagen</button></div>
<div class="amp-meta" id="meta" hidden></div>
</aside>
<noscript><p class="amp-note">Para quitar el fondo necesitas activar JavaScript en tu navegador.</p></noscript>
</section>
<div class="steps">
<div><div class="num">01</div><h3>Elige</h3><p>Arrastra o pega una imagen sencilla, con un fondo liso: por ejemplo, un producto sobre blanco.</p></div>
<div><div class="num">02</div><h3>Quita el fondo</h3><p>Una red neuronal (U²-Net) separa el objeto del fondo y afina el borde con la propia foto. Se ejecuta en tu navegador, en unos segundos.</p></div>
<div><div class="num">03</div><h3>Ajusta y descarga</h3><p>Corrige con los controles, elige el fondo que quieras y descarga el PNG, sin marcas de agua.</p></div>
</div>
<div class="prose seo-text"><h2>Preguntas frecuentes</h2>
${faqs.map(([q, a]) => `<h3>${q}</h3><p>${a}</p>`).join('\n')}</div>
</div>`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Quitar fondo — Fondo Blanco', url: `${URL}/quitar-fondo/`, applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Cualquiera con navegador moderno', inLanguage: 'es', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'COP' },
      description: 'Quita el fondo de imágenes sencillas, con un objeto sobre un fondo de un solo color, con inteligencia artificial, gratis y sin subir nada: todo ocurre en tu navegador.' },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Quitar fondo', item: `${URL}/quitar-fondo/` }] },
  ];
  write('quitar-fondo/index.html', layout({ title: 'Quitar fondo de imágenes gratis — Fondo Blanco', canon: '/quitar-fondo/', nav: 'quitar', body, jsonld,
    desc: 'Quita el fondo de imágenes sencillas, con un objeto sobre fondo liso como el blanco, y descarga un PNG transparente. Gratis, sin registro y sin subir nada.',
    ext: '<script src="/4k/quitar.js" defer data-engine="/4k/"></script>' }));
}

// ---------- redirecciones del sitio anterior ----------
// Fotos cuya dirección cambió (slug antiguo → nuevo). El enlace viejo sigue funcionando.
const FOTOS_MOVIDAS = { 'mujer-esperando-el-metro-en-andén': 'mujer-esperando-el-metro-en-anden' };
function redirecciones() {
  for (const [viejo, nuevo] of Object.entries(FOTOS_MOVIDAS)) {
    write(`foto/${viejo}/index.html`, `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Fondo Blanco</title><meta name="robots" content="noindex,follow"><link rel="canonical" href="${URL}/foto/${nuevo}/"><meta http-equiv="refresh" content="0; url=/foto/${nuevo}/"></head><body><p>Esta foto cambió de dirección. <a href="/foto/${nuevo}/">Ir a la foto</a>.</p></body></html>`);
  }
  // Las antiguas /textura/ no tienen una foto equivalente identificable, así que van a la colección
  // más parecida (frutas → gastronomía; el resto → fondos y texturas), no a la portada.
  const FRUTA = /fruta|naranja|mango|pina|platano|manzana|fresa|limon|kiwi|uva|sandia|aguacate|cereza|mandarina|akebi|arandano|coco|toronja|jabuticaba|lulo|rambutan|pitahaya|dragon|achachairu|melon|surtido|composicion|tres-platanos/;
  for (const s of legado) {
    const destino = FRUTA.test(s) ? '/coleccion/gastronomia/' : '/coleccion/fondos/';
    write(`textura/${s}/index.html`, `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Fondo Blanco</title><meta name="robots" content="noindex,follow"><link rel="canonical" href="${URL}${destino}"><meta http-equiv="refresh" content="0; url=${destino}"></head><body><p>Esta página se movió. <a href="${destino}">Ver la colección</a>.</p></body></html>`);
  }
}

// ---------- generador de banners (/banner/) ----------
// Todo corre en el navegador: la imagen nunca sale del equipo. Sin dependencias.
const BANNER_JS = String.raw`(()=>{
const $=s=>document.querySelector(s);
const cv=$('#lienzo'),ctx=cv.getContext('2d');
const FORMATOS=[['Post cuadrado (Instagram, Facebook)',1080,1080],['Historia o Reel (vertical)',1080,1920],['Pin de Pinterest',1000,1500],['Miniatura de YouTube',1280,720],['Web o enlace compartido',1200,630],['Presentación (16:9)',1920,1080]];
const sel=$('#formato');
FORMATOS.forEach((f,i)=>{const o=document.createElement('option');o.value=i;o.textContent=f[0]+' · '+f[1]+'×'+f[2];sel.appendChild(o)});
let img=null;
const aviso=t=>{$('#aviso').textContent=t||''};
function cargar(src){const i=new Image();i.onload=()=>{img=i;aviso('');dibujar()};i.onerror=()=>aviso('No pude abrir esa imagen. Prueba con JPG, PNG o WebP.');i.src=src}
function lineas(txt,maxW){const out=[];String(txt).split('\n').forEach(p=>{let l='';p.split(' ').forEach(w=>{const t=l?l+' '+w:w;if(l&&ctx.measureText(t).width>maxW){out.push(l);l=w}else l=t});if(l)out.push(l)});return out}
function dibujar(){
  const [,W,H]=FORMATOS[sel.value];cv.width=W;cv.height=H;
  ctx.fillStyle='#fafaf7';ctx.fillRect(0,0,W,H);
  if(!img){ctx.fillStyle='#55554f';ctx.font='400 '+Math.round(W*0.03)+'px Arial, sans-serif';ctx.textAlign='center';ctx.fillText('Carga una imagen para empezar',W/2,H/2);return}
  const esc=Math.max(W/img.width,H/img.height),sw=W/esc,sh=H/esc;
  const sx=(img.width-sw)*$('#fx').value/100,sy=(img.height-sh)*$('#fy').value/100;
  ctx.drawImage(img,sx,sy,sw,sh,0,0,W,H);
  const claro=$('#color').value==='claro';
  if($('#velo').checked){const g=ctx.createLinearGradient(0,0,0,H);const c=claro?'0,0,0':'255,255,255';g.addColorStop(0,'rgba('+c+',0)');g.addColorStop(0.45,'rgba('+c+',0.18)');g.addColorStop(1,'rgba('+c+',0.5)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
  const ink=claro?'#fafaf7':'#151513';
  const t=$('#titulo').value.trim(),s=$('#sub').value.trim(),m=Math.min(W,H);
  ctx.textAlign='left';ctx.textBaseline='top';
  if(t||s){
    const x=W*0.08,maxW=W*0.84;
    const fT=Math.round(m*0.085),fS=Math.round(m*0.042),gap=Math.round(fT*0.3);
    ctx.font='900 '+fT+'px "Archivo Black", "Arial Black", Arial, sans-serif';
    const lt=t?lineas(t,maxW):[];
    ctx.font='400 '+fS+'px Arial, sans-serif';
    const ls=s?lineas(s,maxW):[];
    const alto=lt.length*fT*1.05+(ls.length?gap+ls.length*fS*1.3:0);
    let y=$('#pos').value==='arriba'?H*0.1:$('#pos').value==='centro'?(H-alto)/2:H*0.9-alto;
    ctx.fillStyle=ink;
    ctx.font='900 '+fT+'px "Archivo Black", "Arial Black", Arial, sans-serif';
    lt.forEach(l=>{ctx.fillText(l,x,y);y+=fT*1.05});
    if(ls.length){y+=gap;ctx.font='400 '+fS+'px Arial, sans-serif';ls.forEach(l=>{ctx.fillText(l,x,y);y+=fS*1.3})}
  }
}
sel.addEventListener('change',dibujar);
document.querySelectorAll('input,select,textarea').forEach(e=>e.addEventListener('input',dibujar));
$('#archivo').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;if(f.size>25*1024*1024){aviso('La imagen pesa más de 25 MB.');return}cargar(URL.createObjectURL(f))});
$('#bajar').addEventListener('click',()=>{if(!img){aviso('Primero carga una imagen.');return}const [n,W,H]=FORMATOS[sel.value];cv.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='fondo-blanco-banner-'+W+'x'+H+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)},'image/png')});
const q=new URLSearchParams(location.search);
if(q.get('foto')&&/^[a-z0-9-]+$/.test(q.get('foto')))cargar('/descargas/fondo-blanco-'+q.get('foto')+'.jpg');
dibujar();
if(document.fonts&&document.fonts.load)document.fonts.load('900 40px "Archivo Black"').then(dibujar,()=>{});
})();`;
function bannerPage() {
  const body = `<div class="wrap">
<header class="page-head"><nav class="crumbs mono" aria-label="Ruta" style="margin:0"><a href="/">Inicio</a><span aria-hidden="true">/</span><span aria-current="page">Hacer un banner</span></nav>
<h1>Haz un banner con tus fotos</h1><p>Elige el formato, escribe el título y descarga el PNG listo para publicar. Todo se hace en tu navegador: tu imagen no se sube a ningún servidor.</p></header>
<div class="banner-grid">
<form class="banner-panel" onsubmit="return false">
<p class="label">1 · Imagen</p>
<p class="banner-help">Usa una foto de Fondo Blanco (desde su ficha, con «Hacer un banner») o la tuya.</p>
<label class="btn ghost banner-file"><span>Cargar mi imagen</span><input id="archivo" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
<label>Formato<select id="formato"></select></label>
<p class="label">2 · Texto</p>
<label>Título<textarea id="titulo" rows="2" maxlength="90" placeholder="Escribe el título"></textarea></label>
<label>Subtítulo<input id="sub" type="text" maxlength="120" placeholder="Opcional"></label>
<label>Color del texto<select id="color"><option value="claro">Claro</option><option value="oscuro">Oscuro</option></select></label>
<label>Posición del texto<select id="pos"><option value="abajo">Abajo</option><option value="centro">Centro</option><option value="arriba">Arriba</option></select></label>
<label class="check"><input id="velo" type="checkbox" checked> Velo suave para leer mejor el texto</label>
<label>Encuadre horizontal<input id="fx" type="range" min="0" max="100" value="50"></label>
<label>Encuadre vertical<input id="fy" type="range" min="0" max="100" value="50"></label>
<button class="btn primary" id="bajar" type="button">Descargar PNG</button>
<p id="aviso" class="mono" role="status" aria-live="polite"></p>
</form>
<div class="banner-vista"><canvas id="lienzo" role="img" aria-label="Vista previa del banner"></canvas></div>
</div>
</div>`;
  write('banner/index.html', layout({ title: 'Hacer un banner con tus fotos gratis — Fondo Blanco', desc: 'Crea banners para redes, Pinterest, YouTube y presentaciones con fotos de Fondo Blanco. Recorta, añade texto y descarga en PNG. Gratis y sin registro.', canon: '/banner/', body, script: BANNER_JS }));
}

// ---------- asistente de preguntas frecuentes (widget en todas las páginas) ----------
// Sin servidor ni IA generativa: busca la respuesta preparada más parecida (ver _build/asistente-cliente.js).
// Preguntas y respuestas: _src/asistente.json. Aquí se les inyectan datos reales del sitio y se escribe /asistente.js.
function asistente() {
  const cfg = read('_src/asistente.json');
  const lista = colecciones.map((c) => `[${c.nombre}](/coleccion/${c.slug}/) (${c.fotos.length})`).join(', ');
  const ancho = Math.max(...fotos.map((f) => f.w));
  const rellenar = (t) => t.replaceAll('{{total}}', fotos.length).replaceAll('{{ncol}}', colecciones.length).replaceAll('{{colecciones}}', lista).replaceAll('{{ancho}}', ancho);
  const datos = {
    entradas: cfg.entradas.map((e) => ({ id: e.id, t: e.t, p: e.p || [], k: e.k || [], r: rellenar(e.r) })),
    saludos: cfg.saludos,
    sugeridas: ['gratis', 'comercial', 'ia', 'quitar', 'banner'],
    colecciones: colecciones.map((c) => ({ n: c.nombre, u: `/coleccion/${c.slug}/`, c: c.fotos.length })),
    etiquetas: etiquetas.map((e) => ({ n: e.nombre, u: e.url, c: e.fotos.length })),
  };
  const ids = new Set(datos.entradas.map((e) => e.id));
  for (const s of datos.sugeridas) if (!ids.has(s)) throw new Error('asistente.json: falta la entrada sugerida «' + s + '»');
  const js = 'window.__FBA=' + JSON.stringify(datos) + ';\n' + fs.readFileSync(path.join(ROOT, '_build/asistente-cliente.js'), 'utf8');
  write('asistente.js', js);
  ASIS_V = crypto.createHash('sha1').update(js).digest('hex').slice(0, 8);
}

// ---------- páginas de etiqueta (/fotos/<etiqueta>/) e índice (/fotos/) ----------
function etiqueta(e) {
  const n = e.fotos.length;
  const cols = [...new Set(e.fotos.map((f) => f.col))];
  const conEsp = e.fotos.filter((f) => f.espacio).length;
  const rel = etiquetasDe(e.fotos, { excluir: e.slug, max: 14 });
  const intro = `${n} fotos gratis de ${e.nombre} en alta resolución para tu web, tus redes sociales o tus presentaciones. Se descargan en JPG sin registro y sin marcas de agua, de uso libre, personal y comercial.`;
  const enCols = `Están en ${cols.length === 1 ? 'la colección' : 'las colecciones'} ${lista(cols.map((c) => `<a href="/coleccion/${c.slug}/">${esc(c.nombre.toLowerCase())}</a>`))}.`;
  const esp = conEsp ? ` ${conEsp === n ? 'Todas tienen' : `${conEsp} de ellas tienen`} espacio libre para añadir texto.` : '';
  const body = `<div class="wrap">
<header class="page-head"><nav class="crumbs mono" aria-label="Ruta" style="margin:0"><a href="/">Inicio</a><span aria-hidden="true">/</span><a href="/fotos/">Búsquedas</a></nav>
<h1>${esc(cap(e.nombre))}: fotos gratis</h1><p>${esc(intro)}</p></header>
<p class="count mono">${n} fotos</p>
<ul class="grid">${e.fotos.map((f, i) => card(f, { eager: i < 3 })).join('\n')}</ul>
${rel.length ? `<section aria-labelledby="h-rel"><div class="section-head"><h2 id="h-rel">Búsquedas relacionadas</h2><a class="mono" href="/fotos/">Todas las búsquedas →</a></div>${chipsEtiquetas(rel)}</section>` : ''}
<section class="prose seo-text" aria-labelledby="h-sobre"><h2 id="h-sobre">Sobre estas fotos de ${esc(e.nombre)}</h2><p>${enCols}${esp}</p><p>Todas están generadas con inteligencia artificial y revisadas una a una; <a href="/aviso-ia/">lee el aviso</a> antes de usarlas en piezas sensibles.</p></section>
</div>`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Búsquedas', item: `${URL}/fotos/` },
      { '@type': 'ListItem', position: 3, name: cap(e.nombre), item: URL + e.url }] },
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${cap(e.nombre)}: fotos gratis — Fondo Blanco`, description: intro, url: URL + e.url, inLanguage: 'es',
      mainEntity: { '@type': 'ItemList', numberOfItems: n, itemListElement: e.fotos.map((f, i) => ({ '@type': 'ListItem', position: i + 1, url: URL + f.url, name: f.titulo })) } },
  ];
  write(`fotos/${e.slug}/index.html`, layout({
    title: fit(`${cap(e.nombre)}: fotos gratis en alta resolución | Fondo Blanco`, fit(`${cap(e.nombre)}: fotos gratis | Fondo Blanco`, `${cap(e.nombre)} — Fondo Blanco`)),
    desc: cortar(`${n} fotos de ${e.nombre} gratis en alta resolución. Descarga en JPG sin registro ni marcas de agua, de uso libre, también comercial.`, 160),
    canon: e.url, og: `${URL}/img/og/${e.fotos[0].slug}.jpg`, ogAlt: e.fotos[0].desc, body, jsonld, nav: 'colecciones' }));
}

function indiceEtiquetas() {
  const porLetra = new Map();
  for (const e of [...etiquetas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))) {
    const l = norm(e.nombre).charAt(0).toUpperCase();
    if (!porLetra.has(l)) porLetra.set(l, []);
    porLetra.get(l).push(e);
  }
  const body = `<div class="wrap">
<header class="page-head"><nav class="crumbs mono" aria-label="Ruta" style="margin:0"><a href="/">Inicio</a></nav>
<h1>Búsquedas populares</h1><p>Las ${etiquetas.length} búsquedas con más fotos en Fondo Blanco. Cada una reúne fotos gratis en alta resolución de varias colecciones.</p></header>
<section aria-labelledby="h-top"><div class="section-head"><h2 id="h-top">Las más buscadas</h2></div>${chipsEtiquetas(etiquetas.slice(0, 24))}</section>
<section aria-labelledby="h-az"><div class="section-head"><h2 id="h-az">De la A a la Z</h2></div>
${[...porLetra.entries()].map(([l, es]) => `<h3 class="mono">${l}</h3>${chipsEtiquetas(es)}`).join('\n')}</section>
</div>`;
  write('fotos/index.html', layout({ title: 'Búsquedas populares: fotos gratis por tema — Fondo Blanco',
    desc: cortar(`Encuentra fotos gratis por tema: ${etiquetas.slice(0, 8).map((e) => e.nombre).join(', ')} y más. ${etiquetas.length} búsquedas en alta resolución.`, 160),
    canon: '/fotos/', body, nav: 'colecciones',
    jsonld: [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Búsquedas', item: `${URL}/fotos/` }] }] }));
}

// ---------- Pinterest: pines verticales (/pin/<slug>.jpg) y feed RSS (/feed.xml) ----------
// Pinterest recomienda 2:3 (1000×1500). Foto arriba (recorte por zona de interés) y una franja con la marca y el título.
// Solo se generan los pines que faltan. En Pinterest Business: Ajustes → Publicación automática → feed https://fondoblanco.co/feed.xml
const PIN_W = 1000, PIN_H = 1500, PIN_FOTO = 1130;
function lineas(texto, max) {
  const out = [];
  for (const w of texto.split(/\s+/)) {
    const ult = out[out.length - 1];
    if (ult && (ult + ' ' + w).length <= max) out[out.length - 1] = ult + ' ' + w; else out.push(w);
  }
  return out;
}
async function pines() {
  fs.mkdirSync(path.join(ROOT, 'pin'), { recursive: true });
  let nuevos = 0;
  for (const f of fotos) {
    const out = path.join(ROOT, 'pin', `${f.slug}.jpg`);
    if (fs.existsSync(out)) continue;
    let size = 58, max = 24, ls = lineas(f.titulo, max);
    if (ls.length > 3) { size = 48; max = 30; ls = lineas(f.titulo, max); }
    if (ls.length > 3) ls = [...ls.slice(0, 2), cortar(ls.slice(2).join(' '), max)];
    const alto = PIN_H - PIN_FOTO, lh = Math.round(size * 1.12);
    const y0 = Math.round(96 + (3 - ls.length) * lh * 0.5);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_W}" height="${alto}"><rect width="${PIN_W}" height="${alto}" fill="#fafaf7"/>
<rect width="${PIN_W}" height="6" fill="#e5341d"/>
<g transform="translate(64,40)" fill="none" stroke="#e5341d" stroke-width="3"><circle cx="16" cy="16" r="9"/><path d="M16 2v28M2 16h28"/></g><circle cx="80" cy="56" r="3.2" fill="#e5341d"/>
<text x="112" y="66" font-family="Courier New, monospace" font-size="24" letter-spacing="3" fill="#55554f">FONDO BLANCO · FOTO GRATIS</text>
${ls.map((l, i) => `<text x="64" y="${y0 + 40 + i * lh}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${size}" fill="#151513">${esc(l)}</text>`).join('\n')}
<text x="64" y="${alto - 44}" font-family="Arial, sans-serif" font-size="27" fill="#55554f">Descarga gratis en alta resolución · fondoblanco.co</text></svg>`;
    // Se lee con fs (admite rutas largas en Windows) y se pasa el buffer a sharp
    const foto = await sharp(fs.readFileSync(path.join(ROOT, 'img', `${f.slug}-1600.webp`))).resize(PIN_W, PIN_FOTO, { fit: 'cover', position: sharp.strategy.attention }).toBuffer();
    await sharp({ create: { width: PIN_W, height: PIN_H, channels: 3, background: '#fafaf7' } })
      .composite([{ input: foto, left: 0, top: 0 }, { input: Buffer.from(svg), left: 0, top: PIN_FOTO }])
      .jpeg({ quality: 82, mozjpeg: true }).toFile(out);
    nuevos++;
  }
  return nuevos;
}
function feed() {
  // Las fotos más nuevas primero (las últimas de fotos.json). Pinterest toma las entradas nuevas del feed.
  const items = [...fotos].reverse().map((f) => {
    const pin = path.join(ROOT, 'pin', `${f.slug}.jpg`);
    const len = fs.existsSync(pin) ? fs.statSync(pin).size : 0;
    const tags = f.tags.map((t) => `<category>${esc(t)}</category>`).join('');
    return `<item><title>${esc(`${f.titulo} — foto gratis`)}</title><link>${URL}${f.url}</link><guid isPermaLink="true">${URL}${f.url}</guid>
<description>${esc(`${f.desc} Descarga gratis en alta resolución, de uso libre.`)}</description>${tags}
<enclosure url="${URL}/pin/${f.slug}.jpg" length="${len}" type="image/jpeg"/><media:content url="${URL}/pin/${f.slug}.jpg" medium="image" type="image/jpeg" width="${PIN_W}" height="${PIN_H}"/></item>`;
  });
  write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel><title>Fondo Blanco — Fotos de stock gratis</title><link>${URL}/</link><description>Fotos de stock gratis en alta resolución.</description><language>es</language>
<atom:link href="${URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items.join('\n')}
</channel></rss>
`);
}

// ---------- SEO: sitemap, robots, manifest ----------
// Fecha real de la última confirmación de cada archivo (git). Lo que no está confirmado usa la fecha de hoy.
// Así el sitemap solo marca como cambiada una página cuando de verdad cambió.
const FECHAS_GIT = (() => {
  const m = new Map();
  try {
    const out = execSync('git log --format=@@%cs --name-only', { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    let fecha = null;
    for (const linea of out.split('\n')) {
      if (linea.startsWith('@@')) { fecha = linea.slice(2); continue; }
      if (linea && fecha && !m.has(linea)) m.set(linea, fecha);
    }
  } catch { /* sin git: se usa HOY */ }
  return m;
})();
const fechaDe = (loc) => FECHAS_GIT.get(loc === '/' ? 'index.html' : `${loc.replace(/^\//, '').replace(/\/$/, '')}/index.html`) || HOY;

function seo() {
  const urls = [
    { loc: '/', pr: '1.0' },
    { loc: '/banner/', pr: '0.6' },
    ...colecciones.map((c) => ({ loc: `/coleccion/${c.slug}/`, pr: '0.8' })),
    { loc: '/fotos/', pr: '0.7' },
    ...etiquetas.map((e) => ({ loc: e.url, pr: '0.7' })),
    ...fotos.map((f) => ({ loc: f.url, pr: '0.7', img: f })),
    { loc: '/ampliar/', pr: '0.6' }, { loc: '/quitar-fondo/', pr: '0.6' }, { loc: '/licencia/', pr: '0.4' }, { loc: '/contacto/', pr: '0.3' }, { loc: '/terminos/', pr: '0.2' }, { loc: '/aviso-ia/', pr: '0.2' }, { loc: '/privacidad/', pr: '0.2' },
  ];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map((u) => `<url><loc>${URL}${u.loc}</loc><lastmod>${fechaDe(u.loc)}</lastmod><priority>${u.pr}</priority>${u.img ? `<image:image><image:loc>${URL}${u.img.dl}</image:loc></image:image>` : ''}</url>`).join('\n')}
</urlset>
`);
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${URL}/sitemap.xml\n`);
  write('manifest.webmanifest', JSON.stringify({ name: 'Fondo Blanco', short_name: 'Fondo Blanco', description: 'Fotos de stock gratis en alta resolución', lang: 'es', start_url: '/', display: 'standalone', background_color: '#fafaf7', theme_color: '#fafaf7',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] }, null, 1));
}

// ---------- iconos e imágenes para redes ----------
async function graficos() {
  const mark = (fg, bg, pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${pad ? 0 : 14}" fill="${bg}"/><g fill="none" stroke="${fg}" stroke-width="3.4"><circle cx="32" cy="32" r="13"/><path d="M32 ${10 + pad}v${44 - 2 * pad}M${10 + pad} 32h${44 - 2 * pad}"/></g><circle cx="32" cy="32" r="4.6" fill="${fg}"/></svg>`;
  write('favicon.svg', mark('#151513', '#fafaf7'));
  await sharp(Buffer.from(mark('#151513', '#fafaf7'))).resize(192, 192).png().toFile(path.join(ROOT, 'icon-192.png'));
  await sharp(Buffer.from(mark('#151513', '#fafaf7', 6))).resize(512, 512).png().toFile(path.join(ROOT, 'icon-512.png'));
  await sharp(Buffer.from(mark('#151513', '#fafaf7', 4))).resize(180, 180).png().toFile(path.join(ROOT, 'apple-touch-icon.png'));
  // favicon.ico: lo piden algunos navegadores y buscadores aunque exista favicon.svg. Contenedor ICO con un PNG de 48 px.
  const png48 = await sharp(Buffer.from(mark('#151513', '#fafaf7'))).resize(48, 48).png().toBuffer();
  const ico = Buffer.alloc(22); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
  ico[6] = 48; ico[7] = 48; ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png48.length, 14); ico.writeUInt32LE(22, 18);
  fs.writeFileSync(path.join(ROOT, 'favicon.ico'), Buffer.concat([ico, png48]));
  fs.mkdirSync(path.join(ROOT, 'img/og'), { recursive: true });
  for (const f of fotos) {
    const out = path.join(ROOT, 'img/og', `${f.slug}.jpg`);
    if (!fs.existsSync(out)) await sharp(path.join(ROOT, 'img', `${f.slug}-1600.webp`)).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 78, mozjpeg: true }).toFile(out);
  }
  const og = path.join(ROOT, 'img/og/sitio.jpg');
  if (!fs.existsSync(og)) {
    const pick = [0, 13, 26, 21, 41, 9].map((i) => fotos[i % fotos.length]);
    const tiles = await Promise.all(pick.map((f) => sharp(path.join(ROOT, 'img', `${f.slug}-480.webp`)).resize(400, 230, { fit: 'cover' }).toBuffer()));
    const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="170"><rect width="1200" height="170" fill="#fafaf7"/><g transform="translate(60,48)" fill="none" stroke="#e5341d" stroke-width="5"><circle cx="37" cy="37" r="20"/><path d="M37 5v64M5 37h64"/></g><circle cx="97" cy="85" r="7" fill="#e5341d"/><text x="160" y="112" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="78" fill="#151513" letter-spacing="1">FONDO BLANCO</text><text x="1140" y="104" text-anchor="end" font-family="Arial, sans-serif" font-size="26" fill="#55554f">Fotos de stock gratis</text></svg>`);
    await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#fafaf7' } })
      .composite([...tiles.map((b, k) => ({ input: b, left: (k % 3) * 400, top: Math.floor(k / 3) * 230 })), { input: text, left: 0, top: 460 }])
      .jpeg({ quality: 80, mozjpeg: true }).toFile(og);
  }
}

await graficos();
asistente();
portada();
fotos.forEach(ficha);
colecciones.forEach(coleccion);
etiquetas.forEach(etiqueta);
indiceEtiquetas();
bannerPage();
paginas();
ampliar();
quitarFondo();
redirecciones();
const pinesNuevos = await pines();
feed();
seo();
console.log(`Listo: ${fotos.length} fotos, ${colecciones.length} colecciones, ${etiquetas.length} búsquedas, ${pinesNuevos} pines nuevos, ${legado.length} redirecciones.`);
