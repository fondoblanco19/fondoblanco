// Generador estático de fondoblanco.co
// Lee _src/*.json y escribe HTML listo para GitHub Pages. Uso: npm run build
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

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
// Aviso de cookies y términos de uso. La respuesta se guarda en una cookie técnica (fb_consent, 12 meses).
// En /terminos/, /privacidad/ y /licencia/ se muestra como barra inferior para poder leerlas antes de aceptar.
const CC_HEAD = `<script>(function(d){if(!/(?:^|; )fb_consent=1/.test(d.cookie))d.documentElement.classList.add('cc-need')})(document)</script>`;
const CC_HTML = `<div class="cc" id="cc" role="dialog" aria-modal="true" aria-labelledby="cc-t" aria-describedby="cc-d">
<div class="cc-box"><p class="label">Antes de seguir</p><h2 id="cc-t">Cookies y términos de uso</h2>
<p id="cc-d">Fondo Blanco no usa cookies de seguimiento ni publicidad. Solo guardamos una cookie técnica, durante 12 meses, para recordar tu respuesta. Para continuar, acepta los <a href="/terminos/">Términos de uso</a> y la <a href="/privacidad/">Política de privacidad</a>.</p>
<div class="cc-act"><button class="btn primary" type="button" id="cc-ok">Aceptar y continuar</button></div></div></div>`;
const CC_SCRIPT = `(()=>{const h=document.documentElement,cc=document.getElementById('cc');if(!cc)return;const soft=/^\\/(terminos|privacidad|licencia)\\//.test(location.pathname),parts=['.top','main','.foot'].map(s=>document.querySelector(s)).filter(Boolean);
function open(){h.classList.add('cc-need');if(soft){h.classList.add('cc-soft');cc.setAttribute('aria-modal','false')}else{h.classList.add('cc-lock');parts.forEach(e=>{e.inert=true})}cc.querySelector('button').focus({preventScroll:true})}
function close(){h.classList.remove('cc-need','cc-lock','cc-soft');parts.forEach(e=>{e.inert=false})}
document.getElementById('cc-ok').addEventListener('click',()=>{document.cookie='fb_consent=1; Max-Age=31536000; Path=/; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');close()});
document.querySelectorAll('[data-cookies]').forEach(b=>b.addEventListener('click',()=>{document.cookie='fb_consent=; Max-Age=0; Path=/';open()}));
if(h.classList.contains('cc-need'))open()})();`;

function layout({ title, desc, canon, og, ogAlt, body, jsonld = [], script = '', nav = '', noindex = false, type = 'website', ext = '' }) {
  const ogImg = og || `${URL}/img/og/sitio.jpg`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
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
${CC_HEAD}
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body>
<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="top"><div class="wrap">
<a class="brand" href="/" aria-label="Fondo Blanco, inicio"><span>Fondo Blanco</span></a>
<nav class="nav" aria-label="Principal">
<a href="/#colecciones" class="hide-s"${nav === 'colecciones' ? ' aria-current="page"' : ''}>Colecciones</a>
<a href="/ampliar/"${nav === 'ampliar' ? ' aria-current="page"' : ''}>Ampliar<span class="hide-s"> imagen</span></a>
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
${ext}
</body>
</html>
`;
}

function footer() {
  return `<footer class="foot"><div class="wrap">
<div class="foot-grid">
<div><h2>Fondo Blanco</h2><p>Banco de imágenes gratis en alta resolución. Descarga, usa y da crédito: así de simple.</p></div>
<div><h2>Colecciones</h2><ul>${colecciones.slice(0, 4).map((c) => `<li><a href="/coleccion/${c.slug}/">${esc(c.nombre)}</a></li>`).join('')}</ul></div>
<div><h2>Más</h2><ul>${colecciones.slice(4).map((c) => `<li><a href="/coleccion/${c.slug}/">${esc(c.nombre)}</a></li>`).join('')}</ul></div>
<div><h2>Sitio</h2><ul><li><a href="/ampliar/">Ampliar imagen</a></li><li><a href="/licencia/">Licencia y uso</a></li><li><a href="/terminos/">Términos de uso</a></li><li><a href="/privacidad/">Privacidad</a></li><li><button class="linkbtn" type="button" data-cookies>Preferencias de cookies</button></li><li><a href="/contacto/">Contacto</a></li></ul></div>
</div>
<div class="foot-mark" aria-hidden="true">Fondo Blanco</div>
<div class="foot-legal"><span>© ${new Date().getFullYear()} Fondo Blanco · Imágenes bajo ${sitio.licencia.nombre}</span><span>Tipografía: Archivo Black, Acumin Pro y Source Code Pro vía Adobe Fonts</span></div>
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
<div><div class="num">03</div><h3>Úsala y da crédito</h3><p>Úsala en proyectos personales o comerciales. Solo menciona «Foto: Fondo Blanco». <a href="/licencia/">Ver licencia</a>.</p></div>
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
  write('index.html', layout({ title: 'Fondo Blanco — Fotos de stock gratis en alta resolución', desc: `Banco de imágenes gratis: ${total} fotos de stock en alta resolución de interiores, gastronomía, naturaleza, negocios, bienestar, fondos y temporadas. Descarga sin registro.`, canon: '/', body, script, jsonld }));
}

// ---------- ficha de foto ----------
function ficha(f) {
  const prev = fotos[(f.i - 1 + fotos.length) % fotos.length];
  const next = fotos[(f.i + 1) % fotos.length];
  const rel = f.col.fotos.filter((x) => x.slug !== f.slug).slice(0, 6);
  const extra = rel.length < 3 ? fotos.filter((x) => x.coleccion !== f.coleccion).slice(0, 3 - rel.length) : [];
  const usos = (seoCol[f.coleccion] || {}).usos || 'proyectos web, redes sociales y presentaciones';
  const contexto = `${f.titulo} es una foto gratis de la colección ${f.col.nombre.toLowerCase()}, en formato ${f.w >= f.h ? 'horizontal' : 'vertical'} de ${f.w}×${f.h} px. Sirve para ${usos}.${f.espacio ? ' Tiene espacio libre para añadir texto.' : ''} Se descarga sin registro; solo da crédito a Fondo Blanco.`;
  const credito = `Foto: Fondo Blanco (fondoblanco.co) · ${sitio.licencia.nombre}`;
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
<div class="row"><button class="btn ghost" type="button" id="credito" data-v="${esc(credito)}">${ICON.copy}Copiar crédito</button><button class="btn ghost" type="button" id="enlace">Copiar enlace</button></div>
</div>
<table class="specs"><tbody>
<tr><th scope="row">Dimensiones</th><td>${f.w} × ${f.h} px</td></tr>
<tr><th scope="row">Formato</th><td>JPG · ${mb(f.bytes)}</td></tr>
<tr><th scope="row">Orientación</th><td>${f.w >= f.h ? 'Horizontal' : 'Vertical'}</td></tr>
<tr><th scope="row">Espacio para texto</th><td>${f.espacio ? 'Sí' : 'No'}</td></tr>
<tr><th scope="row">Licencia</th><td><a href="/licencia/">${sitio.licencia.nombre}</a> · uso comercial permitido</td></tr>
<tr><th scope="row">Origen</th><td>Imagen generada con IA y revisada a mano</td></tr>
</tbody></table>
<p class="label">Paleta · toca para copiar</p>
<div class="palette">${f.paleta.slice(0, 5).map((h) => `<button class="swatch" type="button" style="--s:${h}" data-v="${h}" aria-label="Copiar color ${h}"><i></i><span>${h}</span></button>`).join('')}</div>
<p class="label">Etiquetas</p>
<ul class="tags">${f.tags.map((t) => `<li><a href="/?q=${encodeURIComponent(t)}">${esc(t)}</a></li>`).join('')}</ul>
</div>
</article>
<nav class="pager" aria-label="Otras fotos"><a href="${prev.url}" rel="prev"><span class="mono">← Anterior</span><strong>${esc(prev.titulo)}</strong></a><a href="${next.url}" rel="next"><span class="mono">Siguiente →</span><strong>${esc(next.titulo)}</strong></a></nav>
<section aria-labelledby="h-rel"><div class="section-head"><h2 id="h-rel">Más de ${esc(f.col.nombre)}</h2><a class="mono" href="/coleccion/${f.coleccion}/">Ver colección →</a></div>
<ul class="grid">${[...rel, ...extra].map((x) => card(x)).join('\n')}</ul></section>
</div>`;
  const script = `${SCRIPT_COMUN}document.getElementById('credito').addEventListener('click',e=>copy(e.currentTarget.dataset.v,'Crédito copiado'));document.getElementById('enlace').addEventListener('click',()=>copy(location.href.split('#')[0],'Enlace copiado'));document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>copy(b.dataset.v,'Color '+b.dataset.v+' copiado')));`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'ImageObject', name: f.titulo, description: f.desc, contentUrl: URL + f.dl,
      thumbnailUrl: `${URL}/img/${f.slug}-480.webp`, url: URL + f.url, width: f.w, height: f.h, encodingFormat: 'image/jpeg',
      keywords: f.tags.join(', '), license: sitio.licencia.url, acquireLicensePage: `${URL}/licencia/`, creditText: 'Fondo Blanco',
      copyrightNotice: 'Fondo Blanco', creator: { '@type': 'Organization', name: 'Fondo Blanco', url: URL + '/' },
      isAccessibleForFree: true, digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia', inLanguage: 'es' },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: URL + '/' },
      { '@type': 'ListItem', position: 2, name: f.col.nombre, item: `${URL}/coleccion/${f.coleccion}/` },
      { '@type': 'ListItem', position: 3, name: f.titulo, item: URL + f.url }] },
  ];
  write(`foto/${f.slug}/index.html`, layout({ title: `${f.titulo} — Foto gratis en alta resolución | Fondo Blanco`, desc: `${f.desc} Descarga gratis en JPG ${f.w}×${f.h}.`, canon: f.url,
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
${textoHtml}
</div>`;
  const jsonld = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: URL + '/' },
      { '@type': 'ListItem', position: 2, name: c.nombre, item: `${URL}/coleccion/${c.slug}/` }] },
    ...(sc.faqs.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: sc.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : []),
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${c.nombre} — Fondo Blanco`, description: c.desc, url: `${URL}/coleccion/${c.slug}/`,
    mainEntity: { '@type': 'ItemList', numberOfItems: c.fotos.length, itemListElement: c.fotos.map((f, i) => ({ '@type': 'ListItem', position: i + 1, url: URL + f.url, name: f.titulo })) } }];
  write(`coleccion/${c.slug}/index.html`, layout({ title: `${sc.h1 || 'Fotos gratis de ' + c.nombre.toLowerCase()} en alta resolución — Fondo Blanco`, desc: `${c.desc} ${c.fotos.length} fotos en alta resolución para descargar gratis.`,
    canon: `/coleccion/${c.slug}/`, og: `${URL}/img/og/${c.fotos[0].slug}.jpg`, body, jsonld, nav: 'colecciones', script: ROTAR }));
}

// ---------- páginas de texto ----------
function pagina(slug, { title, h1, intro, html, desc, nav, script = '' }) {
  const body = `<div class="wrap"><header class="page-head"><p class="mono" style="color:var(--signal-ink);margin:0">Fondo Blanco</p><h1>${h1}</h1><p>${intro}</p></header><div class="prose">${html}</div></div>`;
  write(`${slug}/index.html`, layout({ title, desc, canon: `/${slug}/`, body, nav, script: script ? SCRIPT_COMUN + script : '' }));
}

function paginas() {
  pagina('licencia', {
    title: 'Licencia y condiciones de uso — Fondo Blanco', h1: 'Licencia', nav: 'licencia',
    desc: `Todas las fotos de Fondo Blanco se publican bajo ${sitio.licencia.nombre}: úsalas gratis, también con fines comerciales, dando crédito.`,
    intro: `Todas las fotos se publican bajo la licencia <a href="${sitio.licencia.url}" rel="license">Creative Commons Atribución 4.0 (CC BY 4.0)</a>. Gratis, también para uso comercial.`,
    html: `<div class="callout"><p><strong>En resumen:</strong> descarga, edita y usa las fotos donde quieras. Solo da crédito: <code>Foto: Fondo Blanco (fondoblanco.co)</code></p></div>
<h2>Puedes</h2><ul><li>Usar las fotos en sitios web, redes sociales, presentaciones, publicidad, empaques e impresos.</li><li>Usarlas en proyectos personales y comerciales, sin pagar nada.</li><li>Recortarlas, editarlas, añadir texto y combinarlas con otros materiales.</li></ul>
<h2>Debes</h2><ul><li>Dar crédito a <strong>Fondo Blanco</strong> de forma razonable, por ejemplo en el pie de foto, en los créditos del sitio o en la descripción de la publicación.</li><li>No dar a entender que Fondo Blanco respalda tu marca, producto u opinión.</li></ul>
<h2>Ten en cuenta</h2><ul><li>Las imágenes se crearon con inteligencia artificial y se revisaron una a una. Las personas que aparecen no son personas reales identificables.</li><li>No uses las fotos para engañar, por ejemplo presentándolas como hechos reales o documentales.</li><li>No redistribuyas la colección completa como si fuera un banco de imágenes propio.</li></ul>
<h2>Cómo dar crédito</h2><p>Cada ficha tiene un botón «Copiar crédito». El texto recomendado es: <code>Foto: Fondo Blanco (fondoblanco.co) · CC BY 4.0</code></p>` });

  pagina('privacidad', {
    title: 'Política de privacidad — Fondo Blanco', h1: 'Privacidad',
    desc: 'Fondo Blanco no usa cookies de seguimiento ni publicidad, no pide registro y no recopila datos personales. Solo guarda una cookie técnica con tu aceptación.',
    intro: `Resumen corto: no usamos cookies de seguimiento ni publicidad, no hay registro y solo recibimos los datos que tú envíes por el formulario de contacto. Actualizado el ${HOY}.`,
    html: `<h2>Qué datos recopilamos</h2><p>Ninguno al navegar. Fondo Blanco es un sitio estático: no tiene cuentas ni comentarios, y no usamos analítica ni publicidad. Solo recibimos lo que escribas en el formulario de contacto.</p>
<h2>Cookies</h2><p>Este sitio solo instala una cookie técnica propia, <code>fb_consent</code>, que dura 12 meses y sirve para recordar que aceptaste los <a href="/terminos/">Términos de uso</a> y esta política, para no preguntarte en cada página. No contiene datos personales ni sirve para seguirte. Puedes borrarla cuando quieras desde el botón «Preferencias de cookies» del pie de página o desde tu navegador; si la borras, te volveremos a pedir la aceptación para continuar.</p>
<h2>Herramientas de ampliación</h2><p>«Ampliar imagen» y «Ampliar a 4K» procesan las imágenes dentro de tu navegador, con tu propio equipo. La imagen que elijas <strong>no se envía a ningún servidor</strong> ni a terceros. Al usarlas, tu navegador descarga desde este mismo sitio el modelo de inteligencia artificial y sus archivos de apoyo.</p>
<h2>Servicios de terceros</h2><ul><li><strong>GitHub Pages</strong> aloja el sitio. Como cualquier servidor web, puede registrar datos técnicos de la visita (como la dirección IP) por motivos de seguridad. Consulta la <a href="https://docs.github.com/es/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener">declaración de privacidad de GitHub</a>.</li><li><strong>Adobe Fonts</strong> sirve las tipografías. Adobe registra datos técnicos para calcular el uso de las fuentes y no usa cookies. Consulta la <a href="https://www.adobe.com/es/privacy/policies/adobe-fonts.html" rel="noopener">política de privacidad de Adobe Fonts</a>.</li></ul>
<h2>Formulario de contacto</h2><p>Si nos escribes desde la página de <a href="/contacto/">contacto</a>, recibimos tu nombre, tu correo y tu mensaje, solo para responderte. El envío lo procesa <strong>FormSubmit</strong>, que reenvía el mensaje a nuestro correo. No usamos esos datos para publicidad.</p><h2>Contacto</h2><p>Si tienes preguntas sobre privacidad, escríbenos desde la página de <a href="/contacto/">contacto</a>.</p>` });

  pagina('terminos', {
    title: 'Términos de uso — Fondo Blanco', h1: 'Términos de uso', nav: '',
    desc: 'Condiciones para usar fondoblanco.co: fotos gratis con licencia CC BY 4.0, imágenes generadas con IA y herramientas de ampliación que funcionan en tu navegador.',
    intro: `Al seguir navegando en fondoblanco.co aceptas estas condiciones. Actualizado el ${HOY}.`,
    html: `<h2>1. Qué es Fondo Blanco</h2><p>Fondo Blanco es un banco de fotos de stock gratuito y un conjunto de herramientas para ampliar imágenes. El sitio se ofrece tal como está, sin necesidad de registro.</p>
<h2>2. Uso de las fotos</h2><p>Las fotos se publican bajo la licencia <a href="${sitio.licencia.url}" rel="license">${sitio.licencia.nombre}</a>: puedes usarlas gratis, también con fines comerciales, dando crédito a Fondo Blanco. Los detalles están en la página de <a href="/licencia/">licencia</a>.</p>
<h2>3. Imágenes creadas con inteligencia artificial</h2><p>Las fotos se generaron con inteligencia artificial y se revisaron una a una. Las personas que aparecen no son personas reales identificables. No las uses para engañar, por ejemplo presentándolas como hechos reales o documentales, ni para suplantar a nadie.</p>
<h2>4. Herramientas «Ampliar imagen» y «Ampliar a 4K»</h2><ul><li>Funcionan dentro de tu navegador: tus imágenes no se envían a nuestros servidores.</li><li>El resultado lo genera un modelo de inteligencia artificial que reconstruye detalle; puede suavizar texturas o inventar detalles que no existían. Revisa siempre el resultado antes de usarlo.</li><li>Eres responsable de tener derecho a usar y modificar las imágenes que amplíes. No las uses con contenido ilegal ni que vulnere derechos de terceros.</li><li>La velocidad depende de tu dispositivo. Pueden tardar varios minutos en equipos sin tarjeta gráfica compatible.</li></ul>
<h2>5. Uso aceptable</h2><p>No intentes dañar, saturar ni sobrecargar el sitio, ni usar sistemas automáticos para descargar la colección completa y redistribuirla como si fuera un banco de imágenes propio.</p>
<h2>6. Disponibilidad y garantías</h2><p>Hacemos lo posible por que el sitio funcione siempre, pero no garantizamos que esté disponible sin interrupciones ni libre de errores. El contenido y las herramientas se ofrecen sin garantías de ningún tipo, y no nos hacemos responsables de los daños que puedan derivarse de su uso, en la medida que lo permita la ley.</p>
<h2>7. Enlaces y servicios de terceros</h2><p>El sitio usa servicios de terceros, como el alojamiento en GitHub Pages y las tipografías de Adobe Fonts, que se rigen por sus propias condiciones. Más detalles en la <a href="/privacidad/">política de privacidad</a>.</p>
<h2>8. Cambios</h2><p>Podemos actualizar estos términos. La versión vigente es la publicada en esta página, con su fecha de actualización.</p>
<h2>9. Contacto</h2><p>Si tienes dudas sobre estos términos, escríbenos desde la página de <a href="/contacto/">contacto</a>.</p>` });

  const tok = sitio.formToken;
  const form = tok ? `<form class="cform" id="cform" action="https://formsubmit.co/${esc(tok)}" method="POST">
<div class="f"><label for="cn">Nombre</label><input id="cn" name="name" required autocomplete="name" maxlength="80"></div>
<div class="f"><label for="ce">Tu correo (para responderte)</label><input id="ce" name="email" type="email" required autocomplete="email" maxlength="120"></div>
<div class="f"><label for="cm">Motivo</label><select id="cm" name="motivo"><option>Soporte</option><option>Reportar una foto</option><option>Duda sobre la licencia</option><option>Sugerir fotos</option><option>Otro</option></select></div>
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
    html: `${form}<h2>Antes de escribir</h2><ul><li>Para dudas de uso, revisa primero la <a href="/licencia/">licencia</a>.</li><li>Si reportas una foto, incluye su código (por ejemplo <code>FB-001</code>).</li></ul>` });

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
<p class="amp-big">Suelta tu imagen aquí</p><p>o toca para elegir un archivo. También puedes pegarla con Ctrl+V.</p><span class="mono">JPG · PNG · WebP · hasta 25 MB</span></div></div>
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

// ---------- redirecciones del sitio anterior ----------
function redirecciones() {
  for (const s of legado) {
    write(`textura/${s}/index.html`, `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Fondo Blanco</title><meta name="robots" content="noindex,follow"><link rel="canonical" href="${URL}/"><meta http-equiv="refresh" content="0; url=/"></head><body><p>Esta página se movió. <a href="/">Ir a Fondo Blanco</a>.</p></body></html>`);
  }
}

// ---------- SEO: sitemap, robots, manifest ----------
function seo() {
  const urls = [
    { loc: '/', pr: '1.0' },
    ...colecciones.map((c) => ({ loc: `/coleccion/${c.slug}/`, pr: '0.8' })),
    ...fotos.map((f) => ({ loc: f.url, pr: '0.7', img: f })),
    { loc: '/ampliar/', pr: '0.6' }, { loc: '/licencia/', pr: '0.4' }, { loc: '/contacto/', pr: '0.3' }, { loc: '/terminos/', pr: '0.2' }, { loc: '/privacidad/', pr: '0.2' },
  ];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map((u) => `<url><loc>${URL}${u.loc}</loc><lastmod>${HOY}</lastmod><priority>${u.pr}</priority>${u.img ? `<image:image><image:loc>${URL}${u.img.dl}</image:loc></image:image>` : ''}</url>`).join('\n')}
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
portada();
fotos.forEach(ficha);
colecciones.forEach(coleccion);
paginas();
ampliar();
redirecciones();
seo();
console.log(`Listo: ${fotos.length} fotos, ${colecciones.length} colecciones, ${legado.length} redirecciones.`);
