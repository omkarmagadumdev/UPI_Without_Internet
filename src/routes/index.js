const express = require('express');
const router = express.Router();
const api = require('../controllers/apiController');
const mesh = require('../controllers/meshController');
const bridge = require('../controllers/bridgeController');

// dashboard
router.get('/', mesh.dashboard);

// public API
router.get('/api/server-key', api.serverKey);
router.get('/api/accounts', api.accounts);
router.get('/api/transactions', api.transactions);
router.get('/api/metrics', api.metrics);

// demo actions
router.post('/api/demo/send', mesh.demoSend);

// mesh
router.get('/api/mesh/state', mesh.meshState);
router.post('/api/mesh/gossip', mesh.gossip);
router.post('/api/mesh/flush', mesh.flush);
router.post('/api/mesh/reset', mesh.reset);
router.post('/api/demo/reset-all', mesh.fullReset);

// bridge
router.post('/api/bridge/ingest', bridge.ingest);

module.exports = router;
