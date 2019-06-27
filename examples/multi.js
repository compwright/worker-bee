const throng = require('throng');
const Queue = require('bee-queue');
const Worker = require('../lib');

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

throng(pid => {
  console.log(`Worker ${pid} started`);

  const queue = new Queue('test-queue');

  worker = new Worker(queue, {
    shutdownTimeout: 10000,
    stalledCheckInterval: 5000,
    concurrency: 2,
    logger: {
      log: (...args) => console.log(`[${pid}]`, ...args),
      error: (...args) => console.error(`[${pid}]`, ...args),
    }
  });

  worker.start(async (job) => {
    for (var i = 0; i < 5; i++) {
      await timeout(1000);
      job.reportProgress(100 * i / 5);
    }
  });
});
