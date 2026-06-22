import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import VideoCard from '../components/VideoCard';
import { getFavorites, loadCatalog, users } from '../services/api';
import type { Anime } from '../types';

export function FavoritesPage() {
  const [items, setItems] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [authNeeded, setAuthNeeded] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await users.getCurrent();
      if (!u) { setAuthNeeded(true); setLoading(false); return; }
      const [favs, catalog] = await Promise.all([getFavorites(), loadCatalog('newest')]);
      const favIds = new Set(favs.map((f) => f.id));
      setItems(catalog.filter((v) => favIds.has(v.id)));
      setLoading(false);
    })();
  }, []);

  if (authNeeded) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28 animate-fade-in">
        <Heart className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
        <h1 className="text-2xl font-bold text-zinc-900">Войдите в аккаунт</h1>
        <p className="mt-2 text-sm text-zinc-500">Чтобы видеть избранное.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-12 animate-fade-in">
      <div className="mb-6 flex items-end justify-between gap-4 animate-slide-up">
        <div>
          <h1 className="text-display text-3xl text-zinc-900 sm:text-5xl">Избранное</h1>
          <p className="mt-1 text-sm text-zinc-500">Сохранённые вами аниме</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 py-16 text-center">
          <Heart className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
          <h3 className="text-lg font-bold text-zinc-900">Список пуст</h3>
          <Link to="/" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all hover:scale-105">
            Открыть каталог
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((v, i) => (
            <div key={v.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}>
              <VideoCard video={v} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
