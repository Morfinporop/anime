import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Loader2, Check, X } from 'lucide-react';
import { admin, users } from '../services/api';

interface AdminUser {
  id: number;
  username: string;
  avatarColor: string;
  isAdmin: boolean;
  canUpload: boolean;
  createdAt: string;
}

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string; isAdmin: boolean } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [list, setList] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    users.getCurrent().then((u) => {
      setCurrentUser(u ? { id: u.id, username: u.username, isAdmin: u.isAdmin } : null);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!currentUser?.isAdmin) return;
    loadList();
  }, [currentUser]);

  const loadList = async () => {
    setLoading(true);
    try {
      const users = await admin.listUsers();
      setList(users);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUpload = async (userId: number, current: boolean) => {
    try {
      await admin.setUploadPermission(userId, !current);
      setList(list.map((u) => u.id === userId ? { ...u, canUpload: !current } : u));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleAdmin = async (userId: number, current: boolean) => {
    if (!confirm(current ? 'Забрать права админа?' : 'Выдать права админа?')) return;
    try {
      await admin.setAdmin(userId, !current);
      setList(list.map((u) => u.id === userId ? { ...u, isAdmin: !current } : u));
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!authChecked) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28">
        <Shield className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
        <h1 className="text-2xl font-bold text-zinc-900">Войдите в аккаунт</h1>
        <p className="mt-2 text-sm text-zinc-500">Админ-панель доступна только администраторам.</p>
        <Link to="/" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          На главную
        </Link>
      </div>
    );
  }

  if (!currentUser.isAdmin) {
    return (
      <div className="mx-auto max-w-md px-5 py-20 text-center sm:py-28">
        <Shield className="mx-auto mb-3 h-12 w-12 text-zinc-300" />
        <h1 className="text-2xl font-bold text-zinc-900">Нет доступа</h1>
        <p className="mt-2 text-sm text-zinc-500">У вас нет прав администратора.</p>
        <Link to="/" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8 sm:py-10 animate-fade-in">
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-600 transition-colors hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" />
        На главную
      </Link>

      <div className="mb-6 animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">Админ-панель</h1>
            <p className="mt-1 text-sm text-zinc-500">Управление пользователями и правами</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Пользователь</th>
                <th className="hidden px-4 py-3 sm:table-cell">ID</th>
                <th className="px-4 py-3">Права</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: u.avatarColor }}
                      >
                        {u.username[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-zinc-900">{u.username}</div>
                        <div className="text-[11px] text-zinc-500 sm:hidden">ID: {u.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-zinc-500 sm:table-cell">{u.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {u.isAdmin && (
                        <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-700">
                          Админ
                        </span>
                      )}
                      {u.canUpload && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          Загрузка
                        </span>
                      )}
                      {!u.isAdmin && !u.canUpload && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                          Пользователь
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => toggleUpload(u.id, u.canUpload)}
                        disabled={u.isAdmin}
                        className={`flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium transition-colors ${
                          u.canUpload
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                        } disabled:opacity-40`}
                        title={u.isAdmin ? 'Админы всегда могут загружать' : ''}
                      >
                        {u.canUpload ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span className="hidden sm:inline">Загрузка</span>
                      </button>
                      <button
                        onClick={() => toggleAdmin(u.id, u.isAdmin)}
                        disabled={u.id === currentUser.id}
                        className={`flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium transition-colors ${
                          u.isAdmin
                            ? 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                            : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                        } disabled:opacity-40`}
                        title={u.id === currentUser.id ? 'Нельзя изменить свои права' : ''}
                      >
                        {u.isAdmin ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span className="hidden sm:inline">Админ</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <h3 className="text-sm font-bold text-zinc-900">Подсказка</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Админ-аккаунт <strong>Morfin</strong> создаётся автоматически при первом запуске сервера.
          Пароль задаётся через переменную окружения <code className="rounded bg-white px-1 py-0.5">ADMIN_PASSWORD</code> (по умолчанию: <code className="rounded bg-white px-1 py-0.5">morfin2024</code>).
          Смените пароль после первого входа.
        </p>
      </div>
    </div>
  );
}
