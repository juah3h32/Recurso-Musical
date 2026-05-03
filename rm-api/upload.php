<?php
/**
 * upload.php — Recurso Musical
 * Sube archivos WAV/MP3 al servidor y devuelve la URL pública.
 * Coloca este archivo en /public_html/rm-api/upload.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-RM-Token');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

/* ── Auth (usa la misma tabla sessions que api.php) ─────────── */
$token = $_SERVER['HTTP_X_RM_TOKEN'] ?? ($_GET['token'] ?? '');

function fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

if (!$token) fail('Sin token de autenticación', 401);

/* Conectar a la misma BD que api.php */
$host = 'localhost';
$db   = 'tu_base_de_datos';   // ← igual que en api.php
$user = 'tu_usuario';         // ← igual que en api.php
$pass = 'tu_contraseña';      // ← igual que en api.php

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (Exception $e) {
    fail('Error BD: ' . $e->getMessage(), 500);
}

/* Verificar sesión */
$st = $pdo->prepare('SELECT user_id FROM rm_sessions WHERE token = ? AND expires_at > NOW()');
$st->execute([$token]);
if (!$st->fetch()) fail('Sesión inválida o expirada', 401);

/* ── Parámetros ─────────────────────────────────────────────── */
$tipo    = preg_replace('/[^a-z_]/', '', strtolower($_POST['tipo'] ?? 'master'));
$rawSlug = $_POST['slug'] ?? ($_POST['titulo'] ?? 'audio');
$slug    = preg_replace('/[^a-z0-9-]/', '', strtolower(
            str_replace([' ', 'á','é','í','ó','ú','ñ'],
                        ['-','a','e','i','o','u','n'], $rawSlug)));
$slug    = trim($slug, '-') ?: 'audio';

/* ── Validar archivo ────────────────────────────────────────── */
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    fail('No se recibió el archivo o hubo un error al subir');
}

$file    = $_FILES['file'];
$origExt = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$allowed = ['wav', 'mp3', 'ogg', 'aac', 'm4a'];

if (!in_array($origExt, $allowed)) {
    fail("Tipo '$origExt' no permitido. Usa: " . implode(', ', $allowed));
}

/* Límite 200 MB */
$maxBytes = 200 * 1024 * 1024;
if ($file['size'] > $maxBytes) fail('Archivo muy grande (máx 200 MB)');

/* ── Destino ────────────────────────────────────────────────── */
$baseDir   = $_SERVER['DOCUMENT_ROOT'] . '/audio/';
$targetDir = $baseDir . $slug . '/';

if (!is_dir($targetDir)) {
    if (!mkdir($targetDir, 0755, true)) fail('No se pudo crear el directorio', 500);
}

$filename = $tipo . '.' . $origExt;
$destPath = $targetDir . $filename;

/* ── Subir ──────────────────────────────────────────────────── */
if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    fail('No se pudo mover el archivo al destino', 500);
}

/* Detectar host automáticamente */
$scheme  = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host    = $_SERVER['HTTP_HOST'] ?? 'recursomusical.com.mx';
$pubUrl  = "$scheme://$host/audio/$slug/$filename";

echo json_encode([
    'ok'       => true,
    'url'      => $pubUrl,
    'slug'     => $slug,
    'tipo'     => $tipo,
    'filename' => $filename,
    'size'     => $file['size'],
]);