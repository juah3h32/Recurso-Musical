import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.recursomusical.com.mx/rm-api/api.php';
const APP_SECRET = 'rm_app_2024_public';
const TOKEN_KEY = 'rm_app_token';

async function getToken(): Promise<string> {
  let token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) return token;
  return refreshToken();
}

async function refreshToken(): Promise<string> {
  const res = await fetch(`${BASE}?action=appToken&secret=${APP_SECRET}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
    },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Error del servidor (${res.status}): ${text.slice(0, 100)}`);
  }
  if (!data.ok) throw new Error(data.message || 'No se pudo obtener token');
  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  return data.token;
}

async function parseResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const preview = text.slice(0, 200);
    throw new Error(`Respuesta no válida del servidor (${res.status}): ${preview}`);
  }
}

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
};

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...COMMON_HEADERS,
      'X-RM-Token': token,
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    await AsyncStorage.removeItem(TOKEN_KEY);
    const newToken = await refreshToken();
    const retry = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...COMMON_HEADERS,
        'X-RM-Token': newToken,
        ...(options.headers ?? {}),
      },
    });
    return parseResponse(retry);
  }
  return parseResponse(res);
}

export interface Tutorial {
  id: number;
  titulo: string;
  artista: string;
  descripcion: string;
  youtube_id: string;
  duracion: string;
  categoria: string;
  tipo: string;
  vistas: string;
  fecha: string;
  capo: string;
  intro: string;
  cancion_titulo: string;
  cancion_letra: string;
  cancion_tono: string;
  cancion_bpm: number;
  imagen: string;
  es_favorito: number;
}

export interface Multitrack {
  id: number;
  titulo: string;
  artista: string;
  tono: string;
  bpm: number;
  compas: string;
  duracion: string;
  imagen_url: string;
}

export interface MultitrackDetalle extends Multitrack {
  pistas: { tipo: string; url: string }[];
}

export const api = {
  getTutoriales: (cat = 'Todos') =>
    apiFetch(`?action=getTutoriales&cat=${encodeURIComponent(cat)}`),

  getCancionero: () =>
    apiFetch(`?action=getTutoriales&cat=Todos`).then((rows: Tutorial[]) =>
      rows.filter((r) => r.tipo === 'cancionero')
    ),

  buscar: (q: string, tipo = 'todos') =>
    apiFetch(`?action=buscar&q=${encodeURIComponent(q)}&tipo=${tipo}`),

  toggleFavorito: (id: number, val: number) =>
    apiFetch(`?action=toggleFavorito`, {
      method: 'POST',
      body: JSON.stringify({ id, val }),
    }),

  getMultitracks: (): Promise<Multitrack[]> =>
    apiFetch(`?action=getMultitracks`),

  getMultitrack: (id: number): Promise<MultitrackDetalle> =>
    apiFetch(`?action=getMultitrack&id=${id}`),

  savePushToken: (token: string, platform: string) =>
    fetch(`${BASE}?action=savePushToken&secret=${APP_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform }),
    }),
};
