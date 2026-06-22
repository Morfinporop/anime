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

-- НЕ создаём Morfin автоматически — админ регистрируется сам через форму
-- и получает права через SQL или админ-панель другого админа

-- Аниме и серии — описаны выше в системе сезонов

-- === СИСТЕМА СЕЗОНОВ И СЕРИЙ ===
-- Аниме — это верхнеуровневая сущность (например "Наруто")
-- Сезон — принадлежит аниме, имеет номер и обложку
-- Серия — принадлежит сезону, имеет номер и видео

CREATE TABLE IF NOT EXISTS anime (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  poster_data BYTEA,
  poster_mime VARCHAR(50),
  genres TEXT[] NOT NULL DEFAULT '{}',
  year INT NOT NULL DEFAULT 2024,
  age_rating VARCHAR(8) NOT NULL DEFAULT '12+',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seasons (
  id SERIAL PRIMARY KEY,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  season_number INT NOT NULL DEFAULT 1,
  poster_data BYTEA,
  poster_mime VARCHAR(50),
  description TEXT NOT NULL DEFAULT '',
  episodes_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(anime_id, season_number)
);
CREATE INDEX IF NOT EXISTS idx_seasons_anime ON seasons(anime_id);

CREATE TABLE IF NOT EXISTS episodes (
  id SERIAL PRIMARY KEY,
  season_id INT REFERENCES seasons(id) ON DELETE CASCADE,
  episode_number INT NOT NULL DEFAULT 1,
  title VARCHAR(200) NOT NULL DEFAULT '',
  video_url TEXT NOT NULL,
  poster_data BYTEA,
  poster_mime VARCHAR(50),
  duration_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(season_id, episode_number)
);
CREATE INDEX IF NOT EXISTS idx_episodes_season ON episodes(season_id, episode_number);

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

-- Оценки аниме (1 пользователь = 1 оценка на аниме)
CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, anime_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_anime ON ratings(anime_id);

-- Комментарии (к аниме)
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  episode_id INT REFERENCES episodes(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_anime ON comments(anime_id, created_at DESC);

-- Лайки комментариев (1 пользователь = 1 лайк на комментарий)
CREATE TABLE IF NOT EXISTS comment_likes (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  comment_id INT REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, comment_id)
);

-- Лайки/дизлайки аниме
CREATE TABLE IF NOT EXISTS anime_votes (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote = 1 OR vote = -1),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, anime_id)
);

-- Просмотры (1 пользователь = 1 просмотр на серию, засчитывается если посмотрел 30+ сек)
CREATE TABLE IF NOT EXISTS views (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  episode_id INT REFERENCES episodes(id) ON DELETE CASCADE,
  watched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, episode_id)
);

-- Избранное (по аниме)
CREATE TABLE IF NOT EXISTS favorites (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, anime_id)
);

-- Лайки/дизлайки видео (1 пользователь = 1 голос на видео)
CREATE TABLE IF NOT EXISTS video_votes (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  video_id VARCHAR(20) REFERENCES videos(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote = 1 OR vote = -1),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_video_votes_video ON video_votes(video_id);

-- Добавляем колонки для счётчиков лайков/дизлайков
ALTER TABLE videos ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS dislikes_count INT NOT NULL DEFAULT 0;

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

-- Озвучки и субтитры для серий и аниме
CREATE TABLE IF NOT EXISTS episode_voiceovers (
  episode_id INT REFERENCES episodes(id) ON DELETE CASCADE,
  voiceover_id INT REFERENCES voiceovers(id) ON DELETE CASCADE,
  PRIMARY KEY (episode_id, voiceover_id)
);

CREATE TABLE IF NOT EXISTS episode_subtitles (
  episode_id INT REFERENCES episodes(id) ON DELETE CASCADE,
  subtitle_id INT REFERENCES subtitles(id) ON DELETE CASCADE,
  PRIMARY KEY (episode_id, subtitle_id)
);

CREATE TABLE IF NOT EXISTS anime_voiceovers (
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  voiceover_id INT REFERENCES voiceovers(id) ON DELETE CASCADE,
  PRIMARY KEY (anime_id, voiceover_id)
);

CREATE TABLE IF NOT EXISTS anime_subtitles (
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  subtitle_id INT REFERENCES subtitles(id) ON DELETE CASCADE,
  PRIMARY KEY (anime_id, subtitle_id)
);

ALTER TABLE anime ADD COLUMN IF NOT EXISTS voiceovers TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE anime ADD COLUMN IF NOT EXISTS subtitles TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS voiceovers TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS subtitles TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_views_video ON views(video_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id, watched_at DESC);
