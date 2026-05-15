const utils = require('../utils/crypto');
const idempRepo = require('../repository/idempotencyRepository');
const txRepo = require('../repository/transactionRepository');
const accountRepo = require('../repository/accountRepository');
const cryptoSvc = require('./cryptoService');
const config = require('../config');

function ingest({ciphertext, bridgeId, hopCount = 0}){
  // compute packetHash = sha256 over ciphertext string bytes
  const packetHash = cryptoSvc.hashCiphertext(ciphertext);

  function handleClaimed(claimed){
    if(!claimed){
      return { outcome: 'DUPLICATE_DROPPED', packetHash, reason: null, transactionId: null };
    }
    // attempt decrypt
    let pi;
    try{
      pi = cryptoSvc.decryptHybridPacket(ciphertext);
    }catch(e){
      txRepo.insert({packetHash, senderVpa:'', receiverVpa:'', amount:'0.00', signedAt: Date.now(), settledAt: Date.now(), bridgeNodeId: bridgeId, hopCount, status:'INVALID', reason:'decryption_failed'});
      return { outcome: 'INVALID', packetHash, reason: 'decryption_failed', transactionId: null };
    }
    // freshness
    const now = Date.now();
    if(pi.signedAt + (config.env.PACKET_FRESHNESS_SECONDS*1000) < now){
      txRepo.insert({packetHash, senderVpa:pi.senderVpa, receiverVpa:pi.receiverVpa, amount:pi.amount, signedAt:pi.signedAt, settledAt: now, bridgeNodeId: bridgeId, hopCount, status:'REJECTED', reason:'stale_packet'});
      return { outcome: 'INVALID', packetHash, reason: 'stale_packet', transactionId: null };
    }
    if(pi.signedAt - (config.env.PACKET_FRESHNESS_SECONDS*1000) > now){
      txRepo.insert({packetHash, senderVpa:pi.senderVpa, receiverVpa:pi.receiverVpa, amount:pi.amount, signedAt:pi.signedAt, settledAt: now, bridgeNodeId: bridgeId, hopCount, status:'REJECTED', reason:'future_dated'});
      return { outcome: 'INVALID', packetHash, reason: 'future_dated', transactionId: null };
    }

    // exact-once settlement: check if already settled
    const settledCount = txRepo.countSettledByPacketHash(packetHash);
    if(settledCount > 0){
      return { outcome: 'DUPLICATE_DROPPED', packetHash, reason: null, transactionId: null };
    }

    // attempt settlement transactionally
    try{
      accountRepo.adjustBalancesTransactional(pi.senderVpa, pi.receiverVpa, Number(pi.amount));
      const txId = txRepo.insert({packetHash, senderVpa:pi.senderVpa, receiverVpa:pi.receiverVpa, amount:pi.amount, signedAt:pi.signedAt, settledAt: now, bridgeNodeId: bridgeId, hopCount, status:'SETTLED'});
      return { outcome: 'SETTLED', packetHash, reason: null, transactionId: txId };
    }catch(e){
      // if insufficient or other error -> reject
      txRepo.insert({packetHash, senderVpa:pi.senderVpa, receiverVpa:pi.receiverVpa, amount:pi.amount, signedAt:pi.signedAt, settledAt: now, bridgeNodeId: bridgeId, hopCount, status:'REJECTED', reason:e.message});
      return { outcome: 'INVALID', packetHash, reason: e.message.toLowerCase(), transactionId: null };
    }
  }

  // claim idempotency (idempRepo.claim may return a boolean or a Promise depending on Redis availability)
  const claimedRes = idempRepo.claim(packetHash);
  if(claimedRes && typeof claimedRes.then === 'function'){
    // Redis-backed path: return a Promise that resolves to the result object
    return claimedRes.then(claimed => handleClaimed(claimed));
  }

  // DB-backed (synchronous) path
  return handleClaimed(claimedRes);
}

module.exports = { ingest };
