// Типы данных для AnimeWorld

export type Quality = '360p' | '480p' | '720p' | '1080p' | '1440p' | '4K' | 'Auto';

export interface Episode {
  id: number;
  seasonId: number | null; // null если загружено без сезона
  animeId: number;
  episodeNumber: number;
  title: string;
  videoUrl: string;
  durationSeconds: number;
  views: number;
  poster: string;
  voiceovers: string[];
  subtitles: string[];
  quality: Quality;
  createdAt: string;
}

export interface Season {
  id: number;
  animeId: number;
  seasonNumber: number;
  poster: string;
  description: string;
  episodesCount: number;
}

export interface Anime {
  id: number;
  title: string;
  description: string;
  poster: string;
  year: number;
  ageRating: string;
  genres: string[];
  voiceovers: string[];
  subtitles: string[];
  likesCount: number;
  dislikesCount: number;
  rating: number;
  ratingsCount: number;
  views: number;
  totalEpisodes: number;
  totalSeasons: number;
  addedAt: string;
  seasons?: Season[];
}

export interface Comment {
  id: number;
  animeId: number;
  episodeId: number | null;
  author: string;
  avatar: string;
  avatarColor: string;
  text: string;
  createdAt: string;
  likes: number;
  likedByMe: boolean;
  userId: number;
}

export interface User {
  id: number;
  username: string;
  avatarColor: string;
  isAdmin: boolean;
  canUpload: boolean;
}
