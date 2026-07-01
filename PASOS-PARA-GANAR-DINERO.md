# De cero a facturar — Guía paso a paso

**No puedo hacer estos pasos por ti** (todos exigen tu email/tarjeta/identidad). Pero solo son clics; cada paso enlaza directo. Tiempo total: ~4 horas de trabajo activo repartidas en 3–7 días (por la revisión de Play).

---

## 📋 Resumen de la ruta (ordenada por mayor rentabilidad)

| # | Paso | Coste | Tiempo | ¿Para qué? |
|---|------|-------|--------|------------|
| 1 | Firebase Hosting | **Gratis** | 30 min | Sirve la PWA por HTTPS (obligatorio) |
| 2 | Dominio propio (opcional) | 12 €/año | 15 min | Marca más pro (encuadre.app en vez de encuadre.web.app) |
| 3 | Gumroad para vender PRO | **Gratis** (10 % por venta) | 20 min | Vende licencias PRO desde ya, sin backend |
| 4 | Google Play Developer | 25 $ **pago único** | 40 min | Publica en Play Store |
| 5 | Bubblewrap → APK/AAB | Gratis | 1 h | Empaqueta la PWA como app Android |
| 6 | Publicar en Play Store | Gratis | Revisión 3–7 días | Distribución masiva |
| 7 | Marketing / ASO | 0–500 € | Continuo | Que la gente la encuentre |

---

## ✅ Paso 1 — Firebase Hosting (subir la web)

**Por qué**: Sin HTTPS público, ni PWA ni Bubblewrap funcionan. Firebase es gratis hasta 10 GB/mes y ~360 MB de almacenamiento (te sobra).

1. Abre → https://console.firebase.google.com/
2. Inicia sesión con tu Gmail. Click **"Add project"**.
3. Nombre del proyecto: `encuadre-inteligente`. Sigue → sigue → **"Create project"**.
4. En el menú izquierdo, entra en **"Build → Hosting"**. Click **"Get started"**.
5. Instala la CLI en tu ordenador. Abre una terminal:
   ```bash
   npm install -g firebase-tools
   firebase login
   # Se abre Chrome, autoriza la cuenta.
   cd /ruta/donde/tengas/nai
   firebase init hosting
   # Elige el proyecto que acabas de crear.
   # Public directory: . (un punto, es la carpeta actual)
   # Configurar como SPA? No
   # Sobrescribir index? No
   firebase deploy
   ```
6. Al final imprime una URL tipo `https://encuadre-inteligente.web.app`. **Cópiala.** Ábrela en Chrome; verás la app.

📌 Ya tienes app pública. Cualquiera con Android puede instalarla "Añadir a pantalla de inicio" y usarla como app.

---

## ✅ Paso 2 — Dominio propio (opcional, recomendado)

Te da credibilidad y ayuda al SEO.

1. Compra dominio en Namecheap, Porkbun o Google Domains (~10 €/año). Ej: `encuadre.app`.
2. En Firebase Console → Hosting → **"Add custom domain"**. Pega el dominio.
3. Firebase te da 2 registros DNS (A o TXT). Cópialos.
4. En el panel de tu registrador de dominios → DNS, pega los registros.
5. Espera 15 min – 24 h. Firebase certifica automáticamente HTTPS.

---

## ✅ Paso 3 — Gumroad (vender PRO **hoy mismo**)

Empieza a vender antes incluso de publicar en Play.

1. → https://gumroad.com/ crea cuenta gratis.
2. Crea producto **"Encuadre Inteligente Pro — Licencia"**. Precio 9,99 € (o el que quieras).
3. En "Content" añade un texto:
   > "Tu clave de licencia: [copia aquí una clave que tú generes con el formato ENC-XXXX-XXXX-XXXX que valide el checksum]"

   Para generarlas en bulk, en Node:
   ```js
   function gen() {
     const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
     while (true) {
       const body = Array.from({length:12}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
       const k = 'ENC-'+body.slice(0,4)+'-'+body.slice(4,8)+'-'+body.slice(8,12);
       let sum = 0;
       for (const c of k.replace(/-/g,'')) sum = (sum*31 + c.charCodeAt(0)) >>> 0;
       if (sum % 97 === 42) return k;
     }
   }
   for (let i=0; i<50; i++) console.log(gen());
   ```
4. Sube el enlace del producto en tu PWA (botón "Comprar PRO" en la modal de Ajustes — te lo añado al final).
5. Cobras a través de Gumroad → 90 % para ti, sin gestión.

⚠️ **Recomendación seria**: monta un mini-backend para no filtrar tu algoritmo de claves. Con Cloudflare Workers gratis (100k requests/día) puedes tener un endpoint `/verify?key=X` que consulte una lista de claves emitidas.

---

## ✅ Paso 4 — Cuenta Google Play Developer

**25 $ una vez, para siempre.** Requiere DNI/pasaporte.

1. → https://play.google.com/console/signup
2. Elige **"Personal"** (o empresa si tienes NIF).
3. Rellena datos, sube DNI, paga 25 $.
4. Google verifica en 1–3 días. Recibes email.

---

## ✅ Paso 5 — Bubblewrap: PWA → app Android

Esto empaqueta tu URL como app Android.

1. Instala Android Studio (gratis, incluye Java): https://developer.android.com/studio
2. En terminal:
   ```bash
   npm install -g @bubblewrap/cli
   cd /ruta/donde/tengas/nai
   bubblewrap init --manifest=https://encuadre-inteligente.web.app/manifest.webmanifest
   ```
   Contestará preguntas — te acepta valores por defecto. Cuando pregunte por el keystore, **elige contraseñas y guárdalas en un gestor**. Sin esas contraseñas, no puedes actualizar la app nunca más.

3. Compila:
   ```bash
   bubblewrap build
   ```
   Salida: `app-release-signed.aab` (para Play) y `app-release-signed.apk` (para probar).

4. **SHA-256 del keystore** (imprescindible para el paso siguiente):
   ```bash
   keytool -list -v -keystore android.keystore -alias android
   ```
   Copia el `SHA256:` (algo como `4E:0B:8C:...`) sin espacios ni dos puntos.

5. Edita `.well-known/assetlinks.json` en el repo (ya te lo dejé preparado):
   - Sustituye `REEMPLAZA-CON-EL-SHA256-DE-TU-KEYSTORE` por el fingerprint.
   - Ajusta `package_name` si cambiaste el default `com.encuadre.app`.

6. `firebase deploy` de nuevo para publicar `assetlinks.json`.
7. Verifica: → https://developers.google.com/digital-asset-links/tools/generator pega tu dominio y package name; debe decir **"Statement found: valid"**.

---

## ✅ Paso 6 — Subir a Play Store

1. En Play Console → **"Create app"**. Nombre: "Encuadre Inteligente Pro". Idioma: Español. Tipo: **App**. **"Free"** (para descargar; las compras son en Gumroad → fuera de Play Billing → no pagas comisión).
2. Ficha de tienda:
   - **Icono** 512×512 PNG. Convierte `icon-512.svg` con:
     ```bash
     # Con Inkscape:
     inkscape icon-512.svg --export-type=png --export-filename=icon-512.png -w 512 -h 512
     # O con rsvg-convert:
     rsvg-convert -w 512 -h 512 icon-512.svg -o icon-512.png
     ```
   - **Feature graphic** 1024×500 PNG (banner). Genera uno en Canva gratis.
   - **Screenshots**: mínimo 2 del teléfono (16:9 o 9:16). Toma capturas del emulador de Android Studio.
   - **Descripción corta** (80 char): "Compón fotos con guías profesionales: tercios, áureo, comida, retrato."
   - **Descripción larga** (usa la del README).
3. Política de privacidad: es **obligatoria**. Publícala en `https://encuadre-inteligente.web.app/privacy.html` (te dejo plantilla abajo).
4. Content rating → cuestionario automático → **PEGI 3 / Everyone**.
5. **"App release"** → **"Production"** → **"Create new release"** → sube el `.aab` de Bubblewrap.
6. Revisión de Google: 3–7 días. Luego se publica.

---

## ✅ Paso 7 — Empezar a ganar

**Estrategia realista** (fotografía tiene mucha competencia):

- Nicho tu marketing: **"Fotos de comida para Instagram"** o **"Composición para fotografía móvil"**. La plantilla de "Food" es tu diferenciador.
- ASO (App Store Optimization): keywords en el título y descripción. Herramienta gratis: Google Play Search Suggest.
- Redes sociales: TikToks de 15 s "así encuadro fotos de comida" → link a Play.
- Reels de "antes/después".
- Precio inicial bajo (4,99 €) durante 2 semanas para reviews, luego sube a 9,99 €.

**Cuentas realistas**: una app de nicho bien hecha suele hacer 100–1000 €/mes tras 3–6 meses de tracción. Casos raros pasan de eso.

---

## 🎁 Plantillas incluidas en el repo

- `firebase.json` — config lista para `firebase deploy`
- `twa-manifest.json` — config de Bubblewrap (edita el dominio)
- `.well-known/assetlinks.json` — plantilla para Digital Asset Links
- Iconos SVG (convertir a PNG para Play)

## 📄 Falta: política de privacidad

Play te la exigirá. Como no envías datos a ningún servidor (todo pasa en el navegador), es muy corta. ¿Quieres que te genere `privacy.html` con una política mínima válida?
