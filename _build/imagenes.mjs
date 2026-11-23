// Optimiza las fotos originales: AVIF + WebP en 3 anchos para la web
// y un JPG de resolución completa para descargar. Calcula la paleta de colores.
// Uso: npm run imagenes   (ORIGEN puede cambiarse con la variable FB_ORIGEN)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const ORIGEN = process.env.FB_ORIGEN || 'D:/Personal/Imagenes/IMAGENES STOCK';
const { fotos } = JSON.parse(fs.readFileSync(path.join(ROOT, '_src/fotos.json'), 'utf8'));
const metaPath = path.join(ROOT, '_src/meta.json');
const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
const ANCHOS = [480, 960, 1600];
fs.mkdirSync(path.join(ROOT, 'img'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'descargas'), { recursive: true });

const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
async function paleta(buf) {
  const { data } = await sharp(buf).resize(64, 36, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = [];
  for (let i = 0; i < data.length; i += 3) px.push([data[i], data[i + 1], data[i + 2]]);
  const lum = (p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
  const ord = [...px].sort((a, b) => lum(a) - lum(b));
  let C = [0.08, 0.3, 0.5, 0.7, 0.92].map((q) => ord[Math.floor(q * ord.length)].slice());
  let A = [];
  for (let it = 0; it < 14; it++) {
    A = px.map((p) => { let b = 0, bd = Infinity; C.forEach((c, j) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; b = j; } }); return b; });
    C = C.map((c, j) => { const m = px.filter((_, i) => A[i] === j); return m.length ? [0, 1, 2].map((k) => m.reduce((s, p) => s + p[k], 0) / m.length) : c; });
  }
  const n = C.map((_, j) => A.filter((a) => a === j).length);
  const media = [0, 1, 2].map((k) => px.reduce((s, p) => s + p[k], 0) / px.length);
  return { paleta: C.map((c, j) => ({ h: hex(c), n: n[j] })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).map((x) => x.h), color: hex(media) };
}

for (const f of fotos) {
  const src = path.join(ORIGEN, `${f.n}.png`);
  const dl = path.join(ROOT, 'descargas', `fondo-blanco-${f.slug}.jpg`);
  const listo = fs.existsSync(dl) && ANCHOS.every((w) => fs.existsSync(path.join(ROOT, 'img', `${f.slug}-${w}.avif`))) && meta[f.slug];
  if (listo) continue;
  const buf = fs.readFileSync(src);
  const img = sharp(buf);
  const m = await img.metadata();
  for (const w of ANCHOS) {
    const base = sharp(buf).resize({ width: w, withoutEnlargement: true });
    await base.clone().avif({ quality: 52, effort: 5 }).toFile(path.join(ROOT, 'img', `${f.slug}-${w}.avif`));
    await base.clone().webp({ quality: 74, effort: 5 }).toFile(path.join(ROOT, 'img', `${f.slug}-${w}.webp`));
  }
  await sharp(buf).jpeg({ quality: 88, mozjpeg: true, progressive: true }).withMetadata({ exif: { IFD0: { Copyright: 'Fondo Blanco - fondoblanco.co - CC BY 4.0', Artist: 'Fondo Blanco' } } }).toFile(dl);
  meta[f.slug] = { w: m.width, h: m.height, bytes: fs.statSync(dl).size, ...(await paleta(buf)) };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 1));
  console.log('ok', f.n, f.slug);
}
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 1));
console.log('listo', Object.keys(meta).length);
