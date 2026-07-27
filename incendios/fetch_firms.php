<?php
/**
 * Descarga incendios NASA FIRMS y genera data/incendios.json.
 *
 * Fuente: FIRMS Active Fire Data (CSV públicos, SIN API key).
 * Se descargan los CSV de Europa de los últimos 7 días para VIIRS
 * SNPP, VIIRS NOAA-20 y MODIS, y se filtra a España por bounding box.
 *
 * Ventajas frente a la Area API con MAP_KEY:
 *  - No requiere clave, no hay límite por transacciones.
 *  - Es la misma detección de NASA, publicada como fichero estático.
 *
 * Si TODAS las descargas fallan, NO sobreescribe el JSON existente
 * (preserva la última versión válida).
 */

$IS_WEB = !empty($_SERVER['HTTP_HOST']);
if ($IS_WEB) {
    while (ob_get_level() > 0) { @ob_end_clean(); }
    header('Content-Type: text/plain; charset=utf-8');
    ini_set('display_errors', '1');
    ini_set('display_startup_errors', '1');
    error_reporting(E_ALL);
    echo "[boot] fetch_firms.php iniciando...\n";
    @ob_flush(); @flush();
}
@set_time_limit(180);

$DATA_DIR = __DIR__ . '/data';
$OUTPUT_FILE = $DATA_DIR . '/incendios.json';

if (!is_dir($DATA_DIR)) {
    mkdir($DATA_DIR, 0755, true);
}

log_message('Starting FIRMS public data fetch');

// Bounding box España (lonMin, latMin, lonMax, latMax).
// Incluye peninsula, Baleares y Canarias.
$BBOX = [-18.5, 27.0, 4.5, 44.0];

// CSVs públicos de FIRMS para Europa (últimos 7 días).
// Fuente: https://firms.modaps.eosdis.nasa.gov/active_fire/
$sources = [
    'VIIRS_SNPP'   => 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Europe_7d.csv',
    'VIIRS_NOAA20' => 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Europe_7d.csv',
    'MODIS'        => 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Europe_7d.csv',
];

$allData = [];
$errors = [];
$anySuccess = false;

foreach ($sources as $name => $url) {
    log_message("Fetching $name...");

    $csv = fetch_url($url, $fetchError);
    if (!$csv) {
        $errors[] = "$name: $fetchError";
        log_message("ERROR $name: $fetchError", true);
        continue;
    }
    $anySuccess = true;
    log_message("$name: " . strlen($csv) . " bytes recibidos.");

    $lines = explode("\n", $csv);
    $header = null;
    $rowsTotal = 0;
    $rowsInSpain = 0;
    $addedCount = 0;

    foreach ($lines as $line) {
        if (empty(trim($line))) continue;

        if ($header === null) {
            $header = str_getcsv($line, ',', '"', '\\');
            log_message("$name: header = " . implode(',', $header));
            continue;
        }

        $row = str_getcsv($line, ',', '"', '\\');
        $rowsTotal++;
        if (count($row) < 5) continue;

        $data = @array_combine($header, $row);
        if ($data === false) continue;

        $lat = (float)($data['latitude'] ?? 0);
        $lon = (float)($data['longitude'] ?? 0);

        // Filtro por bounding box de España
        if ($lon < $BBOX[0] || $lon > $BBOX[2] || $lat < $BBOX[1] || $lat > $BBOX[3]) {
            continue;
        }
        $rowsInSpain++;

        $feature = [
            'type' => 'Feature',
            'geometry' => [
                'type' => 'Point',
                'coordinates' => [$lon, $lat],
            ],
            'properties' => [
                'acq_date' => $data['acq_date'] ?? '',
                'acq_time' => $data['acq_time'] ?? '',
                'latitude' => $lat,
                'longitude' => $lon,
                'frp' => (float)($data['frp'] ?? 0),
                'confidence' => mapConfidence($data['confidence'] ?? ''),
                'instrument' => $name,
                'satellite' => $data['satellite'] ?? '',
                'region' => getRegionFromCoords($lat, $lon),
            ],
        ];

        // Deduplicado <1km y <10min entre satélites
        $isDuplicate = false;
        foreach ($allData as $existing) {
            $dist = haversineDistance(
                $existing['properties']['latitude'],
                $existing['properties']['longitude'],
                $lat,
                $lon
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
            $addedCount++;
        }
    }

    log_message("$name: filas totales=$rowsTotal, en España=$rowsInSpain, features nuevas=$addedCount, acumulado=" . count($allData));
}

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

$json = json_encode($geojson, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
$tmp = $OUTPUT_FILE . '.tmp';
if (file_put_contents($tmp, $json) !== false) {
    rename($tmp, $OUTPUT_FILE);
}

log_message('Success: ' . count($allData) . ' features written');

// -------------------- Helpers --------------------

function fetch_url($url, &$error = null) {
    $error = null;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 25,
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
        $error = 'curl status=' . $status . ($curlErr ? " err=$curlErr" : '');
    } else {
        $error = 'curl extension not available';
    }

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
    // Bounding boxes aproximadas por CCAA (para etiquetar en la web).
    $regions = [
        'Cataluña' => ['lat' => [40.5, 42.9], 'lon' => [0.1, 3.3]],
        'Madrid' => ['lat' => [39.8, 41.0], 'lon' => [-4.5, -2.7]],
        'Andalucía' => ['lat' => [36.0, 38.8], 'lon' => [-7.5, -1.6]],
        'Castilla-León' => ['lat' => [40.0, 43.2], 'lon' => [-7.0, -2.0]],
        'Galicia' => ['lat' => [41.7, 43.8], 'lon' => [-9.3, -6.8]],
        'Comunidad Valenciana' => ['lat' => [37.8, 40.8], 'lon' => [-1.5, 0.8]],
        'Castilla-La Mancha' => ['lat' => [37.6, 40.4], 'lon' => [-5.5, -1.0]],
        'Aragón' => ['lat' => [39.9, 42.9], 'lon' => [-2.2, 0.9]],
        'Extremadura' => ['lat' => [37.9, 40.5], 'lon' => [-7.6, -4.6]],
        'País Vasco' => ['lat' => [42.5, 43.5], 'lon' => [-3.5, -1.7]],
        'Navarra' => ['lat' => [41.9, 43.4], 'lon' => [-2.5, -0.7]],
        'Asturias' => ['lat' => [42.9, 43.7], 'lon' => [-7.2, -4.5]],
        'Cantabria' => ['lat' => [42.8, 43.5], 'lon' => [-4.9, -3.1]],
        'Murcia' => ['lat' => [37.3, 38.8], 'lon' => [-2.4, -0.6]],
        'La Rioja' => ['lat' => [42.0, 42.7], 'lon' => [-3.4, -1.7]],
        'Baleares' => ['lat' => [38.6, 40.1], 'lon' => [1.1, 4.4]],
        'Canarias' => ['lat' => [27.6, 29.5], 'lon' => [-18.3, -13.4]],
        'Portugal' => ['lat' => [36.9, 42.2], 'lon' => [-9.6, -6.2]],
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
    global $IS_WEB;
    $timestamp = date('Y-m-d H:i:s');
    $logFile = __DIR__ . '/fetch_firms.log';
    $prefix = $isError ? '[ERROR]' : '[INFO]';
    $logLine = "[$timestamp] $prefix $msg\n";

    file_put_contents($logFile, $logLine, FILE_APPEND);

    if (!empty($IS_WEB)) {
        echo $logLine;
        @ob_flush();
        @flush();
    }

    if (file_exists($logFile) && filesize($logFile) > 5242880) {
        $lines = file($logFile);
        file_put_contents($logFile, implode('', array_slice($lines, -1000)));
    }
}
