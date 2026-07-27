# bigdata.datosclaros.es/incendios — parche de carga

## Qué fallaba

1. **Backend (cron).** `fetch_firms.php` usaba `file_get_contents()` contra la
   API de NASA FIRMS. En el hosting compartido (WebEmpresa) esa llamada falla
   silenciosamente y, para colmo, después sobreescribía `data/incendios.json`
   con `count: 0`, borrando los datos válidos anteriores. En `fetch_firms.log`
   se ve el bucle: cada 6h las tres fuentes fallan y el JSON queda vacío.
2. **Frontend.** `js/app.js` cargaba `./data/incendios.json` (relativo). Si
   entras a `bigdata.datosclaros.es/incendios` **sin barra final**, el
   navegador resuelve la base a `/` y pide `/data/incendios.json` → 404.
3. **Seguridad.** El `MAP_KEY` de FIRMS estaba hardcoded en el PHP. Al ser
   este repo público, la clave quedaba expuesta.

## Qué cambia con este parche

- `fetch_firms.php`
  - Intenta descargar por **cURL** (extensión PHP) → `file_get_contents` →
    `shell_exec curl`, en ese orden. Loguea el error real de cada intento.
  - Si **todas** las fuentes fallan, **NO** sobreescribe `data/incendios.json`
    (preserva la última descarga válida).
  - Escritura atómica (`.tmp` + `rename`) para evitar que el frontend lea un
    JSON a medias.
  - Lee `MAP_KEY` de `config.php` o de la variable de entorno `FIRMS_MAP_KEY`
    — nada hardcoded.
  - Acepta la confianza VIIRS (`l`/`n`/`h`) además del 0-100 de MODIS.
- `js/app.js`
  - Usa la ruta absoluta `/incendios/data/incendios.json` (funciona con y sin
    barra final).
  - Añade `?t=<timestamp>` y `cache: 'no-store'` para no servir un JSON viejo
    tras el cron.
  - Muestra el error en pantalla si no puede cargar el JSON (antes sólo
    aparecía en la consola).
  - Si el backend devuelve `count: 0` con errores, lo avisa en la web.

## Despliegue por FTP

Sube por FTP a `public_html/incendios/` (sobreescribiendo lo actual):

    incendios/
    ├── index.html
    ├── fetch_firms.php
    ├── config.php            <-- crear en el servidor (no está en el repo)
    ├── config.php.example
    ├── css/style.css
    ├── js/app.js
    └── data/
        ├── .htaccess
        └── incendios.json

1. Copia `config.php.example` a `config.php` en el servidor y pon dentro tu
   `FIRMS_MAP_KEY` real.
2. Asegura permisos: `data/ → 755`, `fetch_firms.php → 755`, `config.php → 600`.
3. Prueba el cron a mano por SSH o desde el panel:

       php /home/lluiski/public_html/incendios/fetch_firms.php

   O vía web (una sola vez para verificar):

       https://bigdata.datosclaros.es/incendios/fetch_firms.php

   Debe imprimir en el log un `[INFO] Success: N features written` con N > 0.
4. Recarga `https://bigdata.datosclaros.es/incendios` y verifica que carga.
   Abre DevTools → Network y confirma que
   `/incendios/data/incendios.json` devuelve 200.

## Rotación de la MAP_KEY

La clave `MAP_KEY` que estaba hardcoded en el `fetch_firms.php` original
puede considerarse comprometida (viajaba dentro de un ZIP fuera de un canal
cifrado). Pide una nueva en <https://firms.modaps.eosdis.nasa.gov/api/map_key/>
y ponla sólo en el `config.php` del servidor.
