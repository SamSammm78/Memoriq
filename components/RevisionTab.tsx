'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronDown,
  Headphones,
  Pause,
  Play,
  RotateCcw,
  X
} from 'lucide-react';
import type { Ayah, Progression, QuranData, VerseStatus } from '@/lib/progression';

const REVIEW_RECITER = 'Mishary Al-Afasy';
const REVIEW_AUDIO_FOLDER = 'Alafasy_128kbps';

interface RevisionTabProps {
  progression: Progression;
  quran: QuranData;
  onStatusChange: (
    surahNumber: number,
    ayahNumber: number,
    status: VerseStatus,
    surahName: string
  ) => Promise<void>;
}

interface ReviewVerse {
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  ayah: Ayah;
}

export function RevisionTab({ progression, quran, onStatusChange }: RevisionTabProps) {
  const [expandedSurah, setExpandedSurah] = useState<string | null>(null);
  const [sessionQueue, setSessionQueue] = useState<ReviewVerse[]>([]);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [isSessionOpen, setIsSessionOpen] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [pendingVerse, setPendingVerse] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const learnedSurahs = useMemo(() => {
    return Object.entries(progression.progression || {})
      .map(([surahKey, surahProgress]) => {
        const surahNumber = Number(surahKey);
        const surah = quran.surahs.find((item) => item.number === surahNumber);
        const verses = Object.entries(surahProgress.verses)
          .map(([ayahKey, status]) => ({
            ayahNumber: Number(ayahKey),
            status,
            ayah: surah?.ayahs.find((item) => item.numberInSurah === Number(ayahKey))
          }))
          .filter((item): item is { ayahNumber: number; status: VerseStatus; ayah: Ayah } => Boolean(item.ayah))
          .sort((a, b) => a.ayahNumber - b.ayahNumber);

        return {
          key: surahKey,
          number: surahNumber,
          name: surah?.englishName || surahProgress.name,
          arabicName: surah?.name || '',
          totalVerses: surah?.ayahs.length || verses.length,
          verses
        };
      })
      .filter((surah) => surah.verses.length > 0)
      .sort((a, b) => a.number - b.number);
  }, [progression.progression, quran]);

  const reviewVerses = useMemo<ReviewVerse[]>(() => {
    return learnedSurahs.flatMap((surah) =>
      surah.verses
        .filter((verse) => verse.status === 'a_reviser')
        .map((verse) => ({
          surahNumber: surah.number,
          surahName: surah.name,
          ayahNumber: verse.ayahNumber,
          ayah: verse.ayah
        }))
    );
  }, [learnedSurahs]);

  const currentVerse = sessionQueue[sessionIndex];
  const sessionComplete = isSessionOpen && sessionIndex >= sessionQueue.length;
  const audioUrl = currentVerse
    ? `https://everyayah.com/data/${REVIEW_AUDIO_FOLDER}/${String(currentVerse.surahNumber).padStart(3, '0')}${String(currentVerse.ayahNumber).padStart(3, '0')}.mp3`
    : '';

  useEffect(() => {
    if (!isSessionOpen) return;

    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById('memoriq-app');
    document.body.style.overflow = 'hidden';
    appRoot?.setAttribute('inert', '');
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSessionOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      appRoot?.removeAttribute('inert');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSessionOpen]);

  useEffect(() => {
    audioRef.current?.pause();
    audioRef.current?.load();
  }, [audioUrl]);

  const saveStatus = async (
    surahNumber: number,
    ayahNumber: number,
    status: VerseStatus,
    surahName: string
  ) => {
    const verseKey = `${surahNumber}:${ayahNumber}`;
    setPendingVerse(verseKey);
    try {
      await onStatusChange(surahNumber, ayahNumber, status, surahName);
    } finally {
      setPendingVerse(null);
    }
  };

  const startSession = () => {
    setSessionQueue(reviewVerses);
    setSessionIndex(0);
    setIsAudioPlaying(false);
    setIsSessionOpen(true);
  };

  const advanceSession = () => {
    audioRef.current?.pause();
    setIsAudioPlaying(false);
    setSessionIndex((index) => index + 1);
  };

  const handlePerfect = async () => {
    if (!currentVerse) return;
    await saveStatus(
      currentVerse.surahNumber,
      currentVerse.ayahNumber,
      'acquis',
      currentVerse.surahName
    );
    advanceSession();
  };

  const toggleAudio = async () => {
    if (!audioRef.current) return;
    if (isAudioPlaying) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
      return;
    }

    audioRef.current.loop = true;
    await audioRef.current.play();
    setIsAudioPlaying(true);
  };

  if (learnedSurahs.length === 0) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-brand-100 bg-brand-50">
          <Headphones className="h-5 w-5 text-brand-500" />
        </div>
        <h2 className="text-sm font-bold text-zinc-800">Aucun verset à réviser</h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">Les versets validés apparaîtront ici, classés par sourate.</p>
      </section>
    );
  }

  return (
    <section className="min-h-full text-zinc-800">
      <div className="mb-4 flex items-end justify-between gap-4 px-0.5">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-brand-500">Bibliothèque de révision</p>
          <h2 className="mt-1 text-lg font-bold text-zinc-800">Mes sourates</h2>
        </div>
        <span className="text-[10px] font-semibold text-zinc-400">{learnedSurahs.length} sourate{learnedSurahs.length > 1 ? 's' : ''}</span>
      </div>

      {reviewVerses.length > 0 && (
        <button
          type="button"
          onClick={startSession}
          className="mb-4 flex min-h-14 w-full items-center justify-between rounded-xl border border-brand-700/10 bg-brand-500 px-5 text-left text-white shadow-sm transition-all duration-300 hover:bg-brand-600 active:scale-[0.99]"
        >
          <span>
            <span className="block text-sm font-bold">Lancer la révision</span>
            <span className="block text-[11px] opacity-70">Session ciblée, une carte à la fois</span>
          </span>
          <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white/15 px-2 text-xs font-bold text-white">
            {reviewVerses.length}
          </span>
        </button>
      )}

      <div className="space-y-2">
        {learnedSurahs.map((surah) => {
          const isExpanded = expandedSurah === surah.key;
          const learnedPercent = Math.round((surah.verses.length / Math.max(surah.totalVerses, 1)) * 100);
          const reviewCount = surah.verses.filter((verse) => verse.status === 'a_reviser').length;

          return (
            <article key={surah.key} className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={`surah-${surah.key}-verses`}
                onClick={() => setExpandedSurah(isExpanded ? null : surah.key)}
                className="w-full px-4 py-4 text-left transition-all duration-300 hover:bg-zinc-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <h3 className="truncate text-sm font-bold text-zinc-800">{surah.name}</h3>
                      {surah.arabicName && <span className="quran-arabic text-sm text-brand-500">{surah.arabicName}</span>}
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-400">
                      {surah.verses.length}/{surah.totalVerses} appris
                      {reviewCount > 0 && <span className="font-semibold text-amber-600"> · {reviewCount} à revoir</span>}
                    </p>
                  </div>
                  <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-brand-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full border border-zinc-200 bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-300"
                    style={{ width: `${learnedPercent}%` }}
                  />
                </div>
              </button>

              <div
                id={`surah-${surah.key}-verses`}
                aria-hidden={!isExpanded}
                inert={!isExpanded}
                className={`grid transition-all duration-300 ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden">
                  <div className="divide-y divide-zinc-100 border-t border-zinc-200 bg-zinc-50/40">
                    {surah.verses.map((verse) => {
                      const isAcquired = verse.status === 'acquis';
                      const verseKey = `${surah.number}:${verse.ayahNumber}`;

                      return (
                        <div key={verseKey} className="px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-bold text-zinc-700">Verset {verse.ayahNumber}</span>
                            <button
                              type="button"
                              disabled={pendingVerse !== null}
                              onClick={() => saveStatus(
                                surah.number,
                                verse.ayahNumber,
                                isAcquired ? 'a_reviser' : 'acquis',
                                surah.name
                              )}
                              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-all duration-300 disabled:opacity-50 ${
                                isAcquired
                                  ? 'border-brand-100 bg-brand-50 text-brand-600'
                                  : 'border-amber-200 bg-amber-50 text-amber-700'
                              }`}
                            >
                              {isAcquired ? <Check className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                              {isAcquired ? 'Acquis' : 'À réviser'}
                            </button>
                          </div>
                          <p className="quran-arabic mt-3 line-clamp-2 text-right text-lg leading-loose text-zinc-900">
                            {verse.ayah.text}
                          </p>
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                            {verse.ayah.translation}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {isSessionOpen && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Session de révision active"
          className="fixed inset-0 z-[100] flex flex-col bg-[#f6f8f5] text-zinc-800"
        >
          <header className="shrink-0 border-b border-zinc-200 bg-white px-5 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-brand-500">Session de révision</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {sessionComplete ? 'Terminée' : `${sessionIndex + 1} / ${sessionQueue.length}`}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fermer la session"
                onClick={() => setIsSessionOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition-all duration-300 hover:bg-zinc-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-300"
                style={{ width: `${sessionQueue.length ? Math.min((sessionIndex / sessionQueue.length) * 100, 100) : 0}%` }}
              />
            </div>
          </header>

          {sessionComplete ? (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-500">
                <Check className="h-8 w-8" />
              </div>
              <h3 className="mt-6 text-2xl font-semibold">Session terminée</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">Les versets encore fragiles restent prêts pour votre prochaine session.</p>
              <button
                type="button"
                onClick={() => setIsSessionOpen(false)}
                className="mt-8 min-h-12 rounded-xl bg-brand-500 px-8 text-sm font-bold text-white shadow-sm transition-all duration-300 hover:bg-brand-600"
              >
                Retour aux sourates
              </button>
            </div>
          ) : currentVerse && (
            <>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-4">
                <div className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-5 text-center shadow-sm sm:p-8">
                  <p className="text-xs font-semibold text-brand-500">{currentVerse.surahName} · Verset {currentVerse.ayahNumber}</p>
                  <p className="quran-arabic mt-7 text-[clamp(1.8rem,7vw,3rem)] leading-[2.15] text-zinc-900">
                    {currentVerse.ayah.text}
                  </p>
                  <div className="mx-auto mt-7 h-px w-16 bg-brand-200" />
                  <p className="mt-6 text-sm italic leading-relaxed text-zinc-700">{currentVerse.ayah.transliteration}</p>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-500">{currentVerse.ayah.translation}</p>
                  <button
                    type="button"
                    onClick={() => toggleAudio().catch(() => setIsAudioPlaying(false))}
                    className={`mx-auto mt-7 flex min-h-11 items-center gap-2 rounded-full border px-4 text-xs font-semibold transition-all duration-300 ${
                      isAudioPlaying
                        ? 'border-brand-200 bg-brand-50 text-brand-600'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    {isAudioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    Audio en boucle · {REVIEW_RECITER}
                  </button>
                  <audio ref={audioRef} src={audioUrl} preload="none" />
                </div>
              </div>

              <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-zinc-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-6">
                <button
                  type="button"
                  onClick={advanceSession}
                  disabled={pendingVerse !== null}
                  className="min-h-16 rounded-xl border border-red-200 bg-red-50 px-3 text-base font-bold text-red-700 transition-all duration-300 active:scale-[0.98] disabled:opacity-50"
                >
                  À revoir
                </button>
                <button
                  type="button"
                  onClick={() => handlePerfect().catch(() => undefined)}
                  disabled={pendingVerse !== null}
                  className="min-h-16 rounded-xl bg-brand-500 px-3 text-base font-bold text-white shadow-sm transition-all duration-300 hover:bg-brand-600 active:scale-[0.98] disabled:opacity-50"
                >
                  Parfait
                </button>
              </footer>
            </>
          )}
        </div>,
        document.body
      )}
    </section>
  );
}
