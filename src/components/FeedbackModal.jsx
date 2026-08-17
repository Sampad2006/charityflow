import { useState } from 'react';
import { trackEvent } from '../utils/analytics';

const FEEDBACK_STORAGE = 'charityflow_user_feedback';

export default function FeedbackModal({ isOpen, onClose }) {
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState('general');
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const entry = {
      id: `fb_${Date.now()}`,
      rating,
      category,
      comment,
      submittedAt: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE) || '[]');
      existing.push(entry);
      localStorage.setItem(FEEDBACK_STORAGE, JSON.stringify(existing));
    } catch {
      // Ignore storage errors
    }

    trackEvent('feedback_submitted', { rating, category });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setComment('');
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-ink-100 bg-paper p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-xs font-bold text-ink-400 hover:text-ink-900"
        >
          ✕
        </button>

        {submitted ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald/10 text-2xl text-emerald">
              ✓
            </div>
            <h3 className="font-display text-lg font-bold text-ink-900">Thank You!</h3>
            <p className="mt-1 text-xs text-ink-500">Your feedback helps improve CharityFlow.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-coral">Beta Feedback</span>
              <h3 className="font-display text-lg font-bold text-ink-900">Share Your Experience</h3>
              <p className="text-xs text-ink-500">How was your interaction with the smart contract and AI agent?</p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-600">
                Rating
              </label>
              <div className="mt-1 flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`h-9 w-9 rounded-xl border text-sm font-bold transition-all ${
                      rating >= star
                        ? 'border-amber bg-amber/15 text-ink-900 shadow-sm'
                        : 'border-ink-100 bg-paper text-ink-400 hover:border-ink-300'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-600">
                Topic
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink-100 bg-paper px-3 py-2 text-xs font-medium text-ink-800 outline-none focus:border-ink-900"
              >
                <option value="general">General Experience</option>
                <option value="wallet">Wallet Connection</option>
                <option value="donation">Donation Flow</option>
                <option value="ai">AI Crisis Deliberation</option>
                <option value="bug">Bug Report</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-600">
                Comments & Suggestions
              </label>
              <textarea
                required
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What did you like or what could be improved?"
                className="mt-1 w-full rounded-xl border border-ink-100 bg-paper p-3 text-xs font-medium text-ink-800 placeholder:text-ink-300 outline-none focus:border-ink-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-ink-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-ink-900 px-5 py-2 text-xs font-semibold text-paper transition-transform hover:scale-105"
              >
                Submit Feedback
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
