// https://github.com/JackyZhang8/locknote
// 一个简单、可靠、离线优先的桌面加密笔记软件。
// A simple, reliable, offline-first encrypted note-taking desktop app.
import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from './store';
import { LockScreen } from './components/LockScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { SetupScreen } from './components/SetupScreen';
import { StartupProgressScreen } from './components/StartupProgressScreen';
import * as App from '../wailsjs/go/main/App';
import { EventsEmit, EventsOn } from '../wailsjs/runtime/runtime';
import { flushEditor } from './editorFlush';
import { formatMessage, useI18n } from './i18n';

const loadMainLayout = () => import('./components/MainLayout');
const MainLayout = lazy(() => loadMainLayout().then((m) => ({ default: m.MainLayout })));

// Extend Window interface for Wails runtime
declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          IsFirstRun?: () => Promise<boolean>;
          IsCoreReady?: () => Promise<boolean>;
          GetStartupError?: () => Promise<string>;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
    runtime?: {
      EventsEmit?: (...args: unknown[]) => void;
      EventsOnMultiple?: (...args: unknown[]) => () => void;
      [key: string]: unknown;
    };
  }
}

// Helper function to check if Wails runtime is ready
function isWailsRuntimeReady(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.go !== undefined &&
    window.go.main !== undefined &&
    window.go.main.App !== undefined &&
    typeof window.go.main.App.IsFirstRun === 'function' &&
    window.runtime !== undefined &&
    typeof window.runtime.EventsEmit === 'function'
  );
}

async function waitForWailsRuntime(): Promise<void> {
  while (!isWailsRuntimeReady()) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

const wailsRuntimeReady = waitForWailsRuntime();
const FIRST_RUN_STARTUP_MINIMUM_MS = 1400;

async function waitForCoreReady(
  onStatus: ((message: string) => void) | undefined,
  messages: { preparingData: string; failed: string },
): Promise<void> {
  let preparationMessageShown = false;
  while (true) {
    const ready = await App.IsCoreReady();
    if (ready) return;
    const startupError = await App.GetStartupError();
    if (startupError) {
      onStatus?.(formatMessage(messages.failed, { error: startupError }));
      throw new Error(startupError);
    }
    if (!preparationMessageShown) {
      onStatus?.(messages.preparingData);
      preparationMessageShown = true;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

async function waitForMinimumStartupDisplay(startedAt: number, firstRun: boolean): Promise<void> {
  if (!firstRun) {
    return;
  }

  const remaining = FIRST_RUN_STARTUP_MINIMUM_MS - (Date.now() - startedAt);
  if (remaining <= 0) {
    return;
  }

  await new Promise(resolve => setTimeout(resolve, remaining));
}

// Throttle function to limit how often UpdateActivity is called
function throttle<T extends (...args: unknown[]) => void>(func: T, limit: number): T {
  let lastCall = 0;
  return ((...args: unknown[]) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      func(...args);
    }
  }) as T;
}

function AppRoot() {
  const { t } = useI18n();
  const { isUnlocked, isFirstRun, setUnlocked, setFirstRun, setVersion, setDataDir } = useStore();
  const [loading, setLoading] = useState(true);
  const [startupMessage, setStartupMessage] = useState(t.startup.starting);
  const [startupProgress, setStartupProgress] = useState(8);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!loading) {
      void loadMainLayout();
    }
  }, [loading]);

  useEffect(() => {
    const suppressDefaultContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    window.addEventListener('contextmenu', suppressDefaultContextMenu, { capture: true });
    return () => window.removeEventListener('contextmenu', suppressDefaultContextMenu, { capture: true });
  }, []);

  useEffect(() => {
    void wailsRuntimeReady
      .then(() => EventsEmit('frontend:ready'))
      .catch((error) => console.error('Failed to emit frontend readiness:', error));
  }, []);

  useEffect(() => {
    const init = async (retryCount = 0): Promise<void> => {
      const startupStartedAt = Date.now();
      const retryDelay = 500; // ms

      try {
        // First, wait for Wails runtime to be ready
        setStartupProgress(18);
        await wailsRuntimeReady;
        setStartupProgress(34);
        await waitForCoreReady(setStartupMessage, t.startup);

        setStartupMessage(t.startup.readingData);
        setStartupProgress(68);
        const firstRun = await App.IsFirstRun();
        setFirstRun(firstRun);
        setShowOnboarding(firstRun);

        setStartupProgress(84);
        const [unlocked, version, dataDir] = await Promise.all([
          App.IsUnlocked(),
          App.GetVersion(),
          App.GetDataDir(),
        ]);
        setUnlocked(unlocked);
        setVersion(version);
        setDataDir(dataDir);

        if (firstRun) {
          setStartupMessage(t.startup.initializing);
        }
        setStartupProgress(92);
        await waitForMinimumStartupDisplay(startupStartedAt, firstRun);
        setStartupProgress(100);
        setLoading(false);
      } catch (error) {
        console.error('Init error:', error);
        if (retryCount >= 120) {
          setStartupMessage(formatMessage(t.startup.failed, { error: String(error) }));
          setStartupProgress(100);
          return;
        }
        // Retry on failure - WebView2 may still be initializing on Windows first run.
        setStartupMessage(formatMessage(t.startup.retrying, { count: retryCount + 1 }));
        setStartupProgress(12);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return init(retryCount + 1);
      }
    };

    init();
  }, [setFirstRun, setUnlocked, setVersion, setDataDir, t.startup]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingTarget =
        tagName === 'input' || tagName === 'textarea' || (target?.isContentEditable ?? false);

      if (!isUnlocked || isTypingTarget) {
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        const key = e.key.toLowerCase();

        if (key === 'k') {
          e.preventDefault();
          useStore.getState().setCurrentView('search');
          return;
        }

        if (key === 'l') {
          e.preventDefault();
          void (async () => {
            try {
              await flushEditor();
              await App.Lock();
              useStore.getState().setUnlocked(false);
            } catch (error) {
              console.error('Failed to lock:', error);
            }
          })();
          return;
        }

        if (key === 'n') {
          e.preventDefault();
          App.CreateNote('新笔记', '')
            .then(async (note) => {
              const updatedNotes = await App.ListNotes();
              useStore.getState().setNotes(updatedNotes || []);
              useStore.getState().setSelectedNoteId(note.id);
              useStore.getState().setCurrentView('notes');
            })
            .catch((error) => {
              console.error('Failed to create note:', error);
            });
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUnlocked]);

  useEffect(() => {
    const offLocked = EventsOn('app:locked', () => {
      useStore.getState().setUnlocked(false);
    });

    return () => {
      offLocked();
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushEditor();
      }
    };
    const handleBlur = () => {
      void flushEditor();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    const offBeforeClose = EventsOn('app:before-close', async () => {
      await flushEditor();
      App.ConfirmClose().catch((error) => {
        console.error('Failed to confirm window close:', error);
      });
    });
    return () => {
      offBeforeClose();
    };
  }, []);

  // Track user activity to reset the idle lock timer
  useEffect(() => {
    if (!isUnlocked) {
      return;
    }

    // Throttle activity updates to once per 30 seconds to avoid excessive calls
    const throttledUpdateActivity = throttle(() => {
      App.UpdateActivity().catch((err) => {
        console.error('Failed to update activity:', err);
      });
    }, 30000);

    const handleActivity = () => {
      throttledUpdateActivity();
    };

    // Listen for various user activity events
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity, true);
    window.addEventListener('touchstart', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity, true);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [isUnlocked]);

  if (loading) {
    return (
      <StartupProgressScreen message={startupMessage} progress={startupProgress} />
    );
  }

  if (isFirstRun && showOnboarding) {
    return <OnboardingScreen onStart={() => setShowOnboarding(false)} />;
  }

  if (isFirstRun) {
    return <SetupScreen />;
  }

  if (!isUnlocked) {
    return <LockScreen />;
  }

  return (
    <Suspense fallback={<div className="h-screen bg-background" />}>
      <MainLayout />
    </Suspense>
  );
}

export default AppRoot;
