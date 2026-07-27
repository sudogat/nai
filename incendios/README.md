# Incendios España — bigdata.datosclaros.es/incendios

Panel de incendios forestales en España. Datos satelitales NASA FIRMS + histórico
oficial MITECO + noticias agregadas.

## Instalación: subir y ya

Sube **toda la carpeta `incendios/`** por FTP a `public_html/bigdata.datosclaros.es/`.
No hay que configurar nada: no hay API keys, no hay base de datos, no hay `config.php`.

```
incendios/
├── index.html              Tiempo real
├── historico.html          45 años de hectáreas quemadas
├── mapa-historico.html     Antes / ahora con imágenes satelitales
├── causas.html             Causas, detenciones y Código Penal
├── rural.html              España rural, marco legal, casos
├── investigar.html         Herramienta: coordenadas → visores oficiales
├── metodologia.html        Metodología, API y FAQ
├── emergencia.html         Guía de autoprotección y teléfonos
├── fetch_firms.php         Cron: descarga focos NASA FIRMS
├── fetch_news.php          Cron: descarga noticias
├── rss.php                 Feeds RSS (noticias y focos)
├── robots.txt
├── sitemap.xml
├── css/style.css
├── js/
│   ├── nav.js              Menú móvil + tema — se carga en TODAS
│   ├── app.js              index.html
│   ├── historico.js        historico.html
│   ├── mapa-historico.js   mapa-historico.html
│   ├── causas.js           causas.html
│   ├── rural.js            rural.html
│   ├── investigar.js       investigar.html
│   └── paginas.js          metodologia.html + emergencia.html
└── data/
    ├── .htaccess
    ├── incendios.json               ← lo regenera fetch_firms.php
    ├── noticias.json                ← lo regenera fetch_news.php
    ├── historico.json               ← editable a mano
    ├── incendios-historicos.json    ← editable a mano
    ├── causas.json                  ← editable a mano
    ├── rural.json                   ← editable a mano
    └── casos-documentados.json      ← editable a mano
```

Permisos: `data/` en 755, los `.php` en 755, los `.json` en 644.

## Los dos crons

En cPanel → Cron Jobs:

```
0 */6 * * *   /usr/bin/php /home/lluisri1/public_html/bigdata.datosclaros.es/incendios/fetch_firms.php
*/30 * * * *  /usr/bin/php /home/lluisri1/public_html/bigdata.datosclaros.es/incendios/fetch_news.php
```

Para probarlos a mano, ábrelos en el navegador: imprimen el log en pantalla.

## Origen de los datos

| Página | Fuente | Actualización |
|---|---|---|
| Tiempo real | CSV públicos de NASA FIRMS (VIIRS SNPP, VIIRS NOAA-20, MODIS) para Europa, filtrados a España por bounding box | Cada 6 h vía cron |
| Noticias | 8 consultas a Google News RSS (general + `site:` de La Vanguardia, El País, RTVE, El Mundo, ABC, Vilaweb, 3Cat) | Cada 30 min vía cron |
| Histórico | MITECO / EGIF, cargado a mano en `data/historico.json` | Manual |
| Antes/ahora | Fichas en `data/incendios-historicos.json` + enlaces a Sentinel Hub, Google Earth y Corine | Manual |
| España rural | INE, Censo Agrario, Inventario Forestal Nacional, en `data/rural.json` | Manual |
| Causas | MITECO/EGIF y Fiscalía de Medio Ambiente, en `data/causas.json` | Manual |

No se usa la Area API de FIRMS con `MAP_KEY`: los CSV públicos dan los mismos
datos sin autenticación ni cuota. Si ves un `config.php` en el servidor de una
instalación anterior, puedes borrarlo.

## Editar los datos manuales

Son JSON planos, se editan con cualquier editor y se recargan solos.

### Añadir un incendio histórico al mapa

En `data/incendios-historicos.json`, dentro de `"incendios"`:

```json
{
  "nombre": "Nombre del incendio",
  "anio": 2012,
  "mes": 8,
  "ccaa": "Cataluña",
  "provincia": "Girona",
  "lat": 42.42,
  "lon": 2.88,
  "hectareas": 13000,
  "descripcion": "Contexto breve.",
  "wikipedia": "https://..."
}
```

`wikipedia` es opcional. Las coordenadas van al centro aproximado del área quemada.

### Corregir una cifra del histórico

En `data/historico.json`, dentro de `"anios"`. Las cifras actuales son las
públicas de MITECO/EGIF ampliamente citadas, pero **contrasta con el PDF oficial
de cada año** en
<https://www.miteco.gob.es/es/biodiversidad/temas/incendios-forestales/estadisticas.html>
antes de citarlas en un medio.

### Añadir un caso documentado de cambio de uso

`data/casos-documentados.json` empieza **vacío a propósito**. Solo añade un caso
cuando tengas fuente primaria enlazable: expediente en boletín autonómico,
sentencia, o pieza periodística que cite el expediente. El propio archivo lleva
la plantilla y los pasos de verificación.

No se ha prepoblado porque no existe ningún dataset abierto que cruce
automáticamente perímetro quemado con qué se construyó encima. Publicar una lista
sin verificar señalaría a empresas y ayuntamientos reales sin pruebas.

## Notas técnicas

- **Tema claro por defecto.** El modo oscuro solo se activa si el usuario pulsa
  el toggle; se guarda en `localStorage`. No se respeta `prefers-color-scheme`
  a propósito.
- **Cache busting** con `?v=N` en CSS y JS. Si tocas esos archivos, sube el
  número en todos los HTML o el navegador servirá la versión vieja.
- **Nginx microcache.** El front de WebEmpresa cachea el JSON de forma agresiva.
  El JS añade `?t=<timestamp>` y `cache: 'no-store'` para saltárselo.
- **`fetch_firms.php` nunca borra datos buenos.** Si las tres fuentes fallan,
  preserva el JSON anterior en vez de escribir uno vacío.
- **Escritura atómica** (`.tmp` + `rename`) para que la web no lea un JSON a medias.


## Feeds RSS

Sin configuración, salen de los mismos JSON:

- `rss.php` — últimas noticias sobre incendios
- `rss.php?tipo=focos` — focos más intensos de las últimas 48 h, con
  coordenadas GeoRSS

Están declarados con `<link rel="alternate">` en todas las páginas, así que
los lectores de feeds los detectan solos.

## Si las noticias no salen

`fetch_news.php` imprime en pantalla un resumen por feed cuando lo abres en el
navegador. Ábrelo y mira la línea `--- Resumen por feed ---`:

- Si **todos** dicen FALLO, el hosting no llega a esos dominios.
- Si solo fallan los `gn-*`, Google News está bloqueando la IP del servidor:
  los feeds directos de medios siguen funcionando y la sección se llena igual.
- Si dicen `0 items`, el feed responde pero no trae nada con las palabras clave.

Las fuentes están en las variables `$GOOGLE` y `$FEEDS_DIRECTOS` al principio
del archivo. Añadir un medio es añadir una línea.

## Sobre la página de causas

`causas.html` publica **solo agregados oficiales**. No hay nombres, ni
iniciales, ni casos individuales de personas detenidas o investigadas, y no
debe haberlos: una detención no es una condena, rige la presunción de
inocencia y los datos judiciales son categoría especial en el RGPD. Publicar
identidades sería ilegal además de injusto.

El dato que sostiene la página, y que contradice el relato habitual: según la
propia clasificación del MITECO, la motivación mayoritaria de los incendios
intencionados en España es **la regeneración de pastos**, no la especulación
urbanística, que aparece como una fracción muy pequeña. Que sea minoritaria no
la hace inexistente — pero conviene decirlo bien.
