const config = require('../config');

function claim(packetHash){
  const db = config.db();
  try{
    const stmt = db.prepare('INSERT INTO idempotency (packetHash, claimedAt) VALUES (?,?)');
    stmt.run(packetHash, Date.now());
    return true;
  }catch(e){
    return false;
  }
}

function exists(packetHash){
  const db = config.db();
  const row = db.prepare('SELECT packetHash FROM idempotency WHERE packetHash = ?').get(packetHash);
  return !!row;
}

function clear(){
  const db = config.db();
  db.prepare('DELETE FROM idempotency').run();
}

module.exports = { claim, exists, clear };
