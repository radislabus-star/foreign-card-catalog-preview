import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../analytics.js', import.meta.url), 'utf8');

function load(search = '') {
  const storage = new Map();
  const context = {
    URL, URLSearchParams, Date, Object, String,
    crypto: { randomUUID: () => '11111111-2222-3333-4444-555555555555' },
    document: { querySelector: () => ({ content: '' }) },
    sessionStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    },
    window: { location: { search, href: `https://example.test/catalog/${search}`, pathname: '/catalog/' } },
    fetch: () => { throw new Error('fetch must not run without endpoint'); }
  };
  vm.runInNewContext(source, context);
  return context.window.CardAnalytics;
}

test('sanitizes and carries only explicit attribution parameters', () => {
  const analytics = load('?trk=trk_test_123&aid=A-7&utm_source=ig&utm_medium=social&utm_campaign=cards');
  assert.equal(analytics.state.trackingKey, 'trk_test_123');
  assert.equal(analytics.state.actionId, 'A-7');
  assert.equal(
    analytics.decorateUrl('card.html?id=AFF-005'),
    '/catalog/card.html?id=AFF-005&trk=trk_test_123&aid=A-7&utm_source=ig&utm_medium=social&utm_campaign=cards'
  );
});

test('detail open is not rewritten as affiliate CTA', async () => {
  const analytics = load();
  const result = await analytics.track('detail_open', 'AFF-005');
  assert.equal(result.sent, false);
  assert.equal(result.event.event_type, 'detail_open');
  assert.equal(result.event.offer_id, 'AFF-005');
  assert.equal(analytics.debugEvents.some((event) => event.event_type === 'cta_click'), false);
});

test('source visit is emitted only once per tab', () => {
  const analytics = load();
  analytics.sourceVisitOnce();
  analytics.sourceVisitOnce();
  assert.equal(analytics.debugEvents.filter((event) => event.event_type === 'source_visit').length, 1);
});

test('back link keeps attribution in the same tab', () => {
  const analytics = load('?trk=trk_test_123&aid=A-7&utm_source=ig&utm_medium=social');
  assert.equal(
    analytics.decorateUrl('index.html'),
    '/catalog/index.html?trk=trk_test_123&aid=A-7&utm_source=ig&utm_medium=social'
  );
});
