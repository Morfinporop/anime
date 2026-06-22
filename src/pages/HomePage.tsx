import { useEffect, useState, useRef, useCallback } from 'react';
import type React from 'react';
import { loadCatalog, LOGO_URL } from '../services/api';
import VideoCard from '../components/VideoCard';
import type { Video } from '../types';

const PAGE_SIZE = 24;

export default function HomePage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Загружаем все видео один раз
  useEffect(() => {
    setLoading(true);
    loadCatalog('newest').then((all) => {
      // Дедупликация по id
      const seen = new Set<string>();
      const unique: Video[] = [];
      for (const v of all) {
        if (!seen.has(v.id)) { seen.add(v.id); unique.push(v); }
      }
      setVideos(unique);
      setLoading(false);
    });
  }, []);

  // Сортируем кэшированный список для разных секций
  const latest = [...videos].sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  const popular = [...videos].sort((a, b) => b.views - a.views);
  const topRated = [...videos].sort((a, b) => b.rating - a.rating);

  // Infinite scroll
  const loadMore = useCallback(() => {
    if (loadingMore || displayCount >= videos.length) return;
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayCount((c) => Math.min(c + PAGE_SIZE, videos.length));
      setLoadingMore(false);
    }, 200);
  }, [loadingMore, displayCount, videos.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="rounded-3xl border border-dashed border-zinc-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-pink-100 text-pink-500">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Каталог пуст</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Здесь пока нет аниме. Когда администратор загрузит видео — оно появится здесь для всех.
          </p>
        </div>
      </div>
    );
  }

  // Сколько показывать в каждой секции
  const sectionSize = 12;
  const displayLatest = latest.slice(0, sectionSize);
  const displayPopular = popular.slice(0, sectionSize);
  const displayTopRated = topRated.slice(0, sectionSize);

  // Для infinite scroll — общий список
  const allForScroll = latest.slice(0, displayCount);

  return (
    <div className="animate-fade-in">
      <section className="mx-auto max-w-[1400px] px-5 pt-4 pb-4 sm:px-8 sm:pt-6 sm:pb-6">
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} alt="CorpMult" className="h-9 w-9 rounded-lg object-cover shadow-sm" />
          <div>
            <h1 className="text-lg font-black tracking-tight text-pink-500 sm:text-xl">
              аниме
            </h1>
            <p className="text-[11px] text-zinc-500 sm:text-xs">{videos.length} {pluralize(videos.length, ['видео', 'видео', 'видео'])} в каталоге</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 pb-10 sm:px-8 sm:pb-14">
        <div className="space-y-8">
          {displayLatest.length > 0 && (
            <Section title="Новые поступления" subtitle="Свежее в каталоге">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {displayLatest.map((v, i) => (
                  <div key={v.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}>
                    <VideoCard video={v} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {displayPopular.length > 0 && popular[0]?.id !== latest[0]?.id && (
            <Section title="Популярное" subtitle="Больше всего просмотров">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {displayPopular.map((v, i) => (
                  <div key={v.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}>
                    <VideoCard video={v} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {displayTopRated.length > 0 && topRated[0]?.id !== popular[0]?.id && (
            <Section title="Лучшее по рейтингу" subtitle="Высокие оценки">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {displayTopRated.map((v, i) => (
                  <div key={v.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}>
                    <VideoCard video={v} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Если видео больше чем показали — добавляем общий список */}
          {videos.length > sectionSize && (
            <Section title="Все аниме" subtitle={`Показано ${Math.min(displayCount, videos.length)} из ${videos.length}`}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {allForScroll.map((v, i) => (
                  <div key={v.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 15, 150)}ms` }}>
                    <VideoCard video={v} />
                  </div>
                ))}
              </div>

              {/* Sentinel для infinite scroll */}
              <div ref={sentinelRef} className="h-20" />

              {loadingMore && (
                <div className="flex justify-center py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
                </div>
              )}

              {!loadingMore && displayCount >= videos.length && (
                <div className="py-6 text-center text-xs text-zinc-400">— Конец каталога —</div>
              )}
            </Section>
          )}
        </div>
      </section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-zinc-900 sm:text-2xl">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500 sm:text-sm">{subtitle}</p>}
      </div>
      {children}
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
