// CorpMult Backend Server
// Архитектура: anime → seasons → episodes
// Express + PostgreSQL + JWT + загрузка видео + раздача статики

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { existsSync, mkdirSync, writeFileSync, statSync, unlinkSync, renameSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';

import { pool, initDatabase, query } from './db';
import {
  hashPassword, verifyPassword, signToken, verifyToken,
  authMiddleware, requireAuth, requireUploadPermission, requireAdmin,
  getRandomAvatarColor,
} from './auth';

const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const THUMB_DIR = join(UPLOAD_DIR, 'thumbs');
[UPLOAD_DIR, THUMB_DIR].forEach((dir) => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 * 1024 },
});

app.set('trust proxy', 1);
app.use(cors({ origin: (origin, cb) => cb(null, true), credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(authMiddleware);

app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '7d',
  setHeaders: (res) => {
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=604800');
  },
}));

// === ПОСТЕР ИЗ БАЗЫ ДАННЫХ ===
app.get('/api/posters/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    let table: string;
    if (type === 'anime') table = 'anime';
    else if (type === 'season') table = 'seasons';
    else if (type === 'episode') table = 'episodes';
    else return res.status(404).end();

    const result = await query(`SELECT poster_data, poster_mime FROM ${table} WHERE id = $1 AND poster_data IS NOT NULL`, [id]);
    if (result.rows.length === 0 || !result.rows[0].poster_data) {
      const svg = generatePosterSvg('CorpMult');
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(svg);
    }
    const { poster_data, poster_mime } = result.rows[0];
    res.setHeader('Content-Type', poster_mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.send(poster_data);
  } catch (err) {
    console.error('Get poster error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

function generatePosterSvg(title: string): string {
  const initials = title.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffd9ea"/><stop offset="100%" stop-color="#ffb0d0"/></linearGradient></defs>
    <rect width="400" height="600" fill="url(#g)"/>
    <text x="200" y="320" text-anchor="middle" font-family="Georgia, serif" font-size="120" font-weight="700" fill="#e84a8a" opacity="0.5">${initials}</text>
    <text x="200" y="560" text-anchor="middle" font-family="system-ui" font-size="14" font-weight="700" fill="#e84a8a" opacity="0.7" letter-spacing="4">CORPMULT</text>
  </svg>`;
}

// === AUTH ===
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
    const token = signToken({ id: user.id, username: user.username, avatarColor: user.avatar_color, isAdmin: user.is_admin, canUpload: user.can_upload });
    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
    res.json({ user: { id: user.id, username: user.username, avatarColor: user.avatar_color, isAdmin: user.is_admin, canUpload: user.can_upload }, token });
  } catch (err) { console.error('Register error:', err); res.status(500).json({ error: 'Ошибка сервера' }); }
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
    const token = signToken({ id: user.id, username: user.username, avatarColor: user.avatar_color, isAdmin: user.is_admin, canUpload: user.can_upload });
    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
    res.json({ user: { id: user.id, username: user.username, avatarColor: user.avatar_color, isAdmin: user.is_admin, canUpload: user.can_upload }, token });
  } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/auth/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

app.get('/api/auth/me', async (req, res) => {
  if (!req.user) return res.json({ user: null });
  try {
    const result = await query('SELECT id, username, avatar_color, is_admin, can_upload FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.json({ user: null });
    const u = result.rows[0];
    res.json({ user: { id: u.id, username: u.username, avatarColor: u.avatar_color, isAdmin: u.is_admin, canUpload: u.can_upload } });
  } catch { res.json({ user: null }); }
});

// === ANIME (каталог) ===
app.get('/api/anime', async (req, res) => {
  try {
    const sort = req.query.sort as string || 'popular';
    const genre = req.query.genre as string;
    let orderBy = 'a.likes_count DESC, a.created_at DESC';
    if (sort === 'newest') orderBy = 'a.created_at DESC';
    else if (sort === 'rating') orderBy = 'COALESCE(r.avg_rating, 0) DESC, a.likes_count DESC';
    else if (sort === 'title') orderBy = 'a.title ASC';

    let sql = `
      SELECT
        a.id, a.title, a.description, a.year, a.age_rating, a.likes_count, a.dislikes_count,
        a.created_at, a.updated_at, a.genres,
        COALESCE(r.avg_rating, 0) AS avg_rating,
        COALESCE(r.ratings_count, 0) AS ratings_count,
        COALESCE(v.total_views, 0) AS views,
        COALESCE(s.total_episodes, 0) AS total_episodes,
        COALESCE(se.total_seasons, 0) AS total_seasons
      FROM anime a
      LEFT JOIN (
        SELECT anime_id, AVG(score)::NUMERIC(3,1) AS avg_rating, COUNT(*) AS ratings_count
        FROM ratings GROUP BY anime_id
      ) r ON r.anime_id = a.id
      LEFT JOIN (
        SELECT s.anime_id, COUNT(e.id) AS total_episodes
        FROM seasons s LEFT JOIN episodes e ON e.season_id = s.id GROUP BY s.anime_id
      ) s ON s.anime_id = a.id
      LEFT JOIN (
        SELECT anime_id, COUNT(*) AS total_seasons FROM seasons GROUP BY anime_id
      ) se ON se.anime_id = a.id
      LEFT JOIN (
        SELECT e.season_id, COUNT(v.id) AS total_views
        FROM episodes e LEFT JOIN views v ON v.episode_id = e.id GROUP BY e.season_id
      ) ev ON ev.season_id IN (SELECT id FROM seasons WHERE anime_id = a.id)
      LEFT JOIN (
        SELECT season_id, SUM(total_views) AS total_views FROM (
          SELECT e.season_id, COUNT(v.id) AS total_views
          FROM episodes e LEFT JOIN views v ON v.episode_id = e.id GROUP BY e.season_id, e.id
        ) s GROUP BY season_id
      ) v ON v.season_id IN (SELECT id FROM seasons WHERE anime_id = a.id)
    `;
    const params: unknown[] = [];
    if (genre && genre !== 'all') {
      sql += ` WHERE $1 = ANY(a.genres) `;
      params.push(genre);
    }
    sql += ` GROUP BY a.id, r.avg_rating, r.ratings_count, v.total_views, s.total_episodes, se.total_seasons ORDER BY ${orderBy} LIMIT 500`;
    const result = await query(sql, params);
    const items = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      poster: `/api/posters/anime/${row.id}`,
      year: row.year,
      ageRating: row.age_rating,
      likesCount: parseInt(row.likes_count) || 0,
      dislikesCount: parseInt(row.dislikes_count) || 0,
      rating: parseFloat(row.avg_rating) || 0,
      ratingsCount: parseInt(row.ratings_count) || 0,
      views: parseInt(row.views) || 0,
      totalEpisodes: parseInt(row.total_episodes) || 0,
      totalSeasons: parseInt(row.total_seasons) || 0,
      genres: row.genres || [],
      addedAt: row.created_at,
    }));
    res.json({ items });
  } catch (err) { console.error('Get anime error:', err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/anime/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT a.*,
        COALESCE(r.avg_rating, 0) AS avg_rating,
        COALESCE(r.ratings_count, 0) AS ratings_count
      FROM anime a
      LEFT JOIN (
        SELECT anime_id, AVG(score)::NUMERIC(3,1) AS avg_rating, COUNT(*) AS ratings_count
        FROM ratings GROUP BY anime_id
      ) r ON r.anime_id = a.id
      WHERE a.id = $1
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Не найдено' });
    const row = result.rows[0];

    // Получаем сезоны
    const seasonsResult = await query(`
      SELECT s.*, COALESCE(e.episodes_count, 0) AS episodes_count
      FROM seasons s
      LEFT JOIN (SELECT season_id, COUNT(*) AS episodes_count FROM episodes GROUP BY season_id) e
        ON e.season_id = s.id
      WHERE s.anime_id = $1
      ORDER BY s.season_number ASC
    `, [id]);
    const seasons = seasonsResult.rows.map((s) => ({
      id: s.id,
      animeId: s.anime_id,
      seasonNumber: s.season_number,
      poster: `/api/posters/season/${s.id}`,
      description: s.description,
      episodesCount: parseInt(s.episodes_count) || 0,
      createdAt: s.created_at,
    }));

    res.json({
      anime: {
        id: row.id,
        title: row.title,
        description: row.description,
        poster: `/api/posters/anime/${row.id}`,
        year: row.year,
        ageRating: row.age_rating,
        genres: row.genres || [],
        likesCount: parseInt(row.likes_count) || 0,
        dislikesCount: parseInt(row.dislikes_count) || 0,
        rating: parseFloat(row.avg_rating) || 0,
        ratingsCount: parseInt(row.ratings_count) || 0,
        addedAt: row.created_at,
        seasons,
      },
    });
  } catch (err) { console.error('Get anime error:', err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// === ЗАГРУЗКА АНИМЕ / СЕЗОНА / СЕРИИ ===
// Шаг 1: создать аниме (если ещё нет)
app.post('/api/anime', requireUploadPermission, upload.fields([
  { name: 'poster', maxCount: 1 },
]), async (req: any, res) => {
  try {
    const { title, description = '', year, ageRating = '12+', genres = '' } = req.body;
    if (!title || title.length < 1) return res.status(400).json({ error: 'Укажите название' });

    const posterFile = req.files?.poster?.[0];
    const posterBuffer = posterFile ? posterFile.buffer : Buffer.from(generatePosterSvg(title), 'utf-8');
    const posterMime = posterFile ? posterFile.mimetype : 'image/svg+xml';
    const genreList = genres.split(',').map((g: string) => g.trim()).filter(Boolean);

    const result = await query(
      `INSERT INTO anime (title, description, year, age_rating, genres, poster_data, poster_mime, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [title, description, parseInt(year) || new Date().getFullYear(), ageRating, genreList, posterBuffer, posterMime, req.user.id]
    );
    res.json({ ok: true, animeId: result.rows[0].id });
  } catch (err) { console.error('Create anime error:', err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// Шаг 2: создать сезон
app.post('/api/anime/:animeId/seasons', requireUploadPermission, upload.fields([
  { name: 'poster', maxCount: 1 },
]), async (req: any, res) => {
  try {
    const { animeId } = req.params;
    const { seasonNumber = '1', description = '' } = req.body;
    const posterFile = req.files?.poster?.[0];
    const posterBuffer = posterFile ? posterFile.buffer : null;
    const posterMime = posterFile ? posterFile.mimetype : null;

    const result = await query(
      `INSERT INTO seasons (anime_id, season_number, description, poster_data, poster_mime)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [animeId, parseInt(seasonNumber), description, posterBuffer, posterMime]
    );
    res.json({ ok: true, seasonId: result.rows[0].id });
  } catch (err: any) {
    if (err.message?.includes('duplicate key')) return res.status(409).json({ error: 'Такой сезон уже существует' });
    console.error('Create season error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Шаг 3: загрузить серию (видео + обложка серии)
app.post('/api/seasons/:seasonId/episodes', requireUploadPermission, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'poster', maxCount: 1 },
]), async (req: any, res) => {
  try {
    const { seasonId } = req.params;
    const { episodeNumber = '1', title = '' } = req.body;
    const videoFile = req.files?.video?.[0];
    const posterFile = req.files?.poster?.[0];
    if (!videoFile) return res.status(400).json({ error: 'Видеофайл не загружен' });

    const ext = videoFile.mimetype.includes('webm') ? 'webm' : 'mp4';
    const filename = `${seasonId}_${Date.now()}_${episodeNumber}.${ext}`;
    const filepath = join(UPLOAD_DIR, filename);
    writeFileSync(filepath, videoFile.buffer);

    const sizeMB = videoFile.size / 1024 / 1024;
    console.log(`[upload] Серия ${episodeNumber}: ${sizeMB.toFixed(1)} МБ`);

    // Сжатие
    if (sizeMB > 50) {
      try {
        const crf = sizeMB > 500 ? '35' : sizeMB > 200 ? '32' : '28';
        const videoBitrate = sizeMB > 500 ? '800k' : sizeMB > 200 ? '1200k' : '1800k';
        const maxHeight = sizeMB > 500 ? '480' : '720';
        await new Promise<void>((resolve) => {
          const cmd = `ffmpeg -i "${filepath}" -c:v libx264 -preset fast -crf ${crf} -vf "scale='min(1280,iw)':-2,scale='if(gt(ih,${maxHeight}),${maxHeight},ih)':-2" -b:v ${videoBitrate} -c:a aac -b:a 96k -movflags +faststart -pix_fmt yuv420p -threads 0 -y "${filepath}.tmp.mp4"`;
          exec(cmd, { timeout: 600000 }, (err) => {
            if (err) { console.error(`[compress] ${err.message}`); resolve(); return; }
            try {
              unlinkSync(filepath);
              renameSync(`${filepath}.tmp.mp4`, filepath);
              const newSize = statSync(filepath).size / 1024 / 1024;
              console.log(`[compress] ${sizeMB.toFixed(1)} МБ → ${newSize.toFixed(1)} МБ (${((1 - newSize / sizeMB) * 100).toFixed(0)}%)`);
            } catch (e) { console.error(`[compress] ${e}`); }
            resolve();
          });
        });
      } catch (e) { console.error(`[compress] ${e}`); }
    }

    // Получаем длительность видео через ffprobe
    let durationSeconds = 0;
    try {
      await new Promise<void>((resolve) => {
        exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filepath}"`, (err, stdout) => {
          if (!err) durationSeconds = Math.round(parseFloat(stdout.trim()) || 0);
          resolve();
        });
      });
    } catch {}

    // Постер серии
    let posterBuffer: Buffer | null = null;
    let posterMime: string | null = null;
    if (posterFile) {
      posterBuffer = posterFile.buffer;
      posterMime = posterFile.mimetype;
    }

    const videoUrl = `/uploads/${filename}`;

    try {
      const result = await query(
        `INSERT INTO episodes (season_id, episode_number, title, video_url, duration_seconds, poster_data, poster_mime)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [seasonId, parseInt(episodeNumber), title || `Серия ${episodeNumber}`, videoUrl, durationSeconds, posterBuffer, posterMime]
      );
      res.json({ ok: true, episodeId: result.rows[0].id, videoUrl });
    } catch (err: any) {
      if (err.message?.includes('duplicate key')) return res.status(409).json({ error: 'Такая серия уже есть в этом сезоне' });
      throw err;
    }
  } catch (err) { console.error('Upload episode error:', err); res.status(500).json({ error: 'Ошибка загрузки' }); }
});

// Получить информацию о серии (для EpisodePage)
app.get('/api/episodes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await query(`
      SELECT e.*, s.season_number, s.anime_id,
        a.title AS anime_title,
        COALESCE(ARRAY_AGG(DISTINCT vo.name) FILTER (WHERE vo.name IS NOT NULL), ARRAY[]::TEXT[]) AS voiceovers,
        COALESCE(ARRAY_AGG(DISTINCT sub.name) FILTER (WHERE sub.name IS NOT NULL), ARRAY[]::TEXT[]) AS subtitles
      FROM episodes e
      JOIN seasons s ON s.id = e.season_id
      JOIN anime a ON a.id = s.anime_id
      LEFT JOIN episode_voiceovers ev ON ev.episode_id = e.id
      LEFT JOIN voiceovers vo ON vo.id = ev.voiceover_id
      LEFT JOIN episode_subtitles es ON es.episode_id = e.id
      LEFT JOIN subtitles sub ON sub.id = es.subtitle_id
      WHERE e.id = $1
      GROUP BY e.id, s.season_number, s.anime_id, a.title
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Не найдено' });
    const e = result.rows[0];
    res.json({
      episode: {
        id: e.id,
        episodeNumber: e.episode_number,
        title: e.title,
        videoUrl: e.video_url,
        durationSeconds: e.duration_seconds || 0,
        views: e.views || 0,
        seasonId: e.season_id,
        seasonNumber: e.season_number,
        animeId: e.anime_id,
        animeTitle: e.anime_title,
        voiceovers: e.voiceovers || [],
        subtitles: e.subtitles || [],
      },
    });
  } catch (err) { console.error('Get episode error:', err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// Получить серии сезона
app.get('/api/seasons/:seasonId/episodes', async (req, res) => {
  try {
    const { seasonId } = req.params;
    const result = await query(`
      SELECT e.id, e.episode_number, e.title, e.video_url, e.duration_seconds, e.created_at,
        (SELECT COUNT(*) FROM views WHERE episode_id = e.id) AS views_count
      FROM episodes e
      WHERE e.season_id = $1
      ORDER BY e.episode_number ASC
    `, [seasonId]);
    res.json({
      episodes: result.rows.map((e) => ({
        id: e.id,
        episodeNumber: e.episode_number,
        title: e.title,
        videoUrl: e.video_url,
        durationSeconds: e.duration_seconds || 0,
        views: parseInt(e.views_count) || 0,
        poster: `/api/posters/episode/${e.id}`,
        createdAt: e.created_at,
      })),
    });
  } catch (err) { console.error('Get episodes error:', err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// === ЛАЙКИ / ДИЗЛАЙКИ АНИМЕ ===
app.post('/api/anime/:id/vote', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { vote } = req.body;
    const voteValue = parseInt(vote);
    if (voteValue !== 1 && voteValue !== -1 && voteValue !== 0) {
      return res.status(400).json({ error: 'Голос должен быть 1, -1 или 0' });
    }
    const existing = await query('SELECT vote FROM anime_votes WHERE user_id = $1 AND anime_id = $2', [req.user.id, id]);
    if (voteValue === 0) {
      if (existing.rows.length > 0) {
        const prev = existing.rows[0].vote;
        await query('DELETE FROM anime_votes WHERE user_id = $1 AND anime_id = $2', [req.user.id, id]);
        if (prev === 1) await query('UPDATE anime SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1', [id]);
        else await query('UPDATE anime SET dislikes_count = GREATEST(dislikes_count - 1, 0) WHERE id = $1', [id]);
      }
    } else {
      if (existing.rows.length > 0) {
        const prev = existing.rows[0].vote;
        if (prev !== voteValue) {
          await query('UPDATE anime_votes SET vote = $1, updated_at = NOW() WHERE user_id = $2 AND anime_id = $3', [voteValue, req.user.id, id]);
          if (prev === 1) {
            await query('UPDATE anime SET likes_count = GREATEST(likes_count - 1, 0), dislikes_count = dislikes_count + 1 WHERE id = $1', [id]);
          } else {
            await query('UPDATE anime SET likes_count = likes_count + 1, dislikes_count = GREATEST(dislikes_count - 1, 0) WHERE id = $1', [id]);
          }
        }
      } else {
        await query('INSERT INTO anime_votes (user_id, anime_id, vote) VALUES ($1, $2, $3)', [req.user.id, id, voteValue]);
        if (voteValue === 1) await query('UPDATE anime SET likes_count = likes_count + 1 WHERE id = $1', [id]);
        else await query('UPDATE anime SET dislikes_count = dislikes_count + 1 WHERE id = $1', [id]);
      }
    }
    const result = await query('SELECT likes_count, dislikes_count FROM anime WHERE id = $1', [id]);
    const userVoteResult = await query('SELECT vote FROM anime_votes WHERE user_id = $1 AND anime_id = $2', [req.user.id, id]);
    res.json({
      likes: parseInt(result.rows[0].likes_count) || 0,
      dislikes: parseInt(result.rows[0].dislikes_count) || 0,
      userVote: userVoteResult.rows.length > 0 ? userVoteResult.rows[0].vote : 0,
    });
  } catch (err) { console.error('Vote error:', err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// === РЕЙТИНГИ ===
app.post('/api/anime/:id/rate', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { score } = req.body;
    const s = Math.max(1, Math.min(10, parseInt(score)));
    if (!s) return res.status(400).json({ error: 'Неверная оценка' });
    await query(
      `INSERT INTO ratings (user_id, anime_id, score) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, anime_id) DO UPDATE SET score = $3, updated_at = NOW()`,
      [req.user.id, id, s]
    );
    const result = await query('SELECT AVG(score)::NUMERIC(3,1) AS avg, COUNT(*) AS count FROM ratings WHERE anime_id = $1', [id]);
    res.json({ average: parseFloat(result.rows[0].avg) || 0, count: parseInt(result.rows[0].count) || 0, userScore: s });
  } catch (err) { console.error('Rate error:', err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/anime/:id/rating', async (req: any, res) => {
  try {
    const { id } = req.params;
    const avgResult = await query('SELECT AVG(score)::NUMERIC(3,1) AS avg, COUNT(*) AS count FROM ratings WHERE anime_id = $1', [id]);
    let userScore = null;
    if (req.user) {
      const userResult = await query('SELECT score FROM ratings WHERE user_id = $1 AND anime_id = $2', [req.user.id, id]);
      if (userResult.rows.length > 0) userScore = userResult.rows[0].score;
    }
    res.json({
      average: parseFloat(avgResult.rows[0].avg) || 0,
      count: parseInt(avgResult.rows[0].count) || 0,
      userScore,
    });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// === КОММЕНТАРИИ ===
app.get('/api/anime/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT c.id, c.text, c.created_at, c.user_id, c.episode_id,
              u.username, u.avatar_color,
              COALESCE(l.likes_count, 0) AS likes_count,
              EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = $2) AS liked_by_me
       FROM comments c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN (SELECT comment_id, COUNT(*) AS likes_count FROM comment_likes GROUP BY comment_id) l
         ON l.comment_id = c.id
       WHERE c.anime_id = $1
       ORDER BY c.created_at DESC`,
      [id, req.user?.id || 0]
    );
    const comments = result.rows.map((row) => ({
      id: row.id,
      animeId: id,
      episodeId: row.episode_id,
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
  } catch (err) { console.error('Get comments error:', err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/anime/:id/comments', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { text, episodeId } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Пустой комментарий' });
    const result = await query(
      'INSERT INTO comments (anime_id, episode_id, user_id, text) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
      [id, episodeId || null, req.user.id, text.trim()]
    );
    res.json({
      comment: {
        id: result.rows[0].id,
        animeId: id,
        episodeId: episodeId || null,
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
  } catch (err) { console.error('Add comment error:', err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/comments/:id/like', requireAuth, async (req: any, res) => {
  try {
    const commentId = parseInt(req.params.id);
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
  } catch (err) { console.error('Like error:', err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.delete('/api/comments/:id', requireAuth, async (req: any, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const check = await query('SELECT user_id FROM comments WHERE id = $1', [commentId]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Не найден' });
    if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });
    await query('DELETE FROM comments WHERE id = $1', [commentId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// === ПРОСМОТРЫ ===
app.post('/api/episodes/:id/view', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { watchedSeconds } = req.body;
    if (!watchedSeconds || watchedSeconds < 30) {
      return res.json({ counted: false, reason: 'need_30_seconds' });
    }
    const result = await query(
      `INSERT INTO views (user_id, episode_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING id`,
      [req.user.id, id]
    );
    const counted = result.rows.length > 0;
    const totalResult = await query('SELECT COUNT(*) AS count FROM views WHERE episode_id = $1', [id]);
    res.json({ counted, views: parseInt(totalResult.rows[0].count) || 0 });
  } catch (err) { console.error('View error:', err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// === ИЗБРАННОЕ ===
app.get('/api/favorites', requireAuth, async (req: any, res) => {
  try {
    const result = await query(
      `SELECT a.id, a.title, a.poster_data, a.year, a.likes_count, a.rating
       FROM favorites f JOIN anime a ON a.id = f.anime_id
       WHERE f.user_id = $1 ORDER BY f.added_at DESC`,
      [req.user.id]
    );
    res.json({
      items: result.rows.map((a) => ({
        id: a.id,
        title: a.title,
        poster: `/api/posters/anime/${a.id}`,
        year: a.year,
        likesCount: parseInt(a.likes_count) || 0,
        rating: parseFloat(a.rating) || 0,
      })),
    });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/favorites/:id', requireAuth, async (req: any, res) => {
  try {
    const animeId = parseInt(req.params.id);
    const existing = await query('SELECT 1 FROM favorites WHERE user_id = $1 AND anime_id = $2', [req.user.id, animeId]);
    if (existing.rows.length > 0) {
      await query('DELETE FROM favorites WHERE user_id = $1 AND anime_id = $2', [req.user.id, animeId]);
      res.json({ favorite: false });
    } else {
      await query('INSERT INTO favorites (user_id, anime_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, animeId]);
      res.json({ favorite: true });
    }
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/history', requireAuth, async (req: any, res) => {
  try {
    const result = await query(
      `SELECT e.id AS episode_id, e.episode_number, e.title AS episode_title, e.video_url,
              s.id AS season_id, s.season_number,
              a.id AS anime_id, a.title AS anime_title, a.poster_data,
              h.watched_at
       FROM history h
       JOIN episodes e ON e.id = h.episode_id
       JOIN seasons s ON s.id = e.season_id
       JOIN anime a ON a.id = s.anime_id
       WHERE h.user_id = $1
       ORDER BY h.watched_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({
      history: result.rows.map((h) => ({
        episodeId: h.episode_id,
        episodeNumber: h.episode_number,
        episodeTitle: h.episode_title,
        videoUrl: h.video_url,
        seasonId: h.season_id,
        seasonNumber: h.season_number,
        animeId: h.anime_id,
        animeTitle: h.anime_title,
        animePoster: `/api/posters/anime/${h.anime_id}`,
        watchedAt: h.watched_at,
      })),
    });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/history/:episodeId', requireAuth, async (req: any, res) => {
  try {
    const episodeId = parseInt(req.params.episodeId);
    await query('INSERT INTO history (user_id, episode_id) VALUES ($1, $2)', [req.user.id, episodeId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// === АДМИНКА ===
app.get('/api/admin/users', requireAdmin, async (req: any, res) => {
  try {
    const result = await query('SELECT id, username, avatar_color, is_admin, can_upload, created_at FROM users ORDER BY id ASC');
    res.json({
      users: result.rows.map((u) => ({
        id: u.id, username: u.username, avatarColor: u.avatar_color,
        isAdmin: u.is_admin, canUpload: u.can_upload, createdAt: u.created_at,
      })),
    });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/admin/users/:id/upload-permission', requireAdmin, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { canUpload } = req.body;
    await query('UPDATE users SET can_upload = $1 WHERE id = $2', [!!canUpload, userId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/admin/users/:id/admin', requireAdmin, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { isAdmin } = req.body;
    await query('UPDATE users SET is_admin = $1 WHERE id = $2', [!!isAdmin, userId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

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
  } catch (err) { console.error('Change password error:', err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/setup-admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Укажите username и password' });
    if (username.length < 2 || username.length > 32) return res.status(400).json({ error: 'Ник: 2-32 символа' });
    if (password.length < 4) return res.status(400).json({ error: 'Пароль: минимум 4 символа' });
    const existingAdmins = await query('SELECT id FROM users WHERE is_admin = TRUE LIMIT 1');
    if (existingAdmins.rows.length > 0) {
      return res.status(403).json({ error: 'Админ уже существует. Используйте админ-панель для выдачи прав.' });
    }
    const hash = await hashPassword(password);
    const color = '#ff85b8';
    const result = await query(
      `INSERT INTO users (username, password_hash, avatar_color, is_admin, can_upload)
       VALUES ($1, $2, $3, TRUE, TRUE)
       ON CONFLICT (username) DO UPDATE SET password_hash = $2, is_admin = TRUE, can_upload = TRUE
       RETURNING id, username, avatar_color, is_admin, can_upload`,
      [username, hash, color]
    );
    const user = result.rows[0];
    const token = signToken({ id: user.id, username: user.username, avatarColor: user.avatar_color, isAdmin: user.is_admin, canUpload: user.can_upload });
    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
    res.json({ ok: true, message: 'Создан первый администратор', user: { id: user.id, username: user.username, avatarColor: user.avatar_color, isAdmin: user.is_admin, canUpload: user.can_upload }, token });
  } catch (err) { console.error('Setup admin error:', err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// === РАЗДАЧА ФРОНТЕНДА ===
const DIST_DIR = join(process.cwd(), 'dist');
if (existsSync(DIST_DIR)) {
  console.log(`[serve] Раздача фронтенда из ${DIST_DIR}`);
  app.use(express.static(DIST_DIR, {
    maxAge: '1h',
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
      return res.status(404).json({ error: 'Не найдено' });
    }
    const indexPath = join(DIST_DIR, 'index.html');
    if (existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(503).send('Фронтенд не собран');
  });
} else {
  app.get('/', (req, res) => res.status(503).send('Фронтенд не собран. Запустите npm run build.'));
}

// === ЗАПУСК ===
async function start() {
  await initDatabase();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] CorpMult API запущен на порту ${PORT}`);
    console.log(`[server] Режим: ${NODE_ENV}`);
    console.log(`[server] Создайте первого админа: curl -X POST $API/api/setup-admin -d '{"username":"Morfin","password":"..."}'`);
  });
}

start().catch((err) => {
  console.error('[fatal] Ошибка запуска:', err);
  process.exit(1);
});
