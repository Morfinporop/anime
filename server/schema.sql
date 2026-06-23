-- Схема базы данных CorpMult
-- Только аниме/сезоны/серии (новая архитектура)
-- Каждый statement выполняется отдельно, чтобы избежать ошибок "relation does not exist"

-- 1. Пользователи
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(32) UNIQUE NOT NULL,
  password_hash VARCHAR(120) NOT NULL,
  avatar_color VARCHAR(16) NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  can_upload BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Аниме (верхний уровень)
CREATE TABLE IF NOT EXISTS anime (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  poster_data BYTEA,
  poster_mime VARCHAR(50),
  genres TEXT[] NOT NULL DEFAULT '{}',
  year INT NOT NULL DEFAULT 2024,
  age_rating VARCHAR(8) NOT NULL DEFAULT '12+',
  likes_count INT NOT NULL DEFAULT 0,
  dislikes_count INT NOT NULL DEFAULT 0,
  voiceovers TEXT[] NOT NULL DEFAULT '{}',
  subtitles TEXT[] NOT NULL DEFAULT '{}',
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Сезоны
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

-- 4. Серии
CREATE TABLE IF NOT EXISTS episodes (
  id SERIAL PRIMARY KEY,
  season_id INT REFERENCES seasons(id) ON DELETE CASCADE,
  episode_number INT NOT NULL DEFAULT 1,
  title VARCHAR(200) NOT NULL DEFAULT '',
  video_url TEXT NOT NULL,
  poster_data BYTEA,
  poster_mime VARCHAR(50),
  voiceovers TEXT[] NOT NULL DEFAULT '{}',
  subtitles TEXT[] NOT NULL DEFAULT '{}',
  duration_seconds INT NOT NULL DEFAULT 0,
  views_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(season_id, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_episodes_season ON episodes(season_id, episode_number);

-- 5. Жанры
CREATE TABLE IF NOT EXISTS genres (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

-- Связь аниме и жанров
CREATE TABLE IF NOT EXISTS anime_genres (
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  genre_id INT REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (anime_id, genre_id)
);

-- 6. Озвучки
CREATE TABLE IF NOT EXISTS voiceovers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS anime_voiceovers (
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  voiceover_id INT REFERENCES voiceovers(id) ON DELETE CASCADE,
  PRIMARY KEY (anime_id, voiceover_id)
);

CREATE TABLE IF NOT EXISTS episode_voiceovers (
  episode_id INT REFERENCES episodes(id) ON DELETE CASCADE,
  voiceover_id INT REFERENCES voiceovers(id) ON DELETE CASCADE,
  PRIMARY KEY (episode_id, voiceover_id)
);

-- 7. Субтитры
CREATE TABLE IF NOT EXISTS subtitles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS anime_subtitles (
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  subtitle_id INT REFERENCES subtitles(id) ON DELETE CASCADE,
  PRIMARY KEY (anime_id, subtitle_id)
);

CREATE TABLE IF NOT EXISTS episode_subtitles (
  episode_id INT REFERENCES episodes(id) ON DELETE CASCADE,
  subtitle_id INT REFERENCES subtitles(id) ON DELETE CASCADE,
  PRIMARY KEY (episode_id, subtitle_id)
);

-- 8. Оценки (1 пользователь = 1 оценка на аниме)
CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, anime_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_anime ON ratings(anime_id);

-- 9. Лайки/дизлайки аниме
CREATE TABLE IF NOT EXISTS anime_votes (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote = 1 OR vote = -1),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, anime_id)
);

-- 10. Комментарии
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  episode_id INT REFERENCES episodes(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_anime ON comments(anime_id, created_at DESC);

-- 11. Лайки комментариев
CREATE TABLE IF NOT EXISTS comment_likes (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  comment_id INT REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, comment_id)
);

-- 12. Просмотры (по сериям, засчитывается если смотрел 30+ сек)
CREATE TABLE IF NOT EXISTS views (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  episode_id INT REFERENCES episodes(id) ON DELETE CASCADE,
  watched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, episode_id)
);

-- 13. Избранное (по аниме)
CREATE TABLE IF NOT EXISTS favorites (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, anime_id)
);

-- 14. История просмотров
CREATE TABLE IF NOT EXISTS history (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  episode_id INT REFERENCES episodes(id) ON DELETE CASCADE,
  watched_at TIMESTAMP DEFAULT NOW()
);

-- 15. Прогресс просмотра
CREATE TABLE IF NOT EXISTS progress (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  episode_id INT REFERENCES episodes(id) ON DELETE CASCADE,
  position_seconds REAL NOT NULL DEFAULT 0,
  duration_seconds REAL NOT NULL DEFAULT 0,
  voiceover VARCHAR(80),
  quality VARCHAR(16),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, episode_id)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_views_episode ON views(episode_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id, watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_anime_created_at ON anime(created_at DESC);
