const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app, server } = require('../index');

describe('TLS Connection Tests', () => {
  const serverKey = path.join(__dirname, '../certs/server.key');
  const serverCert = path.join(__dirname, '../certs/server.crt');
  const clientKey = path.join(__dirname, '../certs/client.key');
  const clientCert = path.join(__dirname, '../certs/client.crt');

  const certsExist = fs.existsSync(serverKey) && fs.existsSync(serverCert) && 
                     fs.existsSync(clientKey) && fs.existsSync(clientCert);

  if (!certsExist) {
    test.skip('TLS certificates not found, skipping TLS tests', () => {});
  } else {
    test('TLS certificates exist', () => {
      expect(fs.existsSync(serverKey)).toBe(true);
      expect(fs.existsSync(serverCert)).toBe(true);
    });
  }

  afterAll((done) => {
    if (server && server.close) {
      server.close(done);
    } else {
      done();
    }
  });
});
