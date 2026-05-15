const config = require('../config');

let redisClient = null;
try{
  const Redis = require('ioredis');
  if(config.env.REDIS_URL){
    redisClient = new Redis(config.env.REDIS_URL);
  }
}catch(e){
  // ioredis not installed or not configured; silently fall back to DB
}

function claim(packetHash){
  // Prefer Redis for fast atomic claim when available
  if(redisClient){
    const ttl = config.env.IDEMPOTENCY_TTL_SECONDS || 86400;
    const key = `idemp:${packetHash}`;
    // SET key value NX EX ttl
    return redisClient.set(key, '1', 'NX', 'EX', ttl).then(res => !!res).catch(()=>false);
  }

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
  if(redisClient){
    const key = `idemp:${packetHash}`;
    return redisClient.exists(key).then(r => r === 1).catch(()=>false);
  }
  const db = config.db();
  const row = db.prepare('SELECT packetHash FROM idempotency WHERE packetHash = ?').get(packetHash);
  return !!row;
}

function clear(){
  if(redisClient){
    // delete keys matching our idempotency prefix only
    return redisClient.keys('idemp:*').then(keys => {
      if(keys.length === 0) return 0;
      return redisClient.del(keys);
    }).catch(()=>0);
  }
  const db = config.db();
  db.prepare('DELETE FROM idempotency').run();
}

module.exports = { claim, exists, clear };
// optional shutdown to close Redis connection in test/CI
module.exports.shutdown = function(){
  if(redisClient){
    try{ redisClient.quit(); }catch(e){}
    redisClient = null;
  }
};
