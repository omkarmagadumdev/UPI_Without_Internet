const config = require('../config');

function insert(tx){
  const db = config.db();
  const stmt = db.prepare('INSERT INTO transactions (packetHash,senderVpa,receiverVpa,amount,signedAt,settledAt,bridgeNodeId,hopCount,status,reason) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const info = stmt.run(tx.packetHash, tx.senderVpa, tx.receiverVpa, String(tx.amount), tx.signedAt || Date.now(), tx.settledAt || Date.now(), tx.bridgeNodeId || null, tx.hopCount || 0, tx.status, tx.reason || null);
  return info.lastInsertRowid;
}

function listLatest(limit=100){
  const db = config.db();
  return db.prepare('SELECT * FROM transactions ORDER BY id DESC LIMIT ?').all(limit);
}

function clear(){
  const db = config.db();
  db.prepare('DELETE FROM transactions').run();
}

function countSettledByPacketHash(hash){
  const db = config.db();
  const row = db.prepare("SELECT COUNT(1) as c from transactions WHERE packetHash = ? AND status = 'SETTLED'").get(hash);
  return row.c;
}

function getMetrics(){
  const db = config.db();
  const summary = db.prepare(`
    SELECT
      COUNT(1) AS total,
      SUM(CASE WHEN status = 'SETTLED' THEN 1 ELSE 0 END) AS settled,
      SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN status = 'INVALID' THEN 1 ELSE 0 END) AS invalid,
      AVG(CASE WHEN status = 'SETTLED' THEN (settledAt - signedAt) END) AS avgSettleMs
    FROM transactions
  `).get();

  return {
    totalTransactions: Number(summary.total || 0),
    settledCount: Number(summary.settled || 0),
    rejectedCount: Number(summary.rejected || 0),
    invalidCount: Number(summary.invalid || 0),
    avgSettleMs: summary.avgSettleMs == null ? null : Number(summary.avgSettleMs)
  };
}

module.exports = { insert, listLatest, countSettledByPacketHash, getMetrics, clear };
