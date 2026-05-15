/*
  Redis integration test — runs only when REDIS_URL is set.
  This is intentionally skipped in CI unless REDIS_URL is provided.
*/
const { execSync } = require('child_process');

if (!process.env.REDIS_URL) {
  test.skip('Redis not configured — skipping Redis integration tests', () => {});
} else {
  const idemp = require('../src/repository/idempotencyRepository');

  afterAll(async () => {
    if (typeof idemp.shutdown === 'function') {
      try{ await idemp.shutdown(); }catch(e){}
    }
  });

  test('idempotency claim via Redis: first claim wins, second fails', async () => {
    // clear any existing keys
    await idemp.clear();
    const hash = 'test-packet-hash-redis';
    const first = idemp.claim(hash);
    const firstRes = (first && typeof first.then === 'function') ? await first : first;
    expect(firstRes).toBe(true);

    const second = idemp.claim(hash);
    const secondRes = (second && typeof second.then === 'function') ? await second : second;
    expect(secondRes).toBe(false);

    await idemp.clear();
  }, 20000);
}
