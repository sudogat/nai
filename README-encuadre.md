# Encuadre Inteligente Pro

App web / PWA para componer y guardar fotos con guías profesionales (regla de tercios, áureo, triángulos, comida, retrato, etc.). Preparada para monetizar y publicarse como app Android.

## Archivos

- `encuadre-inteligente.html` – la app (todo en un solo HTML)
- `manifest.webmanifest` – manifiesto PWA
- `service-worker.js` – cache offline
- `icon-192.svg`, `icon-512.svg`, `icon-maskable.svg` – iconos

## Cómo probar en local

Un service worker sólo se registra sobre `http(s)://`, no `file://`. Sirve la carpeta con un servidor cualquiera:

```bash
# Python
python3 -m http.server 8080
# Node
npx serve .
```

Abre `http://localhost:8080/encuadre-inteligente.html` en Chrome/Edge. El navegador ofrecerá "Instalar app" tras unos segundos.

## Funcionalidades

**Gratis**
- Subir foto, mover, pinch-zoom, rotar (fino + botones 90°)
- 12 presets de composición
- 7 relaciones de aspecto (1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3)
- 6 filtros + brillo/contraste + espejo
- Deshacer / Rehacer (Ctrl+Z / Ctrl+Y)
- Guardar como JPG hasta 2K
- Instalación PWA + offline
- Guardar hasta 12 proyectos en el dispositivo
- Idioma ES / EN
- **Marca de agua obligatoria** con sufijo "FREE"

**PRO** (licencia)
- Marca de agua personalizable u ocultable
- Exportación 3K / 4K
- PNG y WebP
- Botón de Compartir (Web Share API con archivo)
- Textos de marca de agua propios

## Licencia y activación

`ProGate` (dentro del HTML) tiene dos rutas de validación:

1. Clave demo: `DEMO-PRO-2026`
2. Formato real: `ENC-XXXX-XXXX-XXXX` con checksum simple `(hash % 97) === 42`.

Para producción, **reemplaza la validación por una llamada a tu backend** (por ejemplo, Gumroad / LemonSqueezy / Paddle / Stripe Checkout + endpoint `/verify`). Esto también permite revocar claves y evitar sharing.

Ejemplo mínimo de reemplazo:

```js
activate: async (k) => {
  const r = await fetch('https://tuapi.com/verify', {
    method: 'POST',
    body: JSON.stringify({ key: k }),
  });
  const { valid } = await r.json();
  if (valid) { localStorage.setItem('proActive', '1'); return true; }
  return false;
}
```

## Modelos de negocio sugeridos

1. **PRO one-shot**: pago único (9,99 €) → clave permanente. Simple, funciona sin backend.
2. **Suscripción**: 2,99 €/mes o 19,99 €/año a través de Google Play Billing (dentro de la app envuelta) o Stripe.
3. **Freemium con marca**: mantén marca de agua "hecho con Encuadre" en gratis; PRO la quita.
4. **Packs de plantillas**: presets extra vendidos como paquetes de contenido.

## Publicar como app Android

### Opción A — PWA "instalable" (más rápido, sin tienda)

Solo hay que servir los archivos por HTTPS. El usuario abre la web en Chrome Android y "Añadir a pantalla de inicio". Aparece con icono propio, pantalla completa y offline.

Ventaja: cero fricción, sin cuenta de desarrollador (25 $ una vez para Play).
Inconveniente: no está en Play Store, no puedes cobrar por Play Billing.

### Opción B — Bubblewrap (TWA, gratis, Play Store) **RECOMENDADO**

Bubblewrap empaqueta tu PWA como una app Android (Trusted Web Activity) publicable en Play Store.

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://tu-dominio.com/manifest.webmanifest
bubblewrap build
# Genera un .aab firmado listo para subir
```

Requisitos:
- Servir la PWA por HTTPS con Lighthouse "installable" en verde.
- Firmar el archivo `assetlinks.json` en `https://tu-dominio.com/.well-known/assetlinks.json` con el fingerprint del keystore.
- Cuenta Google Play Developer (25 $ pago único).

### Opción C — PWABuilder (Web)

Ve a https://www.pwabuilder.com/ , mete tu URL, y descarga los paquetes Android (Bubblewrap), iOS y Windows. Es la vía más simple.

### Opción D — Capacitor (app híbrida con APIs nativas)

Si vas a añadir cámara real, notificaciones push, IAP nativo o filesystem, usa Capacitor:

```bash
npm init @capacitor/app
npx cap add android
# Copia encuadre-inteligente.html y assets a `www/` y ajusta index.html
npx cap sync
npx cap open android
```

Compila desde Android Studio y publica el `.aab`.

## Facturación in-app (Play Billing)

Si publicas por Play Store, Google exige Play Billing para bienes digitales. Los flujos:

- **TWA (Bubblewrap)**: `PaymentRequest` con `https://play.google.com/billing` como método (Digital Goods API).
- **Capacitor**: plugin oficial de billing.

Alternativa: mantén la app como **herramienta** con función completa, y ofrece licencia PRO vía tu web (Stripe/Gumroad). Verifica la clave en la app. Play no puede exigir Billing si la compra es fuera de la app y para un servicio externo — revisa la política vigente.

## Checklist Play Store

- [ ] Icono 512×512 PNG (convierte `icon-512.svg` con Inkscape o `rsvg-convert`).
- [ ] Feature graphic 1024×500 PNG.
- [ ] 2–8 capturas de pantalla del teléfono.
- [ ] Descripción corta (80 caracteres) y larga (4000).
- [ ] Política de privacidad publicada por URL.
- [ ] Vídeo YouTube opcional (30–60 s).
- [ ] Categoría: Fotografía.
- [ ] Content rating: PEGI 3 / Everyone.

## Mejoras futuras

- Cámara real vía `getUserMedia` (captura en vivo con guías superpuestas).
- Batch: cola de varias fotos y aplicar el mismo encuadre a todas (PRO).
- Auto-encuadre con IA local (TensorFlow.js MobileNet + saliency).
- Exportar historia (Instagram) con marca automática.
- Sincronización de proyectos entre dispositivos con cuenta.

## Atajos de teclado

- `Ctrl+Z` / `Ctrl+Y` — deshacer / rehacer
- `Ctrl+S` — guardar
- `R` — reset
- `G` — mostrar/ocultar guías
