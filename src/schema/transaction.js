class Transaction {
  constructor(fields = {}) {
    Object.assign(this, fields);
  }
}

module.exports = Transaction;