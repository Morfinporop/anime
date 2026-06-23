import { Link } from 'react-router-dom';
import { Heart, Upload, Menu, X, Search, LogIn, LogOut, User, Shield } from 'lucide-react';
import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { searchAnime, users, LOGO_URL } from '../services/api';
import type { Anime, User as UserType } from '../types';

function useCurrentUser(): UserType | null {
  const subscribe = (cb: () => void) => {
    window.addEventListener('corpmult_user_change', cb);
    return () => window.removeEventListener('corpmult_user_change', cb);
  };
  const getSnapshot = () => localStorage.getItem('corpmult_user_cache') || 'null';
  const getServerSnapshot = () => 'null';

  useEffect(() => {
    let cancelled = false;
    users.getCurrent().then((u) => {
      if (cancelled) return;
      localStorage.setItem('corpmult_user_cache', u ? JSON.stringify(u) : 'null');
      window.dispatchEvent(new Event('corpmult_user_change'));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      users.getCurrent().then((u) => {
        localStorage.setItem('corpmult_user_cache', u ? JSON.stringify(u) : 'null');
        window.dispatchEvent(new Event('corpmult_user_change'));
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  try {
    return snapshot === 'null' ? null : JSON.parse(snapshot);
  } catch {
    return null;
  }
}

export default function Header() {
  const currentUser = useCurrentUser();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [results, setResults] = useState<Anime[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (searchValue.trim().length > 0) {
      searchAnime(searchValue).then((v) => setResults(v.slice(0, 10)));
    } else {
      setResults([]);
    }
  }, [searchValue]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'Escape') { setSearchOpen(false); setAuthOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = async () => {
    await users.logout();
  };

  const canUpload = currentUser?.canUpload || currentUser?.isAdmin;

  return (
    <>
      <header className="glass-header sticky top-0 z-40 border-b border-[var(--border)]">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
          {/* Логотип и название */}
          <Link to="/" className="flex flex-shrink-0 items-center gap-2 transition-opacity hover:opacity-80">
            <img
              src={LOGO_URL}
              alt="CorpMult"
              className="h-9 w-9 object-contain"
              style={{ mixBlendMode: 'multiply' }}
            />
            <span className="hidden text-lg font-black tracking-tight text-zinc-900 sm:inline">CorpMult</span>
          </Link>

          {/* Поиск — поле ввода (пошире) */}
          <div ref={searchContainerRef} className="relative flex-1 min-w-0">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="flex h-9 w-full items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3.5 text-sm transition-colors hover:bg-zinc-100"
              aria-label="Поиск"
            >
              <Search className="h-4 w-4 flex-shrink-0 text-zinc-500" />
              <span className="flex-1 text-left text-zinc-400">Поиск аниме по названию...</span>
            </button>

            {searchOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-2xl animate-fade-in">
                <div className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2">
                  <Search className="h-4 w-4 text-zinc-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder="Поиск аниме по названию..."
                    className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                  />
                  {searchValue && (
                    <button onClick={() => setSearchValue('')} className="text-xs text-zinc-500 hover:text-zinc-700">
                      Очистить
                    </button>
                  )}
                </div>

                {searchValue.trim() && results.length > 0 && (
                  <div className="mt-3 max-h-80 space-y-1 overflow-y-auto">
                    {results.map((v) => (
                      <Link
                        key={v.id}
                        to={`/anime/${v.id}`}
                        onClick={() => { setSearchOpen(false); setSearchValue(''); }}
                        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-zinc-50"
                      >
                        <img src={v.poster} alt="" className="h-12 w-8 rounded object-cover" loading="lazy" />
                        <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-sm font-medium text-zinc-900">{v.title}</div>
                      <div className="text-xs text-zinc-500">{v.year} · {v.genres[0] || 'Аниме'}</div>
                    </div>
                  </Link>
                ))}
                {results.length === 0 && (
                  <div className="col-span-full px-3 py-6 text-center text-sm text-zinc-500">
                    Ничего не найдено
                  </div>
                )}
                  </div>
                )}

                {searchValue.trim() && results.length === 0 && (
                  <div className="mt-3 px-3 py-4 text-center text-sm text-zinc-500">
                    По запросу «{searchValue}» ничего не найдено
                  </div>
                )}

                {!searchValue.trim() && (
                  <div className="mt-3 px-2 text-xs text-zinc-500">
                    Введите название аниме для поиска
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Иконки действий */}
          <div className="flex flex-shrink-0 items-center gap-1">
            <Link to="/favorites" className="hidden h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 sm:flex" title="Избранное">
              <Heart className="h-[18px] w-[18px]" />
            </Link>

            {/* Загрузить — ТОЛЬКО круг с иконкой (как везде) */}
            {canUpload && (
              <Link to="/upload" className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white transition-all hover:scale-105 hover:bg-zinc-800" title="Загрузить видео">
                <Upload className="h-[18px] w-[18px]" />
              </Link>
            )}

            {currentUser?.isAdmin && (
              <Link to="/admin" className="hidden h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 sm:flex" title="Админ-панель">
                <Shield className="h-[18px] w-[18px]" />
              </Link>
            )}

            {currentUser ? (
              <div className="relative group ml-1">
                <button className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shadow-md ring-2 ring-white" style={{ backgroundColor: currentUser.avatarColor }}>
                  {currentUser.username[0].toUpperCase()}
                </button>
                <div className="invisible absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-xl border border-zinc-200 bg-white p-2 opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100">
                  <div className="border-b border-zinc-100 px-3 py-2">
                    <div className="text-sm font-semibold text-zinc-900">{currentUser.username}</div>
                    <div className="text-[11px] text-zinc-500">ID: {currentUser.id}</div>
                    {currentUser.isAdmin && <div className="mt-1 text-[10px] font-bold text-pink-500">АДМИН</div>}
                  </div>
                  <Link to="/settings" onClick={() => {}} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50">
                    <User className="h-4 w-4" />
                    Настройки
                  </Link>
                  <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50">
                    <LogOut className="h-4 w-4" />
                    Выйти
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAuthOpen(true)} className="flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Вход</span>
              </button>
            )}

            <button onClick={() => setMobileOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 md:hidden">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      {/* Мобильное меню */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-72 max-w-[85%] bg-white p-5 shadow-2xl animate-slide-up">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-base font-black text-zinc-900">Меню</span>
              <button onClick={() => setMobileOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-zinc-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              <Link to="/favorites" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
                <Heart className="h-5 w-5" /> Избранное
              </Link>
              {canUpload && (
                <Link to="/upload" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white">
                  <Upload className="h-5 w-5" /> Загрузить видео
                </Link>
              )}
              {currentUser?.isAdmin && (
                <Link to="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl bg-zinc-100 px-4 py-3 text-base font-semibold text-zinc-900">
                  <Shield className="h-5 w-5" /> Админ-панель
                </Link>
              )}
              {currentUser ? (
                <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-zinc-700 hover:bg-zinc-50">
                  <LogOut className="h-5 w-5" /> Выйти ({currentUser.username})
                </button>
              ) : (
                <button onClick={() => { setAuthOpen(true); setMobileOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-zinc-700 hover:bg-zinc-50">
                  <LogIn className="h-5 w-5" /> Войти
                </button>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const name = username.trim();
    if (name.length < 2 || name.length > 32) { setError('Ник: 2-32 символа'); return; }
    if (password.length < 4) { setError('Пароль: минимум 4 символа'); return; }

    setLoading(true);
    try {
      if (mode === 'register') {
        await users.register(name, password);
      } else {
        await users.login(name, password);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md animate-fade" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl animate-scale-in">
        <button onClick={onClose} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex flex-col items-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-rose-500 text-white shadow-lg">
            <User className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900">{mode === 'register' ? 'Регистрация' : 'Вход'}</h2>
          <p className="mt-1 text-center text-xs text-zinc-500">
            {mode === 'register' ? 'Создайте аккаунт для оценок и комментариев' : 'Войдите в свой аккаунт'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">Ник</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="АнимеФан" className="input" autoFocus maxLength={32} />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 4 символа" className="input" maxLength={64} />
          </div>

          <button type="submit" disabled={loading} className="w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-50">
            {loading ? 'Подождите...' : (mode === 'register' ? 'Создать аккаунт' : 'Войти')}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-zinc-500">
          {mode === 'register' ? (
            <>Уже есть аккаунт? <button type="button" onClick={() => setMode('login')} className="font-semibold text-zinc-900 hover:underline">Войти</button></>
          ) : (
            <>Нет аккаунта? <button type="button" onClick={() => setMode('register')} className="font-semibold text-zinc-900 hover:underline">Создать</button></>
          )}
        </div>
      </div>
    </div>
  );
}
