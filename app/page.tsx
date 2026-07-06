'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import {
  findAdjacentAyah,
  markAyahAsLearned,
  normalizeProgressionForToday,
  toggleRevisedAyahForToday,
  type Ayah,
  type Progression,
  type QuranData,
  type Surah
} from '@/lib/progression';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  SkipBack, 
  CheckCircle2, 
  Settings, 
  BookOpen, 
  Check, 
  Bell, 
  Volume2, 
  Flame, 
  RefreshCw, 
  Info,
  Smartphone,
  ChevronDown
} from 'lucide-react';

const BASMALAH_ARABIC = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
const BASMALAH_TRANSLITERATION = 'Bismillah arrahmani rahim';
const RECITER_NAME = 'Sheikh Mahmoud Khalil Al-Husary';
const RECITER_AUDIO_FOLDER = 'Husary_128kbps';

const splitOpeningBasmala = (ayah?: Ayah) => {
  const text = ayah?.text?.replace(/^\uFEFF/, '').trim() || '';
  const shouldSplit = ayah?.numberInSurah === 1 && text.startsWith(BASMALAH_ARABIC);

  if (!shouldSplit) {
    return {
      basmala: null,
      verseText: text
    };
  }

  return {
    basmala: BASMALAH_ARABIC,
    verseText: text.slice(BASMALAH_ARABIC.length).trim()
  };
};

// --- Base64 to Uint8Array helper for VAPID subscription ---
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function MemoriqDashboard() {
  // --- States ---
  const [quran, setQuran] = useState<QuranData | null>(null);
  const [progression, setProgression] = useState<Progression>({
    current_memorizing: { surah: 1, ayah: 1 },
    learned_ayahs: [],
    streak: 0,
    last_active_date: '',
    notification_time: '13:00',
    push_subscription: null,
    revised_today: []
  });
  
  const [activeTab, setActiveTab] = useState<'learn' | 'review' | 'settings'>('learn');
  const [loadingQuran, setLoadingQuran] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  
  // Audio states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [audioProgress, setAudioProgress] = useState(0);
  
  // Selector states
  const [selectedSurahIndex, setSelectedSurahIndex] = useState(0);
  const [selectedAyahIndex, setSelectedAyahIndex] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState<'surah' | 'ayah' | null>(null);

  // Push notifications states
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string>('');
  const [notifHour, setNotifHour] = useState('13:00');

  // Audio HTML Element Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function showTemporaryStatus(msg: string) {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  }

  async function checkPushSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
      
      const keyRes = await fetch('/api/push-subscription');
      if (keyRes.ok) {
        const keyData = await keyRes.json();
        setVapidPublicKey(keyData.publicKey);
      }
    } catch (e) {
      console.warn('Push manager subscription check failed:', e);
    }
  }

  // --- Initial Load ---
  useEffect(() => {
    const loadQuranData = async () => {
      try {
        setLoadingQuran(true);
        const res = await fetch('/data/quran.json');
        if (!res.ok) throw new Error('Failed to load Quran text data.');
        const data = await res.json();
        setQuran(data);
      } catch (err) {
        console.error(err);
        showTemporaryStatus('Erreur de chargement du texte du Coran.');
      } finally {
        setLoadingQuran(false);
      }
    };

    const loadProgression = async () => {
      try {
        const res = await fetch('/api/progression');
        if (res.ok) {
          const data: Progression = await res.json();
          
          const processedData = normalizeProgressionForToday(data);

          setProgression(processedData);
          setNotifHour(processedData.notification_time || '13:00');

          if (data.current_memorizing) {
            setSelectedSurahIndex((data.current_memorizing.surah || 1) - 1);
            setSelectedAyahIndex((data.current_memorizing.ayah || 1) - 1);
          }
        }
      } catch (err) {
        console.error('Error fetching progression from API:', err);
      }
    };

    loadQuranData();
    loadProgression();

    const initializePushSupport = async () => {
      if (typeof window === 'undefined') return;
      const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window;
      setIsPushSupported(pushSupported);
      if (pushSupported) {
        checkPushSubscription();
      }
    };

    initializePushSupport();
  }, []);

  const currentSurah = quran?.surahs[selectedSurahIndex];
  const currentAyah = currentSurah?.ayahs[selectedAyahIndex];
  const learnedCount = progression.learned_ayahs.length;
  const revisedCount = progression.revised_today?.length || 0;
  const revisionPercent = learnedCount > 0 ? Math.round((revisedCount / learnedCount) * 100) : 0;
  const displayedAyah = splitOpeningBasmala(currentAyah);

  const audioUrl = currentSurah && currentAyah 
    ? `https://everyayah.com/data/${RECITER_AUDIO_FOLDER}/${String(currentSurah.number).padStart(3, '0')}${String(currentAyah.numberInSurah).padStart(3, '0')}.mp3` 
    : '';

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load();
      setAudioProgress(0);
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    }
  }, [audioUrl]);

  const saveProgression = async (updated: Progression) => {
    setSyncing(true);
    try {
      const res = await fetch('/api/progression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        const result = await res.json();
        setProgression(result.data);
      } else {
        throw new Error('Sync failed');
      }
    } catch (e) {
      console.error('Failed to sync progression:', e);
      showTemporaryStatus('Mise à jour locale effectuée. Erreur de synchronisation.');
    } finally {
      setSyncing(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => showTemporaryStatus('Erreur de lecture audio.'));
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    if (isLooping && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else {
      setIsPlaying(false);
      setAudioProgress(100);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const duration = audioRef.current.duration;
    if (duration > 0) {
      setAudioProgress((current / duration) * 100);
    }
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const duration = audioRef.current.duration;
    if (duration > 0) {
      audioRef.current.currentTime = percentage * duration;
      setAudioProgress(percentage * 100);
    }
  };

  const navigateAyah = (direction: 'next' | 'prev') => {
    if (!quran) return;

    const nextTarget = findAdjacentAyah(quran, selectedSurahIndex, selectedAyahIndex, direction);
    if (!nextTarget) {
      if (direction === 'next') {
        showTemporaryStatus('Dernier verset du Coran atteint !');
      }
      return;
    }

    setSelectedSurahIndex(nextTarget.surahIndex);
    setSelectedAyahIndex(nextTarget.ayahIndex);
  };

  const markAsLearned = () => {
    if (!currentSurah || !currentAyah || !quran) return;

    const updatedProgression = markAyahAsLearned(progression, quran, currentSurah, currentAyah);
    const nextSurah = updatedProgression.current_memorizing.surah;
    const nextAyah = updatedProgression.current_memorizing.ayah;

    if (nextSurah === currentSurah.number && nextAyah === currentAyah.numberInSurah) {
      showTemporaryStatus('Félicitations ! Vous avez fini le Coran.');
    }

    saveProgression(updatedProgression);
    showTemporaryStatus('Verset marqué comme appris.');
    
    setSelectedSurahIndex(nextSurah - 1);
    setSelectedAyahIndex(nextAyah - 1);
  };

  const toggleRevisedToday = (surahNum: number, ayahNum: number) => {
    saveProgression(toggleRevisedAyahForToday(progression, { surah: surahNum, ayah: ayahNum }));
  };

  const clearRevisions = () => {
    const updated = {
      ...progression,
      revised_today: []
    };
    saveProgression(updated);
  };

  const toggleNotifications = async () => {
    if (!isPushSupported) return;

    try {
      const registration = await navigator.serviceWorker.ready;

      if (isSubscribed) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          
          await fetch('/api/push-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: null })
          });

          setIsSubscribed(false);
          const updated = { ...progression, push_subscription: null };
          setProgression(updated);
          showTemporaryStatus('Rappels désactivés.');
        }
      } else {
        if (!vapidPublicKey) {
          showTemporaryStatus('Clé VAPID manquante. Veuillez réessayer.');
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          showTemporaryStatus('Notifications bloquées par l\'appareil.');
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });

        await fetch('/api/push-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        });

        setIsSubscribed(true);
        const updated = { ...progression, push_subscription: subscription };
        setProgression(updated);
        showTemporaryStatus('Rappels activés.');
      }
    } catch (e: unknown) {
      console.error('Error toggling notifications:', e);
      const message = e instanceof Error ? e.message : 'Échec de configuration';
      showTemporaryStatus(`Erreur : ${message}`);
    }
  };

  const handleSaveNotifHour = async () => {
    const updated = {
      ...progression,
      notification_time: notifHour
    };
    await saveProgression(updated);
    showTemporaryStatus(`Heure enregistrée : ${notifHour}`);
  };

  const handleTestNotification = async () => {
    if (!isPushSupported) {
      showTemporaryStatus('Notifications indisponibles sur cet appareil.');
      return;
    }

    if (!isSubscribed) {
      showTemporaryStatus('Activez d’abord le rappel quotidien.');
      return;
    }

    setTestingNotification(true);
    try {
      const res = await fetch('/api/push-subscription/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.status === 410) {
        setIsSubscribed(false);
        const updated = { ...progression, push_subscription: null };
        setProgression(updated);
        showTemporaryStatus('Inscription expirée. Réactivez les notifications.');
        return;
      }

      if (!res.ok) {
        throw new Error('Test notification failed');
      }

      showTemporaryStatus('Notification de test envoyée.');
    } catch (error) {
      console.error('Failed to send test notification:', error);
      showTemporaryStatus('Impossible d’envoyer la notification de test.');
    } finally {
      setTestingNotification(false);
    }
  };

  const getAyahDetails = (surahNum: number, ayahNum: number) => {
    if (!quran) return null;
    const surah = quran.surahs.find(s => s.number === surahNum);
    const ayah = surah?.ayahs.find(a => a.numberInSurah === ayahNum);
    return {
      surahName: surah?.englishName || '',
      surahArabicName: surah?.name || '',
      ayahText: ayah?.text || '',
      translation: ayah?.translation || ''
    };
  };

  if (loadingQuran) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f6f8f5]">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border border-zinc-200 border-t-[#2d6a4f] rounded-full animate-spin mb-4"></div>
          <h1 className="text-sm font-semibold tracking-widest text-[#1b4332] uppercase">Memoriq</h1>
          <p className="text-xs text-zinc-500 mt-1">Préparation du texte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full max-w-md h-[100dvh] min-h-[100dvh] lg:h-auto lg:max-w-7xl lg:my-6 lg:min-h-[calc(100vh-3rem)] mx-auto bg-white shadow-xl lg:shadow-2xl border-x lg:border border-zinc-200/50 lg:rounded-2xl relative overflow-hidden">
      
      {/* Header */}
      <header className="z-20 shrink-0 px-5 lg:px-8 pt-[calc(1rem+env(safe-area-inset-top))] lg:pt-5 pb-4 flex items-center justify-between border-b border-zinc-100 bg-white">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center overflow-hidden shadow-sm">
            <Image
              src="/memoriq-logo.svg"
              alt="Logo Memoriq"
              width={36}
              height={36}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wider text-[#1e2522] font-sans">MEMORIQ</h1>
            <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-semibold">Mémorisation Solo</p>
          </div>
        </div>

        {/* Streak counter */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-100/65">
          <Flame className="w-3.5 h-3.5 text-brand-500 fill-brand-500/10" />
          <span className="text-xs font-semibold text-brand-600">{progression.streak} {progression.streak > 1 ? 'jours' : 'jour'}</span>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-h-0 lg:grid lg:grid-cols-[240px_minmax(0,1fr)_300px] lg:overflow-hidden bg-[#f6f8f5]">
        <aside className="hidden lg:flex flex-col gap-4 border-r border-zinc-200/80 bg-white/75 px-5 py-5 overflow-y-auto">
          <div className="space-y-2">
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Navigation</span>
            <button
              onClick={() => setActiveTab('learn')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                activeTab === 'learn' ? 'bg-brand-50 text-brand-600 border border-brand-100' : 'text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Apprendre
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                activeTab === 'review' ? 'bg-brand-50 text-brand-600 border border-brand-100' : 'text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Réviser
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                activeTab === 'settings' ? 'bg-brand-50 text-brand-600 border border-brand-100' : 'text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              <Settings className="w-4 h-4" />
              Réglages
            </button>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
            <div>
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Progression</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-brand-50 border border-brand-100 p-3">
                  <span className="block text-xl font-bold text-brand-600">{learnedCount}</span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Appris</span>
                </div>
                <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3">
                  <span className="block text-xl font-bold text-zinc-800">{revisedCount}</span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Révisés</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1.5">
                <span>Aujourd&apos;hui</span>
                <span>{revisionPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200">
                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${revisionPercent}%` }}></div>
              </div>
            </div>
          </div>
        </aside>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-5 pb-[calc(6.75rem+env(safe-area-inset-bottom))] lg:px-8 lg:py-6 z-10 space-y-4 bg-[#f6f8f5]">
        
        {/* Sync Status Banner */}
        {syncing && (
          <div className="py-2 px-3 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center space-x-2">
            <RefreshCw className="w-3 h-3 text-brand-500 animate-spin" />
            <span className="text-[11px] text-brand-600 font-medium">Synchronisation en cours...</span>
          </div>
        )}

        {/* Temporary Alerts */}
        {statusMessage && (
          <div className="py-2 px-3 rounded-lg bg-white text-zinc-700 border border-zinc-200 text-[11px] text-center font-semibold shadow-sm">
            {statusMessage}
          </div>
        )}

        {/* TAB 1: LEARN */}
        {activeTab === 'learn' && (
          <div className="space-y-4 lg:max-w-3xl lg:mx-auto">
            
            {/* Target Selectors */}
            <div className="bg-white border border-zinc-200/80 rounded-xl p-4 space-y-3 shadow-sm">
              <div className="text-[9px] text-brand-500 font-bold uppercase tracking-wider">Objectif en cours</div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Surah dropdown selector */}
                <div className="relative flex-1">
                  <button 
                    onClick={() => setDropdownOpen(dropdownOpen === 'surah' ? null : 'surah')}
                    className="w-full bg-brand-50/50 border border-brand-100 rounded-lg px-3 py-2 text-left text-xs font-semibold text-zinc-800 flex items-center justify-between hover:bg-brand-50 transition"
                  >
                    <span className="truncate">{currentSurah ? `${currentSurah.number}. ${currentSurah.englishName}` : 'Sélectionner'}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-brand-500" />
                  </button>
                  {dropdownOpen === 'surah' && quran && (
                    <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-zinc-200 rounded-lg shadow-xl z-20">
                      {quran.surahs.map((s, idx) => (
                        <button
                          key={s.number}
                          onClick={() => {
                            setSelectedSurahIndex(idx);
                            setSelectedAyahIndex(0);
                            setDropdownOpen(null);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-brand-50 ${selectedSurahIndex === idx ? 'text-brand-600 font-bold bg-brand-50/50' : 'text-zinc-700'}`}
                        >
                          {s.number}. {s.englishName} ({s.name})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ayah dropdown selector */}
                <div className="relative sm:w-32">
                  <button 
                    onClick={() => setDropdownOpen(dropdownOpen === 'ayah' ? null : 'ayah')}
                    className="w-full bg-brand-50/50 border border-brand-100 rounded-lg px-3 py-2 text-left text-xs font-semibold text-zinc-800 flex items-center justify-between hover:bg-brand-50 transition"
                  >
                    <span className="truncate">Verset {selectedAyahIndex + 1}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-brand-500" />
                  </button>
                  {dropdownOpen === 'ayah' && currentSurah && (
                    <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-zinc-200 rounded-lg shadow-xl z-20">
                      {currentSurah.ayahs.map((a, idx) => (
                        <button
                          key={a.number}
                          onClick={() => {
                            setSelectedAyahIndex(idx);
                            setDropdownOpen(null);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-brand-50 ${selectedAyahIndex === idx ? 'text-brand-600 font-bold bg-brand-50/50' : 'text-zinc-700'}`}
                        >
                          Verset {a.numberInSurah}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SCRIPTURE CARD (Clean Light, High Readability) */}
            <div className="bg-white border border-[#e1e7e3] rounded-xl p-6 lg:p-8 shadow-sm flex flex-col space-y-6">
              
              {/* Surah Title details */}
              <div className="text-center border-b border-zinc-100 pb-4">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">{currentSurah?.englishName}</span>
                <span className="quran-arabic text-brand-500 text-xl block mt-1">{currentSurah?.name}</span>
                <span className="text-[9px] text-zinc-450 uppercase tracking-wider block mt-1.5">Sourate {currentSurah?.number} • Verset {currentAyah?.numberInSurah}</span>
              </div>

              {/* Arabic verse text */}
              <div className="text-center py-2 space-y-5">
                {displayedAyah.basmala && (
                  <div className="pb-5 border-b border-zinc-100">
                    <p className="quran-arabic text-2xl lg:text-3xl text-brand-600 leading-relaxed text-center font-bold tracking-normal">
                      {displayedAyah.basmala}
                    </p>
                    <p className="text-[11px] lg:text-xs text-zinc-500 font-semibold italic mt-1">
                      {BASMALAH_TRANSLITERATION}
                    </p>
                  </div>
                )}
                {displayedAyah.verseText && (
                  <p className="quran-arabic text-3xl lg:text-4xl text-brand-900 leading-relaxed text-center font-bold tracking-normal">
                    {displayedAyah.verseText}
                  </p>
                )}
              </div>

              {/* Phonetics & Translation */}
              <div className="border-t border-zinc-100 pt-5 space-y-4">
                
                {/* Phonetics */}
                <div className="space-y-1 bg-brand-50/30 p-3 rounded-lg border border-brand-100/50">
                  <span className="text-[9px] text-brand-600 font-bold uppercase tracking-wider block">Phonétique</span>
                  <p className="text-xs font-semibold text-zinc-800 leading-relaxed italic">
                    {currentAyah?.transliteration}
                  </p>
                </div>

                {/* French Translation */}
                <div className="space-y-1 bg-brand-50/30 p-3 rounded-lg border border-brand-100/50">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Traduction</span>
                  <p className="text-xs font-medium text-zinc-800 leading-relaxed">
                    {currentAyah?.translation}
                  </p>
                </div>
              </div>
            </div>

            {/* AUDIO CONTROL BOX */}
            <div className="bg-white border border-zinc-200/80 rounded-xl p-4 space-y-3.5 shadow-sm">
              
              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onEnded={handleAudioEnded}
                  onTimeUpdate={handleTimeUpdate}
                  className="hidden"
                />
              )}

              {/* Progress bar */}
              <div 
                onClick={handleScrub}
                className="h-2 w-full bg-zinc-100 border border-zinc-200 rounded-full cursor-pointer overflow-hidden relative"
              >
                <div 
                  className="h-full bg-brand-500 rounded-full transition-all duration-75"
                  style={{ width: `${audioProgress}%` }}
                ></div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-[2.75rem_1fr] gap-3 sm:flex sm:items-center sm:justify-between">
                
                {/* Loop Button */}
                <button
                  onClick={() => setIsLooping(!isLooping)}
                  className={`w-14 h-14 sm:w-10 sm:h-10 rounded-xl sm:rounded-lg border text-xs font-semibold transition-all flex items-center justify-center justify-self-start ${
                    isLooping 
                      ? 'bg-brand-100 text-brand-600 border-brand-200' 
                      : 'text-zinc-400 border-zinc-200 bg-transparent hover:text-zinc-650'
                  }`}
                >
                  <RotateCcw className="w-5 h-5 sm:w-4 sm:h-4" />
                </button>

                {/* Player button row */}
                <div className="flex items-center justify-center space-x-2">
                  <button
                    onClick={() => navigateAyah('prev')}
                    className="p-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition"
                  >
                    <SkipBack className="w-3.5 h-3.5 fill-current" />
                  </button>

                  <button
                    onClick={togglePlay}
                    className="p-3.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white transition-all transform active:scale-95 shadow-sm"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                  </button>

                  <button
                    onClick={() => navigateAyah('next')}
                    className="p-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition"
                  >
                    <SkipForward className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>

                {/* Audio label info */}
                <div className="col-span-2 text-left sm:text-right sm:max-w-[8.5rem] lg:max-w-none border-t border-zinc-100 sm:border-t-0 pt-2 sm:pt-0">
                  <span className="text-[8px] text-zinc-400 uppercase tracking-widest font-bold block">Récitateur</span>
                  <span className="text-[10px] text-zinc-700 font-medium inline-flex items-center sm:justify-end mt-0.5 leading-tight">
                    <Volume2 className="w-3 h-3 mr-1 text-zinc-450" /> {RECITER_NAME}
                  </span>
                </div>
              </div>
            </div>

            {/* LEARN ACTION BUTTON */}
            <button
              onClick={markAsLearned}
              className="w-full py-3.5 px-6 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs tracking-wider uppercase flex items-center justify-center space-x-2 transition-all border border-brand-700/10 shadow-sm"
            >
              <CheckCircle2 className="w-4.5 h-4.5 text-white fill-current" />
              <span>Marquer comme appris</span>
            </button>

          </div>
        )}

        {/* TAB 2: REVIEW */}
        {activeTab === 'review' && (
          <div className="space-y-4 lg:max-w-4xl lg:mx-auto">
            
            {/* Statistics box */}
            <div className="bg-white border border-zinc-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Programme de révision</h3>
                <p className="text-[10px] text-zinc-500 mt-1">Cochez manuellement les versets revus.</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-brand-600">
                  {progression.revised_today?.length || 0} / {progression.learned_ayahs.length}
                </span>
                <span className="text-[8px] text-zinc-500 block uppercase tracking-wider mt-0.5">Révisés</span>
              </div>
            </div>

            {/* Learned checklist */}
            {progression.learned_ayahs.length === 0 ? (
              <div className="bg-white border border-dashed border-zinc-250 rounded-xl p-8 text-center space-y-2 shadow-sm">
                <BookOpen className="w-6 h-6 text-zinc-400 mx-auto" />
                <p className="text-zinc-500 text-xs font-semibold">Aucun verset mémorisé.</p>
                <p className="text-[9px] text-zinc-450">Commencez par valider vos objectifs dans l&apos;onglet principal.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Versets Mémorisés ({progression.learned_ayahs.length})</span>
                  {(progression.revised_today?.length || 0) > 0 && (
                    <button 
                      onClick={clearRevisions}
                      className="text-[9px] text-[#2d6a4f] hover:text-[#1b4332] font-semibold underline bg-transparent border-none cursor-pointer"
                    >
                      Tout décocher
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-[360px] lg:max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
                  {progression.learned_ayahs.map((learned, idx) => {
                    const details = getAyahDetails(learned.surah, learned.ayah);
                    const isRevised = progression.revised_today?.some(
                      r => r.surah === learned.surah && r.ayah === learned.ayah
                    ) || false;

                    if (!details) return null;

                    return (
                      <div 
                        key={idx}
                        onClick={() => toggleRevisedToday(learned.surah, learned.ayah)}
                        className={`p-3.5 rounded-lg border flex items-start space-x-3 cursor-pointer transition-all ${
                          isRevised 
                            ? 'bg-brand-50/60 border-brand-200' 
                            : 'bg-white border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isRevised 
                            ? 'bg-brand-500 border-brand-500 text-white' 
                            : 'border-zinc-300 bg-transparent text-transparent'
                        }`}>
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <span className={`text-xs font-bold ${isRevised ? 'text-brand-600' : 'text-zinc-800'}`}>
                              Sourate {details.surahName}
                            </span>
                            <span className="text-[9px] text-zinc-400">
                              Verset {learned.ayah}
                            </span>
                          </div>
                          
                          <p className="text-[11px] text-brand-900 mt-1 truncate quran-arabic text-right leading-normal">
                            {details.ayahText}
                          </p>

                          <p className="text-[10px] text-zinc-555 mt-1 truncate">
                            {details.translation}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-4 lg:max-w-2xl lg:mx-auto">
            
            {/* Push Notifications Configuration */}
            <div className="bg-white border border-zinc-200 rounded-xl p-4.5 space-y-3.5 shadow-sm">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-brand-50 border border-brand-100 text-brand-500">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">Notifications de Rappel</h3>
                  <p className="text-[10px] text-zinc-400">Rappels quotidiens direct sur votre appareil.</p>
                </div>
              </div>

              {/* Status block */}
              <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-555">Compatibilité :</span>
                  <span className={isPushSupported ? 'text-green-600 font-semibold' : 'text-brand-600 font-semibold'}>
                    {isPushSupported ? 'Oui' : 'Indisponible'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-555">État d&apos;inscription :</span>
                  <span className={isSubscribed ? 'text-green-600 font-semibold' : 'text-zinc-400 font-semibold'}>
                    {isSubscribed ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              </div>

              {/* Installation notice for Safari */}
              {!isPushSupported && (
                <div className="p-2.5 rounded-lg bg-brand-50 border border-brand-100 text-[10px] text-brand-700 flex items-start space-x-2">
                  <Info className="w-3.5 h-3.5 mr-1 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Sur iPhone (iOS 16.4+), configurez l&apos;application en <strong>l&apos;ajoutant sur l&apos;écran d&apos;accueil</strong> Safari pour activer le push.
                  </p>
                </div>
              )}

              {/* Button */}
              {isPushSupported && (
                <div className="space-y-2">
                  <button
                    onClick={toggleNotifications}
                    className={`w-full py-2 px-3 rounded-lg font-bold text-xs tracking-wider uppercase transition flex items-center justify-center space-x-2 ${
                      isSubscribed
                        ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300'
                        : 'bg-brand-500 hover:bg-brand-600 text-white'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>{isSubscribed ? 'Désactiver les notifications' : 'Activer le rappel quotidien'}</span>
                  </button>

                  <button
                    onClick={handleTestNotification}
                    disabled={!isSubscribed || testingNotification}
                    className="w-full py-2 px-3 rounded-lg font-bold text-xs tracking-wider uppercase transition flex items-center justify-center space-x-2 bg-white text-brand-600 border border-brand-200 disabled:text-zinc-350 disabled:border-zinc-200 disabled:bg-zinc-50 disabled:cursor-not-allowed"
                  >
                    {testingNotification ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Bell className="w-3.5 h-3.5" />
                    )}
                    <span>{testingNotification ? 'Envoi du test...' : 'Tester la notification iPhone'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Time Picker */}
            <div className="bg-white border border-zinc-200 rounded-xl p-4.5 space-y-3 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800">Heure du Rappel</h3>
              <p className="text-[10px] text-zinc-500">Choisissez l&apos;heure de réception de votre rappel quotidien.</p>

              <div className="flex space-x-2">
                <input 
                  type="time" 
                  value={notifHour}
                  onChange={(e) => setNotifHour(e.target.value)}
                  className="bg-white border border-zinc-250 rounded-lg px-3 py-1.5 text-xs text-zinc-800 font-semibold focus:outline-none focus:border-brand-300 flex-1"
                />
                
                <button 
                  onClick={handleSaveNotifHour}
                  className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold uppercase tracking-wider transition"
                >
                  Enregistrer
                </button>
              </div>
            </div>

            {/* iOS installation guides */}
            <div className="bg-white border border-zinc-200 rounded-xl p-4.5 space-y-2.5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center space-x-1.5">
                <Smartphone className="w-3.5 h-3.5 text-brand-500" />
                <span>Installer sur iOS (iPhone)</span>
              </h3>
              <ol className="list-decimal list-inside text-[10px] text-zinc-500 space-y-1.5 leading-relaxed">
                <li>Ouvrez <strong>Safari</strong> sur votre mobile.</li>
                <li>Appuyez sur l&apos;icône <strong>Partager</strong> <span className="inline-block px-1 bg-zinc-100 rounded text-[9px] border border-zinc-200">Partager</span>.</li>
                <li>Sélectionnez <strong>Sur l&apos;écran d&apos;accueil</strong>.</li>
                <li>Lancez <strong>Memoriq</strong> depuis votre écran d&apos;accueil pour l&apos;utiliser en plein écran hors-ligne.</li>
              </ol>
            </div>

            {/* Technical block */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 text-[9px] text-zinc-500 space-y-1 font-mono">
              <div className="font-bold text-zinc-500 mb-1 uppercase tracking-wider">Informations Techniques</div>
              <div>VAPID : {vapidPublicKey ? `${vapidPublicKey.substring(0, 16)}...` : 'Actif en local'}</div>
              <div>Database : Vercel Blob + fallback JSON</div>
              <div>Audio Feed : everyayah.com ({RECITER_NAME})</div>
            </div>

          </div>
        )}

      </main>

        <aside className="hidden lg:flex flex-col gap-4 border-l border-zinc-200/80 bg-white/75 px-5 py-5 overflow-y-auto">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Objectif actuel</span>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-800 truncate">{currentSurah?.englishName || 'Sourate'}</p>
                  <p className="quran-arabic text-lg text-brand-500 leading-none mt-1">{currentSurah?.name}</p>
                </div>
                <div className="shrink-0 rounded-lg bg-brand-50 border border-brand-100 px-3 py-2 text-center">
                  <span className="block text-base font-bold text-brand-600">{currentAyah?.numberInSurah || 1}</span>
                  <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Verset</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                La version PC affiche les contrôles, la révision et les statistiques sans empiler toute l&apos;interface en format mobile.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Session</span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Série</span>
                <span className="font-bold text-brand-600">{progression.streak} {progression.streak > 1 ? 'jours' : 'jour'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Rappel</span>
                <span className="font-bold text-zinc-800">{progression.notification_time || notifHour}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Audio</span>
                <span className="font-bold text-zinc-800">{isLooping ? 'Boucle' : 'Simple'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={markAsLearned}
            className="w-full py-3 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all border border-brand-700/10 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-white fill-current" />
            Valider ce verset
          </button>
        </aside>
      </div>

      {/* Navigation Tab Bar */}
      <nav className="z-30 fixed left-1/2 bottom-0 w-full max-w-md -translate-x-1/2 bg-white/95 backdrop-blur border-x border-t border-zinc-200/80 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex lg:hidden items-center justify-around shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
        <button
          onClick={() => setActiveTab('learn')}
          className={`flex flex-1 flex-col items-center space-y-1 py-1.5 px-2 rounded-lg transition ${
            activeTab === 'learn' ? 'text-brand-500 font-bold' : 'text-zinc-400 hover:text-zinc-650'
          }`}
        >
          <BookOpen className="w-4.5 h-4.5" />
          <span className="text-[10px] tracking-wide">Apprendre</span>
        </button>

        <button
          onClick={() => setActiveTab('review')}
          className={`flex flex-1 flex-col items-center space-y-1 py-1.5 px-2 rounded-lg transition ${
            activeTab === 'review' ? 'text-brand-500 font-bold' : 'text-zinc-400 hover:text-zinc-650'
          }`}
        >
          <CheckCircle2 className="w-4.5 h-4.5" />
          <span className="text-[10px] tracking-wide">Réviser</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-1 flex-col items-center space-y-1 py-1.5 px-2 rounded-lg transition ${
            activeTab === 'settings' ? 'text-brand-500 font-bold' : 'text-zinc-400 hover:text-zinc-650'
          }`}
        >
          <Settings className="w-4.5 h-4.5" />
          <span className="text-[10px] tracking-wide">Réglages</span>
        </button>
      </nav>
    </div>
  );
}
