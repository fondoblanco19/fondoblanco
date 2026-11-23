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
| `_build/` | Generador (`build.mjs`), optimizador de imágenes y estilos |
| `img/`, `descargas/` | Imágenes generadas |
| `foto/`, `coleccion/`, `licencia/`… | Páginas generadas (no editar a mano) |

## Tipografías

Placa, Acumin Pro y Source Code Pro vía Adobe Fonts (kit `ccm6jic`, dominios: fondoblanco.co, www, fondoblanco19.github.io y localhost).
