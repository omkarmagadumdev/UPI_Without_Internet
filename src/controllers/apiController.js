const config = require('../config');
const accountRepo = require('../repository/accountRepository');
const txRepo = require('../repository/transactionRepository');
const cryptoSvc = require('../services/cryptoService');

function serverKey(req,res){
  res.json(cryptoSvc.getPublicKey());
}

function accounts(req,res){
  res.json(accountRepo.getAll());
}

function transactions(req,res){
  res.json(txRepo.listLatest(20));
}

function metrics(req,res){
  const idempotency = config.db().prepare('SELECT COUNT(1) as c FROM idempotency').get().c;
  res.json({
    ...txRepo.getMetrics(),
    idempotencyCacheSize: Number(idempotency || 0)
  });
}

module.exports = { serverKey, accounts, transactions, metrics };
