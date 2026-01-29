// https://github.com/JackyZhang8/locknote
// 一个简单、可靠、离线优先的桌面加密笔记软件。
// A simple, reliable, offline-first encrypted note-taking desktop app.
import { useEffect, useState } from 'react';
import { useStore } from './store';
import { LockScreen } from './components/LockScreen';
import { SetupScreen } from './components/SetupScreen';
import { MainLayout } from './components/MainLayout';
import * as App from './wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';

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

  useEffect(() => {
    const init = async (retryCount = 0): Promise<void> => {
      const maxRetries = 5;
      const retryDelay = 500; // ms

      try {
        const firstRun = await App.IsFirstRun();
        setFirstRun(firstRun);

        const unlocked = await App.IsUnlocked();
        setUnlocked(unlocked);

        const version = await App.GetVersion();
        setVersion(version);

        const dataDir = await App.GetDataDir();
        setDataDir(dataDir);

        setLoading(false);
      } catch (error) {
        console.error('Init error:', error);
        // Retry on failure - WebView2 may still be initializing on Windows first run
        if (retryCount < maxRetries) {
          console.log(`Retrying initialization (${retryCount + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return init(retryCount + 1);
        }
        // After max retries, still set loading to false to show error state
        setLoading(false);
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
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
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
