// Marca un JPG como «generado con IA» añadiendo un bloque XMP (IPTC DigitalSourceType = trainedAlgorithmicMedia),
// con crédito, licencia y enlace al aviso. No recomprime la imagen: solo inserta metadatos. Es idempotente.
import fs from 'node:fs';

const NS_XMP = 'http://ns.adobe.com/xap/1.0/\0';

function paquete({ titulo = '', url = '' } = {}) {
  const x = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about=""
 xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
 xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
 Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"
 xmpRights:Marked="True"
 xmpRights:WebStatement="https://fondoblanco.co/aviso-ia/">
<dc:creator><rdf:Seq><rdf:li>Fondo Blanco</rdf:li></rdf:Seq></dc:creator>
<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">Fondo Blanco - fondoblanco.co. Imagen generada con inteligencia artificial, sin garantías.</rdf:li></rdf:Alt></dc:rights>
<xmpRights:UsageTerms><rdf:Alt><rdf:li xml:lang="x-default">Uso libre, en la medida en que existan derechos. Imagen generada con IA; uso bajo tu responsabilidad. https://fondoblanco.co/aviso-ia/</rdf:li></rdf:Alt></xmpRights:UsageTerms>
${titulo ? `<dc:title><rdf:Alt><rdf:li xml:lang="es">${x(titulo)}</rdf:li></rdf:Alt></dc:title>` : ''}
${url ? `<dc:source>${x(url)}</dc:source>` : ''}
</rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>`;
}

// Devuelve un Buffer nuevo con el XMP insertado (o el mismo si ya lo tenía).
export function marcarIA(buf, datos) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('No es un JPEG');
  // recorrer segmentos APPn iniciales
  let pos = 2, insertar = 2;
  while (pos + 4 <= buf.length && buf[pos] === 0xff) {
    const m = buf[pos + 1];
    if (m < 0xe0 || m > 0xef) break;                       // fin de los APPn
    const len = buf.readUInt16BE(pos + 2);
    if (m === 0xe1 && buf.slice(pos + 4, pos + 4 + NS_XMP.length).toString('latin1') === NS_XMP) return buf; // ya marcado
    if (m === 0xe0 || m === 0xe1) insertar = pos + 2 + len;   // después de JFIF/Exif
    pos += 2 + len;
  }
  const cuerpo = Buffer.concat([Buffer.from(NS_XMP, 'latin1'), Buffer.from(paquete(datos), 'utf8')]);
  if (cuerpo.length + 2 > 0xffff) throw new Error('XMP demasiado grande');
  const cab = Buffer.alloc(4);
  cab[0] = 0xff; cab[1] = 0xe1; cab.writeUInt16BE(cuerpo.length + 2, 2);
  return Buffer.concat([buf.slice(0, insertar), cab, cuerpo, buf.slice(insertar)]);
}

export function marcarArchivoIA(ruta, datos) {
  const a = fs.readFileSync(ruta);
  const b = marcarIA(a, datos);
  if (b !== a) fs.writeFileSync(ruta, b);
  return b !== a;
}
