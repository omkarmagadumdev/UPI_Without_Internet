const crypto = require('crypto');

function sha256Base64(input){
  return crypto.createHash('sha256').update(input).digest('hex');
}

function aesGcmEncrypt(plaintext, key){
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

function aesGcmDecrypt(payload, key){
  const iv = payload.slice(0,12);
  const tag = payload.slice(12,28);
  const ciphertext = payload.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return out;
}

function rsaOaepEncrypt(buffer, publicKeyPem){
  return crypto.publicEncrypt({key: publicKeyPem, oaepHash:'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING}, buffer);
}

function rsaOaepDecrypt(buffer, privateKeyPem){
  return crypto.privateDecrypt({key: privateKeyPem, oaepHash:'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING}, buffer);
}

module.exports = { sha256Base64, aesGcmEncrypt, aesGcmDecrypt, rsaOaepEncrypt, rsaOaepDecrypt };
