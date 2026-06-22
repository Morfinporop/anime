// Клиентский кэш CorpMult
// Стратегия: stale-while-revalidate
// - При заходе на сайт ВСЕ нужные данные подгружаются заранее и кэшируются
// - При открытии страницы данные показываются мгновенно из кэша
// - В фоне обновляются с сервера, кэш обновляется
// - LocalStorage с TTL — простой и надёжный, не требует IndexedDB permission

import type { Anime, Comment } from '../types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_PREFIX = 'corpmult_cache_';
const CACHE_VERSION = 'v4';
const CACHE_TTL = 1000 * 60 * 30; // 30 минут — данные считаются свежими
const STORAGE_LIMIT = 4 * 1024 * 1024; // 4 МБ максимум на ключ (защита от переполнения)

function getKey(name: string): string {
  return `${CACHE_PREFIX}${CACHE_VERSION}_${name}`;
}

function read<T>(name: string): T | null {
  try {
    const raw = localStorage.getItem(getKey(name));
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    // Проверяем версию и размер
    if (!entry.data) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function isFresh(name: string): boolean {
  try {
    const raw = localStorage.getItem(getKey(name));
    if (!raw) return false;
    const entry: CacheEntry<unknown> = JSON.parse(raw);
    return Date.now() - entry.timestamp < CACHE_TTL;
  } catch {
    return false;
  }
}

function write<T>(name: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    const json = JSON.stringify(entry);
    if (json.length > STORAGE_LIMIT) {
      console.warn(`[cache] Skip ${name}, too large: ${json.length} bytes`);
      return;
    }
    localStorage.setItem(getKey(name), json);
  } catch (err) {
    // LocalStorage переполнен — очищаем старые ключи
    clearOldCacheKeys();
    try {
      const entry: CacheEntry<T> = { data, timestamp: Date.now() };
      localStorage.setItem(getKey(name), JSON.stringify(entry));
    } catch {}
  }
}

function clearOldCacheKeys() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    // Удаляем самые старые
    const sorted = keys
      .map((k) => ({ key: k, ts: tryGetTimestamp(k) }))
      .sort((a, b) => a.ts - b.ts);
    // Удаляем половину
    for (let i = 0; i < Math.floor(sorted.length / 2); i++) {
      localStorage.removeItem(sorted[i].key);
    }
  } catch {}
}

function tryGetTimestamp(key: string): number {
  try {
    const entry = JSON.parse(localStorage.getItem(key) || '{}');
    return entry.timestamp || 0;
  } catch { return 0; }
}

// === КЭШИРОВАННЫЕ ДАННЫЕ ===

// Каталог аниме
export const catalogCache = {
  read(): Anime[] | null {
    return read<Anime[]>('catalog');
  },
  write(items: Anime[]) {
    write('catalog', items);
  },
  isFresh(): boolean {
    return isFresh('catalog');
  },
};

// Комментарии к аниме — кэшируются все сразу
export const commentsCache = {
  read(animeId: number): Comment[] | null {
    return read<Comment[]>(`comments_${animeId}`);
  },
  write(animeId: number, items: Comment[]) {
    write(`comments_${animeId}`, items);
  },
  isFresh(animeId: number): boolean {
    return isFresh(`comments_${animeId}`);
  },
};

// Лайки/дизлайки и рейтинг аниме
export interface AnimeStats {
  likesCount: number;
  dislikesCount: number;
  userVote: -1 | 0 | 1;
  rating: { average: number; count: number; userScore: number | null };
}

export const statsCache = {
  read(animeId: number): AnimeStats | null {
    return read<AnimeStats>(`stats_${animeId}`);
  },
  write(animeId: number, stats: AnimeStats) {
    write(`stats_${animeId}`, stats);
  },
  isFresh(animeId: number): boolean {
    return isFresh(`stats_${animeId}`);
  },
};

// Подробная информация об аниме (с сезонами)
export const animeDetailCache = {
  read(animeId: number): Anime | null {
    return read<Anime>(`anime_${animeId}`);
  },
  write(anime: Anime) {
    write(`anime_${anime.id}`, anime);
  },
  isFresh(animeId: number): boolean {
    return isFresh(`anime_${animeId}`);
  },
};

// Серии сезона
export const episodesCache = {
  read(seasonId: number): any[] | null {
    return read<any[]>(`episodes_${seasonId}`);
  },
  write(seasonId: number, items: any[]) {
    write(`episodes_${seasonId}`, items);
  },
  isFresh(seasonId: number): boolean {
    return isFresh(`episodes_${seasonId}`);
  },
};

// Текущий пользователь
export const userCache = {
  read(): any | null {
    return read('current_user');
  },
  write(user: any) {
    write('current_user', user);
  },
  isFresh(): boolean {
    return isFresh('current_user');
  },
};

// Избранное
export const favoritesCache = {
  read(): number[] | null {
    return read<number[]>('favorites');
  },
  write(ids: number[]) {
    write('favorites', ids);
  },
};

// Глобальный сброс
export function clearAllCache() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {}
}
