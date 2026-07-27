<?php
/**
 * Descarga noticias sobre incendios forestales en España y genera
 * data/noticias.json.
 *
 * Estrategia doble para no depender de una sola fuente:
 *   1. Google News RSS — varias consultas, incluida una por medio.
 *   2. Feeds RSS nativos de medios, filtrados por palabra clave.
 *
 * Si TODAS fallan, NO toca el JSON existente.
 *
 * Diagnóstico: al abrirlo en el navegador imprime cuántos ítems ha
 * sacado cada feed, para ver de un vistazo cuál está fallando.
 */

$IS_WEB = !empty($_SERVER['HTTP_HOST']);
if ($IS_WEB) {
    while (ob_get_level() > 0) { @ob_end_clean(); }
    header('Content-Type: text/plain; charset=utf-8');
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
    echo "[boot] fetch_news.php iniciando...\n";
    @ob_flush(); @flush();
}
@set_time_limit(180);

$DATA_DIR = __DIR__ . '/data';
$OUTPUT = $DATA_DIR . '/noticias.json';

if (!is_dir($DATA_DIR)) mkdir($DATA_DIR, 0755, true);

log_message('Starting news fetch');

// --- Fuente 1: Google News RSS ---
// Devuelve el nombre real del medio en <source>, así que las tarjetas
// muestran "La Vanguardia", "El País"... y no un genérico.
$GOOGLE = [
    'gn-general'   => 'incendio forestal España',
    'gn-incendios' => 'incendios forestales',
    'gn-extincion' => 'incendio forestal extinción hectáreas',
    'gn-detenido'  => 'detenido incendio forestal',
];

// --- Fuente 2: RSS nativos de medios (se filtran por palabra clave) ---
// Más fiables que Google News si este bloquea la IP del hosting.
$FEEDS_DIRECTOS = [
    'rtve-sociedad'    => 'https://api.rtve.es/rss/temas_sociedad.xml',
    'eldiario-general' => 'https://www.eldiario.es/rss/',
    '20minutos'        => 'https://www.20minutos.es/rss/',
    'publico'          => 'https://www.publico.es/rss/',
    'lavanguardia'     => 'https://www.lavanguardia.com/rss/home.xml',
    'elperiodico'      => 'https://www.elperiodico.com/es/rss/rss_portada.xml',
    'catalunya-324'    => 'https://www.3cat.cat/324/rss/',
];

// Palabras que debe contener el titular o la entradilla para colar
// una noticia de un feed genérico.
$KEYWORDS = ['incendi', 'fuego forestal', 'llamas', 'quema', 'foc forestal', 'flames'];

$items = [];
$errors = [];
$anySuccess = false;
$stats = [];

// ---------- 1) Google News ----------
foreach ($GOOGLE as $name => $query) {
    $url = 'https://news.google.com/rss/search?q=' . rawurlencode($query)
         . '&hl=es-ES&gl=ES&ceid=ES%3Aes';

    $found = procesarFeed($name, $url, null, $items, $errors, $anySuccess);
    $stats[$name] = $found;
}

// ---------- 2) Feeds directos filtrados ----------
foreach ($FEEDS_DIRECTOS as $name => $url) {
    $found = procesarFeed($name, $url, $KEYWORDS, $items, $errors, $anySuccess);
    $stats[$name] = $found;
}

log_message('--- Resumen por feed ---');
foreach ($stats as $n => $c) {
    log_message(sprintf('  %-18s %s', $n, $c === null ? 'FALLO' : $c . ' items'));
}

if (!$anySuccess) {
    log_message('Todas las fuentes fallaron. Se conserva el noticias.json anterior.', true);
    exit(1);
}

// ---------- Deduplicar ----------
// Google News mezcla la misma noticia entre consultas. Deduplicamos por
// URL y, además, por titular normalizado (la misma noticia puede llegar
// con URLs distintas desde feeds distintos).
$vistos = [];
$unicos = [];
foreach ($items as $it) {
    $kUrl = strtolower(trim($it['link']));
    $kTit = preg_replace('/[^a-z0-9]/', '', strtolower($it['title']));
    $kTit = substr($kTit, 0, 60);
    if (isset($vistos[$kUrl]) || ($kTit && isset($vistos[$kTit]))) continue;
    $vistos[$kUrl] = true;
    if ($kTit) $vistos[$kTit] = true;
    $unicos[] = $it;
}
$items = $unicos;

// Ordenar por fecha desc
usort($items, function ($a, $b) {
    return strtotime($b['pubDate'] ?? '0') - strtotime($a['pubDate'] ?? '0');
});
$items = array_slice($items, 0, 40);

$payload = [
    'timestamp' => date('c'),
    'count' => count($items),
    'errors' => $errors,
    'feeds' => $stats,
    'items' => $items,
];

$tmp = $OUTPUT . '.tmp';
file_put_contents($tmp, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
rename($tmp, $OUTPUT);

log_message('Success: ' . count($items) . ' noticias escritas en ' . $OUTPUT);

// -------------------- Funciones --------------------

/**
 * Descarga y parsea un feed. Si $keywords no es null, solo acepta
 * ítems cuyo titular o descripción contengan alguna de esas palabras.
 * Devuelve el número de ítems añadidos, o null si el feed falló.
 */
function procesarFeed($name, $url, $keywords, &$items, &$errors, &$anySuccess) {
    log_message("Fetching $name...");

    $xml = fetch_url($url, $err);
    if (!$xml) {
        $errors[] = "$name: $err";
        log_message("  ERROR $name: $err", true);
        return null;
    }

    $parsed = @simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NOCDATA);
    if (!$parsed) {
        $errors[] = "$name: XML no parseable";
        log_message("  ERROR $name: XML no parseable (" . strlen($xml) . " bytes)", true);
        return null;
    }

    $anySuccess = true;

    // RSS 2.0 (channel/item) o Atom (entry)
    $entries = [];
    if (isset($parsed->channel->item)) {
        $entries = $parsed->channel->item;
    } elseif (isset($parsed->entry)) {
        $entries = $parsed->entry;
    }

    $added = 0;
    foreach ($entries as $it) {
        $title = trim((string)$it->title);
        $link = trim((string)$it->link);

        // Atom guarda el enlace en un atributo
        if (!$link && isset($it->link['href'])) {
            $link = trim((string)$it->link['href']);
        }

        $desc = trim(strip_tags((string)$it->description));
        if (!$desc && isset($it->summary)) $desc = trim(strip_tags((string)$it->summary));

        $pubRaw = trim((string)$it->pubDate);
        if (!$pubRaw && isset($it->updated)) $pubRaw = trim((string)$it->updated);
        if (!$pubRaw && isset($it->published)) $pubRaw = trim((string)$it->published);

        if (!$title || !$link) continue;

        // Filtro por palabra clave en feeds genéricos
        if ($keywords !== null) {
            $heno = mb_strtolower($title . ' ' . $desc, 'UTF-8');
            $match = false;
            foreach ($keywords as $kw) {
                if (mb_strpos($heno, $kw) !== false) { $match = true; break; }
            }
            if (!$match) continue;
        }

        // Nombre del medio
        $source = trim((string)($it->source ?? ''));
        if (!$source && preg_match('/ - ([^-]+)$/u', $title, $m)) {
            $source = trim($m[1]);
            $title = trim(preg_replace('/ - [^-]+$/u', '', $title));
        }
        if (!$source) $source = medioDesdeUrl($link);

        $ts = $pubRaw ? strtotime($pubRaw) : null;

        $items[] = [
            'title' => $title,
            'link' => $link,
            'source' => $source ?: 'Prensa',
            'pubDate' => $pubRaw,
            'timestamp' => $ts ? date('c', $ts) : null,
        ];
        $added++;
    }

    log_message("  $name: " . strlen($xml) . " bytes, " . count($entries) . " entradas, $added utiles");
    return $added;
}

/** Deduce el nombre del medio a partir del dominio del enlace. */
function medioDesdeUrl($url) {
    $host = parse_url($url, PHP_URL_HOST);
    if (!$host) return '';
    $host = preg_replace('/^www\./', '', $host);
    $mapa = [
        'lavanguardia.com' => 'La Vanguardia',
        'elpais.com' => 'El País',
        'elmundo.es' => 'El Mundo',
        'abc.es' => 'ABC',
        'rtve.es' => 'RTVE',
        'eldiario.es' => 'elDiario.es',
        '20minutos.es' => '20minutos',
        'publico.es' => 'Público',
        'elperiodico.com' => 'El Periódico',
        'vilaweb.cat' => 'VilaWeb',
        '3cat.cat' => '3Cat',
        'lasexta.com' => 'laSexta',
        'antena3.com' => 'Antena 3',
        'europapress.es' => 'Europa Press',
        'efe.com' => 'EFE',
    ];
    foreach ($mapa as $dom => $nombre) {
        if (strpos($host, $dom) !== false) return $nombre;
    }
    return $host;
}

function fetch_url($url, &$error = null) {
    $error = null;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_ENCODING => '',
            CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; incendios-datosclaros/1.0; +https://bigdata.datosclaros.es/incendios)',
            CURLOPT_HTTPHEADER => ['Accept: application/rss+xml, application/xml, text/xml, */*'],
        ]);
        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        if ($body !== false && $status >= 200 && $status < 300 && strlen($body) > 0) {
            return $body;
        }
        $error = "curl status=$status" . ($curlErr ? " err=$curlErr" : '');
    }

    if (function_exists('file_get_contents') && ini_get('allow_url_fopen')) {
        $ctx = stream_context_create(['http' => [
            'timeout' => 20,
            'user_agent' => 'Mozilla/5.0 (compatible; incendios-datosclaros/1.0)',
            'header' => "Accept: application/rss+xml, application/xml, text/xml, */*\r\n",
        ]]);
        $body = @file_get_contents($url, false, $ctx);
        if ($body !== false && strlen($body) > 0) return $body;
        if (!$error) $error = 'file_get_contents failed';
    }

    return null;
}

function log_message($msg, $isError = false) {
    global $IS_WEB;
    $ts = date('Y-m-d H:i:s');
    $line = "[$ts] " . ($isError ? '[ERROR]' : '[INFO]') . " $msg\n";
    file_put_contents(__DIR__ . '/fetch_news.log', $line, FILE_APPEND);
    if (!empty($IS_WEB)) { echo $line; @ob_flush(); @flush(); }
}
