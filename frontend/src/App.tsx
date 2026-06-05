// https://github.com/JackyZhang8/locknote
// 一个简单、可靠、离线优先的桌面加密笔记软件。
// A simple, reliable, offline-first encrypted note-taking desktop app.
import { useEffect, useState } from 'react';
import { useStore } from './store';
import { LockScreen } from './components/LockScreen';
import { MainLayout } from './components/MainLayout';
import { OnboardingScreen } from './components/OnboardingScreen';
import { SetupScreen } from './components/SetupScreen';
import { StartupProgressScreen } from './components/StartupProgressScreen';
import * as App from '../wailsjs/go/main/App';
import { EventsEmit, EventsOn } from '../wailsjs/runtime/runtime';

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

// Wait for Wails runtime to be ready. Windows cold starts can take longer on
// first launch while WebView2 and the Wails bridge warm up.
async function waitForWailsRuntime(): Promise<void> {
  const checkInterval = 100; // Check every 100ms

  for (;;) {
    if (isWailsRuntimeReady()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
}

const wailsRuntimeReady = waitForWailsRuntime();
const FIRST_RUN_STARTUP_MINIMUM_MS = 1400;

async function waitForCoreReady(onStatus?: (message: string) => void): Promise<void> {
  const retryDelay = 300;

  for (;;) {
    const ready = await App.IsCoreReady();
    if (ready) {
      return;
    }

    const startupError = await App.GetStartupError();
    if (startupError) {
      onStatus?.(`启动失败：${startupError}`);
    } else {
      onStatus?.('正在准备本地数据...');
    }

    await new Promise(resolve => setTimeout(resolve, retryDelay));
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
  const { isUnlocked, isFirstRun, setUnlocked, setFirstRun, setVersion, setDataDir } = useStore();
  const [loading, setLoading] = useState(true);
  const [startupMessage, setStartupMessage] = useState('正在启动应用核心...');
  const [startupProgress, setStartupProgress] = useState(8);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Only emit frontend:ready after runtime is ready
    const emitReady = async () => {
      await wailsRuntimeReady;
      EventsEmit('frontend:ready');
    };
    emitReady();
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
        await waitForCoreReady(setStartupMessage);

        setStartupMessage('正在读取本地数据...');
        setStartupProgress(68);
        const firstRun = await App.IsFirstRun();
        setFirstRun(firstRun);
        setShowOnboarding(firstRun);

        const unlocked = await App.IsUnlocked();
        setUnlocked(unlocked);

        setStartupProgress(84);
        const version = await App.GetVersion();
        setVersion(version);

        const dataDir = await App.GetDataDir();
        setDataDir(dataDir);

        if (firstRun) {
          setStartupMessage('正在初始化...');
        }
        setStartupProgress(92);
        await waitForMinimumStartupDisplay(startupStartedAt, firstRun);
        setStartupProgress(100);
        setLoading(false);
      } catch (error) {
        console.error('Init error:', error);
        // Retry on failure - WebView2 may still be initializing on Windows first run.
        setStartupMessage(`正在启动应用核心... (${retryCount + 1})`);
        setStartupProgress(12);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return init(retryCount + 1);
      }
    };

    init();
  }, [setFirstRun, setUnlocked, setVersion, setDataDir]);

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
          App.Lock()
            .then(() => {
              useStore.getState().setUnlocked(false);
            })
            .catch((error) => {
              console.error('Failed to lock:', error);
            });
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

  return <MainLayout />;
}

export default AppRoot;
