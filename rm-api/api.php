<?php
// ============================================================
//  Recurso Musical — API PHP + MySQL (HostGator)
//  Archivo: public_html/rm-api/api.php
//  v4 — Incluye Multitracks completo
// ============================================================

define('DB_HOST',    'localhost');
define('DB_NAME',    'efddacam_efddacam_recurso');
define('DB_USER',    'efddacam_admin');
define('DB_PASS',    'JUANPA991215');
define('API_SECRET', 'rm_secret_2024_FSSsfxK9pL');
define('APP_SECRET', 'rm_app_2024_public');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-RM-Token');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

function normalizeCapo($raw) {
    $raw = trim((string)($raw ?? ''));
    if ($raw === '') return '0';
    preg_match('/(\d+)/', $raw, $m);
    return isset($m[1]) ? $m[1] : '0';
}

function sendPushToAll($db, $title, $body, $data = []) {
    $stmt   = $db->query('SELECT token FROM push_tokens');
    $tokens = $stmt->fetchAll(PDO::FETCH_COLUMN);
    if (empty($tokens)) return ['enviados' => 0];
    $messages = [];
    foreach ($tokens as $token) {
        $messages[] = [
            'to'    => $token,
            'title' => $title,
            'body'  => $body,
            'data'  => $data,
            'sound' => 'default',
            'badge' => 1,
        ];
    }
    $ch = curl_init('https://exp.host/--/api/v2/push/send');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($messages),
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    return ['enviados' => count($tokens), 'expo_response' => json_decode($response, true)];
}

function getDB() {
    static $pdo = null;
    if ($pdo) return $pdo;
    try {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
        return $pdo;
    } catch (Exception $e) {
        resp(500, ['error' => 'DB: ' . $e->getMessage()]);
    }
}

function resp($code, $data) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function body() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function normalizeRow($row) {
    $row['capo']        = normalizeCapo($row['capo'] ?? '');
    $row['intro']       = trim($row['intro'] ?? '');
    $row['cancion_bpm'] = isset($row['cancion_bpm']) ? (int)$row['cancion_bpm'] : 0;
    $row['es_favorito'] = isset($row['es_favorito']) ? (int)$row['es_favorito'] : 0;
    $row['imagen']      = $row['imagen'] ?? '';
    return $row;
}

function requireAuth() {
    $token = $_SERVER['HTTP_X_RM_TOKEN'] ?? '';
    if (empty($token)) resp(401, ['error' => 'No token']);
    $db = getDB();
    $st = $db->prepare('SELECT id, user_id FROM rm_sessions WHERE token = ? AND expires_at > NOW()');
    $st->execute([$token]);
    $session = $st->fetch();
    if (!$session) resp(401, ['error' => 'Token inválido o expirado']);
    $uq = $db->prepare('SELECT username FROM rm_admin_users WHERE id = ?');
    $uq->execute([$session['user_id']]);
    $u        = $uq->fetch();
    $interval = ($u && $u['username'] === 'app_public') ? 'INTERVAL 30 DAY' : 'INTERVAL 8 HOUR';
    $db->prepare("UPDATE rm_sessions SET expires_at = DATE_ADD(NOW(), $interval) WHERE token = ?")
       ->execute([$token]);
    return $session;
}

// ════════════════════════════════════════════════════════════
// ROUTER
// ════════════════════════════════════════════════════════════

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($action) {

    // ─────────────────────────────────────────────────────────
    // AUTH
    // ─────────────────────────────────────────────────────────
    case 'setup':
        setupDB();
        break;

    case 'login':
        if ($method !== 'POST') resp(405, ['error' => 'POST only']);
        doLogin();
        break;

    case 'logout':
        requireAuth();
        getDB()->prepare('DELETE FROM rm_sessions WHERE token = ?')
               ->execute([$_SERVER['HTTP_X_RM_TOKEN'] ?? '']);
        resp(200, ['ok' => true]);
        break;

    case 'check':
        requireAuth();
        resp(200, ['ok' => true]);
        break;

    case 'appToken':
        $secret = $_GET['secret'] ?? '';
        if ($secret !== APP_SECRET) resp(401, ['error' => 'Secret inválido']);
        $db = getDB();
        $st = $db->prepare('SELECT id FROM rm_admin_users WHERE username = ?');
        $st->execute(['app_public']);
        $user = $st->fetch();
        if (!$user) {
            $hash = password_hash('app_readonly_' . date('Y'), PASSWORD_BCRYPT);
            $db->prepare("INSERT INTO rm_admin_users (username, password_hash) VALUES ('app_public', ?)")
               ->execute([$hash]);
            $st->execute(['app_public']);
            $user = $st->fetch();
        }
        $db->prepare('DELETE FROM rm_sessions WHERE user_id = ? AND expires_at < NOW()')
           ->execute([$user['id']]);
        $token = bin2hex(random_bytes(32));
        $db->prepare('INSERT INTO rm_sessions (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))')
           ->execute([$token, $user['id']]);
        resp(200, ['ok' => true, 'token' => $token]);
        break;

    // ─────────────────────────────────────────────────────────
    // PUSH NOTIFICATIONS
    // ─────────────────────────────────────────────────────────
    case 'savePushToken':
        if (($_GET['secret'] ?? '') !== APP_SECRET) resp(403, ['error' => 'No autorizado']);
        $input    = body();
        $token    = trim($input['token']    ?? '');
        $platform = trim($input['platform'] ?? 'android');
        if (empty($token)) resp(400, ['error' => 'Token vacío']);
        $db = getDB();
        $db->prepare(
            'INSERT INTO push_tokens (token, platform) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE platform = VALUES(platform)'
        )->execute([$token, $platform]);
        resp(200, ['ok' => true]);
        break;

    case 'sendPush':
        if (($_GET['secret'] ?? '') !== APP_SECRET) resp(403, ['error' => 'No autorizado']);
        $input = body();
        $title = $input['title'] ?? 'Nuevo contenido';
        $body  = $input['body']  ?? 'Recurso Musical';
        $data  = $input['data']  ?? ['tipo' => 'general'];
        if (empty($data['id'])) resp(400, ['error' => 'data.id obligatorio']);
        $data['id'] = (string)$data['id'];
        $result = sendPushToAll(getDB(), $title, $body, $data);
        resp(200, array_merge(['ok' => true], $result));
        break;

    // ─────────────────────────────────────────────────────────
    // TUTORIALES
    // ─────────────────────────────────────────────────────────
    case 'getTutoriales':
        requireAuth();
        $cat = trim($_GET['cat'] ?? 'Todos');
        $db  = getDB();
        if ($cat === 'Todos' || $cat === '') {
            $rows = $db->query('SELECT * FROM tutoriales ORDER BY id DESC')->fetchAll();
        } else {
            $st = $db->prepare(
                "SELECT * FROM tutoriales
                 WHERE COALESCE(tipo,'tutorial') = 'tutorial' AND categoria = ?
                 ORDER BY id DESC"
            );
            $st->execute([$cat]);
            $rows = $st->fetchAll();
        }
        resp(200, array_map('normalizeRow', $rows));
        break;

    case 'buscar':
        requireAuth();
        $q    = '%' . trim($_GET['q'] ?? '') . '%';
        $tipo = trim($_GET['tipo'] ?? 'tutorial');
        $db   = getDB();
        if ($tipo === 'todos') {
            $st = $db->prepare(
                'SELECT * FROM tutoriales
                 WHERE titulo LIKE ? OR artista LIKE ? OR cancion_titulo LIKE ?
                 ORDER BY id DESC LIMIT 60'
            );
            $st->execute([$q, $q, $q]);
        } else {
            $st = $db->prepare(
                "SELECT * FROM tutoriales
                 WHERE COALESCE(tipo,'tutorial') = ?
                 AND (titulo LIKE ? OR artista LIKE ? OR cancion_titulo LIKE ?)
                 ORDER BY id DESC LIMIT 60"
            );
            $st->execute([$tipo, $q, $q, $q]);
        }
        resp(200, array_map('normalizeRow', $st->fetchAll()));
        break;

    case 'addTutorial':
        requireAuth();
        if ($method !== 'POST') resp(405, ['error' => 'POST only']);
        $d    = body();
        $db   = getDB();
        $tipo = trim($d['tipo'] ?? 'tutorial');
        if (empty(trim($d['titulo'] ?? ''))) resp(400, ['error' => 'Título obligatorio']);
        $artista   = trim($d['artista'] ?? '') ?: 'Recurso Musical';
        $categoria = trim($d['categoria'] ?? '') ?: ($tipo === 'cancionero' ? 'Alabanza' : 'Guitarra');
        $capo      = normalizeCapo($d['capo'] ?? '');
        try {
            $st = $db->prepare(
                'INSERT INTO tutoriales
                 (titulo,artista,descripcion,youtube_id,duracion,categoria,tipo,
                 vistas,fecha,capo,intro,cancion_titulo,cancion_letra,cancion_tono,cancion_bpm,imagen)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
            );
            $st->execute([
                trim($d['titulo']         ?? ''),
                $artista,
                trim($d['descripcion']    ?? ''),
                trim($d['youtube_id']     ?? ''),
                trim($d['duracion']       ?? ''),
                $categoria,
                $tipo,
                trim($d['vistas']         ?? '0'),
                trim($d['fecha']          ?? date('d/m/Y')),
                $capo,
                trim($d['intro']          ?? ''),
                trim($d['cancion_titulo'] ?? ''),
                $d['cancion_letra']       ?? '',
                trim($d['cancion_tono']   ?? ''),
                intval($d['cancion_bpm']  ?? 0),
                trim($d['imagen']         ?? ''),
            ]);
            $newId    = (int)$db->lastInsertId();
            $titulo   = $d['cancion_titulo'] ?? $d['titulo'] ?? 'Nuevo contenido';
            $emoji    = ($tipo === 'cancionero') ? '🎵' : '▶️';
            sendPushToAll($db, "$emoji Nuevo en Recurso Musical",
                trim("$titulo — $artista", " —"),
                ['tipo' => $tipo, 'id' => (string)$newId]);
            resp(200, ['id' => $newId, 'ok' => true]);
        } catch (Exception $e) {
            resp(500, ['error' => 'Error al guardar: ' . $e->getMessage()]);
        }
        break;

    case 'updateTutorial':
        requireAuth();
        if ($method !== 'POST') resp(405, ['error' => 'POST only']);
        $d = body();
        if (!intval($d['id'] ?? 0)) resp(400, ['error' => 'ID requerido']);
        $db = getDB();
        if (isset($d['tipo'])) {
            $tipo = $d['tipo'];
        } else {
            $tq = $db->prepare("SELECT COALESCE(tipo,'tutorial') AS tipo FROM tutoriales WHERE id=?");
            $tq->execute([intval($d['id'])]);
            $tipo = ($tq->fetch())['tipo'] ?? 'tutorial';
        }
        $artista = trim($d['artista'] ?? '') ?: 'Recurso Musical';
        try {
            $db->prepare(
                'UPDATE tutoriales SET
                 titulo=?,artista=?,descripcion=?,youtube_id=?,duracion=?,
                 categoria=?,tipo=?,capo=?,intro=?,
                 cancion_titulo=?,cancion_letra=?,cancion_tono=?,cancion_bpm=?,imagen=?
                 WHERE id=?'
            )->execute([
                trim($d['titulo']         ?? ''),
                $artista,
                trim($d['descripcion']    ?? ''),
                trim($d['youtube_id']     ?? ''),
                trim($d['duracion']       ?? ''),
                trim($d['categoria']      ?? ($tipo === 'cancionero' ? 'Alabanza' : 'Guitarra')),
                $tipo,
                normalizeCapo($d['capo'] ?? ''),
                trim($d['intro']          ?? ''),
                trim($d['cancion_titulo'] ?? ''),
                $d['cancion_letra']       ?? '',
                trim($d['cancion_tono']   ?? ''),
                intval($d['cancion_bpm']  ?? 0),
                trim($d['imagen']         ?? ''),
                intval($d['id']),
            ]);
            resp(200, ['ok' => true]);
        } catch (Exception $e) {
            resp(500, ['error' => 'Error al actualizar: ' . $e->getMessage()]);
        }
        break;

    case 'deleteTutorial':
        requireAuth();
        $id = intval($_GET['id'] ?? 0);
        if (!$id) resp(400, ['error' => 'ID requerido']);
        getDB()->prepare('DELETE FROM tutoriales WHERE id=?')->execute([$id]);
        resp(200, ['ok' => true]);
        break;

    case 'toggleFavorito':
        requireAuth();
        $d = body();
        if (!isset($d['id'], $d['val'])) resp(400, ['error' => 'id y val requeridos']);
        getDB()->prepare('UPDATE tutoriales SET es_favorito=? WHERE id=?')
               ->execute([intval($d['val']), intval($d['id'])]);
        resp(200, ['ok' => true]);
        break;

    case 'changePassword':
        requireAuth();
        if ($method !== 'POST') resp(405, ['error' => 'POST only']);
        $d       = body();
        $current = $d['current_password'] ?? '';
        $new     = $d['new_password']     ?? '';
        if (!$current || !$new)  resp(400, ['error' => 'Faltan campos']);
        if (strlen($new) < 8)    resp(400, ['error' => 'Mínimo 8 caracteres']);
        $token = $_SERVER['HTTP_X_RM_TOKEN'] ?? '';
        $sess  = getDB()->prepare('SELECT user_id FROM rm_sessions WHERE token=?');
        $sess->execute([$token]);
        $s = $sess->fetch();
        if (!$s) resp(401, ['error' => 'Sesión inválida']);
        $uCheck = getDB()->prepare('SELECT username,password_hash FROM rm_admin_users WHERE id=?');
        $uCheck->execute([$s['user_id']]);
        $u = $uCheck->fetch();
        if (!$u)                             resp(404, ['error' => 'Usuario no encontrado']);
        if ($u['username'] === 'app_public') resp(403, ['error' => 'No permitido']);
        if (!password_verify($current, $u['password_hash'])) resp(401, ['error' => 'Contraseña incorrecta']);
        getDB()->prepare('UPDATE rm_admin_users SET password_hash=? WHERE id=?')
               ->execute([password_hash($new, PASSWORD_BCRYPT), $s['user_id']]);
        resp(200, ['ok' => true, 'msg' => 'Contraseña actualizada']);
        break;

    case 'searchLetras':
        requireAuth();
        $q = trim($_GET['q'] ?? '');
        if (!$q) { resp(200, []); break; }
        $hits = [];
        $slug = urlencode(mb_strtolower($q));
        $ctx  = stream_context_create(['http' => ['header' => "User-Agent: Mozilla/5.0\r\n", 'timeout' => 8]]);
        $html = @file_get_contents("https://www.letras.com/busca.php?q={$slug}", false, $ctx);
        if ($html) {
            preg_match_all('/<a[^>]+href="(\/[a-z0-9_-]+\/[a-z0-9_-]+\.html)"[^>]*>\s*([^<]{3,80})/i', $html, $m, PREG_SET_ORDER);
            foreach (array_slice($m, 0, 8) as $row) {
                $t = trim(strip_tags($row[2]));
                if (strlen($t) < 3) continue;
                $hits[] = ['titulo' => $t, 'artista' => '', 'url' => 'https://www.letras.com' . $row[1], 'fuente' => 'letras.com'];
            }
        }
        resp(200, array_values($hits));
        break;

    // ─────────────────────────────────────────────────────────
    // MULTITRACKS
    // ─────────────────────────────────────────────────────────

    // GET api.php?action=getMultitracks
    // Devuelve lista de multitracks activos (para la pantalla de Multitracks)
    case 'getMultitracks':
        // requireAuth(); <-- ¡CANDADO ELIMINADO PARA LA APP MÓVIL!
        $rows = getDB()->query(
            "SELECT id,titulo,artista,tono,bpm,compas,duracion,imagen_url
             FROM multitracks WHERE activo=1 ORDER BY id DESC"
        )->fetchAll();
        resp(200, $rows);
        break;

    // GET api.php?action=getMultitrack&id=5
    // Devuelve detalle + pistas (abre el MultitrackPlayer en la app)
    case 'getMultitrack':
        // requireAuth(); <-- ¡CANDADO ELIMINADO PARA LA APP MÓVIL!
        $id = intval($_GET['id'] ?? 0);
        if (!$id) resp(400, ['error' => 'ID requerido']);
        $db  = getDB();
        $st  = $db->prepare("SELECT * FROM multitracks WHERE id=? AND activo=1");
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) resp(404, ['error' => 'Multitrack no encontrado']);
        $ps = $db->prepare("SELECT tipo,url FROM multitrack_pistas WHERE multitrack_id=? ORDER BY FIELD(tipo,'master','click','guia','bateria','bajo','guitarra','piano','cuerdas','vientos','coros')");
        $ps->execute([$id]);
        $row['pistas'] = $ps->fetchAll();
        resp(200, $row);
        break;

    // POST api.php?action=saveMultitrack
    case 'saveMultitrack':
        requireAuth();
        if ($method !== 'POST') resp(405, ['error' => 'POST only']);
        $d  = body();
        if (empty($d['titulo'])) resp(400, ['error' => 'titulo requerido']);
        $db = getDB();
        $id = intval($d['id'] ?? 0);

        if ($id) {
            // ── ACTUALIZAR ──
            $db->prepare(
                "UPDATE multitracks
                 SET titulo=?,artista=?,tono=?,bpm=?,compas=?,duracion=?,imagen_url=?,markers=?
                 WHERE id=?"
            )->execute([
                trim($d['titulo']),
                trim($d['artista']    ?? ''),
                trim($d['tono']       ?? ''),
                intval($d['bpm']      ?? 0),
                trim($d['compas']     ?? '4/4'),
                trim($d['duracion']   ?? ''),
                trim($d['imagen_url'] ?? ''),
                isset($d['markers']) ? $d['markers'] : null, // <-- LÍNEA NUEVA PARA MARCADORES
                $id,
            ]);
        } else {
            // ── INSERTAR ──
            $db->prepare(
                "INSERT INTO multitracks (titulo, artista, tono, bpm, compas, duracion, imagen_url, markers)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            )->execute([
                trim($d['titulo']),
                trim($d['artista']    ?? ''),
                trim($d['tono']       ?? ''),
                intval($d['bpm']      ?? 0),
                trim($d['compas']     ?? '4/4'),
                trim($d['duracion']   ?? ''),
                trim($d['imagen_url'] ?? ''),
                isset($d['markers']) ? $d['markers'] : null // <-- LÍNEA NUEVA
            ]);
            $id = $db->lastInsertId();
        }

        // ── Reemplaza pistas si vienen ──
        if (!empty($d['pistas']) && is_array($d['pistas'])) {
            $db->prepare("DELETE FROM multitrack_pistas WHERE multitrack_id=?")
               ->execute([$id]);
            $ins = $db->prepare(
                "INSERT INTO multitrack_pistas (multitrack_id,tipo,url) VALUES (?,?,?)"
            );
            foreach ($d['pistas'] as $p) {
                if (empty($p['tipo']) || empty($p['url'])) continue;
                $ins->execute([$id, trim($p['tipo']), trim($p['url'])]);
            }
        }
        resp(200, ['ok' => true, 'id' => $id]);
        break;

    // GET api.php?action=deleteMultitrack&id=5
    case 'deleteMultitrack':
        requireAuth(); // <-- Este candado también se mantiene
        $id = intval($_GET['id'] ?? 0);
        if (!$id) resp(400, ['error' => 'ID requerido']);
        getDB()->prepare("UPDATE multitracks SET activo=0 WHERE id=?")->execute([$id]);
        resp(200, ['ok' => true]);
        break;

    case 'searchCancionero':
        requireAuth();
        $q  = '%' . trim($_GET['q'] ?? '') . '%';
        $db = getDB();
        $st = $db->prepare(
            "SELECT id, cancion_titulo, artista, cancion_tono, cancion_bpm,
                    capo, intro, imagen
             FROM tutoriales
             WHERE tipo = 'cancionero'
               AND (cancion_titulo LIKE ? OR artista LIKE ?)
             ORDER BY cancion_titulo ASC
             LIMIT 30"
        );
        $st->execute([$q, $q]);
        $rows = $st->fetchAll();
        resp(200, array_map(function($r) {
            return [
                'id'            => (int)$r['id'],
                'cancion_titulo'=> $r['cancion_titulo'] ?? '',
                'artista'       => $r['artista']        ?? '',
                'tono'          => $r['cancion_tono']   ?? '',
                'bpm'           => (int)($r['cancion_bpm'] ?? 0),
                'capo'          => $r['capo']             ?? '0',
                'intro'         => $r['intro']            ?? '',
                'imagen'        => $r['imagen']          ?? '',
            ];
        }, $rows));
        break;
    case 'updateMultitrackMarkers':
        requireAuth();
        $d   = body();
        $db  = getDB();
        $updateId    = intval($d['id'] ?? 0);
        $markersData = $d['markers'] ?? null;
        if ($updateId > 0) {
            $db->prepare('UPDATE multitracks SET markers=? WHERE id=?')
               ->execute([$markersData, $updateId]);
        }
        resp(200, ['ok' => true]);
        break;
    // ─────────────────────────────────────────────────────────
    // DEFAULT
    // ─────────────────────────────────────────────────────────
    default:
        resp(404, ['error' => 'Acción no encontrada: ' . $action]);
}

// ════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════
function doLogin() {
    $d    = body();
    $user = trim($d['username'] ?? '');
    $pass = $d['password']      ?? '';
    if (!$user || !$pass)        resp(400, ['error' => 'Usuario y contraseña requeridos']);
    if ($user === 'app_public')  resp(403, ['error' => 'Acceso no permitido']);
    $db      = getDB();
    $lock    = $db->prepare('SELECT locked_until,attempts FROM rm_login_attempts WHERE username=?');
    $lock->execute([$user]);
    $attempt = $lock->fetch();
    if ($attempt && $attempt['locked_until'] && strtotime($attempt['locked_until']) > time())
        resp(429, ['error' => 'Bloqueado. Intenta en ' . (strtotime($attempt['locked_until']) - time()) . 's.']);
    $st = $db->prepare('SELECT id,username,password_hash FROM rm_admin_users WHERE username=? AND active=1');
    $st->execute([$user]);
    $admin = $st->fetch();
    if (!$admin || !password_verify($pass, $admin['password_hash'])) {
        $attempts = ($attempt['attempts'] ?? 0) + 1;
        $locked   = $attempts >= 5 ? date('Y-m-d H:i:s', time() + 60) : null;
        if ($attempt)
            $db->prepare('UPDATE rm_login_attempts SET attempts=?,locked_until=?,last_attempt=NOW() WHERE username=?')
               ->execute([$attempts, $locked, $user]);
        else
            $db->prepare('INSERT INTO rm_login_attempts (username,attempts,locked_until,last_attempt) VALUES (?,?,?,NOW())')
               ->execute([$user, $attempts, $locked]);
        resp(401, ['error' => 'Credenciales incorrectas. ' . max(0, 5 - $attempts) . ' intentos restantes.']);
    }
    $db->prepare('DELETE FROM rm_login_attempts WHERE username=?')->execute([$user]);
    $db->prepare('UPDATE rm_admin_users SET last_login=NOW() WHERE id=?')->execute([$admin['id']]);
    $token = bin2hex(random_bytes(32));
    $db->prepare('INSERT INTO rm_sessions (token,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 8 HOUR))')
       ->execute([$token, $admin['id']]);
    resp(200, ['ok' => true, 'token' => $token, 'username' => $admin['username']]);
}

// ════════════════════════════════════════════════════════════
// SETUP DB
// ════════════════════════════════════════════════════════════
function setupDB() {
    $db = getDB();

    $db->exec("CREATE TABLE IF NOT EXISTS rm_admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        active TINYINT DEFAULT 1,
        last_login DATETIME,
        created_at DATETIME DEFAULT NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS rm_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(64) UNIQUE NOT NULL,
        user_id INT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES rm_admin_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS rm_login_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        attempts INT DEFAULT 0,
        locked_until DATETIME,
        last_attempt DATETIME
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS tutoriales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        artista VARCHAR(255) NOT NULL DEFAULT '',
        descripcion TEXT,
        youtube_id VARCHAR(50) NOT NULL DEFAULT '',
        duracion VARCHAR(20),
        categoria VARCHAR(50) DEFAULT 'Guitarra',
        tipo VARCHAR(20) NOT NULL DEFAULT 'tutorial',
        vistas VARCHAR(20) DEFAULT '0',
        fecha VARCHAR(20),
        capo VARCHAR(10) DEFAULT '0',
        intro VARCHAR(100),
        cancion_titulo VARCHAR(255),
        cancion_letra LONGTEXT,
        cancion_tono VARCHAR(10),
        cancion_bpm INT DEFAULT 0,
        es_favorito TINYINT DEFAULT 0,
        imagen VARCHAR(512) DEFAULT NULL,
        created_at DATETIME DEFAULT NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS push_tokens (
        id       INT AUTO_INCREMENT PRIMARY KEY,
        token    VARCHAR(255) NOT NULL UNIQUE,
        platform VARCHAR(10)  DEFAULT 'android',
        created  DATETIME     DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // ── Tablas de Multitracks ─────────────────────────────────
    $db->exec("CREATE TABLE IF NOT EXISTS multitracks (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        titulo     VARCHAR(255) NOT NULL,
        artista    VARCHAR(255) DEFAULT '',
        tono       VARCHAR(10)  DEFAULT '',
        bpm        INT          DEFAULT 0,
        compas     VARCHAR(20)  DEFAULT '4/4',
        duracion   VARCHAR(20)  DEFAULT '',
        imagen_url TEXT,
        markers    TEXT         DEFAULT NULL,
        activo     TINYINT(1)   DEFAULT 1,
        created_at DATETIME     DEFAULT NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db->exec("CREATE TABLE IF NOT EXISTS multitrack_pistas (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        multitrack_id INT NOT NULL,
        tipo ENUM('master','click','guia','bateria','bajo','guitarra','piano','cuerdas','vientos','coros') NOT NULL,
        url           TEXT NOT NULL,
        FOREIGN KEY (multitrack_id) REFERENCES multitracks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // ── Migraciones seguras ───────────────────────────────────
    // Migraciones en tutoriales
    $migTutoriales = [
        "tipo"   => "ALTER TABLE tutoriales ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'tutorial' AFTER categoria",
        "imagen" => "ALTER TABLE tutoriales ADD COLUMN imagen VARCHAR(512) DEFAULT NULL AFTER es_favorito",
        "capo"   => "ALTER TABLE tutoriales ADD COLUMN capo VARCHAR(10) NOT NULL DEFAULT '0' AFTER fecha",
    ];
    foreach ($migTutoriales as $col => $sql) {
        try {
            if (!$db->query("SHOW COLUMNS FROM tutoriales LIKE '$col'")->fetch())
                $db->exec($sql);
        } catch (Exception $e) {}
    }
    // Migraciones en multitracks
    try {
        if (!$db->query("SHOW COLUMNS FROM multitracks LIKE 'markers'")->fetch())
            $db->exec("ALTER TABLE multitracks ADD COLUMN markers TEXT DEFAULT NULL AFTER imagen_url");
    } catch (Exception $e) {}

    // Normalizar datos existentes
    try { $db->exec("UPDATE tutoriales SET tipo='tutorial' WHERE tipo IS NULL OR tipo=''"); } catch(Exception $e){}
    try { $db->exec("UPDATE tutoriales SET intro='' WHERE intro IS NULL"); } catch(Exception $e){}
    try {
        $db->exec("UPDATE tutoriales SET capo='0' WHERE capo IS NULL OR TRIM(capo)=''");
        $rows = $db->query("SELECT id,capo FROM tutoriales WHERE capo REGEXP '[^0-9]'")->fetchAll();
        foreach ($rows as $row) {
            preg_match('/(\d+)/', $row['capo'], $m);
            $db->prepare("UPDATE tutoriales SET capo=? WHERE id=?")->execute([isset($m[1])?$m[1]:'0', $row['id']]);
        }
    } catch(Exception $e){}

    // Usuario admin por defecto
    $check = $db->query("SELECT COUNT(*) AS n FROM rm_admin_users WHERE username != 'app_public'")->fetch();
    if ($check['n'] == 0) {
        $db->prepare("INSERT INTO rm_admin_users (username,password_hash) VALUES ('admin',?)")
           ->execute([password_hash('RecursoMusical2024!', PASSWORD_BCRYPT)]);
    }

    resp(200, ['ok' => true, 'msg' => 'Tablas listas. Multitracks habilitado.']);
}
?> 