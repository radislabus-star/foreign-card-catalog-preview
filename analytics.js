(() => {
  const endpoint = document.querySelector('meta[name="card-analytics-endpoint"]')?.content?.trim() || '';
  const params = new URLSearchParams(window.location.search);
  const safe = (value, fallback, max = 80) => {
    const cleaned = String(value || '').toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
    return (cleaned || fallback).slice(0, max);
  };
  const safeId = (value, fallback) => {
    const candidate = String(value || '');
    return /^[A-Za-z0-9._:-]{1,80}$/.test(candidate) ? candidate : fallback;
  };
  const trackingKey = /^trk_[a-z0-9_-]{1,76}$/.test(params.get('trk') || '') ? params.get('trk') : 'PENDING';
  const actionId = safeId(params.get('aid'), 'UNATTRIBUTED');
  const attribution = {
    source: safe(params.get('utm_source'), 'direct'),
    medium: safe(params.get('utm_medium'), 'none'),
    campaign: safe(params.get('utm_campaign'), 'none', 120),
    content: safe(params.get('utm_content'), 'none', 120)
  };

  let sessionId = sessionStorage.getItem('card-session-id');
  if (!sessionId) {
    sessionId = `ses_${crypto.randomUUID().replaceAll('-', '')}`;
    sessionStorage.setItem('card-session-id', sessionId);
  }

  const debug = [];
  async function track(eventType, offerId = '') {
    const event = {
      event_id: `evt_${crypto.randomUUID().replaceAll('-', '')}`,
      occurred_at: new Date().toISOString(), event_type: eventType,
      session_id: sessionId, tracking_key: trackingKey, action_id: actionId,
      offer_id: offerId, page_path: window.location.pathname,
      ...attribution
    };
    debug.push(event);
    if (!endpoint) return { sent: false, reason: 'ENDPOINT_NOT_CONFIGURED', event };
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event), keepalive: true, credentials: 'omit', cache: 'no-store'
      });
      return { sent: response.ok, status: response.status, event };
    } catch (_error) {
      return { sent: false, reason: 'NETWORK_ERROR', event };
    }
  }

  function sourceVisitOnce() {
    if (sessionStorage.getItem('card-source-visit') === '1') return;
    sessionStorage.setItem('card-source-visit', '1');
    track('source_visit');
  }

  function decorateUrl(rawUrl) {
    const url = new URL(rawUrl, window.location.href);
    if (trackingKey !== 'PENDING') url.searchParams.set('trk', trackingKey);
    if (actionId !== 'UNATTRIBUTED') url.searchParams.set('aid', actionId);
    for (const [key, value] of Object.entries(attribution)) {
      if (!['direct', 'none'].includes(value)) url.searchParams.set(`utm_${key}`, value);
    }
    return `${url.pathname}${url.search}${url.hash}`;
  }

  window.CardAnalytics = Object.freeze({
    track, sourceVisitOnce, decorateUrl,
    state: Object.freeze({ endpointConfigured: Boolean(endpoint), trackingKey, actionId, attribution }),
    debugEvents: debug
  });
})();
