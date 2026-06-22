// API клиент CorpMult — общается с backend сервером на Railway
// Все данные хранятся в PostgreSQL, LocalStorage полностью убран

import type { Video, Comment, User } from '../types';

const LOGO_URL = 'https://cdn.pixabay.com/photo/2017/03/16/21/18/logo-2150297_640.png';

// API_BASE определяется автоматически:
// - В продакшене (Railway): same origin `/api` (тот же сервер раздаёт и API и фронтенд)
// - В разработке: http://localhost:3001/api (отдельный сервер)
const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

export { LOGO_URL };

// === УТИЛИТЫ ЗАПРОСОВ ===
async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// === АККАУНТЫ ===
export const users = {
  async getCurrent(): Promise<User | null> {
    try {
      const { user } = await http<{ user: User | null }>('/auth/me');
      return user;
    } catch {
      return null;
    }
  },
  async login(username: string, password: string): Promise<User> {
    const { user } = await http<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    cacheUser(user);
    window.dispatchEvent(new Event('corpmult_user_change'));
    return user;
  },
  async register(username: string, password: string): Promise<User> {
    const { user } = await http<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    cacheUser(user);
    window.dispatchEvent(new Event('corpmult_user_change'));
    return user;
  },
  async logout(): Promise<void> {
    await http('/auth/logout', { method: 'POST' });
    localStorage.setItem('corpmult_user_cache', 'null');
    window.dispatchEvent(new Event('corpmult_user_change'));
  },
};

// Кэш текущего пользователя для мгновенного UI
function cacheUser(user: User | null) {
  localStorage.setItem('corpmult_user_cache', user ? JSON.stringify(user) : 'null');
}

// Админка
export const admin = {
  async listUsers() {
    const { users } = await http<{ users: any[] }>('/admin/users');
    return users;
  },
  async setUploadPermission(userId: number, canUpload: boolean) {
    await http(`/admin/users/${userId}/upload-permission`, {
      method: 'POST',
      body: JSON.stringify({ canUpload }),
    });
  },
  async setAdmin(userId: number, isAdmin: boolean) {
    await http(`/admin/users/${userId}/admin`, {
      method: 'POST',
      body: JSON.stringify({ isAdmin }),
    });
  },
  async deleteVideo(videoId: string) {
    await http(`/videos/${videoId}`, { method: 'DELETE' });
  },
  async deleteComment(commentId: number) {
    await http(`/admin/comments/${commentId}`, { method: 'DELETE' });
  },
};

// Сменить пароль
export async function changePassword(oldPassword: string, newPassword: string) {
  return http('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

// Удалить видео (своё или админ — любое)
export async function deleteVideo(videoId: string) {
  return http(`/videos/${videoId}`, { method: 'DELETE' });
}

// === ВИДЕО ===
export async function loadCatalog(sort: string = 'popular', genre?: string): Promise<Video[]> {
  const params = new URLSearchParams({ sort });
  if (genre && genre !== 'all') params.set('genre', genre);
  const { videos } = await http<{ videos: Video[] }>(`/videos?${params}`);
  return videos;
}

export async function getVideoById(id: string): Promise<Video | null> {
  try {
    const { video } = await http<{ video: Video }>(`/videos/${id}`);
    return video;
  } catch {
    return null;
  }
}

export async function searchVideos(query: string): Promise<Video[]> {
  if (!query.trim()) return [];
  const all = await loadCatalog('popular');
  const q = query.trim().toLowerCase();
  return all.filter((v) =>
    v.title.toLowerCase().includes(q) ||
    v.genres.some((g) => g.toLowerCase().includes(q)) ||
    v.voiceovers.some((v) => v.toLowerCase().includes(q)) ||
    v.description.toLowerCase().includes(q)
  );
}

export async function getRelatedVideos(video: Video, limit = 10): Promise<Video[]> {
  const all = await loadCatalog('popular');
  const others = all.filter((v) => v.id !== video.id);

  const scored = others.map((v) => {
    let score = 0;
    score += v.genres.filter((g) => video.genres.includes(g)).length * 10;
    if (v.ageRating === video.ageRating) score += 3;
    const yearDiff = Math.abs(v.year - video.year);
    if (yearDiff <= 3) score += 2;
    else if (yearDiff <= 5) score += 1;
    if (v.isSeries === video.isSeries) score += 1;
    return { video: v, score };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.video);
}

// === ЗАГРУЗКА ВИДЕО ===
export interface UploadOptions {
  title: string;
  description?: string;
  year?: number;
  ageRating?: string;
  quality?: string;
  isSeries?: boolean;
  episodesCount?: number;
  genres?: string;
  voiceovers?: string;
  subtitles?: string;
  onProgress?: (pct: number) => void;
}

export async function uploadVideo(file: File, opts: UploadOptions): Promise<string> {
  const form = new FormData();
  form.append('video', file);
  form.append('title', opts.title);
  if (opts.description) form.append('description', opts.description);
  form.append('year', String(opts.year || new Date().getFullYear()));
  form.append('ageRating', opts.ageRating || '12+');
  form.append('quality', opts.quality || '1080p');
  form.append('isSeries', String(opts.isSeries || false));
  form.append('episodesCount', String(opts.episodesCount || 1));
  form.append('genres', opts.genres || '');
  form.append('voiceovers', opts.voiceovers || 'Оригинал');
  form.append('subtitles', opts.subtitles || '');

  // Используем XHR для отслеживания прогресса загрузки
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/videos`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const { id } = JSON.parse(xhr.responseText);
          resolve(id);
        } catch {
          reject(new Error('Неверный ответ сервера'));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Ошибка сети'));
    xhr.send(form);
  });
}

// === РЕЙТИНГИ ===
export async function rateVideo(videoId: string, score: number) {
  return http<{ average: number; count: number; userScore: number }>(`/videos/${videoId}/rate`, {
    method: 'POST',
    body: JSON.stringify({ score }),
  });
}

export async function getVideoRating(videoId: string) {
  return http<{ average: number; count: number; userScore: number | null }>(`/videos/${videoId}/rating`);
}

// === КОММЕНТАРИИ ===
export async function getComments(videoId: string): Promise<Comment[]> {
  const { comments } = await http<{ comments: Comment[] }>(`/videos/${videoId}/comments`);
  return comments;
}

export async function addComment(videoId: string, text: string): Promise<Comment> {
  const { comment } = await http<{ comment: Comment }>(`/videos/${videoId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  return comment;
}

export async function toggleCommentLike(commentId: number) {
  return http<{ likes: number; liked: boolean }>(`/comments/${commentId}/like`, {
    method: 'POST',
  });
}

export async function deleteComment(commentId: number) {
  await http(`/comments/${commentId}`, { method: 'DELETE' });
}

// === ПРОСМОТРЫ ===
// Засчитывается только если пользователь посмотрел 30+ секунд
export async function recordView(videoId: string, watchedSeconds: number): Promise<number> {
  try {
    const { views } = await http<{ views: number; counted: boolean }>(`/videos/${videoId}/view`, {
      method: 'POST',
      body: JSON.stringify({ watchedSeconds }),
    });
    return views;
  } catch {
    return 0;
  }
}

// === ИЗБРАННОЕ ===
export async function getFavorites(): Promise<string[]> {
  try {
    const { ids } = await http<{ ids: string[] }>('/favorites');
    return ids;
  } catch {
    return [];
  }
}

export async function toggleFavorite(videoId: string): Promise<boolean> {
  const { favorite } = await http<{ favorite: boolean }>(`/favorites/${videoId}`, {
    method: 'POST',
  });
  return favorite;
}

export async function getHistory(): Promise<{ videoId: string; watchedAt: string }[]> {
  try {
    const { history } = await http<{ history: { video_id: string; watched_at: string }[] }>('/history');
    return history.map((h) => ({ videoId: h.video_id, watchedAt: h.watched_at }));
  } catch {
    return [];
  }
}

export async function pushHistory(videoId: string) {
  try {
    await http(`/history/${videoId}`, { method: 'POST' });
  } catch {}
}
