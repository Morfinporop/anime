import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Star, Heart, Share2, MessageCircle, ThumbsUp, ThumbsDown, ChevronDown, Check, LogIn, Play, Tv } from 'lucide-react';
import {
  getAnimeById, getAnimeRating, getComments, addComment,
  toggleCommentLike, deleteComment, rateAnime, voteAnime, getSeasonEpisodes,
  toggleFavorite, getFavorites, pushHistory, users,
} from '../services/api';
import type { Anime, Episode, Comment, User as UserType } from '../types';

export default function AnimePage() {
  const { id, seasonId: seasonIdParam } = useParams();
  const [anime, setAnime] = useState<Anime | null>(null);
  const [currentSeasonId, setCurrentSeasonId] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [userVote, setUserVote] = useState<-1 | 0 | 1>(0);
  const [fav, setFav] = useState(false);
  const [rating, setRating] = useState<{ average: number; count: number; userScore: number | null }>({ average: 0, count: 0, userScore: null });
  const [copied, setCopied] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!id) return;
    const animeId = parseInt(id);
    if (isNaN(animeId)) return;
    Promise.all([getAnimeById(animeId), users.getCurrent()]).then(async ([a, u]) => {
      setAnime(a);
      setCurrentUser(u);
      if (a) {
        setLikesCount(a.likesCount);
        setDislikesCount(a.dislikesCount);
        const [rt, cmts] = await Promise.all([
          getAnimeRating(a.id),
          getComments(a.id),
        ]);
        setRating(rt);
        setComments(cmts);
        if (u) {
          const ids = await getFavorites();
          setFav(ids.some((f) => f.id === a.id));
        }
        // Выбираем сезон
        let targetSeasonId: number | null = null;
        if (seasonIdParam) {
          targetSeasonId = parseInt(seasonIdParam);
        } else if (a.seasons && a.seasons.length > 0) {
          targetSeasonId = a.seasons[0].id;
        }
        setCurrentSeasonId(targetSeasonId);
      }
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [id, seasonIdParam]);

  // Загружаем серии выбранного сезона
  useEffect(() => {
    if (!currentSeasonId) return;
    setLoadingEpisodes(true);
    getSeasonEpisodes(currentSeasonId).then((eps) => {
      setEpisodes(eps);
      setLoadingEpisodes(false);
    });
  }, [currentSeasonId]);

  if (!anime) {
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" /></div>;
  }

  const handleShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: anime.title, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch {}
  };

  const handleVote = async (vote: 1 | -1) => {
    if (!currentUser) { alert('Войдите, чтобы голосовать'); return; }
    try {
      const newVote: 1 | -1 | 0 = userVote === vote ? 0 : vote;
      const result = await voteAnime(anime.id, newVote);
      setLikesCount(result.likes);
      setDislikesCount(result.dislikes);
      setUserVote(result.userVote as -1 | 0 | 1);
      // Обновляем данные аниме
      setAnime({ ...anime, likesCount: result.likes, dislikesCount: result.dislikes });
    } catch (err: any) { alert(err.message); }
  };

  const handleToggleFav = async () => {
    if (!currentUser) return;
    const newState = await toggleFavorite(anime.id);
    setFav(newState);
  };

  const submitRating = async (score: number) => {
    if (!currentUser) return;
    try {
      const result = await rateAnime(anime.id, score);
      setRating({ ...result, userScore: score });
      setAnime({ ...anime, rating: result.average, ratingsCount: result.count });
    } catch (err: any) { alert(err.message); }
  };

  const submitComment = async () => {
    if (!currentUser || !newComment.trim()) return;
    try {
      const c = await addComment(anime.id, newComment);
      setComments([c, ...comments]);
      setNewComment('');
    } catch (err: any) { alert(err.message); }
  };

  const handleCommentLike = async (commentId: number) => {
    if (!currentUser) return;
    try {
      const result = await toggleCommentLike(commentId);
      setComments(comments.map((c) => c.id === commentId ? { ...c, likes: result.likes, likedByMe: result.liked } : c));
    } catch {}
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!currentUser) return;
    try { await deleteComment(commentId); setComments(comments.filter((c) => c.id !== commentId)); }
    catch (err: any) { alert(err.message); }
  };

  const handleWatchEpisode = async (episode: Episode) => {
    if (currentUser) await pushHistory(episode.id);
    window.location.href = `/episode/${episode.id}`;
  };

  const formatRelativeTime = (iso: string): string => {
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} дн назад`;
    return date.toLocaleDateString('ru-RU');
  };

  const isMyComment = (c: Comment) => currentUser && c.userId === currentUser.id;

  return (
    <div className="animate-fade-in">
      {/* Hero с постером */}
      <section className="relative overflow-hidden border-b border-zinc-200" style={{ backgroundColor: '#fff5fa' }}>
        <div className="absolute inset-0">
          <img src={anime.poster} alt="" className="h-full w-full object-cover opacity-20 blur-xl" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,245,250,0.6) 0%, rgba(255,245,250,0.95) 100%)' }} />
        </div>

        <div className="relative mx-auto max-w-[1400px] px-5 pt-6 pb-8 sm:px-8 sm:pt-8 sm:pb-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
            {/* Постер */}
            <div className="flex-shrink-0">
              <img
                src={anime.poster}
                alt={anime.title}
                className="h-64 w-44 rounded-2xl object-cover shadow-2xl sm:h-80 sm:w-56"
              />
            </div>

            {/* Инфо */}
            <div className="flex-1 animate-slide-up">
              <h1 className="text-display text-3xl text-zinc-900 sm:text-5xl lg:text-6xl">
                {anime.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-2 py-0.5 text-xs font-bold text-white">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {anime.rating > 0 ? anime.rating.toFixed(1) : '—'}
                  <span className="text-zinc-400 font-normal">/10</span>
                </span>
                {anime.totalSeasons > 0 && (
                  <span className="rounded border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    {anime.totalSeasons} сезон{anime.totalSeasons === 1 ? '' : anime.totalSeasons < 5 ? 'а' : 'ов'}
                  </span>
                )}
                {anime.totalEpisodes > 0 && (
                  <span className="rounded border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    {anime.totalEpisodes} сер{anime.totalEpisodes === 1 ? 'ия' : anime.totalEpisodes < 5 ? 'ии' : 'ий'}
                  </span>
                )}
                <span className="rounded border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700">{anime.year}</span>
                <span className="rounded border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700">{anime.ageRating}</span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleVote(1)}
                  disabled={!currentUser}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    userVote === 1 ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  <ThumbsUp className={`h-[18px] w-[18px] ${userVote === 1 ? 'fill-emerald-600' : ''}`} />
                  <span className="tabular-nums">{likesCount}</span>
                </button>
                <button
                  onClick={() => handleVote(-1)}
                  disabled={!currentUser}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    userVote === -1 ? 'border-red-300 bg-red-50 text-red-700' : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  <ThumbsDown className={`h-[18px] w-[18px] ${userVote === -1 ? 'fill-red-600' : ''}`} />
                  <span className="tabular-nums">{dislikesCount}</span>
                </button>
                <button
                  onClick={handleToggleFav}
                  disabled={!currentUser}
                  className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    !currentUser ? 'border-zinc-200 bg-white text-zinc-400' :
                    fav ? 'border-pink-300 bg-pink-50 text-pink-700' : 'border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  <Heart className={`h-4 w-4 ${fav ? 'fill-pink-500' : ''}`} />
                  {fav ? 'В избранном' : 'В избранное'}
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-900 transition-all hover:scale-105 hover:bg-zinc-50"
                >
                  {copied ? <><Check className="h-4 w-4 text-emerald-600" /> Скопировано</> : <><Share2 className="h-4 w-4" /> Поделиться</>}
                </button>
              </div>

              {anime.genres.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {anime.genres.map((g) => (
                    <span key={g} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">{g}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10">
        {/* Описание */}
        {anime.description && (
          <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-zinc-500">Описание</h2>
            <div className={`text-sm leading-relaxed text-zinc-700 ${expanded ? '' : 'line-clamp-3'}`}>
              {anime.description}
            </div>
            {anime.description.length > 150 && (
              <button onClick={() => setExpanded((s) => !s)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-zinc-900 hover:underline">
                {expanded ? 'Свернуть' : 'Читать полностью'}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        )}

        {/* СЕЗОНЫ — переключатель */}
        {anime.seasons && anime.seasons.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-zinc-900">
              <Tv className="h-5 w-5" />
              Сезоны
            </h2>
            <div className="flex flex-wrap gap-2">
              {anime.seasons.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentSeasonId(s.id)}
                  className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all ${
                    currentSeasonId === s.id
                      ? 'border-zinc-900 bg-zinc-900 text-white shadow-lg'
                      : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400'
                  }`}
                >
                  <img src={s.poster} alt="" className="h-12 w-8 rounded object-cover" loading="lazy" />
                  <div className="text-left">
                    <div className="text-base font-bold">Сезон {s.seasonNumber}</div>
                    <div className={`text-xs ${currentSeasonId === s.id ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      {s.episodesCount} {s.episodesCount === 1 ? 'серия' : s.episodesCount < 5 ? 'серии' : 'серий'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* СЕРИИ ВЫБРАННОГО СЕЗОНА */}
        {currentSeasonId && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-zinc-900">
              <Play className="h-5 w-5" />
              Серии
            </h2>
            {loadingEpisodes ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
              </div>
            ) : episodes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 py-8 text-center">
                <p className="text-sm text-zinc-500">В этом сезоне пока нет серий</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10">
                {episodes.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => handleWatchEpisode(ep)}
                    className="group flex aspect-square items-center justify-center rounded-xl border border-zinc-200 bg-white text-base font-bold text-zinc-900 transition-all hover:scale-105 hover:border-zinc-900 hover:bg-zinc-900 hover:text-white"
                  >
                    {ep.episodeNumber}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Рейтинг 10-балльный */}
        <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Оцените аниме</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {rating.count > 0
                  ? `Средняя: ${rating.average.toFixed(1)}/10 (${rating.count} ${pluralize(rating.count, ['голос', 'голоса', 'голосов'])})`
                  : 'Будьте первым!'}
              </p>
            </div>
            {rating.userScore !== null && currentUser && (
              <span className="text-xs text-zinc-500">Ваша оценка: <strong className="text-zinc-900">{rating.userScore}/10</strong></span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => submitRating(n)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold transition-all ${
                  rating.userScore === n ? 'bg-yellow-400 text-yellow-900 scale-105 ring-2 ring-yellow-500' :
                  rating.userScore !== null && n <= rating.userScore ? 'bg-yellow-100 text-yellow-800' :
                  'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        {/* Комментарии */}
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-zinc-900">
            Комментарии <span className="text-sm font-normal text-zinc-500">({comments.length})</span>
          </h2>

          {currentUser ? (
            <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Напишите комментарий..."
                rows={3}
                className="w-full resize-none rounded-xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900/10"
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={submitComment}
                  disabled={!newComment.trim()}
                  className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white transition-all hover:scale-105 disabled:opacity-40"
                >
                  Отправить
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-center">
              <LogIn className="mx-auto mb-2 h-7 w-7 text-zinc-400" />
              <p className="text-sm font-medium text-zinc-700">Войдите в аккаунт, чтобы комментировать</p>
            </div>
          )}

          {comments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 py-10 text-center">
              <MessageCircle className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
              <p className="text-sm text-zinc-500">Пока нет комментариев</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: c.avatarColor }}>
                    {c.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-sm font-semibold text-zinc-900">{c.author}</span>
                        <span className="text-xs text-zinc-500">·</span>
                        <span className="text-xs text-zinc-500">{formatRelativeTime(c.createdAt)}</span>
                      </div>
                      {currentUser && isMyComment(c) && (
                        <button onClick={() => handleDeleteComment(c.id)} className="text-zinc-400 hover:text-red-500">
                          <span className="text-xs">Удалить</span>
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-700">{c.text}</p>
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-zinc-500">
                      <button onClick={() => handleCommentLike(c.id)} disabled={!currentUser} className={`flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors ${c.likedByMe ? 'bg-pink-50 text-pink-600' : 'hover:bg-zinc-100'} disabled:opacity-50`}>
                        <ThumbsUp className={`h-3 w-3 ${c.likedByMe ? 'fill-pink-500' : ''}`} />
                        <span className="font-semibold">{c.likes}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
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
