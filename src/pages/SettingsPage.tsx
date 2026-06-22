import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, Check, X } from 'lucide-react';
import { changePassword, users } from '../services/api';
import type { User } from '../types';

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    users.getCurrent().then(setCurrentUser);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (newPassword.length < 4) { setError('Новый пароль: минимум 4 символа'); return; }
    if (newPassword !== confirmPassword) { setError('Пароли не совпадают'); return; }

    setLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      setSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Обновляем кэш пользователя
      const u = await users.getCurrent();
      if (u) {
        localStorage.setItem('corpmult_user_cache', JSON.stringify(u));
        setCurrentUser(u);
      }
      window.dispatchEvent(new Event('corpmult_user_change'));
    } catch (err: any) {
      setError(err.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28 animate-fade-in">
        <Lock className="mx-auto mb-4 h-12 w-12 text-zinc-300" />
        <h1 className="text-2xl font-bold text-zinc-900">Войдите в аккаунт</h1>
        <Link to="/" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-8 sm:px-8 sm:py-12 animate-fade-in">
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-600 transition-colors hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" />
        На главную
      </Link>

      <div className="mb-6 animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">Настройки</h1>
            <p className="mt-1 text-sm text-zinc-500">{currentUser.username} (ID: {currentUser.id})</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-900">Сменить пароль</h2>
        <p className="mt-1 text-xs text-zinc-500">Пароль сохраняется в базе данных</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <X className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <Check className="h-4 w-4 flex-shrink-0" />
              Пароль успешно изменён
            </div>
          )}

          <Field label="Текущий пароль">
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Введите текущий пароль"
              className="input"
              autoComplete="current-password"
            />
          </Field>

          <Field label="Новый пароль">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Минимум 4 символа"
              className="input"
              autoComplete="new-password"
              minLength={4}
            />
          </Field>

          <Field label="Повторите новый пароль">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              className="input"
              autoComplete="new-password"
              minLength={4}
            />
          </Field>

          <button
            type="submit"
            disabled={loading || !oldPassword || !newPassword || !confirmPassword}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {loading ? 'Сохранение...' : 'Сменить пароль'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
