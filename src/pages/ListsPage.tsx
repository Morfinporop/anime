import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import VideoCard from '../components/VideoCard';
import { loadCatalog } from '../services/api';
import type { Video } from '../types';

interface Props {
  mode: 'popular' | 'latest';
}

export default function ListsPage({ mode }: Props) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadCatalog(mode).then((v) => {
      setVideos(v);
      setLoading(false);
    });
  }, [mode]);

  const isPopular = mode === 'popular';
  const title = isPopular ? 'Популярное' : 'Новинки';
  const subtitle = isPopular ? 'Самые просматриваемые' : 'Свежие премьеры';

  return (
    <div className="animate-fade-in">
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-[1400px] px-5 py-10 sm:px-8 sm:py-14">
          <h1 className="text-display text-4xl text-zinc-900 sm:text-6xl">{title}</h1>
          <p className="mt-1 text-sm text-zinc-500 sm:text-base">{subtitle}</p>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8">
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" /></div>
        ) : videos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 py-16 text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
            <h2 className="text-xl font-bold text-zinc-900">Здесь пока пусто</h2>
            <Link to="/upload" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all hover:scale-105">
              Добавить аниме
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
    </div>
  );
}
