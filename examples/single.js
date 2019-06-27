const Queue = require('bee-queue');
const Worker = require('../lib');

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log(`Worker started`);

const queue = new Queue('test-queue');

worker = new Worker(queue, {
  concurrency: 10
});

worker.start(async (job) => {
  for (var i = 0; i < 5; i++) {
    await timeout(1000);
    job.reportProgress(100 * i / 5);
  }
});
