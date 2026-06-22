import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import VideoCard from '../components/VideoCard';
import { getFavorites, getHistory, loadCatalog, users } from '../services/api';
// storage import removed - everything is server-side now
import type { Video } from '../types';

// Добавлен key={v.id} для предотвращения перерендера
export function FavoritesPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [authNeeded, setAuthNeeded] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await users.getCurrent();
      if (!u) { setAuthNeeded(true); setLoading(false); return; }
      const [favIds, catalog] = await Promise.all([getFavorites(), loadCatalog('newest')]);
      setVideos(catalog.filter((v) => favIds.includes(v.id)));
      setLoading(false);
    })();
  }, []);

  if (authNeeded) return <AuthRequired title="Избранное" description="Войдите в аккаунт, чтобы добавлять видео в избранное." />;

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-12 animate-fade-in">
      <div className="mb-6 flex items-end justify-between gap-4 animate-slide-up">
        <div>
          <h1 className="text-display text-3xl text-zinc-900 sm:text-5xl">Избранное</h1>
          <p className="mt-1 text-sm text-zinc-500">Сохранённые вами аниме</p>
        </div>
        <span className="text-xs text-zinc-500">{videos.length} {pluralize(videos.length, ['видео', 'видео', 'видео'])}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" /></div>
      ) : videos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 py-16 text-center">
          <Heart className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
          <h3 className="text-lg font-bold text-zinc-900">Список пуст</h3>
          <p className="mt-1 text-sm text-zinc-500">Добавляйте аниме в избранное, нажимая на сердечко.</p>
          <Link to="/anime" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all hover:scale-105">
            Открыть каталог
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {videos.map((v, i) => (
            <div key={v.id} className="animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
              <VideoCard video={v} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HistoryPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [authNeeded, setAuthNeeded] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await users.getCurrent();
      if (!u) { setAuthNeeded(true); setLoading(false); return; }
      const [history, catalog] = await Promise.all([getHistory(), loadCatalog('newest')]);
      const list = history
        .map((h) => catalog.find((v) => v.id === h.videoId))
        .filter((v): v is Video => Boolean(v));
      setVideos(list);
      setLoading(false);
    })();
  }, []);

  if (authNeeded) return <AuthRequired title="История" description="Войдите в аккаунт, чтобы видеть историю просмотров." />;

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-12 animate-fade-in">
      <div className="mb-6 flex items-end justify-between gap-4 animate-slide-up">
        <div>
          <h1 className="text-display text-3xl text-zinc-900 sm:text-5xl">История</h1>
          <p className="mt-1 text-sm text-zinc-500">Последние просмотренные аниме</p>
        </div>
        <span className="text-xs text-zinc-500">{videos.length} {pluralize(videos.length, ['видео', 'видео', 'видео'])}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" /></div>
      ) : videos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 py-16 text-center">
          <svg className="mx-auto mb-3 h-10 w-10 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v5h5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l4 2" />
          </svg>
          <h3 className="text-lg font-bold text-zinc-900">История пуста</h3>
          <p className="mt-1 text-sm text-zinc-500">Здесь появятся аниме, которые вы посмотрите.</p>
          <Link to="/anime" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all hover:scale-105">
            Открыть каталог
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {videos.map((v, i) => (
            <div key={v.id} className="animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
              <VideoCard video={v} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuthRequired({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28 animate-fade-in">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
        <Heart className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
      <p className="mt-1 text-xs text-zinc-400">Войдите через кнопку «Вход» в правом верхнем углу.</p>
    </div>
  );
}

function pluralize(n: number, forms: [string, string, string]) {
  const n100 = n % 100;
  const n10 = n % 10;
  if (n100 >= 11 && n100 <= 14) return forms[2];
  if (n10 === 1) return forms[0];
  if (n10 >= 2 && n10 <= 4) return forms[1];
  return forms[2];
}
