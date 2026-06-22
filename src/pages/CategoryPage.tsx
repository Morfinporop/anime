import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Filter, Grid3x3, List, ArrowLeft } from 'lucide-react';
import VideoCard from '../components/VideoCard';
import { loadCatalog } from '../services/api';
import type { Video } from '../types';

const meta = {
  name: 'Аниме',
  tagline: 'Японская анимация в высоком качестве',
  image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXUgdrfGB0cEVNygm2BZRO2972CZA1Fcc1jBoKIV6Suw&s=10',
  bgColor: '#fff5fa',
};

type Sort = 'popular' | 'newest' | 'rating' | 'title';
type View = 'grid' | 'list';

export default function CategoryPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [sort, setSort] = useState<Sort>('popular');
  const [view, setView] = useState<View>('grid');
  const [genre, setGenre] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadCatalog(sort, genre).then((v) => {
      setVideos(v);
      setLoading(false);
    });
  }, [sort, genre]);

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => v.genres.forEach((g) => set.add(g)));
    return ['all', ...Array.from(set)];
  }, [videos]);

  const totalCount = videos.length;

  return (
    <div className="animate-fade-in">
      <section className="relative overflow-hidden" style={{ backgroundColor: meta.bgColor }}>
        <div className="absolute inset-0">
          <img src={meta.image} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${meta.bgColor} 0%, ${meta.bgColor}cc 50%, ${meta.bgColor}f5 100%)` }} />
        </div>

        <div className="relative mx-auto max-w-[1400px] px-5 pt-6 pb-10 sm:px-8 sm:pb-12">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-900">
            <ArrowLeft className="h-4 w-4" />
            На главную
          </Link>

          <div className="mt-5 max-w-4xl animate-slide-up">
            <h1 className="text-display text-5xl text-zinc-900 sm:text-7xl lg:text-[6rem]">{meta.name}</h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-700 sm:text-base">{meta.tagline}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
              <span className="rounded-full bg-white/80 px-2.5 py-1 font-semibold backdrop-blur-md">{totalCount} {pluralize(totalCount, ['видео', 'видео', 'видео'])}</span>
              <span className="rounded-full bg-white/70 px-2.5 py-1 font-medium backdrop-blur-md">Несколько озвучек</span>
              <span className="rounded-full bg-white/70 px-2.5 py-1 font-medium backdrop-blur-md">HD · 4K</span>
            </div>
          </div>
        </div>
      </section>

      <div className="sticky top-14 z-30 border-b border-[var(--border)] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-5 py-3 sm:px-8">
          <Filter className="h-4 w-4 text-zinc-400" />

          <select value={genre} onChange={(e) => setGenre(e.target.value)} className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 outline-none transition-colors hover:bg-zinc-50">
            {allGenres.map((g) => (
              <option key={g} value={g}>{g === 'all' ? 'Все жанры' : g}</option>
            ))}
          </select>

          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 outline-none transition-colors hover:bg-zinc-50">
            <option value="popular">По популярности</option>
            <option value="newest">Сначала новые</option>
            <option value="rating">По рейтингу</option>
            <option value="title">По алфавиту</option>
          </select>

          <div className="flex-1" />

          <div className="flex gap-1 rounded-full border border-zinc-200 bg-white p-1">
            <button onClick={() => setView('grid')} className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${view === 'grid' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`} aria-label="Сетка">
              <Grid3x3 className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setView('list')} className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${view === 'list' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`} aria-label="Список">
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            <p className="mt-3 text-sm text-zinc-500">Загрузка каталога...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 py-16 text-center sm:py-20">
            <h3 className="text-xl font-bold text-zinc-900">Пока ничего нет</h3>
            <p className="mt-2 text-sm text-zinc-500">Загрузите первое аниме — оно появится здесь для всех.</p>
            <Link to="/upload" className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:scale-105">
              Загрузить аниме
            </Link>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {videos.map((video, i) => (
              <div key={video.id} className="animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                <VideoCard video={video} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {videos.map((video) => (
              <VideoRow key={video.id} video={video} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { Loader2 } from 'lucide-react';

function pluralize(n: number, forms: [string, string, string]) {
  const n100 = n % 100;
  const n10 = n % 10;
  if (n100 >= 11 && n100 <= 14) return forms[2];
  if (n10 === 1) return forms[0];
  if (n10 >= 2 && n10 <= 4) return forms[1];
  return forms[2];
}

function VideoRow({ video }: { video: Video }) {
  return (
    <Link to={`/anime/${video.id}`} className="group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-white p-3 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-lg sm:h-28 sm:w-20">
        <img src={video.poster} alt={video.title} loading="lazy" className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-1 flex-col">
        <h3 className="line-clamp-1 text-sm font-semibold text-zinc-900 group-hover:underline">{video.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="font-semibold text-zinc-900">★ {video.rating > 0 ? video.rating.toFixed(1) : '—'}</span>
          <span>·</span>
          <span>{video.year}</span>
          <span>·</span>
          <span>{video.genres.slice(0, 2).join(', ')}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{video.description}</p>
      </div>
    </Link>
  );
}
