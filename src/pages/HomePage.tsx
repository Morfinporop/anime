import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { loadCatalog } from '../services/api';
import VideoCard from '../components/VideoCard';
import type { Anime } from '../types';

const PAGE_SIZE = 24;

type Sort = 'popular' | 'newest' | 'rating' | 'title';

export default function HomePage() {
  const [items, setItems] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<Sort>('popular');
  const [genre, setGenre] = useState<string>('all');
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    loadCatalog(sort, genre).then((all) => {
      setItems(all);
      setDisplayCount(PAGE_SIZE);
      setLoading(false);
    });
  }, [sort, genre]);

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    items.forEach((v) => v.genres.forEach((g: string) => set.add(g)));
    return ['all', ...Array.from(set)];
  }, [items]);

  const loadMore = useCallback(() => {
    if (displayCount >= items.length) return;
    setTimeout(() => setDisplayCount((c) => Math.min(c + PAGE_SIZE, items.length)), 150);
  }, [displayCount, items.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '300px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="animate-fade-in">
      <section className="relative overflow-hidden border-b border-zinc-200">
        <div className="absolute inset-0">
          <img
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXUgdrfGB0cEVNygm2BZRO2972CZA1Fcc1jBoKIV6Suw&s=10"
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,245,250,0.4) 0%, rgba(255,245,250,0.6) 50%, rgba(255,245,250,0.95) 100%)' }} />
        </div>

        <div className="relative mx-auto max-w-[1400px] px-5 pt-6 pb-6 sm:px-8 sm:pt-10 sm:pb-8">
          <div className="max-w-3xl animate-slide-up">
            <h1 className="text-display text-4xl text-zinc-900 sm:text-5xl lg:text-6xl">
              Аниме.<br />
              Мультфильмы.<br />
              <span className="text-zinc-400">Одно место.</span>
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-zinc-600 sm:text-base">
              Сотни тайтлов в высоком качестве с разными озвучками и продвинутым плеером.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 pb-12 sm:px-8 sm:pb-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
            <p className="mt-3 text-sm text-zinc-500">Загрузка каталога...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 bg-white p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-pink-100 text-pink-500">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-zinc-900">Каталог пуст</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
              Здесь пока нет аниме. Когда администратор загрузит — оно появится здесь.
            </p>
          </div>
        ) : (
          <>
            <div className="sticky top-14 z-20 mb-5 -mx-5 border-b border-zinc-200 bg-white/90 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
              <div className="flex flex-wrap items-center gap-2">
                <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <select value={genre} onChange={(e) => setGenre(e.target.value)} className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 outline-none hover:bg-zinc-50">
                  {allGenres.map((g) => <option key={g} value={g}>{g === 'all' ? 'Все жанры' : g}</option>)}
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 outline-none hover:bg-zinc-50">
                  <option value="popular">По популярности</option>
                  <option value="newest">Сначала новые</option>
                  <option value="rating">По рейтингу</option>
                  <option value="title">По алфавиту</option>
                </select>
                <div className="flex-1" />
                <span className="text-xs text-zinc-500">{items.length} {pluralize(items.length, ['видео', 'видео', 'видео'])}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {items.slice(0, displayCount).map((v, i) => (
                <div key={v.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 15, 150)}ms` }}>
                  <VideoCard video={v} />
                </div>
              ))}
            </div>

            <div ref={sentinelRef} className="h-16" />

            {displayCount >= items.length && items.length > PAGE_SIZE && (
              <div className="py-6 text-center text-xs text-zinc-400">— Конец каталога —</div>
            )}
          </>
        )}
      </section>
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
