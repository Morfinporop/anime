import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import { recordView, pushHistory, users } from '../services/api';

interface EpisodeData {
  id: number;
  episodeNumber: number;
  title: string;
  videoUrl: string;
  durationSeconds: number;
  views: number;
  seasonId: number;
  seasonNumber: number;
  animeId: number;
  animeTitle: string;
  voiceovers: string[];
  subtitles: string[];
}

export default function EpisodePage() {
  const { id } = useParams();
  const [episode, setEpisode] = useState<EpisodeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const episodeId = parseInt(id);
    if (isNaN(episodeId)) return;
    // Загружаем через прямой запрос к нашему API
    fetch(`/api/episodes/${episodeId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then(async (data) => {
        setEpisode(data.episode);
        setLoading(false);
        const u = await users.getCurrent();
        if (u) await pushHistory(episodeId);
      })
      .catch(() => setLoading(false));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [id]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" /></div>;
  }

  if (!episode) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28">
        <h1 className="text-2xl font-bold text-zinc-900">Серия не найдена</h1>
      </div>
    );
  }

  const handleView = async (watchedSeconds: number) => {
    const newViews = await recordView(episode.id, watchedSeconds);
    if (newViews > 0) setEpisode({ ...episode, views: newViews });
  };

  return (
    <div className="animate-fade-in">
      <div className="mx-auto max-w-[1400px] px-3 sm:px-6 lg:px-8">
        {/* Хлебные крошки */}
        <nav className="flex items-center gap-1.5 py-3 text-xs text-zinc-500 sm:text-sm">
          <a href={`/anime/${episode.animeId}`} className="hover:text-zinc-900">{episode.animeTitle}</a>
          <span>›</span>
          <span>Сезон {episode.seasonNumber}</span>
          <span>›</span>
          <span className="text-zinc-900">Серия {episode.episodeNumber}</span>
        </nav>

        <VideoPlayer
          videoSrc={episode.videoUrl}
          poster={`/api/posters/episode/${episode.id}`}
          voiceovers={episode.voiceovers}
          onView={handleView}
        />

        <div className="mt-5">
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
            {episode.animeTitle} — Серия {episode.episodeNumber}
          </h1>
          {episode.title && <p className="mt-1 text-sm text-zinc-600">{episode.title}</p>}
        </div>
      </div>
    </div>
  );
}
