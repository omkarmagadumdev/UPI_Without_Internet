class Account {
  constructor(vpa, holderName, balance, version = 0) {
    this.vpa = vpa;
    this.holderName = holderName;
    this.balance = balance;
    this.version = version;
  }
}

module.exports = Account;