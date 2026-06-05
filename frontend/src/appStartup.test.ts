import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/App.tsx', 'utf8');
const onboardingSource = readFileSync('src/components/OnboardingScreen.tsx', 'utf8');
const startupProgressSource = readFileSync('src/components/StartupProgressScreen.tsx', 'utf8');

test('App waits for Wails runtime without falling through to the first-run screen on Windows cold start', () => {
  assert.equal(/const wailsRuntimeReady = waitForWailsRuntime\(\);/.test(source), true);
  assert.equal(/waitForWailsRuntime\(maxWaitTime = 10000\)/.test(source), false);
  assert.equal(/Date\.now\(\) - startTime < maxWaitTime/.test(source), false);
  assert.equal(/Wails runtime not ready after timeout[\s\S]*setLoading\(false\)/.test(source), false);
  assert.equal(/await wailsRuntimeReady;/.test(source), true);
});

test('App waits for background core initialization before calling first-run APIs', () => {
  assert.equal(/waitForCoreReady/.test(source), true);
  assert.equal(/await waitForCoreReady\(setStartupMessage\);/.test(source), true);
  assert.equal(/App\.IsCoreReady/.test(source), true);
  assert.equal(/App\.GetStartupError/.test(source), true);
  assert.equal(source.indexOf('await waitForCoreReady(setStartupMessage);') < source.indexOf('const firstRun = await App.IsFirstRun();'), true);
});

test('App shows a cold-start message while the Windows runtime is still warming up', () => {
  assert.equal(/const \[startupMessage, setStartupMessage\]/.test(source), true);
  assert.equal(/useState\('正在启动应用核心\.\.\.'\)/.test(source), true);
  assert.equal(/setStartupMessage\(`正在启动应用核心\.\.\. \(\$\{retryCount \+ 1\}\)`\)/.test(source), true);
  assert.equal(/<StartupProgressScreen message=\{startupMessage\}/.test(source), true);
  assert.equal(/progress=\{startupProgress\}/.test(source), true);
  assert.equal(/role="progressbar"/.test(startupProgressSource), true);
  assert.equal(/const boundedProgress = Math\.min\(100, Math\.max\(0, progress\)\);/.test(startupProgressSource), true);
  assert.equal(/style=\{\{ width: `\$\{boundedProgress\}%` \}\}/.test(startupProgressSource), true);
});

test('App keeps first-run startup progress visible even when initialization is fast', () => {
  const minimumMatch = source.match(/const FIRST_RUN_STARTUP_MINIMUM_MS = (\d+);/);
  assert.equal(minimumMatch !== null, true);
  const minimumDuration = Number(minimumMatch?.[1]);
  assert.equal(minimumDuration >= 1000 && minimumDuration <= 2000, true);
  assert.equal(/async function waitForMinimumStartupDisplay/.test(source), true);
  assert.equal(/const startupStartedAt = Date\.now\(\);/.test(source), true);
  assert.equal(/await waitForMinimumStartupDisplay\(startupStartedAt, firstRun\);/.test(source), true);
  assert.equal(/setStartupProgress\(92\);[\s\S]*await waitForMinimumStartupDisplay\(startupStartedAt, firstRun\);[\s\S]*setStartupProgress\(100\);/.test(source), true);
  assert.equal(source.indexOf('const firstRun = await App.IsFirstRun();') < source.indexOf('await waitForMinimumStartupDisplay(startupStartedAt, firstRun);'), true);
});

test('App shows onboarding before setup password on first run', () => {
  assert.equal(/import \{ OnboardingScreen \}/.test(source), true);
  assert.equal(/const \[showOnboarding, setShowOnboarding\] = useState\(false\)/.test(source), true);
  assert.equal(/setShowOnboarding\(firstRun\)/.test(source), true);
  assert.equal(/if \(isFirstRun && showOnboarding\)/.test(source), true);
  assert.equal(/<OnboardingScreen onStart=\{\(\) => setShowOnboarding\(false\)\}/.test(source), true);
  assert.equal(source.indexOf('if (isFirstRun && showOnboarding)') < source.indexOf('if (isFirstRun)'), true);
});

test('Onboarding introduces core features and links to legal pages', () => {
  assert.equal(/app-icon\.png/.test(onboardingSource), true);
  assert.equal(/version/.test(onboardingSource), true);
  assert.equal(/onboardingSlides/.test(onboardingSource), true);
  assert.equal((onboardingSource.match(/\{ icon:/g) || []).length, 5);
  assert.equal(/ChevronLeft/.test(onboardingSource), true);
  assert.equal(/ChevronRight/.test(onboardingSource), true);
  assert.equal(/onStart/.test(onboardingSource), true);
  assert.equal(/BrowserOpenURL\('https:\/\/locknote\.app'\)/.test(onboardingSource), true);
  assert.equal(/BrowserOpenURL\('https:\/\/locknote\.app\/privacy'\)/.test(onboardingSource), true);
  assert.equal(/BrowserOpenURL\('https:\/\/locknote\.app\/terms'\)/.test(onboardingSource), true);
  assert.equal(/BrowserOpenURL\('https:\/\/locknote\.app\/disclaimer'\)/.test(onboardingSource), true);
});

test('Onboarding centers the larger brand header and only frames the slide panel', () => {
  assert.equal(onboardingSource.includes('className="flex flex-col items-center justify-center gap-3 text-center"'), true);
  assert.equal(onboardingSource.includes('className="h-20 w-20 rounded-[22px]"'), true);
  assert.equal(onboardingSource.includes('className="w-full max-w-3xl"'), true);
  assert.equal(onboardingSource.includes('className="rounded-lg border border-primary-100 bg-white p-6 shadow-sm"'), true);
  assert.equal(onboardingSource.includes('shadow-lg'), false);
  assert.equal(onboardingSource.includes('max-h-[760px] w-full max-w-2xl flex-col rounded-2xl'), false);
});

test('Onboarding slide uses left visual right copy layout and compact right aligned start button', () => {
  assert.equal(onboardingSource.includes('sm:grid-cols-[minmax(160px,220px)_minmax(0,1fr)]'), true);
  assert.equal(onboardingSource.includes('className="text-left"'), true);
  assert.equal(onboardingSource.includes('className="w-full max-w-3xl"'), true);
  assert.equal(onboardingSource.includes('className="mt-11 flex justify-end"'), true);
  assert.equal(onboardingSource.includes('className="inline-flex min-w-[160px] items-center justify-center'), true);
  assert.equal(onboardingSource.indexOf('rounded-lg border border-primary-100 bg-white p-6 shadow-sm') < onboardingSource.indexOf('className="mt-11 flex justify-end"'), true);
});
