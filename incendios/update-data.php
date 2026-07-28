<?php
// update-data.php — Endpoint para actualizar datos vía AJAX (sin crons)
// Llamado por JavaScript cada cierto tiempo

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Función auxiliar para ejecutar un script PHP y capturar su output
function runScript($file) {
    ob_start();
    $result = include($file);
    $output = ob_get_clean();
    return array(
        'success' => $result !== false,
        'output' => $output
    );
}

$updates = array();

// Determinar qué actualizar basado en parámetros GET
$updateFirms = isset($_GET['firms']) ? filter_var($_GET['firms'], FILTER_VALIDATE_BOOLEAN) : false;
$updateNews = isset($_GET['news']) ? filter_var($_GET['news'], FILTER_VALIDATE_BOOLEAN) : false;

// Si no se especifica, intentar ambas
if (!$updateFirms && !$updateNews) {
    $updateFirms = true;
    $updateNews = true;
}

if ($updateFirms) {
    $updates['firms'] = runScript(__DIR__ . '/fetch_firms.php');
}

if ($updateNews) {
    $updates['news'] = runScript(__DIR__ . '/fetch_news.php');
}

// Verificar si los archivos JSON existen y son válidos
$status = array(
    'timestamp' => date('c'),
    'updates' => $updates,
    'data_status' => array(
        'firms' => file_exists(__DIR__ . '/data/incendios.json'),
        'news' => file_exists(__DIR__ . '/data/noticias.json')
    )
);

echo json_encode($status);
?>
