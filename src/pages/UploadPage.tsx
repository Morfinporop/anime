import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, Film, X, Plus, LogIn, CheckCircle2, ChevronRight } from 'lucide-react';
import {
  createAnime, createSeason, uploadEpisode, loadCatalog, users,
} from '../services/api';
import type { User, Anime } from '../types';

const SUGGESTED_VOICEOVERS = ['Оригинал', 'Дубляж', 'Субтитры'];
const SUBTITLES = ['Русские', 'English', '日本語'];

type Step = 'anime' | 'season' | 'episode' | 'episodeDirect' | 'done';

export default function UploadPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [step, setStep] = useState<Step>('anime');

  // Аниме
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);
  const [newAnime, setNewAnime] = useState({
    title: '',
    description: '',
    year: new Date().getFullYear(),
    ageRating: '12+',
    genres: '',
  });
  const [animePoster, setAnimePoster] = useState<File | null>(null);
  const [animePosterPreview, setAnimePosterPreview] = useState('');
  const [showNewAnime, setShowNewAnime] = useState(false);
  const [creatingAnime, setCreatingAnime] = useState(false);

  // Сезон
  const [seasonNumber, setSeasonNumber] = useState(1);
  const [seasonDescription, setSeasonDescription] = useState('');
  const [seasonPoster, setSeasonPoster] = useState<File | null>(null);
  const [seasonPosterPreview, setSeasonPosterPreview] = useState('');
  const [currentSeasonId, setCurrentSeasonId] = useState<number | null>(null);
  const [creatingSeason, setCreatingSeason] = useState(false);

  // Эпизод
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [episodeVideo, setEpisodeVideo] = useState<File | null>(null);
  const [episodePoster, setEpisodePoster] = useState<File | null>(null);
  const [episodePosterPreview, setEpisodePosterPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [voiceovers, setVoiceovers] = useState<string[]>(['Оригинал']);
  const [subtitles, setSubtitles] = useState<string[]>(['Русские']);
  const [newVoiceover, setNewVoiceover] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    users.getCurrent().then((u) => {
      setCurrentUser(u);
      setAuthChecked(true);
      if (u) {
        loadCatalog('newest').then(setAnimeList);
      }
    });
  }, []);

  if (!authChecked) {
    return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" /></div>;
  }

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28 animate-fade-in">
        <LogIn className="mx-auto mb-4 h-12 w-12 text-zinc-300" />
        <h1 className="text-2xl font-bold text-zinc-900">Войдите в аккаунт</h1>
        <p className="mt-2 text-sm text-zinc-500">Чтобы загружать аниме, нужно войти.</p>
      </div>
    );
  }

  if (!currentUser.canUpload && !currentUser.isAdmin) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28 animate-fade-in">
        <h1 className="text-2xl font-bold text-zinc-900">Нет прав на загрузку</h1>
        <p className="mt-2 text-sm text-zinc-500">Обратитесь к администратору.</p>
      </div>
    );
  }

  const handleCreateAnime = async () => {
    setError('');
    if (!newAnime.title.trim()) { setError('Укажите название аниме'); return; }
    setCreatingAnime(true);
    try {
      const id = await createAnime({
        title: newAnime.title.trim(),
        description: newAnime.description.trim(),
        year: newAnime.year,
        ageRating: newAnime.ageRating,
        genres: newAnime.genres,
        poster: animePoster,
      });
      setSelectedAnimeId(id);
      const updated = await loadCatalog('newest');
      setAnimeList(updated);
      setStep('season');
    } catch (err: any) { setError(err.message); }
    finally { setCreatingAnime(false); }
  };

  const handleSelectAnime = (id: number) => {
    setSelectedAnimeId(id);
    setStep('season');
  };

  const handleCreateSeason = async () => {
    if (!selectedAnimeId) return;
    setError('');
    setCreatingSeason(true);
    try {
      const id = await createSeason({
        animeId: selectedAnimeId,
        seasonNumber,
        description: seasonDescription,
        poster: seasonPoster,
      });
      setCurrentSeasonId(id);
      setStep('episode');
    } catch (err: any) { setError(err.message); }
    finally { setCreatingSeason(false); }
  };

  const handleUploadEpisode = async () => {
    if (!currentSeasonId) return;
    setError('');
    if (!episodeVideo) { setError('Выберите видеофайл'); return; }
    setUploading(true);
    setProgress(0);
    try {
      const id = await uploadEpisode({
        seasonId: currentSeasonId,
        episodeNumber,
        title: episodeTitle,
        video: episodeVideo,
        poster: episodePoster,
        onProgress: setProgress,
      });
      setProgress(100);
      setStep('done');
      setTimeout(() => navigate(`/episode/${id}`), 1200);
    } catch (err: any) {
      setError(err.message);
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10 animate-fade-in">
      <div className="mb-6 text-center animate-slide-up">
        <h1 className="text-display text-3xl text-zinc-900 sm:text-5xl">Загрузить аниме</h1>
        <p className="mt-1 text-sm text-zinc-500">Шаг {step === 'anime' ? '1' : step === 'season' ? '2' : step === 'episode' ? '3' : '4'} из 3</p>
      </div>

      {/* Прогресс шагов */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {(['anime', 'season', 'episode'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
              step === s ? 'bg-zinc-900 text-white' :
              (['anime', 'season', 'episode', 'episodeDirect'].indexOf(step) > i) ? 'bg-emerald-500 text-white' :
              'bg-zinc-200 text-zinc-500'
            }`}>
              {(['anime', 'season', 'episode', 'episodeDirect'].indexOf(step) > i) ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className="text-xs font-medium text-zinc-600">
              {s === 'anime' ? 'Аниме' : s === 'season' ? 'Сезон' : 'Серия'}
            </span>
            {i < 2 && <ChevronRight className="h-3 w-3 text-zinc-400" />}
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-zinc-400">или</div>
          <button
            onClick={() => setStep('episodeDirect')}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
              step === 'episodeDirect' ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-500'
            }`}
          >
            🚀
          </button>
          <span className="text-xs font-medium text-zinc-600">Быстрая загрузка</span>
        </div>
      </div>

      {uploading && (
        <div className="mb-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <UploadIcon className="h-8 w-8 animate-pulse text-zinc-700" />
            <h3 className="mt-2 text-base font-semibold text-zinc-900">Серия загружается</h3>
            <p className="mt-2 text-2xl font-bold text-zinc-900">{progress}%</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      {step === 'anime' && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          {error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"><X className="h-4 w-4" />{error}</div>}

          <h2 className="mb-4 text-lg font-bold text-zinc-900">Шаг 1. Выберите или создайте аниме</h2>

          {animeList.length > 0 && !showNewAnime && (
            <>
              <p className="mb-2 text-xs text-zinc-500">Выберите существующее аниме (например, если заливаете 2-й сезон):</p>
              <div className="mb-4 max-h-60 space-y-2 overflow-y-auto rounded-xl border border-zinc-200 p-2">
                {animeList.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleSelectAnime(a.id)}
                    className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-zinc-50"
                  >
                    <img src={a.poster} alt="" className="h-12 w-8 rounded object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-zinc-900">{a.title}</div>
                      <div className="text-xs text-zinc-500">{a.year} · {a.totalSeasons} сезон{a.totalSeasons === 1 ? '' : a.totalSeasons < 5 ? 'а' : 'ов'}</div>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowNewAnime(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-50">
                <Plus className="h-4 w-4" /> Создать новое аниме
              </button>
            </>
          )}

          {(showNewAnime || animeList.length === 0) && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">{animeList.length > 0 && <button onClick={() => setShowNewAnime(false)} className="text-pink-500 hover:underline">← Назад к выбору</button>}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Название аниме" required>
                  <input type="text" value={newAnime.title} onChange={(e) => setNewAnime({ ...newAnime, title: e.target.value })} placeholder="Наруто" className="input" />
                </Field>
                <Field label="Год">
                  <input type="number" value={newAnime.year} onChange={(e) => setNewAnime({ ...newAnime, year: parseInt(e.target.value) || 2024 })} className="input" />
                </Field>
                <Field label="Возраст">
                  <select value={newAnime.ageRating} onChange={(e) => setNewAnime({ ...newAnime, ageRating: e.target.value })} className="input">
                    <option>0+</option><option>6+</option><option>12+</option><option>16+</option><option>18+</option>
                  </select>
                </Field>
                <Field label="Жанры (через запятую)">
                  <input type="text" value={newAnime.genres} onChange={(e) => setNewAnime({ ...newAnime, genres: e.target.value })} placeholder="Боевик, Драма, Фэнтези" className="input" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Описание">
                    <textarea value={newAnime.description} onChange={(e) => setNewAnime({ ...newAnime, description: e.target.value })} rows={2} placeholder="Описание сюжета..." className="input resize-none" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <FileUpload label="Обложка аниме" preview={animePosterPreview} onChange={(e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setAnimePoster(f);
                    const reader = new FileReader(); reader.onload = () => setAnimePosterPreview(reader.result as string); reader.readAsDataURL(f);
                  }} />
                </div>
              </div>
              <button onClick={handleCreateAnime} disabled={creatingAnime || !newAnime.title.trim()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] disabled:opacity-50">
                {creatingAnime ? 'Создание...' : <><Plus className="h-4 w-4" /> Создать аниме</>}
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'season' && selectedAnimeId && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          {error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"><X className="h-4 w-4" />{error}</div>}

          <h2 className="mb-4 text-lg font-bold text-zinc-900">Шаг 2. Создайте сезон</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Номер сезона" required>
              <input type="number" min="1" max="999" value={seasonNumber} onChange={(e) => setSeasonNumber(Math.max(1, parseInt(e.target.value) || 1))} className="input" />
            </Field>
            <Field label="Количество серий">
              <input type="text" value="Указывается при загрузке серий" disabled className="input opacity-50" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Описание сезона">
                <textarea value={seasonDescription} onChange={(e) => setSeasonDescription(e.target.value)} rows={2} placeholder="О чём этот сезон..." className="input resize-none" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <FileUpload label="Обложка сезона (необязательно)" preview={seasonPosterPreview} onChange={(e) => {
                const f = e.target.files?.[0]; if (!f) return;
                setSeasonPoster(f);
                const reader = new FileReader(); reader.onload = () => setSeasonPosterPreview(reader.result as string); reader.readAsDataURL(f);
              }} />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={() => setStep('anime')} className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Назад
            </button>
            <button onClick={handleCreateSeason} disabled={creatingSeason} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-zinc-900 py-2 text-sm font-semibold text-white transition-all hover:scale-[1.01] disabled:opacity-50">
              {creatingSeason ? 'Создание...' : <>Создать сезон и перейти к серии <ChevronRight className="h-4 w-4" /></>}
            </button>
          </div>
        </div>
      )}

      {step === 'episode' && currentSeasonId && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          {error && <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"><X className="h-4 w-4" />{error}</div>}

          <h2 className="mb-4 text-lg font-bold text-zinc-900">Шаг 3. Загрузите серию</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Номер серии" required>
              <input type="number" min="1" max="999" value={episodeNumber} onChange={(e) => setEpisodeNumber(Math.max(1, parseInt(e.target.value) || 1))} className="input" />
            </Field>
            <Field label="Название (необязательно)">
              <input type="text" value={episodeTitle} onChange={(e) => setEpisodeTitle(e.target.value)} placeholder="Начало пути" className="input" />
            </Field>

            {/* Озвучки */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">Озвучки</label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {voiceovers.map((v) => (
                  <span key={v} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${v === 'Оригинал' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'}`}>
                    {v}
                    {v !== 'Оригинал' && (
                      <button onClick={() => setVoiceovers(voiceovers.filter((x) => x !== v))} className="rounded-full bg-zinc-300 text-zinc-700 hover:bg-zinc-400">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {SUGGESTED_VOICEOVERS.filter((v) => !voiceovers.includes(v)).map((v) => (
                  <button key={v} onClick={() => setVoiceovers([...voiceovers, v])} className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                    + {v}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newVoiceover} onChange={(e) => setNewVoiceover(e.target.value)} onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); const v = newVoiceover.trim(); if (v && !voiceovers.includes(v)) { setVoiceovers([...voiceovers, v]); setNewVoiceover(''); } }
                }} placeholder="AniLibria, JAM..." className="input flex-1" />
                <button onClick={() => {
                  const v = newVoiceover.trim(); if (v && !voiceovers.includes(v)) { setVoiceovers([...voiceovers, v]); setNewVoiceover(''); }
                }} className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white hover:scale-105 disabled:opacity-30" disabled={!newVoiceover.trim()}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Субтитры */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">Субтитры</label>
              <div className="flex flex-wrap gap-1.5">
                {SUBTITLES.map((s) => (
                  <button key={s} onClick={() => setSubtitles(subtitles.includes(s) ? subtitles.filter((x) => x !== s) : [...subtitles, s])} className={`rounded-full px-3 py-1 text-xs font-medium ${subtitles.includes(s) ? 'bg-zinc-900 text-white' : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <FileUpload label="Видеофайл" accept="video/*" file={episodeVideo} onChange={(e) => setEpisodeVideo(e.target.files?.[0] || null)} required />
            <FileUpload label="Обложка серии (необязательно)" accept="image/*" file={episodePoster} preview={episodePosterPreview} onChange={(e) => {
              const f = e.target.files?.[0]; if (!f) return;
              setEpisodePoster(f);
              const reader = new FileReader(); reader.onload = () => setEpisodePosterPreview(reader.result as string); reader.readAsDataURL(f);
            }} />
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={() => setStep('season')} className="rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Назад
            </button>
            <button onClick={handleUploadEpisode} disabled={uploading || !episodeVideo} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-zinc-900 py-2 text-sm font-semibold text-white transition-all hover:scale-[1.01] disabled:opacity-50">
              {uploading ? `Загрузка... ${progress}%` : <><UploadIcon className="h-4 w-4" /> Загрузить серию</>}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900">Готово!</h2>
          <p className="mt-2 text-sm text-zinc-500">Серия добавлена в каталог</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        {label} {required && <span className="text-zinc-900">*</span>}
      </span>
      {children}
    </label>
  );
}

function FileUpload({ label, accept, file, preview, onChange, required }: { label: string; accept?: string; file?: File | null; preview?: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean }) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        {label} {required && <span className="text-zinc-900">*</span>}
      </span>
      <label className="group relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors hover:border-zinc-900 hover:bg-white">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : file ? (
          <div className="flex flex-col items-center gap-1 px-4 text-center">
            <Film className="h-6 w-6 text-zinc-900" />
            <div className="line-clamp-1 text-xs font-semibold text-zinc-900">{file.name}</div>
            <div className="text-[10px] text-zinc-500">{(file.size / 1024 / 1024).toFixed(1)} МБ</div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 group-hover:text-zinc-900">
            <UploadIcon className="h-6 w-6" />
            <span className="text-xs font-medium">Выберите файл</span>
          </div>
        )}
        <input type="file" accept={accept} onChange={onChange} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </div>
  );
}
