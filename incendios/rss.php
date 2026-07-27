<?php
/**
 * Feed RSS 2.0 del sitio.
 *
 *   rss.php              → últimas noticias sobre incendios (por defecto)
 *   rss.php?tipo=focos   → focos activos más intensos detectados por satélite
 *
 * No requiere configuración: lee los JSON que generan los crons.
 */

header('Content-Type: application/rss+xml; charset=utf-8');

$BASE = 'https://bigdata.datosclaros.es/incendios';
$DATA = __DIR__ . '/data';
$tipo = isset($_GET['tipo']) ? $_GET['tipo'] : 'noticias';

function e($s) {
    return htmlspecialchars((string)$s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

function rfc2822($iso) {
    $t = $iso ? strtotime($iso) : false;
    return date(DATE_RSS, $t ?: time());
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:georss="http://www.georss.org/georss">
<channel>
<?php if ($tipo === 'focos'): ?>
<?php
    $file = $DATA . '/incendios.json';
    $json = is_readable($file) ? json_decode(file_get_contents($file), true) : null;
    $features = $json['features'] ?? [];

    // Los 30 focos más intensos de las últimas 48 h
    $corte = time() - 48 * 3600;
    $recientes = [];
    foreach ($features as $f) {
        $p = $f['properties'];
        $hora = str_pad((string)($p['acq_time'] ?? '0000'), 4, '0', STR_PAD_LEFT);
        $ts = strtotime($p['acq_date'] . ' ' . substr($hora, 0, 2) . ':' . substr($hora, 2, 2));
        if ($ts && $ts >= $corte) {
            $f['_ts'] = $ts;
            $recientes[] = $f;
        }
    }
    usort($recientes, function ($a, $b) {
        return ($b['properties']['frp'] ?? 0) <=> ($a['properties']['frp'] ?? 0);
    });
    $recientes = array_slice($recientes, 0, 30);
?>
    <title>Incendios España — focos activos por satélite</title>
    <link><?= e($BASE) ?>/</link>
    <description>Focos más intensos detectados por NASA FIRMS (VIIRS y MODIS) en España en las últimas 48 horas.</description>
    <language>es-ES</language>
    <lastBuildDate><?= rfc2822($json['timestamp'] ?? null) ?></lastBuildDate>
    <ttl>360</ttl>
    <atom:link href="<?= e($BASE) ?>/rss.php?tipo=focos" rel="self" type="application/rss+xml" />
<?php foreach ($recientes as $f):
        $p = $f['properties'];
        $c = $f['geometry']['coordinates'];
        $hora = str_pad((string)($p['acq_time'] ?? '0000'), 4, '0', STR_PAD_LEFT);
        $horaFmt = substr($hora, 0, 2) . ':' . substr($hora, 2, 2);
        $titulo = sprintf('%s — %.0f MW (%s %s)', $p['region'] ?? 'España', $p['frp'] ?? 0, $p['acq_date'], $horaFmt);
        $desc = sprintf(
            'Foco detectado en %s. Potencia radiativa: %.1f MW. Confianza: %s. Sensor: %s. Coordenadas: %.4f, %.4f. Dato indicativo, no oficial.',
            $p['region'] ?? 'ubicación desconocida', $p['frp'] ?? 0, $p['confidence'] ?? '-', $p['instrument'] ?? '-', $c[1], $c[0]
        );
        $link = sprintf('https://www.google.com/maps/@%s,%s,14z/data=!3m1!1e3', $c[1], $c[0]);
?>
    <item>
        <title><?= e($titulo) ?></title>
        <link><?= e($link) ?></link>
        <guid isPermaLink="false">foco-<?= e($p['acq_date'] . '-' . $hora . '-' . $c[1] . '-' . $c[0]) ?></guid>
        <pubDate><?= date(DATE_RSS, $f['_ts']) ?></pubDate>
        <description><?= e($desc) ?></description>
        <georss:point><?= e($c[1] . ' ' . $c[0]) ?></georss:point>
    </item>
<?php endforeach; ?>
<?php else: ?>
<?php
    $file = $DATA . '/noticias.json';
    $json = is_readable($file) ? json_decode(file_get_contents($file), true) : null;
    $items = $json['items'] ?? [];
?>
    <title>Incendios España — últimas noticias</title>
    <link><?= e($BASE) ?>/#noticias</link>
    <description>Noticias sobre incendios forestales en España agregadas de medios y fuentes oficiales por datosclaros.es</description>
    <language>es-ES</language>
    <lastBuildDate><?= rfc2822($json['timestamp'] ?? null) ?></lastBuildDate>
    <ttl>30</ttl>
    <atom:link href="<?= e($BASE) ?>/rss.php" rel="self" type="application/rss+xml" />
<?php foreach ($items as $n): ?>
    <item>
        <title><?= e($n['title']) ?></title>
        <link><?= e($n['link']) ?></link>
        <guid isPermaLink="true"><?= e($n['link']) ?></guid>
        <pubDate><?= rfc2822($n['timestamp'] ?? null) ?></pubDate>
        <source url="<?= e($BASE) ?>/rss.php"><?= e($n['source'] ?? 'Prensa') ?></source>
        <description><?= e($n['source'] ?? '') ?></description>
    </item>
<?php endforeach; ?>
<?php endif; ?>
</channel>
</rss>
