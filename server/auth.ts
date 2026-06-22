// Система аккаунтов — bcrypt + JWT
// Пароли хранятся как bcrypt хеши, токены — JWT с подписью

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'corpmult-dev-secret-change-me-in-production';
const JWT_EXPIRES = '30d';
const AVATAR_COLORS = [
  '#ff85b8', '#7aa3ff', '#7affb3', '#ffd17a', '#c87aff',
  '#ff7a7a', '#7ae5ff', '#b3ff7a', '#ffae7a', '#7affe5',
];

export interface UserPayload {
  id: number;
  username: string;
  avatarColor: string;
  isAdmin: boolean;
  canUpload: boolean;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(user: UserPayload): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch {
    return null;
  }
}

export function getRandomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// Middleware: проверяет JWT из cookie или Authorization header
export function authMiddleware(req: any, res: any, next: any) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    req.user = null;
    return next();
  }
  const user = verifyToken(token);
  req.user = user;
  next();
}

export function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  next();
}

export function requireUploadPermission(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  if (!req.user.canUpload && !req.user.isAdmin) {
    return res.status(403).json({ error: 'У вас нет прав на загрузку видео' });
  }
  next();
}

export function requireAdmin(req: any, res: any, next: any) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Требуются права администратора' });
  }
  next();
}
