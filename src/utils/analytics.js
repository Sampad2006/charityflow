// Lightweight telemetry and client-side usage analytics for CharityFlow
// Tracks core lifecycle events for Level 4 audit and product validation.

const STORAGE_KEY = 'charityflow_analytics_events';

export function trackEvent(eventName, payload = {}) {
  const event = {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: eventName,
    payload,
    timestamp: new Date().toISOString(),
    url: window?.location?.pathname || '/',
  };

  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    existing.push(event);
    // Keep last 100 events
    if (existing.length > 100) existing.shift();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // Ignore storage errors (private browsing, etc.)
  }

  if (import.meta.env.DEV) {
    console.debug(`[Analytics] ${eventName}:`, payload);
  }

  return event;
}

export function getAnalyticsSummary() {
  try {
    const events = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const countByName = {};
    for (const ev of events) {
      countByName[ev.name] = (countByName[ev.name] || 0) + 1;
    }
    return {
      totalEvents: events.length,
      counts: countByName,
      recent: events.slice(-10),
    };
  } catch {
    return { totalEvents: 0, counts: {}, recent: [] };
  }
}
