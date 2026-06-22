-- Схема базы данных CorpMult
-- Все таблицы создаются автоматически при первом запуске сервера

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(32) UNIQUE NOT NULL,
  password_hash VARCHAR(120) NOT NULL,
  avatar_color VARCHAR(16) NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  can_upload BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
  id VARCHAR(20) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  poster_url TEXT,
  video_url TEXT NOT NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  year INT NOT NULL,
  age_rating VARCHAR(8) NOT NULL DEFAULT '12+',
  quality VARCHAR(16) NOT NULL DEFAULT '1080p',
  is_series BOOLEAN NOT NULL DEFAULT FALSE,
  episodes_count INT NOT NULL DEFAULT 1,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Связь видео и жанров (многие-ко-многим)
CREATE TABLE IF NOT EXISTS genres (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS video_genres (
  video_id VARCHAR(20) REFERENCES videos(id) ON DELETE CASCADE,
  genre_id INT REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, genre_id)
);

-- Озвучки
CREATE TABLE IF NOT EXISTS voiceovers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS video_voiceovers (
  video_id VARCHAR(20) REFERENCES videos(id) ON DELETE CASCADE,
  voiceover_id INT REFERENCES voiceovers(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, voiceover_id)
);

-- Субтитры
CREATE TABLE IF NOT EXISTS subtitles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS video_subtitles (
  video_id VARCHAR(20) REFERENCES videos(id) ON DELETE CASCADE,
  subtitle_id INT REFERENCES subtitles(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, subtitle_id)
);

-- Оценки (1 пользователь = 1 оценка на видео)
CREATE TABLE IF NOT EXISTS ratings (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  video_id VARCHAR(20) REFERENCES videos(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, video_id)
);

-- Комментарии
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(20) REFERENCES videos(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Лайки комментариев (1 пользователь = 1 лайк на комментарий)
CREATE TABLE IF NOT EXISTS comment_likes (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  comment_id INT REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, comment_id)
);

-- Просмотры (1 пользователь = 1 просмотр на видео, засчитывается если посмотрел 30+ сек)
CREATE TABLE IF NOT EXISTS views (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  video_id VARCHAR(20) REFERENCES videos(id) ON DELETE CASCADE,
  watched_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, video_id)
);

-- Избранное
CREATE TABLE IF NOT EXISTS favorites (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  video_id VARCHAR(20) REFERENCES videos(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, video_id)
);

-- История просмотров
CREATE TABLE IF NOT EXISTS history (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  video_id VARCHAR(20) REFERENCES videos(id) ON DELETE CASCADE,
  watched_at TIMESTAMP DEFAULT NOW()
);

-- Прогресс просмотра
CREATE TABLE IF NOT EXISTS progress (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  video_id VARCHAR(20) REFERENCES videos(id) ON DELETE CASCADE,
  position_seconds REAL NOT NULL DEFAULT 0,
  duration_seconds REAL NOT NULL DEFAULT 0,
  voiceover VARCHAR(80),
  quality VARCHAR(16),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, video_id)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_video ON ratings(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_views_video ON views(video_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id, watched_at DESC);
