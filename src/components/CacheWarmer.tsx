// Прогреватель кэша при заходе на сайт
// При первом монтировании:
// 1. Загружает каталог аниме (мгновенно показывается из кэша)
// 2. Загружает текущего пользователя
// 3. Затем в фоне прогревает статы и комментарии для всех аниме

import { useEffect } from 'react';
import { preloadAllStats, loadCatalog, users, getFavorites, refreshAll } from '../services/api';

// Ключ версии — если меняется, кэш сбрасывается и грузится заново
const SCHEMA_VERSION = 'v4';

export default function CacheWarmer() {
  useEffect(() => {
    let cancelled = false;

    async function warm() {
      try {
        // Проверяем версию — если приложение обновилось, сбросить кэш
        const savedVersion = localStorage.getItem('corpmult_schema_version');
        if (savedVersion !== SCHEMA_VERSION) {
          // Очищаем все ключи кэша
          const keys: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('corpmult_cache_')) keys.push(k);
          }
          keys.forEach((k) => localStorage.removeItem(k));
          localStorage.setItem('corpmult_schema_version', SCHEMA_VERSION);
        }

        // 1. Запускаем параллельную загрузку пользователя и каталога
        await Promise.allSettled([
          users.getCurrent(),
          loadCatalog('popular'),
        ]);

        if (cancelled) return;

        // 2. Параллельно подгружаем избранное (если залогинен)
        const u = await users.getCurrent();
        if (u) {
          await getFavorites().catch(() => {});
        }

        if (cancelled) return;

        // 3. В фоне прогреваем все статы и комментарии для всех аниме
        // Это происходит постепенно — пользователь уже видит каталог
        loadCatalog('popular').then((catalog) => {
          if (cancelled || catalog.length === 0) return;
          const ids = catalog.map((a) => a.id);
          preloadAllStats(ids).catch(() => {});
        });

        // 4. Периодически обновляем кэш в фоне (каждые 5 минут)
        const interval = setInterval(() => {
          if (cancelled) {
            clearInterval(interval);
            return;
          }
          refreshAll().catch(() => {});
        }, 5 * 60 * 1000);
      } catch (e) {
        console.warn('[warm] error:', e);
      }
    }

    warm();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
