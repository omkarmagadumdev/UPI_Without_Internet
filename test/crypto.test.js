const fs = require('fs');
const path = require('path');
const request = require('supertest');

const dbFile = path.join(__dirname, 'upi-test.db');
process.env.DB_FILE = dbFile;
process.env.PORT = '0';

const config = require('../src/config');
const { bootstrap } = require('../index');
const cryptoService = require('../src/services/cryptoService');
const demoService = require('../src/services/demoService');
const bridgeService = require('../src/services/bridgeIngestService');
const accountRepo = require('../src/repository/accountRepository');
const idempotencyRepo = require('../src/repository/idempotencyRepository');
const meshService = require('../src/services/meshService');

describe('UPI mesh demo', () => {
  let app;
  let server;

  beforeAll(async () => {
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
    }
    ({ app, server } = await bootstrap());
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
    }
  });

  beforeEach(() => {
    idempotencyRepo.clear();
    meshService.resetMesh();
  });

  test('server key endpoint', async () => {
    const response = await request(app).get('/api/server-key');
    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(response.body.publicKey).toContain('BEGIN PUBLIC KEY');
    expect(response.body.algorithm).toBe('RSA-2048 / OAEP-SHA256');
  });

  test('metrics endpoint exposes settlement counters', async () => {
    const metricsBefore = await request(app).get('/api/metrics');
    expect(metricsBefore.status).toBe(200);
    expect(metricsBefore.body.totalTransactions).toBeGreaterThanOrEqual(0);
    expect(metricsBefore.body.settledCount).toBeGreaterThanOrEqual(0);
    expect(metricsBefore.body.rejectedCount).toBeGreaterThanOrEqual(0);
    expect(metricsBefore.body.invalidCount).toBeGreaterThanOrEqual(0);
    expect(metricsBefore.body).toHaveProperty('idempotencyCacheSize');

    const packet = demoService.createPaymentInstruction({
      senderVpa: 'alice@demo',
      receiverVpa: 'bob@demo',
      amount: '10.00',
      pin: '1234',
      ttl: 5
    });
    bridgeService.ingest({ ciphertext: packet.ciphertext, bridgeId: 'bridge-metrics' });

    const metricsAfter = await request(app).get('/api/metrics');
    expect(metricsAfter.status).toBe(200);
    expect(metricsAfter.body.totalTransactions).toBeGreaterThanOrEqual(metricsBefore.body.totalTransactions + 1);
  });

  test('validation errors use standardized error payload', async () => {
    const response = await request(app)
      .post('/api/demo/send')
      .send({ senderVpa: 'alice@demo' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBeTruthy();
    expect(response.body.error.requestId).toBeTruthy();
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  test('encryptDecryptRoundTrip', () => {
    const original = {
      senderVpa: 'alice@demo',
      receiverVpa: 'bob@demo',
      amount: '123.45',
      pinHash: 'abcdef',
      nonce: 'nonce-1',
      signedAt: Date.now()
    };

    const ciphertext = cryptoService.createHybridPacket(original);
    const decrypted = cryptoService.decryptHybridPacket(ciphertext);

    expect(decrypted.senderVpa).toBe(original.senderVpa);
    expect(decrypted.receiverVpa).toBe(original.receiverVpa);
    expect(decrypted.amount).toBe(original.amount);
    expect(decrypted.nonce).toBe(original.nonce);
  });

  test('tamperedCiphertextIsRejected', () => {
    const packet = demoService.createPaymentInstruction({
      senderVpa: 'alice@demo',
      receiverVpa: 'bob@demo',
      amount: '50.00',
      pin: '1234',
      ttl: 5
    });

    const chars = packet.ciphertext.split('');
    chars[Math.floor(chars.length / 2)] = chars[Math.floor(chars.length / 2)] === 'A' ? 'B' : 'A';
    const result = bridgeService.ingest({ ciphertext: chars.join(''), bridgeId: 'bridge-x' });

    expect(result.outcome).toBe('INVALID');
    expect(result.reason).toBe('decryption_failed');
  });

  test('singlePacketDeliveredByThreeBridgesSettlesExactlyOnce', () => {
    const startingAlice = accountRepo.findByVpa('alice@demo').balance;
    const startingBob = accountRepo.findByVpa('bob@demo').balance;

    const packet = demoService.createPaymentInstruction({
      senderVpa: 'alice@demo',
      receiverVpa: 'bob@demo',
      amount: '100.00',
      pin: '1234',
      ttl: 5
    });

    const results = [
      bridgeService.ingest({ ciphertext: packet.ciphertext, bridgeId: 'bridge-1' }),
      bridgeService.ingest({ ciphertext: packet.ciphertext, bridgeId: 'bridge-2' }),
      bridgeService.ingest({ ciphertext: packet.ciphertext, bridgeId: 'bridge-3' })
    ];

    expect(results.filter(r => r.outcome === 'SETTLED')).toHaveLength(1);
    expect(results.filter(r => r.outcome === 'DUPLICATE_DROPPED')).toHaveLength(2);

    const aliceAfter = accountRepo.findByVpa('alice@demo').balance;
    const bobAfter = accountRepo.findByVpa('bob@demo').balance;

    expect(aliceAfter).not.toBe(startingAlice);
    expect(bobAfter).not.toBe(startingBob);
  });

  test('demo send injection', async () => {
    const response = await request(app)
      .post('/api/demo/send')
      .send({
        senderVpa: 'alice@demo',
        receiverVpa: 'bob@demo',
        amount: 25,
        pin: '1234',
        ttl: 5,
        startDevice: 'phone-alice'
      });

    expect(response.status).toBe(200);
    expect(response.body.packetId).toBeTruthy();
  });

  test('gossip propagates packets and returns transfer stats', async () => {
    await request(app)
      .post('/api/demo/send')
      .send({
        senderVpa: 'alice@demo',
        receiverVpa: 'bob@demo',
        amount: 10,
        pin: '1234',
        ttl: 5,
        startDevice: 'phone-alice'
      });

    const gossip = await request(app).post('/api/mesh/gossip').send({});
    expect(gossip.status).toBe(200);
    expect(typeof gossip.body.transfers).toBe('number');
    expect(gossip.body.transfers).toBeGreaterThan(0);
    expect(gossip.body.deviceCounts['phone-bridge']).toBeGreaterThan(0);
  });

  test('mesh flush uploads and returns outcomes', async () => {
    await request(app)
      .post('/api/demo/send')
      .send({
        senderVpa: 'alice@demo',
        receiverVpa: 'bob@demo',
        amount: 15,
        pin: '1234',
        ttl: 5,
        startDevice: 'phone-alice'
      });

    await request(app).post('/api/mesh/gossip').send({});

    const flush = await request(app).post('/api/mesh/flush').send({});
    expect(flush.status).toBe(200);
    expect(typeof flush.body.uploadsAttempted).toBe('number');
    expect(flush.body.uploadsAttempted).toBeGreaterThan(0);
    expect(Array.isArray(flush.body.results)).toBe(true);
    expect(flush.body.results[0].outcome).toBeTruthy();
  });
});
