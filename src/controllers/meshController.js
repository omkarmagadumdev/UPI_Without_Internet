const mesh = require('../services/meshService');
const demo = require('../services/demoService');
const bridgeIngest = require('../services/bridgeIngestService');
const validators = require('../validators');
const config = require('../config');
const idempotencyRepo = require('../repository/idempotencyRepository');
const accountRepo = require('../repository/accountRepository');
const txRepo = require('../repository/transactionRepository');

async function dashboard(req,res){
  res.render('dashboard', { });
}

function meshState(req,res){
  const idempotencyCacheSize = config.db().prepare('SELECT COUNT(1) as c FROM idempotency').get().c;
  res.json({ devices: mesh.getState(), idempotencyCacheSize });
}

function demoSend(req,res){
  validators.validateDemoSend(req.body);
  const {senderVpa,receiverVpa,amount,pin,ttl,startDevice} = req.body;
  const packet = demo.createPaymentInstruction({senderVpa,receiverVpa,amount,pin,ttl});
  const injectedAt = startDevice || 'phone-alice';
  mesh.injectPacketToDevice(injectedAt, packet);
  res.json({
    packetId: packet.packetId,
    ciphertextPreview: `${packet.ciphertext.slice(0, 64)}...`,
    ttl: packet.ttl,
    injectedAt
  });
}

function gossip(req,res){
  const result = mesh.gossipRound();
  res.json({ transfers: result.transfers, deviceCounts: result.deviceCounts });
}

function flush(req,res){
  const uploads = mesh.getState()
    .filter(d => d.hasInternet)
    .flatMap(d => mesh.flushDevice(d.deviceId).map(packet => ({ packet, bridgeNodeId: d.deviceId })));
  const results = uploads.map(u => ({
    bridgeNode: u.bridgeNodeId,
    packetId: u.packet.packetId.slice(0, 8),
    ...bridgeIngest.ingest({ciphertext:u.packet.ciphertext, bridgeId:u.bridgeNodeId})
  }));
  res.json({uploadsAttempted: uploads.length, results});
}

function reset(req,res){
  mesh.resetMesh();
  idempotencyRepo.clear();
  res.json({ok:true});
}

function fullReset(req,res){
  mesh.resetMesh();
  idempotencyRepo.clear();
  txRepo.clear();
  accountRepo.resetToSeed();
  res.json({ok:true, mode:'full'});
}

module.exports = { dashboard, meshState, demoSend, gossip, flush, reset, fullReset };
