// turso.js — conectado a la API REST de recursomusical.com.mx
import { api } from '../api/api';

export async function getTutorialesByCategoria(categoria) {
  const data = await api.getTutoriales(categoria);
  if (!Array.isArray(data)) {
    throw new Error(data?.error || data?.message || 'Respuesta inesperada del servidor');
  }
  return data;
}

export async function buscarTutoriales(query) {
  const data = await api.buscar(query);
  return Array.isArray(data) ? data : [];
}

export async function getFavoritos() {
  const data = await api.getTutoriales('Todos');
  const list = Array.isArray(data) ? data : [];
  return list.filter(t => t.es_favorito === 1 || t.es_favorito === '1');
}

export async function toggleFavorito(id, isFav) {
  try {
    await api.toggleFavorito(id, isFav ? 0 : 1);
  } catch {}
}

export async function getCancionero() {
  const data = await api.getCancionero();
  return Array.isArray(data) ? data : [];
}

export async function toggleFavoritoCancionero(id, isFav) {
  try {
    await api.toggleFavorito(id, isFav ? 0 : 1);
  } catch {}
}

export function normalizeCancion(cancion) {
  if (!cancion) return cancion;
  return {
    ...cancion,
    id:        cancion.id            || '',
    titulo:    cancion.titulo        || cancion.cancion_titulo || cancion.title || '',
    artista:   cancion.artista       || cancion.artist         || '',
    tono:      cancion.tono          || cancion.cancion_tono   || cancion.key  || '',
    capo:      cancion.capo          || '',
    letra:     cancion.letra         || cancion.cancion_letra  || '',
    tabs:      cancion.tabs          || '',
    youtube_id:cancion.youtube_id    || cancion.youtubeId      || '',
    favorito:  !!(cancion.es_favorito === 1 || cancion.es_favorito === '1' || cancion.favorito),
  };
}
