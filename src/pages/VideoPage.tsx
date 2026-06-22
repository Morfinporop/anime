import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Star, Eye, Calendar, Heart, Share2, MessageCircle, ThumbsUp,
  ChevronDown, ChevronRight, Globe, Check, Send, Trash2, LogIn,
} from 'lucide-react';
import VideoPlayer from '../components/VideoPlayer';
import VideoCard from '../components/VideoCard';
import {
  getVideoById, getComments, addComment,
  toggleCommentLike, deleteComment, rateVideo, getVideoRating,
  recordView, getRelatedVideos, toggleFavorite, getFavorites, pushHistory,
  users,
} from '../services/api';
import type { Video, Comment, User as UserType } from '../types';

export default function VideoPage() {
  const { id } = useParams();
  const [video, setVideo] = useState<Video | null>(null);
  const [fav, setFav] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [related, setRelated] = useState<Video[]>([]);
  const [showAllDesc, setShowAllDesc] = useState(false);
  const [rating, setRating] = useState<{ average: number; count: number; userScore: number | null }>({ average: 0, count: 0, userScore: null });
  const [copied, setCopied] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getVideoById(id),
      users.getCurrent(),
    ]).then(async ([v, u]) => {
      setVideo(v);
      setCurrentUser(u);
      if (v) {
        const [cmts, rt, rel] = await Promise.all([
          getComments(v.id),
          getVideoRating(v.id),
          getRelatedVideos(v, 10),
        ]);
        setComments(cmts);
        setRating(rt);
        setRelated(rel);
        if (u) {
          setFav((await getFavorites()).includes(v.id));
          pushHistory(v.id);
        }
      }
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [id]);

  useEffect(() => {
    const handler = () => {
      users.getCurrent().then((u) => {
        setCurrentUser(u);
        if (video) {
          getFavorites().then((ids) => setFav(ids.includes(video.id))).catch(() => {});
          getVideoRating(video.id).then(setRating).catch(() => {});
          getComments(video.id).then(setComments).catch(() => {});
        }
      });
    };
    window.addEventListener('corpmult_user_change', handler);
    return () => window.removeEventListener('corpmult_user_change', handler);
  }, [video]);

  if (!video) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
        <MessageCircle className="mb-4 h-10 w-10 text-zinc-300" />
        <h1 className="text-3xl font-bold text-zinc-900">Загрузка...</h1>
      </div>
    );
  }

  const handleView = async (watchedSeconds: number) => {
    if (!currentUser) return;
    const newViews = await recordView(video.id, watchedSeconds);
    if (newViews > 0) setVideo({ ...video, views: newViews });
  };

  const handleShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: video.title, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  const handleToggleFav = async () => {
    if (!currentUser) return;
    const newState = await toggleFavorite(video.id);
    setFav(newState);
  };

  const submitRating = async (score: number) => {
    if (!currentUser) return;
    try {
      const result = await rateVideo(video.id, score);
      setRating({ ...result, userScore: score });
      setVideo({ ...video, rating: result.average, ratingsCount: result.count });
    } catch {}
  };

  const submitComment = async () => {
    if (!currentUser || !newComment.trim()) return;
    try {
      const c = await addComment(video.id, newComment);
      setComments([c, ...comments]);
      setNewComment('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCommentLike = async (commentId: number) => {
    if (!currentUser) return;
    try {
      const result = await toggleCommentLike(commentId);
      setComments(comments.map((c) =>
        c.id === commentId ? { ...c, likes: result.likes, likedByMe: result.liked } : c
      ));
    } catch {}
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!currentUser) return;
    try {
      await deleteComment(commentId);
      setComments(comments.filter((c) => c.id !== commentId));
    } catch (err: any) {
      alert(err.message);
    }
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
      <div className="mx-auto max-w-[1400px] px-3 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-1.5 py-3 text-xs text-zinc-500 sm:text-sm">
          <Link to="/" className="hover:text-zinc-900">Главная</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/anime" className="hover:text-zinc-900">Аниме</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="line-clamp-1 text-zinc-900">{video.title}</span>
        </nav>

        <VideoPlayer
          videoSrc={video.videoSrc}
          poster={video.poster}
          voiceovers={video.voiceovers}
          onView={handleView}
        />

        <div className="mt-5 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{video.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-2 py-0.5 text-xs font-bold text-white">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {video.rating > 0 ? video.rating.toFixed(1) : '—'}
              </span>
              <span className="flex items-center gap-1.5 text-zinc-600">
                <Eye className="h-4 w-4" /> {video.views.toLocaleString('ru')}
              </span>
              <span className="flex items-center gap-1.5 text-zinc-600">
                <Calendar className="h-4 w-4" /> {video.year}
              </span>
              <span className="rounded border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">{video.ageRating}</span>
              {video.isSeries && video.episodesCount > 1 && (
                <span className="rounded border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">{video.episodesCount} серий</span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleToggleFav}
                disabled={!currentUser}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  !currentUser ? 'border border-zinc-200 bg-white text-zinc-400 cursor-not-allowed' :
                  fav ? 'bg-pink-500 text-white' : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50'
                }`}
              >
                <Heart className={`h-4 w-4 ${fav ? 'fill-white' : ''}`} />
                {fav ? 'В избранном' : 'В избранное'}
              </button>
              <button onClick={handleShare} className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-all hover:scale-105 hover:bg-zinc-50">
                {copied ? <><Check className="h-4 w-4 text-emerald-600" /> Скопировано</> : <><Share2 className="h-4 w-4" /> Поделиться</>}
              </button>
            </div>

            {video.description && (
              <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5">
                <div className={`text-sm leading-relaxed text-zinc-700 ${showAllDesc ? '' : 'line-clamp-3'}`}>
                  {video.description}
                </div>
                {video.description.length > 150 && (
                  <button onClick={() => setShowAllDesc((s) => !s)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-zinc-900 hover:underline">
                    {showAllDesc ? 'Свернуть' : 'Читать полностью'}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllDesc ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            )}

            {(video.voiceovers.length > 0 || video.subtitles.length > 0) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {video.voiceovers.length > 0 && (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Озвучки</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {video.voiceovers.map((v) => (
                        <span key={v} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">{v}</span>
                      ))}
                    </div>
                  </div>
                )}
                {video.subtitles.length > 0 && (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      <Globe className="h-3 w-3" /> Субтитры
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {video.subtitles.map((s) => (
                        <span key={s} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {video.genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {video.genres.map((g) => (
                  <span key={g} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">{g}</span>
                ))}
              </div>
            )}

            {/* Оценка + Комментарии */}
            <div className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-zinc-900">
                Комментарии <span className="text-sm font-normal text-zinc-500">({comments.length})</span>
              </h2>

              {currentUser ? (
                <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4">
                  {rating.userScore !== null && (
                    <div className="mb-2 text-xs text-zinc-500">Ваша оценка: <strong className="text-zinc-900">{rating.userScore}/10</strong></div>
                  )}
                  <div className="mb-3 flex flex-wrap items-center gap-1">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        onClick={() => submitRating(n)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                          rating.userScore === n ? 'bg-yellow-400 text-yellow-900 scale-105' :
                          'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Напишите комментарий..."
                    rows={2}
                    className="w-full resize-none rounded-xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:bg-white focus:ring-2 focus:ring-zinc-900/10"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={submitComment}
                      disabled={!newComment.trim()}
                      className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white transition-all hover:scale-105 disabled:opacity-40"
                    >
                      <Send className="h-3 w-3" /> Отправить
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-center">
                  <LogIn className="mx-auto mb-2 h-7 w-7 text-zinc-400" />
                  <p className="text-sm font-medium text-zinc-700">Войдите в аккаунт, чтобы оценивать и комментировать</p>
                  <p className="mt-1 text-xs text-zinc-500">Нажмите кнопку «Вход» в правом верхнем углу</p>
                </div>
              )}

              {comments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 py-10 text-center">
                  <MessageCircle className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
                  <p className="text-sm text-zinc-500">Пока нет комментариев. Будьте первым!</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-3">
                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: c.avatarColor }}
                      >
                        {c.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate text-sm font-semibold text-zinc-900">{c.author}</span>
                            <span className="text-xs text-zinc-500">·</span>
                            <span className="text-xs text-zinc-500">{formatRelativeTime(c.createdAt)}</span>
                          </div>
                          {isMyComment(c) && (
                            <button
                              onClick={() => handleDeleteComment(c.id)}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-500"
                              title="Удалить"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-zinc-700">{c.text}</p>
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-zinc-500">
                          <button
                            onClick={() => handleCommentLike(c.id)}
                            disabled={!currentUser}
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors ${
                              c.likedByMe ? 'bg-pink-50 text-pink-600' : 'hover:bg-zinc-100'
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            <ThumbsUp className={`h-3 w-3 ${c.likedByMe ? 'fill-pink-500' : ''}`} />
                            <span className="font-semibold">{c.likes}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Похожее по жанру</h3>
            {related.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-5 text-center text-xs text-zinc-500">
                Пока нет похожих
              </div>
            ) : (
              related.map((v) => <VideoCard key={v.id} video={v} />)
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
