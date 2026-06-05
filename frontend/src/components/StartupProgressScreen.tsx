import appIcon from '../assets/app-icon.png';

interface StartupProgressScreenProps {
  message: string;
  progress: number;
}

export function StartupProgressScreen({ message, progress }: StartupProgressScreenProps) {
  const boundedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="flex h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-primary-100 bg-white p-8 shadow-lg">
        <div className="mb-5 flex justify-center">
          <img
            src={appIcon}
            alt=""
            aria-hidden="true"
            className="h-16 w-16 rounded-[18px]"
          />
        </div>
        <h1 className="text-center text-2xl font-bold text-gray-900">LockNote</h1>
        <p className="mt-2 text-center text-sm text-gray-500">{message}</p>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-primary-50">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={boundedProgress}
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${boundedProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
