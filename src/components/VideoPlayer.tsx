import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings,
  SkipBack, SkipForward, Check, Loader2,
} from 'lucide-react';
import type { Quality } from '../types';

interface Props {
  videoSrc: string;
  poster?: string;
  onProgress?: (position: number, duration: number) => void;
  onEnded?: () => void;
  onView?: (watchedSeconds: number) => void;
  initialPosition?: number;
  initialVoiceover?: string;
  initialQuality?: Quality;
  voiceovers?: string[];
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const QUALITIES: Quality[] = ['Auto', '360p', '480p', '720p', '1080p', '1440p', '4K'];

const formatTime = (s: number) => {
  if (!isFinite(s) || isNaN(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

export default function VideoPlayer({
  videoSrc,
  poster,
  onProgress,
  onEnded,
  onView,
  initialPosition = 0,
  initialVoiceover,
  initialQuality = 'Auto',
  voiceovers = ['Оригинал'],
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);
  const onViewRef = useRef(onView);
  const viewRecordedRef = useRef(false);
  const maxWatchedRef = useRef(0);
  const autoplayRef = useRef(true);
  // Метка для подавления лишних предупреждений (используется в onLoadedMetadata)
  void autoplayRef;

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  // === СУБТИТРЫ В РЕАЛЬНОМ ВРЕМЕНИ ===
  // Используем Web Speech API для распознавания речи из аудио видео
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [subtitleLang, setSubtitleLang] = useState<'ru-RU' | 'en-US' | 'ja-JP'>('ru-RU');
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const recognitionRef = useRef<any>(null);
  const lastTranscriptRef = useRef<{ text: string; time: number }>({ text: '', time: 0 });
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  // Загружаем сохранённое качество из LocalStorage
  const [quality, setQuality] = useState<Quality>(() => {
    try {
      const saved = localStorage.getItem('corpmult_quality');
      if (saved && QUALITIES.includes(saved as Quality)) return saved as Quality;
    } catch {}
    return initialQuality;
  });

  // Сохраняем выбор качества
  useEffect(() => {
    try { localStorage.setItem('corpmult_quality', quality); } catch {}
  }, [quality]);
  const [voiceover, setVoiceover] = useState<string>(initialVoiceover || voiceovers[0] || 'Оригинал');
  const [subtitles, setSubtitles] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'speed' | 'quality' | 'voiceover' | 'subtitles'>('speed');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(initialPosition > 30);
  const [thumbPos, setThumbPos] = useState({ x: 0, time: 0 });
  const [showThumb, setShowThumb] = useState(false);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onEndedRef.current = onEnded;
    onViewRef.current = onView;
  }, [onProgress, onEnded, onView]);

  // Сброс при смене видео
  useEffect(() => {
    setError(null);
    setLoading(true);
    setPosition(0);
    setDuration(0);
    viewRecordedRef.current = false;
    maxWatchedRef.current = 0;
  }, [videoSrc]);

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (playing) setControlsVisible(false);
    }, 2500);
  }, [playing]);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [playing, resetHideTimer]);

  // === СУБТИТРЫ ЧЕРЕЗ WEB SPEECH API ===
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API не поддерживается в этом браузере');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = subtitleLang;

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript.trim();
          if (text) {
            setCurrentSubtitle(text);
            if (result.isFinal) {
              lastTranscriptRef.current = { text, time: videoRef.current?.currentTime || 0 };
            }
          }
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('Speech recognition error:', e.error);
        }
      };

      recognition.onend = () => {
        if (subtitlesEnabled && recognitionRef.current) {
          try { recognition.start(); } catch {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Не удалось запустить распознавание речи:', err);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setCurrentSubtitle('');
  };

  useEffect(() => {
    if (subtitlesEnabled) {
      startSpeechRecognition();
    } else {
      stopSpeechRecognition();
    }
    return () => stopSpeechRecognition();
  }, [subtitlesEnabled, subtitleLang]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedMetadata = () => {
      setDuration(video.duration || 0);
      setLoading(false);
      // Если есть сохранённая позиция — перематываем
      if (initialPosition > 0 && initialPosition < (video.duration || 0) - 5) {
        try { video.currentTime = initialPosition; } catch {}
      }
      // Автозапуск при первой загрузке
      if (autoplayRef.current && !showResumePrompt) {
        autoplayRef.current = false;
        // Небольшая задержка чтобы избежать блокировки браузером
        setTimeout(() => {
          video.play().catch(() => {});
        }, 100);
      }
    };
    const onTimeUpdate = () => {
      setPosition(video.currentTime);
      if (video.currentTime > maxWatchedRef.current) maxWatchedRef.current = video.currentTime;
    };
    const onProgressEv = () => {
      if (video.buffered.length > 0 && video.duration > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1) / video.duration);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      // Засчитываем просмотр если посмотрел больше 30 сек
      if (!viewRecordedRef.current && maxWatchedRef.current >= 30) {
        viewRecordedRef.current = true;
        onViewRef.current?.(maxWatchedRef.current);
      }
      onEndedRef.current?.();
    };
    const onError = () => {
      setError('Не удалось загрузить видео');
      setLoading(false);
    };
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('progress', onProgressEv);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('progress', onProgressEv);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
    };
  }, [initialPosition]);

  // Сохранение прогресса каждые 5 сек
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      onProgressRef.current?.(position, duration);
      // Также засчитываем просмотр если смотрел достаточно
      if (!viewRecordedRef.current && maxWatchedRef.current >= 30) {
        viewRecordedRef.current = true;
        onViewRef.current?.(maxWatchedRef.current);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [playing, position, duration]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted]);

  // Горячие клавиши
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          if (v.paused) v.play().catch(() => {}); else v.pause();
          break;
        case 'ArrowRight':
        case 'l':
        case 'L':
          e.preventDefault();
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
          break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 10);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          setMuted((m) => !m);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        default:
          if (e.key >= '0' && e.key <= '9') {
            const pct = parseInt(e.key) / 10;
            if (v.duration) v.currentTime = v.duration * pct;
          }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {
        // Fallback для браузеров без navigationUI
        el.requestFullscreen?.().catch(() => {});
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  };

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = v.duration * pct;
    setPosition(v.currentTime);
  };

  const onSeekMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setThumbPos({ x: e.clientX - rect.left, time: v.duration * pct });
  };

  const showUI = controlsVisible || !playing;
  const progressPct = duration > 0 ? (position / duration) * 100 : 0;
  const bufferedPct = Math.min(100, buffered * 100);

  return (
    <div
      ref={containerRef}
      className="group/player relative mx-auto w-full overflow-hidden bg-black shadow-2xl"
      style={{ aspectRatio: '16 / 9' }}
      onMouseEnter={resetHideTimer}
      onMouseLeave={() => { if (playing) setControlsVisible(false); }}
      onMouseMove={resetHideTimer}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        poster={poster}
        className="block h-full w-full bg-black object-contain"
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {!playing && !loading && !error && (
        <button onClick={togglePlay} className="absolute inset-0 z-10 flex items-center justify-center" aria-label="Воспроизвести">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-all hover:scale-110 hover:bg-black/80">
            <Play className="h-7 w-7 fill-white text-white ml-0.5" />
          </div>
        </button>
      )}

      {showResumePrompt && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-72 max-w-[90%] rounded-xl bg-zinc-900 p-5 text-center shadow-2xl">
            <h3 className="text-base font-bold text-white">Продолжить?</h3>
            <p className="mt-1 text-xs text-zinc-400">Осталось {formatTime(Math.max(0, duration - initialPosition))}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  if (videoRef.current) videoRef.current.currentTime = 0;
                  setShowResumePrompt(false);
                  videoRef.current?.play().catch(() => {});
                }}
                className="flex-1 rounded-full bg-zinc-800 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
              >
                Сначала
              </button>
              <button
                onClick={() => {
                  setShowResumePrompt(false);
                  videoRef.current?.play().catch(() => {});
                }}
                className="flex-1 rounded-full bg-white py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-200"
              >
                Продолжить
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-white/70" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <p className="px-4 text-sm text-zinc-300">{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); if (videoRef.current) videoRef.current.load(); }}
              className="mt-3 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-200"
            >
              Повторить
            </button>
          </div>
        </div>
      )}

      <div className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/50 to-transparent px-3 pb-2 pt-12 transition-opacity duration-200 sm:px-4 ${showUI ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <div
          className="group/seek relative flex h-3 cursor-pointer items-center"
          onClick={onSeek}
          onMouseMove={(e) => { onSeekMove(e); setShowThumb(true); }}
          onMouseLeave={() => setShowThumb(false)}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/30">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/40" style={{ width: `${bufferedPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-red-600" style={{ width: `${progressPct}%` }} />
          </div>
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600 opacity-0 shadow transition-opacity group-hover/seek:opacity-100"
            style={{ left: `${progressPct}%` }}
          />
          {showThumb && duration > 0 && (
            <div className="absolute -top-12 z-30 -translate-x-1/2 rounded bg-black/95 px-2 py-1 text-xs font-mono text-white shadow-xl" style={{ left: thumbPos.x }}>
              {formatTime(thumbPos.time)}
            </div>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1 text-white sm:gap-2">
          <button onClick={togglePlay} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/15" title="K">
            {playing ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white ml-0.5" />}
          </button>
          <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10); }} className="hidden h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 sm:flex">
            <SkipBack className="h-4 w-4" />
          </button>
          <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10); }} className="hidden h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15 sm:flex">
            <SkipForward className="h-4 w-4" />
          </button>

          <div className="group/vol flex items-center">
            <button onClick={() => setMuted((m) => !m)} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/15">
              {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <input
              type="range" min={0} max={1} step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
              className="ml-1 hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/30 group-hover/vol:block [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>

          <div className="ml-1 font-mono text-xs tabular-nums text-white/95">
            {formatTime(position)} <span className="text-white/60">/ {formatTime(duration)}</span>
          </div>

          <div className="flex-1" />

          <span className="hidden rounded bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:inline">{quality}</span>
          <span className="hidden rounded bg-white/15 px-2 py-0.5 text-[10px] font-bold tracking-wider sm:inline">{voiceover}</span>

          <div className="relative">
            <button onClick={() => setShowSettings((s) => !s)} className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${showSettings ? 'bg-white/20' : 'hover:bg-white/15'}`}>
              <Settings className="h-4 w-4" />
            </button>
            {showSettings && (
              <div className="absolute bottom-10 right-0 z-40 w-72 max-w-[92vw] overflow-hidden rounded-xl bg-black/95 text-white shadow-2xl ring-1 ring-white/10 animate-scale-in backdrop-blur-md">
                <div className="flex border-b border-white/10 text-[11px] font-semibold">
                  {(['speed', 'quality', 'voiceover', 'subtitles'] as const).map((tab) => (
                    <button key={tab} onClick={() => setSettingsTab(tab)} className={`flex-1 px-2 py-2.5 transition-colors ${settingsTab === tab ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`}>
                      {tab === 'speed' ? 'Скорость' : tab === 'quality' ? 'Качество' : tab === 'voiceover' ? 'Озвучка' : 'Субтитры'}
                    </button>
                  ))}
                </div>
                <div className="max-h-72 overflow-y-auto p-1">
                  {settingsTab === 'speed' && SPEEDS.map((s) => (
                    <button key={s} onClick={() => setSpeed(s)} className={`flex w-full items-center justify-between rounded px-3 py-2 text-sm transition-colors hover:bg-white/10 ${speed === s ? 'font-semibold' : ''}`}>
                      {s === 1 ? 'Обычная' : `${s}x`}
                      {speed === s && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                  {settingsTab === 'quality' && QUALITIES.map((q) => (
                    <button key={q} onClick={() => setQuality(q)} className={`flex w-full items-center justify-between rounded px-3 py-2 text-sm transition-colors hover:bg-white/10 ${quality === q ? 'font-semibold' : ''}`}>
                      {q === 'Auto' ? 'Авто' : q}
                      {quality === q && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                  {settingsTab === 'voiceover' && voiceovers.map((v) => (
                    <button key={v} onClick={() => setVoiceover(v)} className={`flex w-full items-center justify-between rounded px-3 py-2 text-sm transition-colors hover:bg-white/10 ${voiceover === v ? 'font-semibold' : ''}`}>
                      {v}
                      {voiceover === v && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                  {settingsTab === 'subtitles' && (
                    <>
                      {['Отключены', 'Русские', 'English'].map((lang) => (
                        <button key={lang} onClick={() => setSubtitles(lang === 'Отключены' ? null : lang)} className={`flex w-full items-center justify-between rounded px-3 py-2 text-sm transition-colors hover:bg-white/10 ${(subtitles === null && lang === 'Отключены') || subtitles === lang ? 'font-semibold' : ''}`}>
                          {lang}
                          {((subtitles === null && lang === 'Отключены') || subtitles === lang) && <Check className="h-4 w-4" />}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <button onClick={toggleFullscreen} className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/15">
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Субтитры в реальном времени (поверх видео, чуть выше контролов) */}
      {subtitlesEnabled && currentSubtitle && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center px-4 sm:bottom-28">
          <div className="max-w-3xl rounded-lg bg-black/85 px-4 py-2 text-center text-sm font-semibold text-white shadow-xl backdrop-blur-sm sm:text-lg">
            <span lang={subtitleLang}>{currentSubtitle}</span>
          </div>
        </div>
      )}
    </div>
  );
}
