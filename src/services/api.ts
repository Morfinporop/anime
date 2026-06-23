// API клиент CorpMult с умным кэшированием
// Стратегия stale-while-revalidate:
// - Сначала показываем данные из кэша (мгновенно)
// - В фоне обновляем с сервера
// - При заходе на сайт — прогружаем ВСЮ базу (каталог + статы + комментарии)

import type { Anime, Episode, Comment, User } from '../types';
import {
  catalogCache, animeDetailCache, episodesCache, commentsCache,
  statsCache, userCache, favoritesCache,
} from './cache';

const LOGO_URL = '/images/logov.png';
const API_BASE = '/api';

// === HTTP ===
async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// === ПРЕДЗАГРУЗКА (вызывается при старте приложения) ===
let preloadStarted = false;
let preloadPromise: Promise<void> | null = null;

export function preloadAll(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    if (preloadStarted) return;
    preloadStarted = true;
    try {
      // Загружаем параллельно: каталог + текущий пользователь
      const tasks: Promise<void>[] = [];

      // 1. Каталог
      tasks.push(
        (async () => {
          if (catalogCache.isFresh() && catalogCache.read()) return; // уже свежий
          try {
            const { items } = await http<{ items: Anime[] }>('/anime?sort=popular');
            catalogCache.write(items || []);
          } catch {}
        })()
      );

      // 2. Пользователь
      tasks.push(
        (async () => {
          if (userCache.isFresh() && userCache.read() !== null) return;
          try {
            const { user } = await http<{ user: User | null }>('/auth/me');
            userCache.write(user);
          } catch {}
        })()
      );

      await Promise.allSettled(tasks);
    } catch {}
  })();
  return preloadPromise;
}

// Принудительное обновление всего кэша с сервера
export async function refreshAll(): Promise<void> {
  preloadStarted = false;
  preloadPromise = null;
  await preloadAll();
}

// === АККАУНТЫ ===
export const users = {
  async getCurrent(): Promise<User | null> {
    // Сначала кэш
    const cached = userCache.read();
    if (cached !== null) {
      // В фоне обновляем с сервера
      http<{ user: User | null }>('/auth/me').then(({ user }) => {
        userCache.write(user);
        window.dispatchEvent(new Event('corpmult_user_change'));
      }).catch(() => {});
      return cached;
    }
    // Нет кэша — запрос
    try {
      const { user } = await http<{ user: User | null }>('/auth/me');
      userCache.write(user);
      return user;
    } catch { return null; }
  },
  async login(username: string, password: string): Promise<User> {
    const { user } = await http<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    userCache.write(user);
    return user;
  },
  async register(username: string, password: string): Promise<User> {
    const { user } = await http<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
    userCache.write(user);
    return user;
  },
  async logout(): Promise<void> {
    await http('/auth/logout', { method: 'POST' });
    userCache.write(null);
    favoritesCache.write([]);
  },
};

// === АНИМЕ (каталог) ===
export async function loadCatalog(sort = 'popular', genre?: string): Promise<Anime[]> {
  // 1) Сначала кэш
  if (!genre && sort === 'popular') {
    const cached = catalogCache.read();
    if (cached && cached.length > 0) {
      // 2) В фоне обновляем
      http<{ items: Anime[] }>(`/anime?sort=popular`).then(({ items }) => {
        if (items && items.length > 0) catalogCache.write(items);
      }).catch(() => {});
      return cached;
    }
  }

  // Нет кэша или другой запрос — синхронно
  const params = new URLSearchParams({ sort });
  if (genre && genre !== 'all') params.set('genre', genre);
  const { items } = await http<{ items: Anime[] }>(`/anime?${params}`);
  if (!genre && sort === 'popular') catalogCache.write(items);
  return items;
}

export async function getAnimeById(id: number): Promise<Anime | null> {
  // 1) Кэш
  const cached = animeDetailCache.read(id);
  if (cached) {
    // 2) В фоне обновляем
    http<{ anime: Anime }>(`/anime/${id}`).then(({ anime }) => {
      if (anime) {
        animeDetailCache.write(anime);
      }
    }).catch(() => {});
    return cached;
  }
  // Нет кэша
  try {
    const { anime } = await http<{ anime: Anime }>(`/anime/${id}`);
    if (anime) animeDetailCache.write(anime);
    return anime;
  } catch { return null; }
}

export async function searchAnime(query: string): Promise<Anime[]> {
  if (!query.trim()) return [];
  const all = await loadCatalog('popular');
  const q = query.trim().toLowerCase();
  return all.filter((v) =>
    v.title.toLowerCase().includes(q) ||
    v.genres.some((g) => g.toLowerCase().includes(q)) ||
    v.description.toLowerCase().includes(q)
  );
}

// === ЗАГРУЗКА АНИМЕ / СЕЗОНА / СЕРИИ ===
export interface CreateAnimeOptions {
  title: string;
  description?: string;
  year?: number;
  ageRating?: string;
  genres?: string;
  poster?: File | null;
  onProgress?: (pct: number) => void;
}

export async function createAnime(opts: CreateAnimeOptions): Promise<number> {
  const form = new FormData();
  form.append('title', opts.title);
  if (opts.description) form.append('description', opts.description);
  form.append('year', String(opts.year || new Date().getFullYear()));
  form.append('ageRating', opts.ageRating || '12+');
  form.append('genres', opts.genres || '');
  if (opts.poster) form.append('poster', opts.poster);
  const { animeId } = await http<{ animeId: number }>('/anime', { method: 'POST', body: form });
  // Инвалидируем кэш каталога
  catalogCache.write([]);
  return animeId;
}

export interface CreateSeasonOptions {
  animeId: number;
  seasonNumber: number;
  description?: string;
  poster?: File | null;
}

export async function createSeason(opts: CreateSeasonOptions): Promise<number> {
  const form = new FormData();
  form.append('seasonNumber', String(opts.seasonNumber));
  if (opts.description) form.append('description', opts.description);
  if (opts.poster) form.append('poster', opts.poster);
  const { seasonId } = await http<{ seasonId: number }>(`/anime/${opts.animeId}/seasons`, { method: 'POST', body: form });
  return seasonId;
}

export interface UploadEpisodeOptions {
  seasonId: number;
  episodeNumber: number;
  title?: string;
  video: File;
  poster?: File | null;
  onProgress?: (pct: number) => void;
}

export async function uploadEpisode(opts: UploadEpisodeOptions): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/seasons/${opts.seasonId}/episodes`);
    xhr.withCredentials = true;

    const form = new FormData();
    form.append('episodeNumber', String(opts.episodeNumber));
    if (opts.title) form.append('title', opts.title);
    form.append('video', opts.video);
    if (opts.poster) form.append('poster', opts.poster);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) opts.onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText).episodeId); } catch { reject(new Error('Invalid response')); }
      } else {
        try { reject(new Error(JSON.parse(xhr.responseText).error || `HTTP ${xhr.status}`)); }
        catch { reject(new Error(`HTTP ${xhr.status}`)); }
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(form);
  });
}

// === СЕРИИ СЕЗОНА (с кэшем) ===
export async function getSeasonEpisodes(seasonId: number): Promise<Episode[]> {
  const cached = episodesCache.read(seasonId);
  if (cached && cached.length > 0) {
    http<{ episodes: Episode[] }>(`/seasons/${seasonId}/episodes`).then(({ episodes }) => {
      if (episodes && episodes.length > 0) episodesCache.write(seasonId, episodes);
    }).catch(() => {});
    return cached as Episode[];
  }
  const { episodes } = await http<{ episodes: Episode[] }>(`/seasons/${seasonId}/episodes`);
  if (episodes && episodes.length > 0) episodesCache.write(seasonId, episodes);
  return episodes;
}

// === ПРЕДЗАГРУЗКА КОММЕНТАРИЕВ И СТАТОВ ДЛЯ ВСЕХ АНИМЕ ===
// При первом заходе — загружаем ВСЕ комментарии ко всем аниме
// Это занимает ~1-2 сек для каталога в 50 аниме
export async function preloadAllStats(animeIds: number[]): Promise<void> {
  // Параллельно загружаем статы и комментарии (лимит — 6 одновременно)
  const BATCH = 6;
  for (let i = 0; i < animeIds.length; i += BATCH) {
    const batch = animeIds.slice(i, i + BATCH);
    await Promise.allSettled(batch.map(async (id) => {
      // Загружаем только если кэш не свежий
      if (statsCache.isFresh(id)) return;
      try {
        const [votesRes, ratingRes, commentsRes] = await Promise.all([
          http<{ likes: number; dislikes: number; userVote: number }>(`/anime/${id}/votes`),
          http<{ average: number; count: number; userScore: number | null }>(`/anime/${id}/rating`),
          http<{ comments: Comment[] }>(`/anime/${id}/comments`),
        ]);

        statsCache.write(id, {
          likesCount: votesRes.likes,
          dislikesCount: votesRes.dislikes,
          userVote: votesRes.userVote as -1 | 0 | 1,
          rating: ratingRes,
        });
        commentsCache.write(id, commentsRes.comments);
      } catch {}
    }));
  }
}

// === ЛАЙКИ / ДИЗЛАЙКИ ===
export async function voteAnime(animeId: number, vote: 1 | -1 | 0) {
  const result = await http<{ likes: number; dislikes: number; userVote: number }>(`/anime/${animeId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ vote }),
  });
  // Обновляем кэш
  const cached = statsCache.read(animeId);
  if (cached) {
    statsCache.write(animeId, { ...cached, likesCount: result.likes, dislikesCount: result.dislikes, userVote: result.userVote as -1 | 0 | 1 });
  }
  return result;
}

// === РЕЙТИНГИ ===
export async function rateAnime(animeId: number, score: number) {
  const result = await http<{ average: number; count: number; userScore: number }>(`/anime/${animeId}/rate`, {
    method: 'POST',
    body: JSON.stringify({ score }),
  });
  const cached = statsCache.read(animeId);
  if (cached) {
    statsCache.write(animeId, { ...cached, rating: result });
  }
  return result;
}

export async function getAnimeRating(animeId: number) {
  // Сначала кэш
  const cached = statsCache.read(animeId);
  if (cached) {
    http<{ average: number; count: number; userScore: number | null }>(`/anime/${animeId}/rating`).then((fresh) => {
      statsCache.write(animeId, { ...cached, rating: fresh });
    }).catch(() => {});
    return cached.rating;
  }
  const fresh = await http<{ average: number; count: number; userScore: number | null }>(`/anime/${animeId}/rating`);
  return fresh;
}

// === КОММЕНТАРИИ (с кэшем) ===
export async function getComments(animeId: number): Promise<Comment[]> {
  const cached = commentsCache.read(animeId);
  if (cached && cached.length > 0) {
    // В фоне обновляем
    http<{ comments: Comment[] }>(`/anime/${animeId}/comments`).then(({ comments }) => {
      if (comments) commentsCache.write(animeId, comments);
    }).catch(() => {});
    return cached;
  }
  const { comments } = await http<{ comments: Comment[] }>(`/anime/${animeId}/comments`);
  if (comments) commentsCache.write(animeId, comments);
  return comments;
}

export async function addComment(animeId: number, text: string, episodeId?: number): Promise<Comment> {
  const { comment } = await http<{ comment: Comment }>(`/anime/${animeId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text, episodeId }),
  });
  // Добавляем в кэш
  const cached = commentsCache.read(animeId) || [];
  commentsCache.write(animeId, [comment, ...cached]);
  return comment;
}

export async function toggleCommentLike(commentId: number) {
  const result = await http<{ likes: number; liked: boolean }>(`/comments/${commentId}/like`, { method: 'POST' });
  // Обновляем все кэши комментариев — ищем по id
  const keys = Object.keys(localStorage);
  keys.forEach((k) => {
    if (k.includes('comments_')) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) return;
        const entry = JSON.parse(raw);
        if (Array.isArray(entry.data)) {
          entry.data = entry.data.map((c: any) =>
            c.id === commentId ? { ...c, likes: result.likes, likedByMe: result.liked } : c
          );
          localStorage.setItem(k, JSON.stringify(entry));
        }
      } catch {}
    }
  });
  // Уведомляем компоненты
  window.dispatchEvent(new Event('corpmult_comments_change'));
  return result;
}

export async function deleteComment(commentId: number) {
  await http(`/comments/${commentId}`, { method: 'DELETE' });
  // Удаляем из всех кэшей
  const keys = Object.keys(localStorage);
  keys.forEach((k) => {
    if (k.includes('comments_')) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) return;
        const entry = JSON.parse(raw);
        if (Array.isArray(entry.data)) {
          entry.data = entry.data.filter((c: any) => c.id !== commentId);
          localStorage.setItem(k, JSON.stringify(entry));
        }
      } catch {}
    }
  });
  window.dispatchEvent(new Event('corpmult_comments_change'));
}

// === ПРОСМОТРЫ ===
export async function recordView(episodeId: number, watchedSeconds: number): Promise<number> {
  try {
    const { views } = await http<{ views: number; counted: boolean }>(`/episodes/${episodeId}/view`, {
      method: 'POST',
      body: JSON.stringify({ watchedSeconds }),
    });
    return views;
  } catch { return 0; }
}

// === ИЗБРАННОЕ (с кэшем) ===
export async function getFavorites(): Promise<{ id: number; title: string; poster: string; year: number; likesCount: number; rating: number }[]> {
  const cached = favoritesCache.read();
  if (cached !== null) {
    http<{ items: any[] }>('/favorites').then(({ items }) => {
      favoritesCache.write(items.map((i: any) => i.id));
    }).catch(() => {});
    // Возвращаем детальную инфу из кэша каталога
    const catalog = catalogCache.read() || [];
    return cached
      .map((id) => catalog.find((c) => c.id === id))
      .filter((c): c is Anime => Boolean(c))
      .map((c) => ({
        id: c.id, title: c.title, poster: c.poster, year: c.year,
        likesCount: c.likesCount, rating: c.rating,
      }));
  }
  try {
    const { items } = await http<{ items: any[] }>('/favorites');
    favoritesCache.write(items.map((i: any) => i.id));
    return items;
  } catch { return []; }
}

export async function toggleFavorite(animeId: number): Promise<boolean> {
  const { favorite } = await http<{ favorite: boolean }>(`/favorites/${animeId}`, { method: 'POST' });
  // Обновляем кэш
  const cached = favoritesCache.read() || [];
  const idx = cached.indexOf(animeId);
  if (favorite && idx === -1) cached.push(animeId);
  if (!favorite && idx >= 0) cached.splice(idx, 1);
  favoritesCache.write(cached);
  window.dispatchEvent(new Event('corpmult_favorites_change'));
  return favorite;
}

// === ИСТОРИЯ ===
export async function getHistory() {
  try { return (await http<{ history: any[] }>('/history')).history; } catch { return []; }
}
export async function pushHistory(episodeId: number) {
  try { await http(`/history/${episodeId}`, { method: 'POST' }); } catch {}
}

// === АДМИНКА ===
export const admin = {
  async listUsers() { return (await http<{ users: any[] }>('/admin/users')).users; },
  async setUploadPermission(userId: number, canUpload: boolean) {
    await http(`/admin/users/${userId}/upload-permission`, { method: 'POST', body: JSON.stringify({ canUpload }) });
  },
  async setAdmin(userId: number, isAdmin: boolean) {
    await http(`/admin/users/${userId}/admin`, { method: 'POST', body: JSON.stringify({ isAdmin }) });
  },
  async toggleBan(userId: number, isBanned: boolean) {
    await http(`/admin/users/${userId}/ban`, { method: 'POST', body: JSON.stringify({ isBanned }) });
  },
  async deleteComment(commentId: number) {
    await http(`/admin/comments/${commentId}`, { method: 'DELETE' });
  },
  async deleteAnime(animeId: number) {
    await fetch(`${API_BASE}/admin/anime/${animeId}`, { method: 'DELETE', credentials: 'include' });
    catalogCache.write([]);
  },
  async deleteSeason(seasonId: number) {
    await fetch(`${API_BASE}/admin/seasons/${seasonId}`, { method: 'DELETE', credentials: 'include' });
  },
  async deleteEpisode(episodeId: number) {
    await fetch(`${API_BASE}/admin/episodes/${episodeId}`, { method: 'DELETE', credentials: 'include' });
  },
};

export async function changePassword(oldPassword: string, newPassword: string) {
  return http('/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) });
}

export { LOGO_URL };
export type Video = Anime;
