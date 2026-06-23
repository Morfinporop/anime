import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Очистка устаревших ключей LocalStorage
(function migrateOldData() {
  try {
    const oldKeys = [
      'corpmult_catalog', 'corpmult_catalog_v1', 'corpmult_catalog_v2', 'corpmult_catalog_v3',
      'corpmult_favorites', 'corpmult_favorites_v1', 'corpmult_favorites_v2', 'corpmult_favorites_v3',
      'corpmult_history', 'corpmult_history_v1', 'corpmult_history_v2', 'corpmult_history_v3',
      'corpmult_progress', 'corpmult_progress_v1', 'corpmult_progress_v2', 'corpmult_progress_v3',
      'corpmult_theme', 'corpmult_views', 'corpmult_ratings',
    ];
    oldKeys.forEach((k) => localStorage.removeItem(k));
  } catch {}
})();

createRoot(document.getElementById("root")!).render(<App />);
