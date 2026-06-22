import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload as UploadIcon, Film, X, Plus, LogIn, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { uploadVideo, users } from '../services/api';
import type { User } from '../types';

const SUGGESTED_VOICEOVERS = ['Оригинал', 'Дубляж', 'Субтитры'];
const SUBTITLES = ['Русские', 'English', '日本語'];

export default function UploadPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    genres: '',
    year: new Date().getFullYear(),
    ageRating: '12+',
    voiceovers: ['Оригинал'] as string[],
    subtitles: ['Русские'] as string[],
    isSeries: false,
    episodesCount: 1,
  });
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string>('');
  const [newVoiceover, setNewVoiceover] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    users.getCurrent().then((u) => {
      setCurrentUser(u);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    const handler = () => users.getCurrent().then(setCurrentUser);
    window.addEventListener('corpmult_user_change', handler);
    return () => window.removeEventListener('corpmult_user_change', handler);
  }, []);

  const handleFile = (setter: (f: File | null) => void, preview?: boolean) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] || null;
      setter(f);
      if (preview && f) {
        const reader = new FileReader();
        reader.onload = () => setPosterPreview(reader.result as string);
        reader.readAsDataURL(f);
      } else if (!f) setPosterPreview('');
    };

  const toggleVoiceover = (v: string) => {
    setForm((f) => ({
      ...f,
      voiceovers: f.voiceovers.includes(v) ? f.voiceovers.filter((x) => x !== v) : [...f.voiceovers, v],
    }));
  };
  const addCustomVoiceover = () => {
    const v = newVoiceover.trim();
    if (!v) return;
    if (!form.voiceovers.includes(v)) setForm((f) => ({ ...f, voiceovers: [...f.voiceovers, v] }));
    setNewVoiceover('');
  };
  const removeVoiceover = (v: string) => {
    if (v === 'Оригинал') return;
    setForm((f) => ({ ...f, voiceovers: f.voiceovers.filter((x) => x !== v) }));
  };
  const toggleSubtitle = (s: string) => {
    setForm((f) => ({
      ...f,
      subtitles: f.subtitles.includes(s) ? f.subtitles.filter((x) => x !== s) : [...f.subtitles, s],
    }));
  };

  const startUpload = async () => {
    if (uploading) return; // защита от двойного клика
    setError('');
    if (!currentUser) { setError('Войдите в аккаунт'); return; }
    if (!currentUser.canUpload && !currentUser.isAdmin) { setError('У вас нет прав на загрузку. Обратитесь к администратору.'); return; }
    if (!form.title.trim()) { setError('Укажите название'); return; }
    if (form.voiceovers.length === 0) { setError('Выберите озвучку'); return; }
    if (!videoFile) { setError('Выберите видеофайл'); return; }
    if (videoFile.size > 2 * 1024 * 1024 * 1024) { setError('Максимум 2 ГБ'); return; }

    setUploading(true);
    setProgress(0);
    try {
      const id = await uploadVideo(videoFile, {
        title: form.title.trim(),
        description: form.description.trim(),
        year: form.year,
        ageRating: form.ageRating,
        isSeries: form.isSeries,
        episodesCount: form.episodesCount,
        genres: form.genres,
        voiceovers: form.voiceovers.join(','),
        subtitles: form.subtitles.join(','),
        onProgress: setProgress,
      });
      setProgress(100);
      setDone(true);
      setTimeout(() => navigate(`/anime/${id}`), 800);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки');
      setUploading(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28 animate-fade-in">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
          <LogIn className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900">Войдите в аккаунт</h1>
        <p className="mt-2 text-sm text-zinc-500">Чтобы загружать видео, нужно войти. Нажмите «Вход» в правом верхнем углу.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10 animate-fade-in">
      <div className="mb-6 text-center animate-slide-up">
        <h1 className="text-display text-3xl text-zinc-900 sm:text-5xl">Загрузить аниме</h1>
        <p className="mt-1 text-sm text-zinc-500">Видео сохраняется на сервере как есть — без пережатия</p>
      </div>

      {/* Загрузка — по центру, чёрная полоска */}
      {uploading && (
        <div className="mb-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            {!done ? (
              <>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
                  <UploadIcon className="h-6 w-6 animate-pulse text-zinc-700" />
                </div>
                <h3 className="text-base font-semibold text-zinc-900">Видео загружается</h3>
                <p className="mt-1 text-xs text-zinc-500">Не закрывайте вкладку. После загрузки видео появится на сайте для всех.</p>
                <p className="mt-2 text-2xl font-bold text-zinc-900">{progress}%</p>
              </>
            ) : (
              <>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="text-base font-semibold text-zinc-900">Готово!</h3>
                <p className="mt-1 text-xs text-zinc-500">Перенаправляем на страницу видео...</p>
              </>
            )}
          </div>
          {/* Одна полоска — по центру */}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {!uploading && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Название" required>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Наруто" className="input" />
            </Field>

            <Field label="Год">
              <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || 2024 })} className="input" />
            </Field>

            <Field label="Возраст">
              <select value={form.ageRating} onChange={(e) => setForm({ ...form, ageRating: e.target.value })} className="input">
                <option>0+</option><option>6+</option><option>12+</option><option>16+</option><option>18+</option>
              </select>
            </Field>

            <div className="sm:col-span-2">
              <Field label="Жанры (через запятую)">
                <input type="text" value={form.genres} onChange={(e) => setForm({ ...form, genres: e.target.value })} placeholder="Боевик, Драма, Фэнтези" className="input" />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Описание">
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Описание сюжета..." className="input resize-none" />
              </Field>
            </div>

            {/* Озвучки */}
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">Озвучки</label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {form.voiceovers.map((v) => (
                  <span key={v} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${v === 'Оригинал' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'}`}>
                    {v}
                    {v !== 'Оригинал' && (
                      <button type="button" onClick={() => removeVoiceover(v)} className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-zinc-300 text-zinc-700 hover:bg-zinc-400">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {SUGGESTED_VOICEOVERS.filter((v) => !form.voiceovers.includes(v)).map((v) => (
                  <button key={v} type="button" onClick={() => toggleVoiceover(v)} className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50">+ {v}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={newVoiceover} onChange={(e) => setNewVoiceover(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomVoiceover(); } }} placeholder="Своя озвучка (AniLibria, JAM...)" className="input flex-1" />
                <button type="button" onClick={addCustomVoiceover} disabled={!newVoiceover.trim()} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition-all hover:scale-105 disabled:opacity-30">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">Субтитры</label>
              <div className="flex flex-wrap gap-1.5">
                {SUBTITLES.map((s) => (
                  <button key={s} type="button" onClick={() => toggleSubtitle(s)} className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${form.subtitles.includes(s) ? 'bg-zinc-900 text-white' : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3">
                <input type="checkbox" checked={form.isSeries} onChange={(e) => setForm({ ...form, isSeries: e.target.checked })} className="mt-0.5 h-4 w-4 accent-zinc-900" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-zinc-900">Это сериал</div>
                  <div className="text-xs text-zinc-500">Несколько серий</div>
                  {form.isSeries && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-zinc-600">Серий:</span>
                      <input type="number" min="1" max="999" value={form.episodesCount} onChange={(e) => setForm({ ...form, episodesCount: Math.max(1, parseInt(e.target.value) || 1) })} className="w-20 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-sm outline-none focus:border-zinc-900" />
                    </div>
                  )}
                </div>
              </label>
            </div>

            <FileUpload label="Постер (необязательно)" accept="image/*" file={posterFile} preview={posterPreview} onChange={handleFile(setPosterFile, true)} />
            <FileUpload label="Видеофайл" accept="video/*" file={videoFile} onChange={handleFile(setVideoFile)} required />
          </div>

          <div className="mt-5 flex justify-end">
            <button onClick={startUpload} disabled={uploading} className="flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:scale-105 disabled:opacity-50">
              <UploadIcon className="h-4 w-4" />
              Опубликовать
            </button>
          </div>
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

function FileUpload({ label, accept, file, preview, onChange, required }: {
  label: string; accept: string; file: File | null; preview?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; required?: boolean;
}) {
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

// User type imported from types/index.ts
