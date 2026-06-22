import { Link } from 'react-router-dom';
import { Star, Heart } from 'lucide-react';
import type { Anime } from '../types';
import { useState, useEffect } from 'react';
import { toggleFavorite, getFavorites, users } from '../services/api';

interface Props {
  video: Anime;
}

export default function VideoCard({ video }: Props) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    users.getCurrent().then(async (u) => {
      if (!u) { setFav(false); return; }
      const ids = await getFavorites();
      setFav(ids.some((f) => f.id === video.id));
    });
  }, [video.id]);

  const handleToggleFav = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const u = await users.getCurrent();
    if (!u) return;
    const newState = await toggleFavorite(video.id);
    setFav(newState);
  };

  return (
    <Link to={`/anime/${video.id}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-100 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
        <img
          src={video.poster}
          alt={video.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          {video.rating > 0 ? video.rating.toFixed(1) : '—'}
        </div>

        <button
          onClick={handleToggleFav}
          className="absolute bottom-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-md transition-all duration-300 hover:bg-black/80 group-hover:opacity-100"
          aria-label="В избранное"
        >
          <Heart className={`h-3.5 w-3.5 ${fav ? 'fill-pink-400 text-pink-400' : ''}`} />
        </button>

        {video.totalSeasons > 0 && (
          <div className="absolute right-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-zinc-900 shadow-sm backdrop-blur-sm">
            {video.totalSeasons} сезон{video.totalSeasons === 1 ? '' : video.totalSeasons < 5 ? 'а' : 'ов'}
          </div>
        )}
      </div>

      <div className="mt-2.5 px-1">
        <h3 className="line-clamp-1 text-sm font-medium text-zinc-900 transition-colors group-hover:text-zinc-600">
          {video.title}
        </h3>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span>{video.year}</span>
          <span>·</span>
          <span className="line-clamp-1">{video.genres[0] || '—'}</span>
        </div>
      </div>
    </Link>
  );
}
