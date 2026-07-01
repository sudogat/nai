# Publicar en lluisridao.photo (WordPress) — Guía específica

Tu web es WordPress. La app **no va como página de WordPress** (WP añade cabecera, footer y peso innecesario). La subes como **archivos estáticos en una subcarpeta** de tu hosting. Todo lo hace más rápido, funciona offline y es compatible con Play Store.

Resultado final:
- App: `https://lluisridao.photo/herramientas/encuadre/`
- Sigue teniendo tu HTTPS y tu dominio (no depende de Firebase).
- WordPress no se toca; queda intacto.

---

## Paso 1 — Subir los archivos por FTP / Administrador de archivos

**Vas a necesitar acceso al hosting**, no a WordPress. Pistas para localizarlo:
- Panel del hosting (cPanel, Plesk, DirectAdmin, o el panel de tu proveedor: Hostinger, SiteGround, Raiola, Webempresa, etc.).
- Si no lo recuerdas, entra en el panel donde compraste el dominio; suele tener enlace a "Administrar hosting".

Archivos a subir a la carpeta `/public_html/herramientas/encuadre/`:

```
encuadre-inteligente.html
manifest.webmanifest
service-worker.js
icon-192.svg
icon-512.svg
icon-maskable.svg
privacy.html
index.html
```

Además, este archivo va a la RAÍZ del dominio (imprescindible para Play Store):

```
/public_html/.well-known/assetlinks.json
```

### Opción A — cPanel / Administrador de archivos (más fácil)

1. Entra en tu panel de hosting → "Administrador de archivos" (File Manager).
2. Navega a `public_html/`. Si no existe la carpeta `herramientas`, créala. Dentro de ella, crea `encuadre`.
3. Súbelos con el botón "Upload" (o arrastra los archivos).
4. Crea la carpeta `.well-known` en la raíz `public_html/`. **Importante**: como empieza con punto, algunos administradores la ocultan. Activa "Mostrar archivos ocultos" en Configuración.
5. Sube `assetlinks.json` dentro de `.well-known/`.

### Opción B — FTP con FileZilla

1. Descarga FileZilla → https://filezilla-project.org/
2. Datos de conexión: te los da tu hosting (host FTP, usuario, contraseña). Puerto 21 (FTP) o 22 (SFTP).
3. En el panel derecho, navega hasta `/public_html/herramientas/`.
4. Arrastra los archivos desde tu ordenador al servidor.

### Prueba rápida

Abre en el navegador:
- https://lluisridao.photo/herramientas/encuadre/ → debe cargar la app.
- https://lluisridao.photo/.well-known/assetlinks.json → debe mostrar el JSON.
- https://lluisridao.photo/herramientas/encuadre/manifest.webmanifest → debe mostrar el JSON del manifiesto.

Si `assetlinks.json` no carga, es porque tu servidor bloquea archivos ocultos. Añade esto a un `.htaccess` en la raíz:

```apache
<Files "assetlinks.json">
  Order allow,deny
  Allow from all
</Files>
```

---

## Paso 2 — Enlazar la app desde /herramientas/ en WordPress

En tu panel WordPress:

1. Ve a Páginas → busca la página **"Herramientas"** → **Editar**.
2. Añade un nuevo bloque (por ejemplo, "Grupo" o "Columnas"):

**HTML sugerido para el bloque (bloque "HTML personalizado"):**

```html
<a href="/herramientas/encuadre/" style="display:block;text-decoration:none;background:linear-gradient(135deg,#ffd700,#ff9a00);color:#000;padding:24px;border-radius:12px;margin:20px 0;max-width:520px;">
  <div style="display:flex;gap:16px;align-items:center;">
    <div style="font-size:40px;">📐</div>
    <div>
      <div style="font-size:20px;font-weight:700;">Encuadre Inteligente</div>
      <div style="font-size:14px;opacity:0.85;">Compón fotos con plantillas de tercios, áureo, comida, retrato… — Instalable como app.</div>
    </div>
  </div>
</a>
```

3. Guardar → publicar.

---

## Paso 3 — MIME de `.webmanifest` (por si acaso)

Algunos hostings sirven `.webmanifest` como texto plano. En la raíz `public_html/` edita `.htaccess` y añade:

```apache
AddType application/manifest+json .webmanifest
AddType image/svg+xml .svg
```

Comprueba con las DevTools de Chrome (F12 → Network → clic en `manifest.webmanifest` → Response Headers). Debe decir `Content-Type: application/manifest+json`.

---

## Paso 4 — Verifica que es PWA "installable"

En Chrome desktop:

1. Abre https://lluisridao.photo/herramientas/encuadre/
2. F12 → pestaña **Application** → **Manifest**. Verifica que aparece el icono y no hay errores.
3. F12 → pestaña **Lighthouse** → "PWA" → **Analyze page load**. Debe pasar todas.
4. En la barra de direcciones aparece un icono de **"Instalar app"**. Click y la instala como app de escritorio.

Si Lighthouse falla en "installable":
- Comprueba que `manifest.webmanifest` carga con MIME correcto.
- Comprueba que `service-worker.js` carga en la pestaña Application → Service Workers.

---

## Paso 5 — Cambiar el enlace de "Comprar PRO"

Ahora mismo apunta a `https://lluisridao.gumroad.com/l/encuadre-pro`. En Gumroad:

1. Cuenta gratis en → https://gumroad.com/
2. Crea producto "Encuadre Inteligente PRO" (9,99 €).
3. Copia la URL del producto (tipo `https://lluisridao.gumroad.com/l/xxxxx`).
4. Edita `encuadre-inteligente.html` línea con `BUY_PRO_URL` y sustituye.
5. Sube el archivo modificado por FTP encima del anterior.

---

## Paso 6 — Publicar en Play Store (sigue igual que antes)

La única diferencia respecto a la guía general es que usarás **`lluisridao.photo`** como dominio en todos los pasos de Bubblewrap, y **el package name recomendado** es `photo.lluisridao.encuadre` (ya te lo dejé configurado en `twa-manifest.json`).

Los pasos, ya adaptados a tu dominio:

```bash
npm install -g @bubblewrap/cli
cd /ruta/local/donde/tengas/tu/proyecto
bubblewrap init --manifest=https://lluisridao.photo/herramientas/encuadre/manifest.webmanifest
# Cuando pregunte package name, deja o pon: photo.lluisridao.encuadre
# Genera un keystore nuevo → GUARDA las contraseñas
bubblewrap build
```

Después obtén el SHA-256:

```bash
keytool -list -v -keystore android.keystore -alias android
```

Copia el fingerprint (línea `SHA256: XX:XX:...`) sin `:` ni espacios. Edita el `assetlinks.json` que ya subiste, sustituye el placeholder, y **vuelve a subirlo** por FTP.

Comprueba que quedó bien:
→ https://developers.google.com/digital-asset-links/tools/generator
Pon: `lluisridao.photo`, `photo.lluisridao.encuadre`, tu SHA-256. Debe decir **"Statement found"**.

Luego sube el `.aab` a Play Console como app nueva.

---

## Recordatorio de política de privacidad

El archivo `privacy.html` ya te lo he preparado. En Play Console te van a pedir una URL pública de política de privacidad. Usa: `https://lluisridao.photo/herramientas/encuadre/privacy.html`

Antes de enviar, **cambia el email de contacto** en `privacy.html` a tu email real (línea del final).

---

## Cuando actualices la app

Cada vez que edites `encuadre-inteligente.html` (o cualquier archivo):

1. Cambia la línea en `service-worker.js`:
   ```js
   const CACHE = 'encuadre-v1';
   ```
   por `'encuadre-v2'`, `'encuadre-v3'`, etc. Esto **fuerza el refresco** en dispositivos que ya tenían la app cacheada.

2. Sube por FTP los archivos cambiados.

Para actualizar en Play Store, incrementa `appVersionCode` y `appVersionName` en `twa-manifest.json`, corre `bubblewrap update` + `bubblewrap build`, y sube el nuevo `.aab`.

---

## Checklist rápida final

- [ ] Archivos subidos a `/public_html/herramientas/encuadre/`
- [ ] `.well-known/assetlinks.json` accesible desde la raíz
- [ ] MIME de `.webmanifest` correcto
- [ ] Lighthouse PWA en verde
- [ ] Bloque de enlace en la página "Herramientas" de WordPress
- [ ] Gumroad con producto creado y URL puesta en `BUY_PRO_URL`
- [ ] `privacy.html` con tu email de contacto real
- [ ] Cuenta Google Play Developer creada (25 $)
- [ ] Bubblewrap ejecutado con tu dominio
- [ ] `assetlinks.json` con el SHA-256 real (no el placeholder)
- [ ] Validador de Digital Asset Links en verde
- [ ] `.aab` subido a Play Console

Cada casilla es un rato. En una tarde tienes los 5 primeros; el resto exige la cuenta de Play Developer (24–48 h de verificación).
