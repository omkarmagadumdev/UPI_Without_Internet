const config = require('../config');
const utils = require('../utils/crypto');

function getPublicKey(){
  return {
    publicKey: config.keypair().publicKey,
    algorithm: 'RSA-2048 / OAEP-SHA256',
    hybridScheme: 'RSA-OAEP encrypts an AES-256-GCM session key'
  };
}

function createHybridPacket(paymentInstruction){
  // paymentInstruction is an object -> stringify, encrypt
  const aesKey = cryptoRandomKey();
  const plaintext = Buffer.from(JSON.stringify(paymentInstruction));
  const encryptedPayload = utils.aesGcmEncrypt(plaintext, aesKey);
  const encryptedKey = utils.rsaOaepEncrypt(aesKey, config.keypair().publicKey);
  const packet = Buffer.concat([Buffer.from(encryptedKey), encryptedPayload]).toString('base64');
  return packet;
}

function decryptHybridPacket(packetB64){
  const buf = Buffer.from(packetB64, 'base64');
  // RSA encrypted key is same size as key modulus in bytes (2048 bits => 256 bytes)
  const keyLen = 256;
  const encKey = buf.slice(0,keyLen);
  const payload = buf.slice(keyLen);
  let aesKey;
  try{
    aesKey = utils.rsaOaepDecrypt(encKey, config.keypair().privateKey);
  }catch(e){
    throw new Error('INVALID_KEY');
  }
  let plaintext;
  try{
    plaintext = utils.aesGcmDecrypt(payload, aesKey);
  }catch(e){
    throw new Error('INVALID_CIPHERTEXT');
  }
  const obj = JSON.parse(plaintext.toString());
  return obj;
}

function hashCiphertext(ciphertext){
  return utils.sha256Base64(ciphertext);
}

function cryptoRandomKey(){
  return require('crypto').randomBytes(32);
}

module.exports = { getPublicKey, createHybridPacket, decryptHybridPacket, hashCiphertext };
