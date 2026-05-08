const cryptoSvc = require('./cryptoService');
const utils = require('../utils/crypto');

function createPaymentInstruction({senderVpa,receiverVpa,amount,pin,ttl}){
  const now = Date.now();
  const pi = {
    senderVpa,
    receiverVpa,
    amount,
    pinHash: utils.sha256Base64(pin||''),
    nonce: Math.random().toString(36).slice(2),
    signedAt: now
  };
  const ciphertext = cryptoSvc.createHybridPacket(pi);
  const packetId = utils.sha256Base64(`${senderVpa}|${receiverVpa}|${amount}|${now}|${pi.nonce}`);
  return { packetId, ciphertext, ttl: ttl || 5, createdAt: now };
}

module.exports = { createPaymentInstruction };
