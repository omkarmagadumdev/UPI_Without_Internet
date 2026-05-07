const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();
const Database = require('better-sqlite3');
const demoSeed = require('../data/demoSeed');

const env = {
  PORT: process.env.PORT || 3000,
  IDEMPOTENCY_TTL_SECONDS: Number(process.env.IDEMPOTENCY_TTL_SECONDS || 86400),
  PACKET_FRESHNESS_SECONDS: Number(process.env.PACKET_FRESHNESS_SECONDS || 86400),
  DB_FILE: process.env.DB_FILE || path.join(process.cwd(),'data','upi_demo.db')
};

let db;
let keypair;

function ensureDataDir(){
  const dir = path.dirname(env.DB_FILE);
  if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
}

function genKeypair(){
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa',{
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return {publicKey, privateKey};
}

async function init(){
  ensureDataDir();
  db = new Database(env.DB_FILE);
  keypair = genKeypair();
  // initialize tables
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS accounts (
      vpa TEXT PRIMARY KEY,
      holderName TEXT NOT NULL,
      balance TEXT NOT NULL,
      version INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      packetHash TEXT NOT NULL,
      senderVpa TEXT NOT NULL,
      receiverVpa TEXT NOT NULL,
      amount TEXT NOT NULL,
      signedAt INTEGER NOT NULL,
      settledAt INTEGER NOT NULL,
      bridgeNodeId TEXT NOT NULL,
      hopCount INTEGER NOT NULL,
      status TEXT NOT NULL,
      reason TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_packet_hash ON transactions(packetHash);
    CREATE TABLE IF NOT EXISTS idempotency (
      packetHash TEXT PRIMARY KEY,
      claimedAt INTEGER
    );
  `);
  // seed accounts if empty
  const row = db.prepare('SELECT COUNT(1) as c FROM accounts').get();
  if(row.c === 0){
    const insert = db.prepare('INSERT INTO accounts (vpa,holderName,balance,version) VALUES (?,?,?,0)');
    demoSeed.accounts.forEach(account => {
      insert.run(account.vpa, account.holderName, account.balance);
    });
  }

  // simple cleanup job for idempotency table
  const evictionTimer = setInterval(()=>{
    const cutoff = Date.now() - env.IDEMPOTENCY_TTL_SECONDS*1000;
    db.prepare('DELETE FROM idempotency WHERE claimedAt < ?').run(cutoff);
  }, 60*1000);
  evictionTimer.unref();
}

module.exports = { init, env, db: ()=>db, keypair: ()=>keypair };
