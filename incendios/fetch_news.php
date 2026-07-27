<?php
/**
 * Descarga noticias sobre incendios forestales en España desde
 * Google News RSS y genera data/noticias.json.
 *
 * Google News RSS agrega de fuentes oficiales y prensa (RTVE, EFE,
 * ministerios, gobiernos autonomicos, ayuntamientos, prensa regional).
 * Sin autenticacion, sin limites practicos.
 *
 * Idempotente: si la descarga falla no toca el JSON existente.
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
@set_time_limit(60);

$DATA_DIR = __DIR__ . '/data';
$OUTPUT = $DATA_DIR . '/noticias.json';

if (!is_dir($DATA_DIR)) mkdir($DATA_DIR, 0755, true);

log_message('Starting news fetch');

// Consulta editorial: incendios forestales en España.
// Google News agrega fuentes españolas y devuelve el nombre del medio
// en <source>; site: nos deja pedir por medio concreto.
$FEEDS = [
    'google-general' => 'https://news.google.com/rss/search?q=%22incendio+forestal%22+Espa%C3%B1a&hl=es-ES&gl=ES&ceid=ES:es',
    'google-lavanguardia' => 'https://news.google.com/rss/search?q=incendio+forestal+site%3Alavanguardia.com&hl=es-ES&gl=ES&ceid=ES:es',
    'google-elpais' => 'https://news.google.com/rss/search?q=incendio+forestal+site%3Aelpais.com&hl=es-ES&gl=ES&ceid=ES:es',
    'google-vilaweb' => 'https://news.google.com/rss/search?q=incendi+forestal+site%3Avilaweb.cat&hl=ca&gl=ES&ceid=ES:ca',
    'google-rtve' => 'https://news.google.com/rss/search?q=incendio+forestal+site%3Artve.es&hl=es-ES&gl=ES&ceid=ES:es',
    'google-elmundo' => 'https://news.google.com/rss/search?q=incendio+forestal+site%3Aelmundo.es&hl=es-ES&gl=ES&ceid=ES:es',
    'google-abc' => 'https://news.google.com/rss/search?q=incendio+forestal+site%3Aabc.es&hl=es-ES&gl=ES&ceid=ES:es',
    'google-324' => 'https://news.google.com/rss/search?q=incendi+forestal+site%3A3cat.cat&hl=ca&gl=ES&ceid=ES:ca',
];

$items = [];
$errors = [];
$anySuccess = false;

foreach ($FEEDS as $name => $url) {
    log_message("Fetching $name...");
    $xml = fetch_url($url, $err);
    if (!$xml) {
        $errors[] = "$name: $err";
        log_message("ERROR $name: $err", true);
        continue;
    }
    $anySuccess = true;
    log_message("$name: " . strlen($xml) . " bytes");

    $parsed = @simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NOCDATA);
    if (!$parsed) {
        $errors[] = "$name: XML no parseable";
        log_message("$name: XML no parseable", true);
        continue;
    }

    // Estructura RSS 2.0: rss > channel > item(s)
    $entries = $parsed->channel->item ?? [];
    foreach ($entries as $it) {
        $title = trim((string)$it->title);
        $link = trim((string)$it->link);
        $desc = trim((string)$it->description);
        $pubRaw = trim((string)$it->pubDate);
        $source = trim((string)($it->source ?? ''));
        // Google News mete el nombre del medio en <source>. Si no, extraer del titulo (formato "Titulo - Medio")
        if (!$source && preg_match('/ - ([^-]+)$/', $title, $m)) {
            $source = trim($m[1]);
            $title = trim(preg_replace('/ - [^-]+$/', '', $title));
        }
        $ts = $pubRaw ? strtotime($pubRaw) : null;

        if (!$title || !$link) continue;

        $items[] = [
            'title' => $title,
            'link' => $link,
            'source' => $source ?: 'Google News',
            'pubDate' => $pubRaw,
            'timestamp' => $ts ? date('c', $ts) : null,
        ];
    }
    log_message("$name: " . count($entries) . " items");
}

if (!$anySuccess) {
    log_message('All feeds failed. Preserving previous noticias.json.', true);
    exit(1);
}

// Deduplicar por URL de destino (Google News mezcla la misma noticia entre
// consultas). Mantener el primer aparecido (más metadata suele traer).
$byUrl = [];
foreach ($items as $it) {
    $key = strtolower(trim($it['link']));
    if (!isset($byUrl[$key])) $byUrl[$key] = $it;
}
$items = array_values($byUrl);

// Ordenar por fecha desc, cortar a 30
usort($items, function ($a, $b) {
    return strtotime($b['pubDate'] ?? '0') - strtotime($a['pubDate'] ?? '0');
});
$items = array_slice($items, 0, 30);

$payload = [
    'timestamp' => date('c'),
    'count' => count($items),
    'errors' => $errors,
    'items' => $items,
];

$tmp = $OUTPUT . '.tmp';
file_put_contents($tmp, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
rename($tmp, $OUTPUT);

log_message('Success: ' . count($items) . ' noticias written');

// -------------------- Helpers --------------------

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
            CURLOPT_USERAGENT => 'incendios-datosclaros/1.0 (+https://bigdata.datosclaros.es/incendios)',
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
        $ctx = stream_context_create(['http' => ['timeout' => 20, 'user_agent' => 'incendios-datosclaros/1.0']]);
        $body = @file_get_contents($url, false, $ctx);
        if ($body !== false && strlen($body) > 0) return $body;
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
