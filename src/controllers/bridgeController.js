const bridgeIngest = require('../services/bridgeIngestService');
const validators = require('../validators');

async function ingest(req,res){
  const {ciphertext, bridgeId} = req.body;
  validators.validateBridgeIngest(req.body);
  const result = await bridgeIngest.ingest({ciphertext, bridgeId: bridgeId||'bridge-1'});
  res.json(result);
}

module.exports = { ingest };
