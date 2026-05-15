const { performance } = require('perf_hooks');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ENDPOINT = process.env.ENDPOINT || '/api/demo/send';
const TOTAL_REQUESTS = Number(process.env.TOTAL_REQUESTS || process.argv[2] || 50);

function validateOrExit() {
  if (Number.isNaN(TOTAL_REQUESTS) || TOTAL_REQUESTS <= 0) {
    console.error('TOTAL_REQUESTS must be a positive number.');
    process.exit(1);
  }

  if (typeof fetch !== 'function') {
    console.error('Global fetch is not available. Use Node.js 18+ or install axios and update this script.');
    process.exit(1);
  }
}

function buildTransaction(index) {
  const participants = ['alice@demo', 'bob@demo', 'carol@demo', 'dave@demo'];
  const senderId = participants[index % participants.length];
  const receiverId = participants[(index + 1) % participants.length];
  const amount = ((index % 20) + 1).toFixed(2);

  return { senderId, receiverId, amount };
}

async function sendTransaction(transaction) {
  const response = await fetch(`${BASE_URL}${ENDPOINT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      senderId: transaction.senderId,
      receiverId: transaction.receiverId,
      amount: transaction.amount,
      senderVpa: transaction.senderId,
      receiverVpa: transaction.receiverId,
      pin: '1234',
      ttl: 5,
      startDevice: 'phone-alice'
    })
  });

  return response.status;
}

async function main() {
  const transactions = Array.from({ length: TOTAL_REQUESTS }, (_, i) => buildTransaction(i));

  const startTime = performance.now();

  const results = await Promise.all(
    transactions.map(async (tx) => {
      try {
        const status = await sendTransaction(tx);
        return { ok: status === 200, status };
      } catch (error) {
        return { ok: false, status: 0, error: error.message };
      }
    })
  );

  const endTime = performance.now();

  const totalRequests = results.length;
  const successful = results.filter((r) => r.ok).length;
  const failed = totalRequests - successful;
  const timeTakenSeconds = (endTime - startTime) / 1000;
  const throughput = timeTakenSeconds > 0 ? totalRequests / timeTakenSeconds : 0;
  const successRate = totalRequests > 0 ? (successful / totalRequests) * 100 : 0;

  console.log('=== Load Test Results ===');
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  console.log(`Time taken: ${timeTakenSeconds.toFixed(3)} seconds`);
  console.log(`Throughput: ${throughput.toFixed(3)} txns/sec`);
  console.log(`Success rate: ${successRate.toFixed(2)}%`);
  console.log('========================');
}

module.exports = { buildTransaction, sendTransaction, main, TOTAL_REQUESTS };

if (require.main === module) {
  validateOrExit();
  main().catch((error) => {
    console.error('Load test failed:', error);
    process.exit(1);
  });
}
