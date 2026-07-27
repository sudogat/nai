<?php
/**
 * Diagnóstico de por qué /incendios/data/incendios.json devuelve 403.
 *
 * Abre https://bigdata.datosclaros.es/incendios/diag.php en el navegador
 * y pásame el resultado. BORRAR este archivo del servidor cuando esté
 * todo funcionando: expone info del hosting.
 */
header('Content-Type: text/plain; charset=utf-8');

$jsonPath = __DIR__ . '/data/incendios.json';
$htaccessPath = __DIR__ . '/data/.htaccess';
$dataDir = __DIR__ . '/data';

echo "=== INCENDIOS DIAG ===\n\n";

echo "PHP user:        " . get_current_user() . "\n";
echo "PHP uid:         " . (function_exists('posix_geteuid') ? posix_geteuid() : 'n/a') . "\n";
echo "Script dir:      " . __DIR__ . "\n\n";

echo "-- data/ --\n";
echo "exists:          " . (is_dir($dataDir) ? 'yes' : 'NO') . "\n";
if (is_dir($dataDir)) {
    echo "readable:        " . (is_readable($dataDir) ? 'yes' : 'NO') . "\n";
    echo "perms:           " . substr(sprintf('%o', fileperms($dataDir)), -4) . "\n";
    echo "owner:           " . (function_exists('posix_getpwuid')
        ? (posix_getpwuid(fileowner($dataDir))['name'] ?? fileowner($dataDir))
        : fileowner($dataDir)) . "\n";
}
echo "\n";

echo "-- data/incendios.json --\n";
echo "exists:          " . (file_exists($jsonPath) ? 'yes' : 'NO') . "\n";
if (file_exists($jsonPath)) {
    echo "readable:        " . (is_readable($jsonPath) ? 'yes' : 'NO') . "\n";
    echo "perms:           " . substr(sprintf('%o', fileperms($jsonPath)), -4) . "\n";
    echo "size:            " . filesize($jsonPath) . " bytes\n";
    echo "owner:           " . (function_exists('posix_getpwuid')
        ? (posix_getpwuid(fileowner($jsonPath))['name'] ?? fileowner($jsonPath))
        : fileowner($jsonPath)) . "\n";
    $sample = @file_get_contents($jsonPath, false, null, 0, 200);
    echo "first 200 bytes: " . ($sample === false ? '(no se puede leer)' : $sample) . "\n";
}
echo "\n";

echo "-- data/.htaccess --\n";
echo "exists:          " . (file_exists($htaccessPath) ? 'yes' : 'NO') . "\n";
if (file_exists($htaccessPath)) {
    echo "perms:           " . substr(sprintf('%o', fileperms($htaccessPath)), -4) . "\n";
    echo "content:\n";
    echo "----------------\n";
    echo file_get_contents($htaccessPath);
    echo "\n----------------\n";
}
echo "\n";

echo "-- HTTP self-test --\n";
$selfUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http')
    . '://' . $_SERVER['HTTP_HOST'] . rtrim(dirname($_SERVER['REQUEST_URI']), '/')
    . '/data/incendios.json';
echo "URL:             $selfUrl\n";

if (function_exists('curl_init')) {
    $ch = curl_init($selfUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_HEADER => true,
        CURLOPT_NOBODY => true,
    ]);
    $resp = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    echo "HEAD status:     $status\n";
    if ($resp) {
        echo "response head:\n$resp\n";
    }
}

echo "\n-- allow_url_fopen --\n";
echo "allow_url_fopen: " . (ini_get('allow_url_fopen') ? 'on' : 'off') . "\n";
echo "curl loaded:     " . (function_exists('curl_init') ? 'yes' : 'no') . "\n";
echo "shell_exec:      " . (function_exists('shell_exec') ? 'yes' : 'no (disabled)') . "\n";
