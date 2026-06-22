// CorpMult Backend Server
// Express + PostgreSQL + JWT авторизация + загрузка видео + раздача статического фронтенда

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

import { pool, initDatabase, query } from './db';
import {
  hashPassword, verifyPassword, signToken, verifyToken,
  authMiddleware, requireAuth, requireUploadPermission, requireAdmin,
  getRandomAvatarColor,
} from './auth';

const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// === ИНИЦИАЛИЗАЦИЯ ===
const app = express();

// Директории для загруженных файлов
const UPLOAD_DIR = join(process.cwd(), 'uploads');
const THUMB_DIR = join(UPLOAD_DIR, 'thumbs');
const HLS_DIR = join(UPLOAD_DIR, 'hls');
const DIST_DIR = join(process.cwd(), 'dist');
[UPLOAD_DIR, THUMB_DIR, HLS_DIR].forEach((dir) => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
});

// Multer для загрузки файлов
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

// === MIDDLEWARE ===
app.set('trust proxy', 1);
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(authMiddleware);

// === РАЗДАЧА ВИДЕО (должна быть до SPA fallback) ===
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '7d',
  setHeaders: (res) => {
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=604800');
  },
}));

// === УТИЛИТЫ ===
function genVideoId(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `id${day}${month}${year}${rand}`;
}

// === AUTH API ===
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
    if (username.length < 2 || username.length > 32) return res.status(400).json({ error: 'Ник: 2-32 символа' });
    if (password.length < 4) return res.status(400).json({ error: 'Пароль: минимум 4 символа' });

    const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Ник уже занят' });

    const hash = await hashPassword(password);
    const color = getRandomAvatarColor();
    const result = await query(
      'INSERT INTO users (username, password_hash, avatar_color, is_admin, can_upload) VALUES ($1, $2, $3, FALSE, FALSE) RETURNING id, username, avatar_color, is_admin, can_upload',
      [username, hash, color]
    );
    const user = result.rows[0];
    const token = signToken({
      id: user.id,
      username: user.username,
      avatarColor: user.avatar_color,
      isAdmin: user.is_admin,
      canUpload: user.can_upload,
    });
    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
    res.json({
      user: {
        id: user.id,
        username: user.username,
        avatarColor: user.avatar_color,
        isAdmin: user.is_admin,
        canUpload: user.can_upload,
      },
      token,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });

    const result = await query('SELECT id, username, password_hash, avatar_color, is_admin, can_upload FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Неверный ник или пароль' });

    const user = result.rows[0];
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверный ник или пароль' });

    const token = signToken({
      id: user.id,
      username: user.username,
      avatarColor: user.avatar_color,
      isAdmin: user.is_admin,
      canUpload: user.can_upload,
    });
    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
    res.json({
      user: {
        id: user.id,
        username: user.username,
        avatarColor: user.avatar_color,
        isAdmin: user.is_admin,
        canUpload: user.can_upload,
      },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  try {
    const result = await query(
      'SELECT id, username, avatar_color, is_admin, can_upload FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.json({ user: null });
    }
    const u = result.rows[0];
    res.json({
      user: {
        id: u.id,
        username: u.username,
        avatarColor: u.avatar_color,
        isAdmin: u.is_admin,
        canUpload: u.can_upload,
      },
    });
  } catch {
    res.json({ user: null });
  }
});

// === VIDEOS API ===
app.get('/api/videos', async (req, res) => {
  try {
    const sort = req.query.sort as string || 'popular';
    const genre = req.query.genre as string;

    let orderBy = 'v.views_count DESC, v.created_at DESC';
    if (sort === 'newest') orderBy = 'v.created_at DESC';
    else if (sort === 'rating') orderBy = 'COALESCE(r.avg_rating, 0) DESC, v.views_count DESC';
    else if (sort === 'title') orderBy = 'v.title ASC';

    let sql = `
      SELECT
        v.id, v.title, v.description, v.poster_url, v.video_url,
        v.year, v.age_rating, v.quality, v.is_series, v.episodes_count,
        v.created_at,
        COALESCE(r.avg_rating, 0) AS avg_rating,
        COALESCE(r.ratings_count, 0) AS ratings_count,
        COALESCE(vi.views_count, 0) AS views_count,
        COALESCE(ARRAY_AGG(DISTINCT g.name) FILTER (WHERE g.name IS NOT NULL), ARRAY[]::TEXT[]) AS genres,
        COALESCE(ARRAY_AGG(DISTINCT vo.name) FILTER (WHERE vo.name IS NOT NULL), ARRAY[]::TEXT[]) AS voiceovers,
        COALESCE(ARRAY_AGG(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), ARRAY[]::TEXT[]) AS subtitles
      FROM videos v
      LEFT JOIN (
        SELECT video_id, AVG(score)::NUMERIC(3,1) AS avg_rating, COUNT(*) AS ratings_count
        FROM ratings GROUP BY video_id
      ) r ON r.video_id = v.id
      LEFT JOIN (
        SELECT video_id, COUNT(*) AS views_count FROM views GROUP BY video_id
      ) vi ON vi.video_id = v.id
      LEFT JOIN video_genres vg ON vg.video_id = v.id
      LEFT JOIN genres g ON g.id = vg.genre_id
      LEFT JOIN video_voiceovers vvo ON vvo.video_id = v.id
      LEFT JOIN voiceovers vo ON vo.id = vvo.voiceover_id
      LEFT JOIN video_subtitles vs ON vs.video_id = v.id
      LEFT JOIN subtitles s ON s.id = vs.subtitle_id
    `;
    const params: unknown[] = [];

    if (genre && genre !== 'all') {
      sql += ` WHERE v.id IN (SELECT vg2.video_id FROM video_genres vg2 JOIN genres g2 ON g2.id = vg2.genre_id WHERE g2.name = $1) `;
      params.push(genre);
    }

    sql += ` GROUP BY v.id, r.avg_rating, r.ratings_count, vi.views_count ORDER BY ${orderBy} LIMIT 500`;

    const result = await query(sql, params);
    const videos = result.rows.map(formatVideo);
    res.json({ videos });
  } catch (err) {
    console.error('Get videos error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT
        v.*,
        COALESCE(r.avg_rating, 0) AS avg_rating,
        COALESCE(r.ratings_count, 0) AS ratings_count,
        COALESCE(vi.views_count, 0) AS views_count,
        COALESCE(ARRAY_AGG(DISTINCT g.name) FILTER (WHERE g.name IS NOT NULL), ARRAY[]::TEXT[]) AS genres,
        COALESCE(ARRAY_AGG(DISTINCT vo.name) FILTER (WHERE vo.name IS NOT NULL), ARRAY[]::TEXT[]) AS voiceovers,
        COALESCE(ARRAY_AGG(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), ARRAY[]::TEXT[]) AS subtitles
      FROM videos v
      LEFT JOIN (
        SELECT video_id, AVG(score)::NUMERIC(3,1) AS avg_rating, COUNT(*) AS ratings_count
        FROM ratings GROUP BY video_id
      ) r ON r.video_id = v.id
      LEFT JOIN (
        SELECT video_id, COUNT(*) AS views_count FROM views GROUP BY video_id
      ) vi ON vi.video_id = v.id
      LEFT JOIN video_genres vg ON vg.video_id = v.id
      LEFT JOIN genres g ON g.id = vg.genre_id
      LEFT JOIN video_voiceovers vvo ON vvo.video_id = v.id
      LEFT JOIN voiceovers vo ON vo.id = vvo.voiceover_id
      LEFT JOIN video_subtitles vs ON vs.video_id = v.id
      LEFT JOIN subtitles s ON s.id = vs.subtitle_id
      WHERE v.id = $1
      GROUP BY v.id, r.avg_rating, r.ratings_count, vi.views_count
    `;
    const result = await query(sql, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Видео не найдено' });
    res.json({ video: formatVideo(result.rows[0]) });
  } catch (err) {
    console.error('Get video error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

function formatVideo(row: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    poster: row.poster_url,
    videoSrc: row.video_url,
    year: row.year,
    ageRating: row.age_rating,
    quality: row.quality,
    isSeries: row.is_series,
    episodesCount: row.episodes_count,
    rating: parseFloat(row.avg_rating) || 0,
    ratingsCount: parseInt(row.ratings_count) || 0,
    views: parseInt(row.views_count) || 0,
    genres: row.genres || [],
    voiceovers: row.voiceovers || [],
    subtitles: row.subtitles || [],
    addedAt: row.created_at,
  };
}

// Загрузка видео
app.post('/api/videos', requireUploadPermission, upload.single('video'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Видеофайл не загружен' });

    const {
      title, description = '', year = new Date().getFullYear(),
      ageRating = '12+', quality = '1080p',
      isSeries = 'false', episodesCount = '1',
      genres = '', voiceovers = 'Оригинал', subtitles = '',
    } = req.body;

    if (!title || title.length < 1) return res.status(400).json({ error: 'Укажите название' });

    const id = genVideoId();
    const ext = req.file.mimetype.includes('webm') ? 'webm' : 'mp4';
    const filename = `${id}.${ext}`;
    const filepath = join(UPLOAD_DIR, filename);

    writeFileSync(filepath, req.file.buffer);
    console.log(`[upload] Видео сохранено: ${filename} (${(req.file.size / 1024 / 1024).toFixed(1)} МБ)`);

    const posterUrl = `/uploads/thumbs/${id}.svg`;
    const svgPoster = generatePosterSvg(title);
    writeFileSync(join(THUMB_DIR, `${id}.svg`), svgPoster);

    const videoUrl = `/uploads/${filename}`;
    const userId = req.user.id;

    await query('BEGIN');
    try {
      await query(
        `INSERT INTO videos (id, title, description, poster_url, video_url, year, age_rating, quality, is_series, episodes_count, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [id, title, description, posterUrl, videoUrl, parseInt(year), ageRating, quality,
         isSeries === 'true' || isSeries === true, parseInt(episodesCount) || 1, userId]
      );

      const genreList = genres.split(',').map((g: string) => g.trim()).filter(Boolean);
      for (const g of genreList) {
        const gr = await query('INSERT INTO genres (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id', [g]);
        await query('INSERT INTO video_genres (video_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, gr.rows[0].id]);
      }

      const voiceList = voiceovers.split(',').map((v: string) => v.trim()).filter(Boolean);
      for (const v of voiceList) {
        const vr = await query('INSERT INTO voiceovers (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id', [v]);
        await query('INSERT INTO video_voiceovers (video_id, voiceover_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, vr.rows[0].id]);
      }

      const subList = subtitles.split(',').map((s: string) => s.trim()).filter(Boolean);
      for (const s of subList) {
        const sr = await query('INSERT INTO subtitles (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id', [s]);
        await query('INSERT INTO video_subtitles (video_id, subtitle_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, sr.rows[0].id]);
      }

      await query('COMMIT');
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }

    res.json({ ok: true, id, videoUrl, posterUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Ошибка загрузки' });
  }
});

function generatePosterSvg(title: string): string {
  const initials = title.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  const escaped = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffd9ea"/>
        <stop offset="100%" stop-color="#ffb0d0"/>
      </linearGradient>
    </defs>
    <rect width="400" height="600" fill="url(#g)"/>
    <text x="200" y="320" text-anchor="middle" font-family="Georgia, serif" font-size="120" font-weight="700" fill="#e84a8a" opacity="0.5">${initials}</text>
    <text x="200" y="560" text-anchor="middle" font-family="system-ui" font-size="14" font-weight="700" fill="#e84a8a" opacity="0.7" letter-spacing="4">CORPMULT</text>
  </svg>`;
}

// === РЕЙТИНГИ ===
app.post('/api/videos/:id/rate', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { score } = req.body;
    const s = Math.max(1, Math.min(10, parseInt(score)));
    if (!s || s < 1) return res.status(400).json({ error: 'Неверная оценка' });

    await query(
      `INSERT INTO ratings (user_id, video_id, score) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, video_id) DO UPDATE SET score = $3, updated_at = NOW()`,
      [req.user.id, id, s]
    );

    const result = await query(
      'SELECT AVG(score)::NUMERIC(3,1) AS avg, COUNT(*) AS count FROM ratings WHERE video_id = $1',
      [id]
    );
    res.json({ average: parseFloat(result.rows[0].avg) || 0, count: parseInt(result.rows[0].count) || 0, userScore: s });
  } catch (err) {
    console.error('Rate error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/videos/:id/rating', async (req: any, res) => {
  try {
    const { id } = req.params;
    const avgResult = await query('SELECT AVG(score)::NUMERIC(3,1) AS avg, COUNT(*) AS count FROM ratings WHERE video_id = $1', [id]);
    let userScore = null;
    if (req.user) {
      const userResult = await query('SELECT score FROM ratings WHERE user_id = $1 AND video_id = $2', [req.user.id, id]);
      if (userResult.rows.length > 0) userScore = userResult.rows[0].score;
    }
    res.json({
      average: parseFloat(avgResult.rows[0].avg) || 0,
      count: parseInt(avgResult.rows[0].count) || 0,
      userScore,
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// === КОММЕНТАРИИ ===
app.get('/api/videos/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT c.id, c.text, c.created_at, c.user_id,
              u.username, u.avatar_color,
              COALESCE(l.likes_count, 0) AS likes_count,
              EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = $2) AS liked_by_me
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN (
         SELECT comment_id, COUNT(*) AS likes_count FROM comment_likes GROUP BY comment_id
       ) l ON l.comment_id = c.id
       WHERE c.video_id = $1
       ORDER BY c.created_at DESC`,
      [id, req.user?.id || 0]
    );
    const comments = result.rows.map((row) => ({
      id: row.id,
      videoId: id,
      author: row.username,
      avatar: row.username[0].toUpperCase(),
      avatarColor: row.avatar_color,
      text: row.text,
      createdAt: row.created_at,
      likes: parseInt(row.likes_count) || 0,
      likedByMe: row.liked_by_me,
      userId: row.user_id,
    }));
    res.json({ comments });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/videos/:id/comments', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Пустой комментарий' });
    if (text.length > 2000) return res.status(400).json({ error: 'Слишком длинный текст' });

    const result = await query(
      'INSERT INTO comments (video_id, user_id, text) VALUES ($1, $2, $3) RETURNING id, created_at',
      [id, req.user.id, text.trim()]
    );
    res.json({
      comment: {
        id: result.rows[0].id,
        videoId: id,
        author: req.user.username,
        avatar: req.user.username[0].toUpperCase(),
        avatarColor: req.user.avatarColor,
        text: text.trim(),
        createdAt: result.rows[0].created_at,
        likes: 0,
        likedByMe: false,
        userId: req.user.id,
      },
    });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/comments/:id/like', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const commentId = parseInt(id);
    const existing = await query('SELECT 1 FROM comment_likes WHERE user_id = $1 AND comment_id = $2', [req.user.id, commentId]);
    let liked: boolean;
    if (existing.rows.length > 0) {
      await query('DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2', [req.user.id, commentId]);
      liked = false;
    } else {
      await query('INSERT INTO comment_likes (user_id, comment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, commentId]);
      liked = true;
    }
    const result = await query('SELECT COUNT(*) AS count FROM comment_likes WHERE comment_id = $1', [commentId]);
    res.json({ likes: parseInt(result.rows[0].count) || 0, liked });
  } catch (err) {
    console.error('Like comment error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.delete('/api/comments/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const commentId = parseInt(id);
    const check = await query('SELECT user_id FROM comments WHERE id = $1', [commentId]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Не найден' });
    if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });

    await query('DELETE FROM comments WHERE id = $1', [commentId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// === ПРОСМОТРЫ ===
app.post('/api/videos/:id/view', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { watchedSeconds } = req.body;
    if (!watchedSeconds || watchedSeconds < 30) {
      return res.json({ counted: false, reason: 'need_30_seconds' });
    }
    const result = await query(
      `INSERT INTO views (user_id, video_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING video_id`,
      [req.user.id, id]
    );
    const counted = result.rows.length > 0;
    const totalResult = await query('SELECT COUNT(*) AS count FROM views WHERE video_id = $1', [id]);
    res.json({ counted, views: parseInt(totalResult.rows[0].count) || 0 });
  } catch (err) {
    console.error('View error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// === ИЗБРАННОЕ ===
app.get('/api/favorites', requireAuth, async (req: any, res) => {
  try {
    const result = await query(
      `SELECT v.id FROM favorites f JOIN videos v ON v.id = f.video_id WHERE f.user_id = $1 ORDER BY f.added_at DESC`,
      [req.user.id]
    );
    res.json({ ids: result.rows.map((r) => r.id) });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/favorites/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT 1 FROM favorites WHERE user_id = $1 AND video_id = $2', [req.user.id, id]);
    if (existing.rows.length > 0) {
      await query('DELETE FROM favorites WHERE user_id = $1 AND video_id = $2', [req.user.id, id]);
      res.json({ favorite: false });
    } else {
      await query('INSERT INTO favorites (user_id, video_id) VALUES ($1, $2)', [req.user.id, id]);
      res.json({ favorite: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// === ИСТОРИЯ ===
app.get('/api/history', requireAuth, async (req: any, res) => {
  try {
    const result = await query(
      `SELECT video_id, watched_at FROM history WHERE user_id = $1 ORDER BY watched_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ history: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/history/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    await query('INSERT INTO history (user_id, video_id) VALUES ($1, $2)', [req.user.id, id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// === АДМИНКА ===
app.get('/api/admin/users', requireAdmin, async (req: any, res) => {
  try {
    const result = await query(
      'SELECT id, username, avatar_color, is_admin, can_upload, created_at FROM users ORDER BY id ASC'
    );
    res.json({
      users: result.rows.map((u) => ({
        id: u.id,
        username: u.username,
        avatarColor: u.avatar_color,
        isAdmin: u.is_admin,
        canUpload: u.can_upload,
        createdAt: u.created_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/admin/users/:id/upload-permission', requireAdmin, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { canUpload } = req.body;
    await query('UPDATE users SET can_upload = $1 WHERE id = $2', [!!canUpload, userId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/admin/users/:id/admin', requireAdmin, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { isAdmin } = req.body;
    await query('UPDATE users SET is_admin = $1 WHERE id = $2', [!!isAdmin, userId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удалить видео (только админ или автор)
app.delete('/api/videos/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const check = await query('SELECT id, created_by, video_url FROM videos WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Не найдено' });
    const video = check.rows[0];
    if (video.created_by !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    // Удаляем файл
    try {
      const fs = await import('fs');
      const filepath = join(process.cwd(), video.video_url.replace(/^\//, ''));
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      const thumbPath = join(THUMB_DIR, `${id}.svg`);
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    } catch {}
    // Удаляем записи
    await query('DELETE FROM videos WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete video error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Админ может удалить любой комментарий
app.delete('/api/admin/comments/:id', requireAdmin, async (req: any, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const check = await query('SELECT id FROM comments WHERE id = $1', [commentId]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Не найден' });
    await query('DELETE FROM comments WHERE id = $1', [commentId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin delete comment error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сменить пароль (свой)
app.post('/api/auth/change-password', requireAuth, async (req: any, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Заполните все поля' });
    if (newPassword.length < 4) return res.status(400).json({ error: 'Новый пароль: минимум 4 символа' });

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });

    const valid = await verifyPassword(oldPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверный текущий пароль' });

    const hash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// === СКРИПТ ДЛЯ СОЗДАНИЯ ПЕРВОГО АДМИНА ===
// Вызывается через: curl -X POST http://localhost:3000/api/setup-admin -H "Content-Type: application/json" -d '{"username":"Morfin","password":"..."}'
// Защита: работает только если в базе НЕТ ни одного админа
app.post('/api/setup-admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Укажите username и password' });
    if (username.length < 2 || username.length > 32) return res.status(400).json({ error: 'Ник: 2-32 символа' });
    if (password.length < 4) return res.status(400).json({ error: 'Пароль: минимум 4 символа' });

    // Проверяем что в базе нет ни одного админа
    const existingAdmins = await query('SELECT id FROM users WHERE is_admin = TRUE LIMIT 1');
    if (existingAdmins.rows.length > 0) {
      return res.status(403).json({ error: 'Админ уже существует. Используйте админ-панель для выдачи прав.' });
    }

    const hash = await hashPassword(password);
    const colors = ['#ff85b8', '#7aa3ff', '#7affb3', '#ffd17a', '#c87aff', '#ff7a7a', '#7ae5ff', '#b3ff7a', '#ffae7a', '#7affe5'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const result = await query(
      `INSERT INTO users (username, password_hash, avatar_color, is_admin, can_upload)
       VALUES ($1, $2, $3, TRUE, TRUE)
       ON CONFLICT (username) DO UPDATE SET password_hash = $2, is_admin = TRUE, can_upload = TRUE
       RETURNING id, username, avatar_color, is_admin, can_upload`,
      [username, hash, color]
    );
    const user = result.rows[0];
    const token = signToken({
      id: user.id,
      username: user.username,
      avatarColor: user.avatar_color,
      isAdmin: user.is_admin,
      canUpload: user.can_upload,
    });
    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
    res.json({
      ok: true,
      message: 'Создан первый администратор',
      user: {
        id: user.id,
        username: user.username,
        avatarColor: user.avatar_color,
        isAdmin: user.is_admin,
        canUpload: user.can_upload,
      },
      token,
    });
  } catch (err) {
    console.error('Setup admin error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// === РАЗДАЧА ФРОНТЕНДА (SPA) ===
// ВАЖНО: должно быть после всех API маршрутов
if (existsSync(DIST_DIR)) {
  console.log(`[serve] Раздача фронтенда из ${DIST_DIR}`);
  app.use(express.static(DIST_DIR, {
    maxAge: '1h',
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  // SPA fallback — все неизвестные маршруты ведут на index.html
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return res.status(404).json({ error: 'Не найдено' });
    }
    const indexPath = join(DIST_DIR, 'index.html');
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(503).send(`
        <html><body style="font-family:sans-serif;padding:40px;text-align:center;">
          <h1>Фронтенд не собран</h1>
          <p>На сервере нет папки <code>dist/</code>. Запустите <code>npm run build</code> перед <code>npm run server</code>.</p>
        </body></html>
      `);
    }
  });
} else {
  console.warn(`[!] Папка ${DIST_DIR} не найдена. Фронтенд не будет раздаваться.`);
  app.get('/', (req, res) => {
    res.status(503).send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h1>CorpMult API работает</h1>
        <p>API сервер запущен, но фронтенд не собран. Запустите <code>npm run build</code>.</p>
        <p>API endpoints доступны по <code>/api/*</code></p>
      </body></html>
    `);
  });
}

// === ЗАПУСК ===
async function start() {
  await initDatabase();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] CorpMult API запущен на порту ${PORT}`);
    console.log(`[server] Режим: ${NODE_ENV}`);
    console.log(`[server] Создайте первого админа:`);
    console.log(`[server]   curl -X POST $API/api/setup-admin \\`);
    console.log(`[server]     -H "Content-Type: application/json" \\`);
    console.log(`[server]     -d '{"username":"Morfin","password":"ваш_пароль"}'`);
  });
}

start().catch((err) => {
  console.error('[fatal] Ошибка запуска:', err);
  process.exit(1);
});
