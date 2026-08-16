import { useApp } from '../context/AppContext';

const STYLES = {
  success: 'border-emerald/20 bg-emerald/10 text-emerald',
  error: 'border-coral/20 bg-coral/10 text-coral',
  info: 'border-ink-200 bg-white text-ink-900',
  default: 'border-ink-200 bg-white text-ink-900',
};

export default function ToastContainer() {
  const { toasts, dismissToast } = useApp();

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-xl backdrop-blur ${STYLES[toast.type] || STYLES.default}`}
          data-testid="toast"
        >
          <p className="min-w-0 flex-1 break-words text-sm">{toast.message}</p>
          <button
            onClick={() => dismissToast(toast.id)}
            className="shrink-0 text-xs opacity-60 transition-opacity hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
