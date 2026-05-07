const { AppError } = require('../errors/appError');

function validateDemoSend(body) {
  const required = ['senderVpa', 'receiverVpa', 'amount', 'pin'];
  for (const key of required) {
    if (body[key] == null || body[key] === '') {
      throw new AppError(`${key} is required`, { status: 400, code: 'VALIDATION_ERROR' });
    }
  }
  if (Number.isNaN(Number(body.amount)) || Number(body.amount) <= 0) {
    throw new AppError('amount must be a positive number', { status: 400, code: 'VALIDATION_ERROR' });
  }
}

function validateBridgeIngest(body) {
  if (!body || !body.ciphertext) {
    throw new AppError('ciphertext is required', { status: 400, code: 'VALIDATION_ERROR' });
  }
}

module.exports = { validateDemoSend, validateBridgeIngest };