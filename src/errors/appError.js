class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.status = options.status || 400;
    this.code = options.code || 'BAD_REQUEST';
  }
}

module.exports = { AppError };