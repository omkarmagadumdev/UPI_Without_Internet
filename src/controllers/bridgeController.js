const bridgeIngest = require('../services/bridgeIngestService');
const validators = require('../validators');

function ingest(req,res){
  const {ciphertext, bridgeId} = req.body;
  validators.validateBridgeIngest(req.body);
  const result = bridgeIngest.ingest({ciphertext, bridgeId: bridgeId||'bridge-1'});
  res.json(result);
}

module.exports = { ingest };
