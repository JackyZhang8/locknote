import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, FileText, Image, ListTodo, ShieldCheck } from 'lucide-react';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import { useI18n } from '../i18n';
import { useStore } from '../store';
import appIcon from '../assets/app-icon.png';

interface OnboardingScreenProps {
  onStart: () => void;
}

const onboardingSlides = [
  { icon: ShieldCheck, titleKey: 'secureTitle', descKey: 'secureDesc' },
  { icon: FileText, titleKey: 'notesTitle', descKey: 'notesDesc' },
  { icon: ListTodo, titleKey: 'todosTitle', descKey: 'todosDesc' },
  { icon: CalendarDays, titleKey: 'calendarTitle', descKey: 'calendarDesc' },
  { icon: Image, titleKey: 'imagesTitle', descKey: 'imagesDesc' },
] as const;

export function OnboardingScreen({ onStart }: OnboardingScreenProps) {
  const { version } = useStore();
  const { t } = useI18n();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = onboardingSlides[activeIndex];
  const ActiveIcon = activeSlide.icon;

  const goPrevious = () => {
    setActiveIndex((current) => (current === 0 ? onboardingSlides.length - 1 : current - 1));
  };

  const goNext = () => {
    setActiveIndex((current) => (current === onboardingSlides.length - 1 ? 0 : current + 1));
  };

  return (
    <div className="h-screen overflow-hidden bg-background px-6 py-8">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
        <header className="flex flex-col items-center justify-center gap-3 text-center">
          <img
            src={appIcon}
            alt=""
            aria-hidden="true"
            className="h-20 w-20 rounded-[22px]"
          />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">LockNote</h1>
            <p className="mt-1 text-sm text-gray-400">{version}</p>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 items-center justify-center py-7">
          <div className="w-full max-w-3xl">
            <div className="rounded-lg border border-primary-100 bg-white p-6 shadow-sm">
              <div className="grid w-full grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-4">
                <button
                  type="button"
                  onClick={goPrevious}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  aria-label={t.common.previous}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <section className="grid min-w-0 gap-6 sm:grid-cols-[minmax(160px,220px)_minmax(0,1fr)] sm:items-center">
                  <div className="flex aspect-square min-h-[160px] items-center justify-center rounded-lg bg-primary-50 text-accent">
                    <ActiveIcon className="h-20 w-20" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-2xl font-semibold text-gray-900">
                      {t.onboarding[activeSlide.titleKey]}
                    </h2>
                    <p className="mt-4 max-w-md text-sm leading-6 text-gray-500">
                      {t.onboarding[activeSlide.descKey]}
                    </p>
                    <div className="mt-7 flex gap-2">
                      {onboardingSlides.map((slide, index) => (
                        <button
                          key={slide.titleKey}
                          type="button"
                          onClick={() => setActiveIndex(index)}
                          className={`h-2.5 rounded-full transition-all ${
                            index === activeIndex ? 'w-7 bg-accent' : 'w-2.5 bg-gray-200 hover:bg-gray-300'
                          }`}
                          aria-label={`${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                <button
                  type="button"
                  onClick={goNext}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  aria-label={t.common.next}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-11 flex justify-end">
              <button
                type="button"
                onClick={onStart}
                className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-primary-600"
              >
                <FileText className="h-5 w-5" />
                {t.onboarding.start}
              </button>
            </div>
          </div>
        </main>

        <footer>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-gray-100 pt-4 text-sm">
            <button
              type="button"
              onClick={() => BrowserOpenURL('https://locknote.app')}
              className="text-gray-500 hover:text-accent hover:underline"
            >
              {t.settings.website}
            </button>
            <button
              type="button"
              onClick={() => BrowserOpenURL('https://locknote.app/privacy')}
              className="text-gray-500 hover:text-accent hover:underline"
            >
              {t.settings.privacy}
            </button>
            <button
              type="button"
              onClick={() => BrowserOpenURL('https://locknote.app/terms')}
              className="text-gray-500 hover:text-accent hover:underline"
            >
              {t.settings.terms}
            </button>
            <button
              type="button"
              onClick={() => BrowserOpenURL('https://locknote.app/disclaimer')}
              className="text-gray-500 hover:text-accent hover:underline"
            >
              {t.settings.disclaimer}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
