import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Очистка устаревших ключей LocalStorage и миграция
(function migrateOldData() {
  try {
    // Очистка старых ключей CorpMult
    const oldKeys = [
      'corpmult_catalog', 'corpmult_catalog_v1', 'corpmult_catalog_v2', 'corpmult_catalog_v3',
      'corpmult_favorites', 'corpmult_favorites_v1', 'corpmult_favorites_v2', 'corpmult_favorites_v3',
      'corpmult_history', 'corpmult_history_v1', 'corpmult_history_v2', 'corpmult_history_v3',
      'corpmult_progress', 'corpmult_progress_v1', 'corpmult_progress_v2', 'corpmult_progress_v3',
      'corpmult_theme', 'corpmult_views', 'corpmult_ratings',
    ];
    
    // Также удаляем новые ключи animeworld, чтобы избежать конфликтов при миграции
    const newKeys = [
      'animeworld_catalog', 'animeworld_catalog_v1',
      'animeworld_favorites', 'animeworld_favorites_v1',
      'animeworld_history', 'animeworld_history_v1',
    ];
    
    oldKeys.forEach((k) => localStorage.removeItem(k));
    newKeys.forEach((k) => localStorage.removeItem(k));
    
    // Миграция данных из corpMult в animeWorld (если нужно)
    const userCache = localStorage.getItem('corpmult_user_cache');
    if (userCache) {
      localStorage.setItem('animeworld_user_cache', userCache);
      localStorage.removeItem('corpmult_user_cache');
    }
    
    const favorites = localStorage.getItem('corpmult_favorites_cache');
    if (favorites) {
      localStorage.setItem('animeworld_favorites_cache', favorites);
      localStorage.removeItem('corpmult_favorites_cache');
    }
    
  } catch (e) {
    console.warn('Migration failed:', e);
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
