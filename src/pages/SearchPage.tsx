import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import VideoCard from '../components/VideoCard';
import { searchAnime } from '../services/api';
import type { Anime } from '../types';

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [results, setResults] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim()) {
      setLoading(true);
      searchAnime(q).then((v) => {
        setResults(v);
        setLoading(false);
      });
    } else {
      setResults([]);
    }
  }, [q]);

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-12 animate-fade-in">
      <div className="mb-6 animate-slide-up">
        <h1 className="text-display text-3xl text-zinc-900 sm:text-5xl">
          {q ? 'Результаты поиска' : 'Поиск'}
        </h1>
        {q && <p className="mt-1 text-sm text-zinc-500">По запросу <strong className="text-zinc-900">«{q}»</strong> найдено {results.length}</p>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" /></div>
      ) : !q ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 py-16 text-center">
          <SearchIcon className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
          <h2 className="text-xl font-bold text-zinc-900">Введите запрос</h2>
          <p className="mt-1 text-sm text-zinc-500">Нажмите для открытия поиска</p>
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 py-16 text-center">
          <SearchIcon className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
          <h2 className="text-xl font-bold text-zinc-900">Ничего не найдено</h2>
          <p className="mt-1 text-sm text-zinc-500">Попробуйте изменить запрос</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {results.map((v, i) => (
            <div key={v.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 15, 150)}ms` }}>
              <VideoCard video={v} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
