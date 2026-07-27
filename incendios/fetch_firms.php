<?php
/**
 * Descarga incendios NASA FIRMS y genera data/incendios.json.
 *
 * Estrategia: curl (extensión PHP) -> file_get_contents -> shell_exec curl.
 * Si TODAS las fuentes fallan, NO sobreescribe el JSON existente (preserva
 * los datos válidos de la ejecución anterior).
 *
 * MAP_KEY se lee, por orden, de:
 *   1. variable de entorno FIRMS_MAP_KEY
 *   2. archivo config.php junto a este script (define('FIRMS_MAP_KEY', '...'))
 * Nunca hardcodear la clave en este archivo (el repo es público).
 */

// --- Configuración ---
$configFile = __DIR__ . '/config.php';
if (is_readable($configFile)) {
    require_once $configFile;
}

$MAP_KEY = getenv('FIRMS_MAP_KEY');
if (!$MAP_KEY && defined('FIRMS_MAP_KEY')) {
    $MAP_KEY = FIRMS_MAP_KEY;
}

$DATA_DIR = __DIR__ . '/data';
$OUTPUT_FILE = $DATA_DIR . '/incendios.json';

if (!is_dir($DATA_DIR)) {
    mkdir($DATA_DIR, 0755, true);
}

log_message('Starting FIRMS data fetch');

if (!$MAP_KEY) {
    log_message('ABORT: no MAP_KEY. Define FIRMS_MAP_KEY en config.php o como variable de entorno.', true);
    exit(1);
}

// Bounding box de España peninsular + Baleares + Canarias no incluidas (ajusta si quieres)
$bbox = '-9.5,35.9,4.3,43.8';
$days = 7;

$sources = [
    'VIIRS_SNPP' => 'viirs-snpp',
    'VIIRS_NOAA' => 'viirs-n20',
    'MODIS_TERRA' => 'modis-t',
];

$allData = [];
$errors = [];
$anySuccess = false;

foreach ($sources as $name => $source) {
    $url = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/$MAP_KEY/$source/$bbox/$days";
    log_message("Fetching $name...");

    $csv = fetch_url($url, $fetchError);
    if (!$csv) {
        $errors[] = "$name: $fetchError";
        log_message("ERROR $name: $fetchError", true);
        continue;
    }
    $anySuccess = true;

    $lines = explode("\n", $csv);
    $header = null;

    foreach ($lines as $line) {
        if (empty(trim($line))) continue;

        if ($header === null) {
            $header = str_getcsv($line);
            continue;
        }

        $row = str_getcsv($line);
        if (count($row) < 5) continue;

        $data = @array_combine($header, $row);
        if ($data === false) continue;

        $feature = [
            'type' => 'Feature',
            'geometry' => [
                'type' => 'Point',
                'coordinates' => [
                    (float)($data['longitude'] ?? 0),
                    (float)($data['latitude'] ?? 0),
                ],
            ],
            'properties' => [
                'acq_date' => $data['acq_date'] ?? '',
                'acq_time' => $data['acq_time'] ?? '',
                'latitude' => (float)($data['latitude'] ?? 0),
                'longitude' => (float)($data['longitude'] ?? 0),
                'frp' => (float)($data['frp'] ?? 0),
                'confidence' => mapConfidence($data['confidence'] ?? ''),
                'instrument' => $name,
                'satellite' => $data['satellite'] ?? '',
                'region' => getRegionFromCoords((float)($data['latitude'] ?? 0), (float)($data['longitude'] ?? 0)),
            ],
        ];

        // Deduplicado <1km y <10min entre satélites
        $isDuplicate = false;
        foreach ($allData as $existing) {
            $dist = haversineDistance(
                $existing['properties']['latitude'],
                $existing['properties']['longitude'],
                $feature['properties']['latitude'],
                $feature['properties']['longitude']
            );

            if ($dist < 1 &&
                $existing['properties']['acq_date'] === $feature['properties']['acq_date'] &&
                abs(strtotime($existing['properties']['acq_time']) - strtotime($feature['properties']['acq_time'])) < 600) {
                $isDuplicate = true;
                break;
            }
        }

        if (!$isDuplicate) {
            $allData[] = $feature;
        }
    }
}

// Si TODAS las fuentes fallaron: preserva el JSON anterior.
if (!$anySuccess) {
    log_message('All sources failed. Preserving previous incendios.json.', true);
    exit(1);
}

usort($allData, function ($a, $b) {
    $timeA = strtotime($a['properties']['acq_date'] . ' ' . $a['properties']['acq_time']);
    $timeB = strtotime($b['properties']['acq_date'] . ' ' . $b['properties']['acq_time']);
    return $timeB - $timeA;
});

$geojson = [
    'type' => 'FeatureCollection',
    'timestamp' => date('c'),
    'count' => count($allData),
    'errors' => $errors,
    'features' => $allData,
];

// Escritura atómica para que el frontend nunca lea un JSON a medias.
$json = json_encode($geojson, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
$tmp = $OUTPUT_FILE . '.tmp';
if (file_put_contents($tmp, $json) !== false) {
    rename($tmp, $OUTPUT_FILE);
}

log_message('Success: ' . count($allData) . ' features written');

// -------------------- Helpers --------------------

/**
 * Intenta descargar $url con tres estrategias distintas.
 * Rellena $error con el motivo del último fallo.
 */
function fetch_url($url, &$error = null) {
    $error = null;

    // 1) cURL (extensión PHP)
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_USERAGENT => 'incendios-datosclaros/1.0 (+https://bigdata.datosclaros.es/incendios)',
        ]);
        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($body !== false && $status >= 200 && $status < 300 && strlen($body) > 0) {
            return $body;
        }
        $error = 'curl status=' . $status . ($curlErr ? " err=$curlErr" : '');
    } else {
        $error = 'curl extension not available';
    }

    // 2) file_get_contents (por si allow_url_fopen sí funciona)
    if (function_exists('file_get_contents') && ini_get('allow_url_fopen')) {
        $ctx = stream_context_create([
            'http' => [
                'timeout' => 30,
                'follow_location' => 1,
                'user_agent' => 'incendios-datosclaros/1.0',
            ],
        ]);
        $body = @file_get_contents($url, false, $ctx);
        if ($body !== false && strlen($body) > 0) {
            return $body;
        }
        $lastErr = error_get_last();
        $error = 'file_get_contents failed' . ($lastErr ? ': ' . $lastErr['message'] : '');
    }

    // 3) shell_exec curl (fallback si el binario existe)
    if (function_exists('shell_exec')) {
        $which = @shell_exec('command -v curl 2>/dev/null');
        if ($which) {
            $cmd = 'curl -sS -L --max-time 30 ' . escapeshellarg($url) . ' 2>&1';
            $body = @shell_exec($cmd);
            if ($body && strlen($body) > 0 && strpos($body, 'curl:') !== 0) {
                return $body;
            }
            $error = 'shell curl failed: ' . substr((string)$body, 0, 200);
        }
    }

    return null;
}

function mapConfidence($rawConf) {
    // NASA FIRMS devuelve 'l','n','h' (VIIRS) o 0-100 (MODIS)
    $s = strtolower(trim((string)$rawConf));
    if ($s === 'h') return 'high';
    if ($s === 'n') return 'medium';
    if ($s === 'l') return 'low';
    if ($s === '') return 'low';
    $conf = (int)$rawConf;
    if ($conf >= 80) return 'high';
    if ($conf >= 50) return 'medium';
    return 'low';
}

function getRegionFromCoords($lat, $lon) {
    $regions = [
        'Cataluña' => ['lat' => [40.5, 42.9], 'lon' => [0.1, 3.3]],
        'Madrid' => ['lat' => [39.8, 41.0], 'lon' => [-4.5, -2.7]],
        'Andalucía' => ['lat' => [36.0, 38.8], 'lon' => [-3.8, 0.0]],
        'Castilla-León' => ['lat' => [39.8, 42.6], 'lon' => [-7.0, -2.0]],
        'Galicia' => ['lat' => [41.7, 43.8], 'lon' => [-9.3, -6.8]],
        'Comunidad Valenciana' => ['lat' => [38.2, 40.8], 'lon' => [-1.5, 0.8]],
        'Castilla-La Mancha' => ['lat' => [37.6, 40.4], 'lon' => [-4.0, -1.5]],
        'Aragón' => ['lat' => [39.9, 42.9], 'lon' => [-1.7, 0.6]],
    ];

    foreach ($regions as $name => $bounds) {
        if ($lat >= $bounds['lat'][0] && $lat <= $bounds['lat'][1] &&
            $lon >= $bounds['lon'][0] && $lon <= $bounds['lon'][1]) {
            return $name;
        }
    }

    return 'Otra región';
}

function haversineDistance($lat1, $lon1, $lat2, $lon2) {
    $earth_radius = 6371;
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a = sin($dLat / 2) * sin($dLat / 2) +
         cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
         sin($dLon / 2) * sin($dLon / 2);
    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
    return $earth_radius * $c;
}

function log_message($msg, $isError = false) {
    $timestamp = date('Y-m-d H:i:s');
    $logFile = __DIR__ . '/fetch_firms.log';
    $prefix = $isError ? '[ERROR]' : '[INFO]';
    $logLine = "[$timestamp] $prefix $msg\n";

    file_put_contents($logFile, $logLine, FILE_APPEND);

    if (file_exists($logFile) && filesize($logFile) > 5242880) {
        $lines = file($logFile);
        file_put_contents($logFile, implode('', array_slice($lines, -1000)));
    }
}
