const config = require('../config');

const demoSeed = {
  accounts: [
    { vpa: 'alice@demo', holderName: 'Alice', balance: '5000.00' },
    { vpa: 'bob@demo', holderName: 'Bob', balance: '1000.00' },
    { vpa: 'carol@demo', holderName: 'Carol', balance: '2500.00' },
    { vpa: 'dave@demo', holderName: 'Dave', balance: '500.00' }
  ]
};

function getAll(){
  const db = config.db();
  return db.prepare('SELECT vpa,holderName,balance,version FROM accounts ORDER BY vpa').all();
}

function findByVpa(vpa){
  const db = config.db();
  return db.prepare('SELECT * FROM accounts WHERE vpa = ?').get(vpa);
}

function updateBalanceOptimistic(vpa, newBalance){
  const db = config.db();
  // increment version to indicate update
  const stmt = db.prepare('UPDATE accounts SET balance = ?, version = version + 1 WHERE vpa = ?');
  const info = stmt.run(newBalance, vpa);
  return info.changes === 1;
}

function adjustBalancesTransactional(fromVpa, toVpa, amount){
  const db = config.db();
  const tx = db.transaction(()=>{
    const from = db.prepare('SELECT balance,version FROM accounts WHERE vpa = ?').get(fromVpa);
    if(!from) throw new Error('FROM_NOT_FOUND');
    if(Number(from.balance) < amount) throw new Error('INSUFFICIENT');
    const to = db.prepare('SELECT balance FROM accounts WHERE vpa = ?').get(toVpa);
    if(!to) throw new Error('TO_NOT_FOUND');
    db.prepare('UPDATE accounts SET balance = ? , version = version + 1 WHERE vpa = ?').run((Number(from.balance) - amount).toFixed(2), fromVpa);
    db.prepare('UPDATE accounts SET balance = ? , version = version + 1 WHERE vpa = ?').run((Number(to.balance) + amount).toFixed(2), toVpa);
  });
  tx();
}

function resetToSeed(){
  const db = config.db();
  const tx = db.transaction(()=>{
    db.prepare('DELETE FROM accounts').run();
    const insert = db.prepare('INSERT INTO accounts (vpa,holderName,balance,version) VALUES (?,?,?,0)');
    demoSeed.accounts.forEach(account => {
      insert.run(account.vpa, account.holderName, account.balance);
    });
  });
  tx();
}

module.exports = { getAll, findByVpa, updateBalanceOptimistic, adjustBalancesTransactional, resetToSeed };
