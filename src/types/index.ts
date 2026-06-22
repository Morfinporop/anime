// Типы данных для CorpMult

export type Category = 'anime';
// Только один раздел — аниме. Мультфильмы убраны навсегда.

export type Quality = '360p' | '480p' | '720p' | '1080p' | '1440p' | '4K' | 'Auto';

export interface Comment {
  id: number;
  videoId: string;
  author: string;
  avatar: string;
  avatarColor: string;
  text: string;
  createdAt: string;
  likes: number;
  likedByMe: boolean;
  userId: number;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  poster: string;
  videoSrc: string;
  year: number;
  ageRating: string;
  quality: Quality;
  isSeries: boolean;
  episodesCount: number;
  rating: number;
  ratingsCount: number;
  views: number;
  genres: string[];
  voiceovers: string[];
  subtitles: string[];
  addedAt: string;
}

export interface AdminUser {
  id: number;
  username: string;
  avatarColor: string;
  isAdmin: boolean;
  canUpload: boolean;
  createdAt: string;
}

export interface User {
  id: number;
  username: string;
  avatarColor: string;
  isAdmin: boolean;
  canUpload: boolean;
}
