# Fondo Blanco

Banco de fotos de stock gratis — [fondoblanco.co](https://fondoblanco.co). Sitio estático publicado con GitHub Pages.

## Cómo agregar fotos nuevas

1. Copia el PNG nuevo a la carpeta de originales (`D:\Personal\Imagenes\IMAGENES STOCK`) con un número, por ejemplo `52.png`.
2. Añade una entrada al final de `fotos` en `_src/fotos.json`:
   ```json
   { "n": 52, "slug": "nombre-en-minusculas-con-guiones", "titulo": "Título visible", "desc": "Descripción de lo que se ve en la foto.", "tags": ["etiqueta", "otra"], "coleccion": "interiores", "espacio": true }
   ```
   - `coleccion`: uno de los `slug` de `colecciones` (puedes crear colecciones nuevas en el mismo archivo).
   - `espacio`: `true` si la foto tiene una zona libre para poner texto.
3. Ejecuta:
   ```powershell
   npm install
   npm run imagenes
   npm run build
   ```
4. Revisa los cambios y haz commit y push.

`npm run imagenes` solo procesa las fotos nuevas. Genera AVIF y WebP en 480, 960 y 1600 px para la web, un JPG de resolución completa para descargar y la paleta de colores. Si los originales están en otra carpeta, define la variable `FB_ORIGEN`.

## Estructura

| Ruta | Qué es |
| --- | --- |
| `_src/fotos.json` | Catálogo: colecciones y fotos |
| `_src/sitio.json` | Datos del sitio: URL, correo de contacto, kit de Adobe Fonts, licencia |
| `_src/meta.json` | Generado: tamaño, peso y paleta de cada foto |
| `_build/` | Generador (`build.mjs`), optimizador de imágenes y estilos (`estilos.css` + `estilos-extra.css`) |
| `4k/` | Herramientas de ampliación con IA (se sirven tal cual, no las genera `build.mjs`). Ver más abajo |
| `img/`, `descargas/` | Imágenes generadas |
| `foto/`, `coleccion/`, `licencia/`, `terminos/`, `privacidad/`, `ampliar/`… | Páginas generadas (no editar a mano) |

## Ampliar imagen y «Ampliar a 4K»

Todo corre en el navegador del visitante (WebGPU si existe, CPU si no); ninguna imagen se sube a un servidor.

- `4k/fb4k.js`: botón **Ampliar a 4K** que `build.mjs` añade a cada ficha de foto. Usa el JPG de `descargas/` y, si no existe, la versión de 1600 px.
- `4k/ampliar.js`: lógica de la página **/ampliar/** (el visitante trae su propia imagen). La página la genera `ampliar()` en `build.mjs`.
- `4k/model/` (Real-ESRGAN `realesr-general-x4v3`, ONNX) y `4k/ort/` (ONNX Runtime Web 1.22.0). Créditos en `4k/LEEME.txt`.

## Textos legales, aviso de aceptación e imágenes de IA

- **Textos:** `_build/legal.mjs` genera `/licencia/`, `/aviso-ia/`, `/terminos/` y `/privacidad/`. Están aparte para revisarlos con un abogado.
- **Aceptación:** un aviso bloquea la navegación hasta pulsar «Aceptar y continuar» (en `/terminos/`, `/aviso-ia/`, `/privacidad/` y `/licencia/` es una barra que deja leer). Se guarda la cookie técnica `fb_terms=<versión>` (12 meses); se revoca con «Preferencias de cookies» del pie. Código en `CC_HEAD`, `CC_HTML` y `CC_SCRIPT` de `build.mjs`.
- **Si cambias los términos de fondo, sube `TERMS_VERSION`** en `legal.mjs`: el aviso vuelve a salir y todos aceptan la versión nueva.
- **Metadatos de IA:** `_build/xmp.mjs` añade a cada JPG de `descargas/` el marcado IPTC «trainedAlgorithmicMedia», crédito, licencia y enlace a `/aviso-ia/`, sin recomprimir. `npm run imagenes` lo aplica a las fotos nuevas, y el botón 4K hace lo mismo con sus archivos.
- Si algún día se añade analítica o publicidad, hay que actualizar `/privacidad/`, el aviso y subir `TERMS_VERSION`.

## Tipografías

Archivo Black, Acumin Pro y Source Code Pro vía Adobe Fonts (kit `nzg5tvo`, dominios: fondoblanco.co, www, fondoblanco19.github.io y localhost).
