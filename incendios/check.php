<?php
/**
 * Test directo. Abrir en el navegador y ver la respuesta.
 * Borrar del servidor cuando ya funcione todo.
 */
header('Content-Type: text/plain; charset=utf-8');

$dir = __DIR__;
echo "=== CHECK config.php ===\n\n";
echo "Directorio del script:  $dir\n\n";

$config = $dir . '/config.php';
echo "Buscando:              $config\n";
echo "file_exists:           " . (file_exists($config) ? 'SI' : 'NO') . "\n";
echo "is_readable:           " . (is_readable($config) ? 'SI' : 'NO') . "\n\n";

echo "Archivos con 'config' en el nombre en $dir:\n";
foreach (scandir($dir) as $f) {
    if (stripos($f, 'config') !== false) {
        $full = $dir . '/' . $f;
        echo "  - $f  (perms: " . substr(sprintf('%o', fileperms($full)), -4) . ", size: " . filesize($full) . " bytes)\n";
    }
}
echo "\n";

if (is_readable($config)) {
    require_once $config;
    echo "Tras require_once:\n";
    echo "  FIRMS_MAP_KEY defined: " . (defined('FIRMS_MAP_KEY') ? 'SI' : 'NO') . "\n";
    if (defined('FIRMS_MAP_KEY')) {
        $k = FIRMS_MAP_KEY;
        echo "  longitud MAP_KEY:      " . strlen($k) . " chars\n";
        echo "  primeros 4 chars:      " . substr($k, 0, 4) . "...\n";
        echo "  es placeholder:        " . (in_array($k, ['AQUI_TU_CLAVE', 'PON_AQUI_TU_MAP_KEY']) ? 'SI (mal)' : 'NO (bien)') . "\n";
    }
} else {
    echo "config.php NO se puede leer. Revisa:\n";
    echo "  - que el archivo se llame exactamente 'config.php' (sin .example, sin .txt)\n";
    echo "  - que esté en la MISMA carpeta que este check.php\n";
    echo "  - permisos al menos 644\n";
}
