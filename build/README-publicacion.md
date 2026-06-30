# La Mente Cuántica · Paquete de publicación

## Archivos en este paquete

- **`La-Mente-Cuantica.epub`** — el libro listo para subir a tiendas digitales. Validado con epubcheck (0 errores, 0 warnings).
- **`La-Mente-Cuantica.md`** — manuscrito completo en Markdown, por si quieres seguir editando o exportar a otros formatos.

## Contenido

- Introducción
- 13 capítulos
- Conclusión
- Epílogo fotográfico (con marcadores `[PENDIENTE]` para tu serie fotográfica y tu voz personal)
- Apéndice I · Tabla comparativa 1941-1949 / 2025-2033
- Apéndice II · Fuentes y bibliografía comentada
- Apéndice III · Nota metodológica sobre el uso de IA

Total: ~29.000 palabras (unas 120 páginas en formato libro estándar).

## Antes de publicar — pendientes editoriales

Estos huecos no se han rellenado para no inventar tu voz:

1. **Cap 4 (Atención):** integrar el material propio de *Adicciones a Internet* en lluisridao.com.
2. **Cap 11 (Salud mental):** integrar tu voz personal a partir del hilo en X (status 1597263238760370176).
3. **Cap 12 (Salud física):** integrar el Substack *Lo que he aprendido sobre cuidarme*.
4. **Epílogo:** seleccionar fotografías y escribir tu voz como fotógrafo (los dos huecos `[PENDIENTE]`).
5. **Cifra dudosa Cap 10:** verificar el dato de "17-23 millones de empleos destruidos en España" antes de citarlo.

## Plan de publicación recomendado (orden táctico)

### 1. Amazon KDP (Kindle + Tapa blanda)

1. Crea cuenta en <https://kdp.amazon.com> (gratuita).
2. **Crear nuevo libro de Kindle eBook.**
3. Detalles:
   - Idioma: **Español**
   - Título: **La Mente Cuántica**
   - Subtítulo: *Una cartografía de la electrificación del sistema nervioso colectivo (2025-2033)*
   - Autor: **Lluís Ridao**
   - Descripción: copia el campo `description` del EPUB (también dentro del archivo).
   - Categorías: *Ensayo > Tecnología y sociedad* + *Filosofía contemporánea*.
   - Palabras clave: inteligencia artificial, deepfakes, atención, salud mental, ensayo.
4. Sube el archivo `La-Mente-Cuantica.epub`. Amazon lo convertirá a KFX automáticamente.
5. **Sube una portada** (te la pide aparte, JPG 1600×2560 px mínimo). Si no tienes diseño aún, KDP tiene un Cover Creator gratuito.
6. **Precio:** 3,99–6,99 € recomendado. Marca regalías al 70 % (precio entre 2,99 y 9,99 €).
7. **NO marques KDP Select** (te quita 90 días de exclusividad y bloquea Apple/Kobo/Google Play).
8. Publica.

Para tapa blanda: repite los pasos en **Tapa blanda de KDP**. Necesitarás un PDF maquetado 6×9″ (no incluido en este paquete; se puede generar con pandoc + LaTeX si lo pides).

### 2. Distribución multi-tienda con Draft2Digital (gratis)

Con el **mismo EPUB**, sube a Draft2Digital (<https://www.draft2digital.com>) y distribuirán automáticamente a:

- Apple Books
- Kobo
- Google Play Books
- Barnes & Noble Nook
- Scribd, Tolino, etc.

D2D no cobra comisión; toman 10 % de las ventas. Te ahorra crear cuenta y subir en cada plataforma.

### 3. Venta directa (opcional)

Para vender directo a tus lectores con un margen del 90 %:

- **Payhip** (<https://payhip.com>) o **Gumroad** (<https://gumroad.com>).
- Sube el mismo EPUB, fija precio, comparte el enlace en Substack y X.

## Cómo previsualizar el EPUB

- **macOS:** doble click → se abre en Apple Books.
- **iPad/iPhone:** AirDrop → abrir con Books.
- **Kindle:** envía el EPUB a tu correo `@kindle.com` o usa la app *Send to Kindle*.
- **Cualquier ordenador:** instala [Calibre](https://calibre-ebook.com/) (gratis) y arrastra el archivo.
- **Online:** [epub.to/reader](https://epub.to/reader) o el lector incluido en Edge/Firefox con extensión EPUBReader.

## Notas técnicas

- EPUB versión 3.2.
- Idioma: español (es-ES).
- 19 archivos XHTML internos (uno por capítulo).
- ToC navegable hasta nivel 2 (capítulo + sección).
- Sin DRM. Sin imágenes (el epílogo está marcado como pendiente).
- Tamaño: ~106 KB.
