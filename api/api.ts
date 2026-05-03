// Recurso Musical — Vercel Serverless API
// Replaces rm-api/api.php with Turso (libSQL/SQLite) backend
// env vars (Turso Vercel integration): TURSO_DATABASE_URL, TURSO_AUTH_TOKEN

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type Row } from '@libsql/client';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

// ────────────────────────────────────────────────────────────
// DATABASE
// ────────────────────────────────────────────────────────────

const db = createClient({
  url: (process.env.TURSO_DATABASE_URL ?? process.env.TURSO_URL)!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const API_SECRET = process.env.API_SECRET || 'rm_secret_2024_FSSsfxK9pL';
const APP_SECRET = process.env.APP_SECRET || 'rm_app_2024_public';

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

function toObj(row: Row, columns: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  columns.forEach((col, i) => { obj[col] = row[i]; });
  return obj;
}

function toObjs(rows: Row[], columns: string[]): Record<string, unknown>[] {
  return rows.map(r => toObj(r, columns));
}

function normalizeCapo(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '0';
  const m = s.match(/(\d+)/);
  return m ? m[1] : '0';
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    capo: normalizeCapo(row.capo),
    intro: String(row.intro ?? '').trim(),
    cancion_bpm: row.cancion_bpm ? Number(row.cancion_bpm) : 0,
    es_favorito: row.es_favorito ? Number(row.es_favorito) : 0,
    imagen: row.imagen ?? '',
  };
}

async function sendPushToAll(
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<{ enviados: number; expo_response?: unknown }> {
  const result = await db.execute('SELECT token FROM push_tokens');
  const tokens = result.rows.map(r => String(r[0]));
  if (!tokens.length) return { enviados: 0 };
  const messages = tokens.map(token => ({
    to: token, title, body, data, sound: 'default', badge: 1,
  }));
  const resp = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(messages),
  });
  const expo_response = await resp.json();
  return { enviados: tokens.length, expo_response };
}

// Returns session or null (response already sent on failure)
async function requireAuth(
  req: VercelRequest,
  res: VercelResponse
): Promise<{ id: number; user_id: number } | null> {
  const token = req.headers['x-rm-token'] as string | undefined;
  if (!token) { res.status(401).json({ error: 'No token' }); return null; }

  const r = await db.execute({
    sql: "SELECT id, user_id FROM rm_sessions WHERE token = ? AND expires_at > datetime('now')",
    args: [token],
  });
  if (!r.rows.length) { res.status(401).json({ error: 'Token inválido o expirado' }); return null; }

  const session = toObj(r.rows[0], r.columns);
  const uq = await db.execute({
    sql: 'SELECT username FROM rm_admin_users WHERE id = ?',
    args: [session.user_id as number],
  });
  const username = uq.rows.length ? String(uq.rows[0][0]) : '';
  const ext = username === 'app_public' ? '+30 days' : '+8 hours';
  await db.execute({
    sql: "UPDATE rm_sessions SET expires_at = datetime('now', ?) WHERE token = ?",
    args: [ext, token],
  });

  return { id: Number(session.id), user_id: Number(session.user_id) };
}

// ────────────────────────────────────────────────────────────
// MAIN HANDLER
// ────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-RM-Token');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const action = (req.query.action as string) || '';
  const body = (req.body || {}) as Record<string, unknown>;

  try {
    switch (action) {

      // ── SETUP ────────────────────────────────────────────────
      case 'setup': {
        if ((req.query.secret as string) !== API_SECRET) {
          res.status(403).json({ error: 'No autorizado' }); return;
        }
        await setupDB();
        res.json({ ok: true, msg: 'Tablas listas.' });
        return;
      }

      // ── AUTH ─────────────────────────────────────────────────
      case 'appToken': {
        if ((req.query.secret as string) !== APP_SECRET) {
          res.status(401).json({ error: 'Secret inválido' }); return;
        }
        let uq = await db.execute({
          sql: 'SELECT id FROM rm_admin_users WHERE username = ?',
          args: ['app_public'],
        });
        let userId: number;
        if (!uq.rows.length) {
          const hash = await bcrypt.hash('app_readonly_' + new Date().getFullYear(), 10);
          await db.execute({
            sql: "INSERT INTO rm_admin_users (username, password_hash) VALUES ('app_public', ?)",
            args: [hash],
          });
          uq = await db.execute({
            sql: 'SELECT id FROM rm_admin_users WHERE username = ?',
            args: ['app_public'],
          });
        }
        userId = Number(uq.rows[0][0]);
        await db.execute({
          sql: "DELETE FROM rm_sessions WHERE user_id = ? AND expires_at < datetime('now')",
          args: [userId],
        });
        const token = randomBytes(32).toString('hex');
        await db.execute({
          sql: "INSERT INTO rm_sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))",
          args: [token, userId],
        });
        res.json({ ok: true, token });
        return;
      }

      case 'login': {
        if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
        const user = String(body.username ?? '').trim();
        const pass = String(body.password ?? '');
        if (!user || !pass) { res.status(400).json({ error: 'Usuario y contraseña requeridos' }); return; }
        if (user === 'app_public') { res.status(403).json({ error: 'Acceso no permitido' }); return; }

        const lockR = await db.execute({
          sql: 'SELECT locked_until, attempts FROM rm_login_attempts WHERE username = ?',
          args: [user],
        });
        const attempt = lockR.rows.length ? toObj(lockR.rows[0], lockR.columns) : null;
        if (attempt?.locked_until && new Date(attempt.locked_until as string) > new Date()) {
          const secs = Math.ceil((new Date(attempt.locked_until as string).getTime() - Date.now()) / 1000);
          res.status(429).json({ error: `Bloqueado. Intenta en ${secs}s.` }); return;
        }

        const st = await db.execute({
          sql: 'SELECT id, username, password_hash FROM rm_admin_users WHERE username = ? AND active = 1',
          args: [user],
        });
        const admin = st.rows.length ? toObj(st.rows[0], st.columns) : null;
        const valid = admin && await bcrypt.compare(pass, admin.password_hash as string);

        if (!valid) {
          const attempts = (Number(attempt?.attempts ?? 0)) + 1;
          const lockedUntil = attempts >= 5 ? new Date(Date.now() + 60000).toISOString() : null;
          if (attempt) {
            await db.execute({
              sql: 'UPDATE rm_login_attempts SET attempts=?, locked_until=?, last_attempt=datetime(\'now\') WHERE username=?',
              args: [attempts, lockedUntil, user],
            });
          } else {
            await db.execute({
              sql: "INSERT INTO rm_login_attempts (username,attempts,locked_until,last_attempt) VALUES (?,?,?,datetime('now'))",
              args: [user, attempts, lockedUntil],
            });
          }
          res.status(401).json({ error: `Credenciales incorrectas. ${Math.max(0, 5 - attempts)} intentos restantes.` });
          return;
        }

        await db.execute({ sql: 'DELETE FROM rm_login_attempts WHERE username=?', args: [user] });
        await db.execute({ sql: "UPDATE rm_admin_users SET last_login=datetime('now') WHERE id=?", args: [admin!.id as number] });
        const token = randomBytes(32).toString('hex');
        await db.execute({
          sql: "INSERT INTO rm_sessions (token,user_id,expires_at) VALUES (?,?,datetime('now','+8 hours'))",
          args: [token, admin!.id as number],
        });
        res.json({ ok: true, token, username: admin!.username });
        return;
      }

      case 'logout': {
        const s = await requireAuth(req, res);
        if (!s) return;
        await db.execute({
          sql: 'DELETE FROM rm_sessions WHERE token=?',
          args: [req.headers['x-rm-token'] as string],
        });
        res.json({ ok: true });
        return;
      }

      case 'check': {
        const s = await requireAuth(req, res);
        if (!s) return;
        res.json({ ok: true });
        return;
      }

      // ── PUSH NOTIFICATIONS ───────────────────────────────────
      case 'savePushToken': {
        if ((req.query.secret as string) !== APP_SECRET) {
          res.status(403).json({ error: 'No autorizado' }); return;
        }
        const tkn = String(body.token ?? '').trim();
        const platform = String(body.platform ?? 'android');
        if (!tkn) { res.status(400).json({ error: 'Token vacío' }); return; }
        await db.execute({
          sql: 'INSERT INTO push_tokens (token, platform) VALUES (?, ?) ON CONFLICT(token) DO UPDATE SET platform = excluded.platform',
          args: [tkn, platform],
        });
        res.json({ ok: true });
        return;
      }

      case 'sendPush': {
        if ((req.query.secret as string) !== APP_SECRET) {
          res.status(403).json({ error: 'No autorizado' }); return;
        }
        const title = String(body.title ?? 'Nuevo contenido');
        const msg = String(body.body ?? 'Recurso Musical');
        const data = (body.data ?? { tipo: 'general' }) as Record<string, unknown>;
        if (!data.id) { res.status(400).json({ error: 'data.id obligatorio' }); return; }
        data.id = String(data.id);
        const result = await sendPushToAll(title, msg, data);
        res.json({ ok: true, ...result });
        return;
      }

      // ── TUTORIALES ───────────────────────────────────────────
      case 'getTutoriales': {
        const s = await requireAuth(req, res);
        if (!s) return;
        const cat = String(req.query.cat ?? 'Todos').trim();
        let r;
        if (cat === 'Todos' || cat === '') {
          r = await db.execute('SELECT * FROM tutoriales ORDER BY id DESC');
        } else {
          r = await db.execute({
            sql: "SELECT * FROM tutoriales WHERE COALESCE(tipo,'tutorial')='tutorial' AND categoria=? ORDER BY id DESC",
            args: [cat],
          });
        }
        res.json(toObjs(r.rows, r.columns).map(normalizeRow));
        return;
      }

      case 'buscar': {
        const s = await requireAuth(req, res);
        if (!s) return;
        const q = '%' + String(req.query.q ?? '').trim() + '%';
        const tipo = String(req.query.tipo ?? 'tutorial').trim();
        let r;
        if (tipo === 'todos') {
          r = await db.execute({
            sql: 'SELECT * FROM tutoriales WHERE titulo LIKE ? OR artista LIKE ? OR cancion_titulo LIKE ? ORDER BY id DESC LIMIT 60',
            args: [q, q, q],
          });
        } else {
          r = await db.execute({
            sql: "SELECT * FROM tutoriales WHERE COALESCE(tipo,'tutorial')=? AND (titulo LIKE ? OR artista LIKE ? OR cancion_titulo LIKE ?) ORDER BY id DESC LIMIT 60",
            args: [tipo, q, q, q],
          });
        }
        res.json(toObjs(r.rows, r.columns).map(normalizeRow));
        return;
      }

      case 'addTutorial': {
        const s = await requireAuth(req, res);
        if (!s) return;
        if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
        const tipo = String(body.tipo ?? 'tutorial').trim();
        const titulo = String(body.titulo ?? '').trim();
        if (!titulo) { res.status(400).json({ error: 'Título obligatorio' }); return; }
        const artista = String(body.artista ?? '').trim() || 'Recurso Musical';
        const categoria = String(body.categoria ?? '').trim() || (tipo === 'cancionero' ? 'Alabanza' : 'Guitarra');
        const capo = normalizeCapo(body.capo);
        const r = await db.execute({
          sql: `INSERT INTO tutoriales
                (titulo,artista,descripcion,youtube_id,duracion,categoria,tipo,vistas,fecha,capo,intro,cancion_titulo,cancion_letra,cancion_tono,cancion_bpm,imagen)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [
            titulo,
            artista,
            String(body.descripcion ?? '').trim(),
            String(body.youtube_id ?? '').trim(),
            String(body.duracion ?? '').trim(),
            categoria, tipo,
            String(body.vistas ?? '0').trim(),
            String(body.fecha ?? new Date().toLocaleDateString('es-MX')).trim(),
            capo,
            String(body.intro ?? '').trim(),
            String(body.cancion_titulo ?? '').trim(),
            String(body.cancion_letra ?? ''),
            String(body.cancion_tono ?? '').trim(),
            Number(body.cancion_bpm ?? 0),
            String(body.imagen ?? '').trim(),
          ],
        });
        const newId = Number(r.lastInsertRowid);
        const pushTitle = String(body.cancion_titulo ?? body.titulo ?? 'Nuevo contenido');
        const emoji = tipo === 'cancionero' ? '🎵' : '▶️';
        sendPushToAll(`${emoji} Nuevo en Recurso Musical`, `${pushTitle} — ${artista}`.replace(/\s*—\s*$/, ''), { tipo, id: String(newId) });
        res.json({ id: newId, ok: true });
        return;
      }

      case 'updateTutorial': {
        const s = await requireAuth(req, res);
        if (!s) return;
        if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
        const id = Number(body.id ?? 0);
        if (!id) { res.status(400).json({ error: 'ID requerido' }); return; }
        let tipo: string;
        if (body.tipo !== undefined) {
          tipo = String(body.tipo);
        } else {
          const tq = await db.execute({ sql: "SELECT COALESCE(tipo,'tutorial') AS tipo FROM tutoriales WHERE id=?", args: [id] });
          tipo = tq.rows.length ? String(tq.rows[0][0]) : 'tutorial';
        }
        const artista = String(body.artista ?? '').trim() || 'Recurso Musical';
        await db.execute({
          sql: `UPDATE tutoriales SET
                titulo=?,artista=?,descripcion=?,youtube_id=?,duracion=?,
                categoria=?,tipo=?,capo=?,intro=?,
                cancion_titulo=?,cancion_letra=?,cancion_tono=?,cancion_bpm=?,imagen=?
                WHERE id=?`,
          args: [
            String(body.titulo ?? '').trim(),
            artista,
            String(body.descripcion ?? '').trim(),
            String(body.youtube_id ?? '').trim(),
            String(body.duracion ?? '').trim(),
            String(body.categoria ?? (tipo === 'cancionero' ? 'Alabanza' : 'Guitarra')).trim(),
            tipo,
            normalizeCapo(body.capo),
            String(body.intro ?? '').trim(),
            String(body.cancion_titulo ?? '').trim(),
            String(body.cancion_letra ?? ''),
            String(body.cancion_tono ?? '').trim(),
            Number(body.cancion_bpm ?? 0),
            String(body.imagen ?? '').trim(),
            id,
          ],
        });
        res.json({ ok: true });
        return;
      }

      case 'deleteTutorial': {
        const s = await requireAuth(req, res);
        if (!s) return;
        const id = Number(req.query.id ?? 0);
        if (!id) { res.status(400).json({ error: 'ID requerido' }); return; }
        await db.execute({ sql: 'DELETE FROM tutoriales WHERE id=?', args: [id] });
        res.json({ ok: true });
        return;
      }

      case 'toggleFavorito': {
        const s = await requireAuth(req, res);
        if (!s) return;
        if (body.id === undefined || body.val === undefined) {
          res.status(400).json({ error: 'id y val requeridos' }); return;
        }
        await db.execute({
          sql: 'UPDATE tutoriales SET es_favorito=? WHERE id=?',
          args: [Number(body.val), Number(body.id)],
        });
        res.json({ ok: true });
        return;
      }

      case 'changePassword': {
        const s = await requireAuth(req, res);
        if (!s) return;
        if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
        const current = String(body.current_password ?? '');
        const newPass = String(body.new_password ?? '');
        if (!current || !newPass) { res.status(400).json({ error: 'Faltan campos' }); return; }
        if (newPass.length < 8) { res.status(400).json({ error: 'Mínimo 8 caracteres' }); return; }
        const token = req.headers['x-rm-token'] as string;
        const sessR = await db.execute({ sql: 'SELECT user_id FROM rm_sessions WHERE token=?', args: [token] });
        if (!sessR.rows.length) { res.status(401).json({ error: 'Sesión inválida' }); return; }
        const userId = Number(sessR.rows[0][0]);
        const uR = await db.execute({ sql: 'SELECT username, password_hash FROM rm_admin_users WHERE id=?', args: [userId] });
        if (!uR.rows.length) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
        const u = toObj(uR.rows[0], uR.columns);
        if (u.username === 'app_public') { res.status(403).json({ error: 'No permitido' }); return; }
        if (!await bcrypt.compare(current, u.password_hash as string)) {
          res.status(401).json({ error: 'Contraseña incorrecta' }); return;
        }
        await db.execute({
          sql: 'UPDATE rm_admin_users SET password_hash=? WHERE id=?',
          args: [await bcrypt.hash(newPass, 10), userId],
        });
        res.json({ ok: true, msg: 'Contraseña actualizada' });
        return;
      }

      case 'searchLetras': {
        const s = await requireAuth(req, res);
        if (!s) return;
        const q = String(req.query.q ?? '').trim();
        if (!q) { res.json([]); return; }
        const slug = encodeURIComponent(q.toLowerCase());
        try {
          const r = await fetch(`https://www.letras.com/busca.php?q=${slug}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(8000),
          });
          const html = await r.text();
          const hits: unknown[] = [];
          const re = /<a[^>]+href="(\/[a-z0-9_-]+\/[a-z0-9_-]+\.html)"[^>]*>\s*([^<]{3,80})/gi;
          let m;
          while ((m = re.exec(html)) && hits.length < 8) {
            const t = m[2].trim();
            if (t.length < 3) continue;
            hits.push({ titulo: t, artista: '', url: 'https://www.letras.com' + m[1], fuente: 'letras.com' });
          }
          res.json(hits);
        } catch {
          res.json([]);
        }
        return;
      }

      case 'searchCancionero': {
        const s = await requireAuth(req, res);
        if (!s) return;
        const q = '%' + String(req.query.q ?? '').trim() + '%';
        const r = await db.execute({
          sql: `SELECT id, cancion_titulo, artista, cancion_tono, cancion_bpm, capo, intro, imagen
                FROM tutoriales
                WHERE tipo='cancionero' AND (cancion_titulo LIKE ? OR artista LIKE ?)
                ORDER BY cancion_titulo ASC LIMIT 30`,
          args: [q, q],
        });
        res.json(toObjs(r.rows, r.columns).map(row => ({
          id: Number(row.id),
          cancion_titulo: row.cancion_titulo ?? '',
          artista: row.artista ?? '',
          tono: row.cancion_tono ?? '',
          bpm: Number(row.cancion_bpm ?? 0),
          capo: row.capo ?? '0',
          intro: row.intro ?? '',
          imagen: row.imagen ?? '',
        })));
        return;
      }

      // ── MULTITRACKS ──────────────────────────────────────────
      case 'getMultitracks': {
        const r = await db.execute(
          "SELECT id,titulo,artista,tono,bpm,compas,duracion,imagen_url FROM multitracks WHERE activo=1 ORDER BY id DESC"
        );
        res.json(toObjs(r.rows, r.columns));
        return;
      }

      case 'getMultitrack': {
        const id = Number(req.query.id ?? 0);
        if (!id) { res.status(400).json({ error: 'ID requerido' }); return; }
        const r = await db.execute({ sql: 'SELECT * FROM multitracks WHERE id=? AND activo=1', args: [id] });
        if (!r.rows.length) { res.status(404).json({ error: 'Multitrack no encontrado' }); return; }
        const row = toObj(r.rows[0], r.columns);
        const ps = await db.execute({
          sql: `SELECT tipo, url FROM multitrack_pistas WHERE multitrack_id=?
                ORDER BY CASE tipo
                  WHEN 'master' THEN 0 WHEN 'click' THEN 1 WHEN 'guia' THEN 2
                  WHEN 'bateria' THEN 3 WHEN 'bajo' THEN 4 WHEN 'guitarra' THEN 5
                  WHEN 'piano' THEN 6 WHEN 'cuerdas' THEN 7 WHEN 'vientos' THEN 8
                  WHEN 'coros' THEN 9 ELSE 10 END`,
          args: [id],
        });
        row.pistas = toObjs(ps.rows, ps.columns);
        res.json(row);
        return;
      }

      case 'saveMultitrack': {
        const s = await requireAuth(req, res);
        if (!s) return;
        if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
        if (!body.titulo) { res.status(400).json({ error: 'titulo requerido' }); return; }
        const id = Number(body.id ?? 0);
        const markers = body.markers !== undefined ? body.markers : null;
        let finalId: number;
        if (id) {
          await db.execute({
            sql: 'UPDATE multitracks SET titulo=?,artista=?,tono=?,bpm=?,compas=?,duracion=?,imagen_url=?,markers=? WHERE id=?',
            args: [
              String(body.titulo), String(body.artista ?? ''), String(body.tono ?? ''),
              Number(body.bpm ?? 0), String(body.compas ?? '4/4'), String(body.duracion ?? ''),
              String(body.imagen_url ?? ''), markers as string | null, id,
            ],
          });
          finalId = id;
        } else {
          const r = await db.execute({
            sql: 'INSERT INTO multitracks (titulo,artista,tono,bpm,compas,duracion,imagen_url,markers) VALUES (?,?,?,?,?,?,?,?)',
            args: [
              String(body.titulo), String(body.artista ?? ''), String(body.tono ?? ''),
              Number(body.bpm ?? 0), String(body.compas ?? '4/4'), String(body.duracion ?? ''),
              String(body.imagen_url ?? ''), markers as string | null,
            ],
          });
          finalId = Number(r.lastInsertRowid);
        }
        const pistas = body.pistas as { tipo: string; url: string }[] | undefined;
        if (pistas && Array.isArray(pistas)) {
          await db.execute({ sql: 'DELETE FROM multitrack_pistas WHERE multitrack_id=?', args: [finalId] });
          for (const p of pistas) {
            if (!p.tipo || !p.url) continue;
            await db.execute({
              sql: 'INSERT INTO multitrack_pistas (multitrack_id,tipo,url) VALUES (?,?,?)',
              args: [finalId, p.tipo.trim(), p.url.trim()],
            });
          }
        }
        res.json({ ok: true, id: finalId });
        return;
      }

      case 'deleteMultitrack': {
        const s = await requireAuth(req, res);
        if (!s) return;
        const id = Number(req.query.id ?? 0);
        if (!id) { res.status(400).json({ error: 'ID requerido' }); return; }
        await db.execute({ sql: 'UPDATE multitracks SET activo=0 WHERE id=?', args: [id] });
        res.json({ ok: true });
        return;
      }

      case 'updateMultitrackMarkers': {
        const s = await requireAuth(req, res);
        if (!s) return;
        const id = Number(body.id ?? 0);
        if (id > 0) {
          await db.execute({
            sql: 'UPDATE multitracks SET markers=? WHERE id=?',
            args: [body.markers !== undefined ? body.markers as string : null, id],
          });
        }
        res.json({ ok: true });
        return;
      }

      default:
        res.status(404).json({ error: 'Acción no encontrada: ' + action });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: msg });
  }
}

// ────────────────────────────────────────────────────────────
// DB SETUP (SQLite / Turso schema)
// ────────────────────────────────────────────────────────────

async function setupDB() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS rm_admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS rm_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES rm_admin_users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS rm_login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      locked_until TEXT,
      last_attempt TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS tutoriales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      artista TEXT NOT NULL DEFAULT '',
      descripcion TEXT,
      youtube_id TEXT NOT NULL DEFAULT '',
      duracion TEXT,
      categoria TEXT DEFAULT 'Guitarra',
      tipo TEXT NOT NULL DEFAULT 'tutorial',
      vistas TEXT DEFAULT '0',
      fecha TEXT,
      capo TEXT DEFAULT '0',
      intro TEXT,
      cancion_titulo TEXT,
      cancion_letra TEXT,
      cancion_tono TEXT,
      cancion_bpm INTEGER DEFAULT 0,
      es_favorito INTEGER DEFAULT 0,
      imagen TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS push_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      platform TEXT DEFAULT 'android',
      created TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS multitracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      artista TEXT DEFAULT '',
      tono TEXT DEFAULT '',
      bpm INTEGER DEFAULT 0,
      compas TEXT DEFAULT '4/4',
      duracion TEXT DEFAULT '',
      imagen_url TEXT,
      markers TEXT,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS multitrack_pistas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      multitrack_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      url TEXT NOT NULL,
      FOREIGN KEY (multitrack_id) REFERENCES multitracks(id) ON DELETE CASCADE
    )`,
  ];

  for (const sql of stmts) {
    await db.execute(sql);
  }

  // Default admin user (if no non-public admin exists)
  const check = await db.execute("SELECT COUNT(*) FROM rm_admin_users WHERE username != 'app_public'");
  if (Number(check.rows[0][0]) === 0) {
    const hash = await bcrypt.hash('RecursoMusical2024!', 10);
    await db.execute({
      sql: "INSERT OR IGNORE INTO rm_admin_users (username, password_hash) VALUES ('admin', ?)",
      args: [hash],
    });
  }
}
