# @compwright/worker-bee

[![Build Status](https://travis-ci.org/compwright/worker-bee.png?branch=master)](https://travis-ci.org/compwright/worker-bee)
[![Code Climate](https://codeclimate.com/github/compwright/worker-bee/badges/gpa.svg)](https://codeclimate.com/github/compwright/worker-bee)
[![Test Coverage](https://codeclimate.com/github/compwright/worker-bee/badges/coverage.svg)](https://codeclimate.com/github/compwright/worker-bee/coverage)
[![Dependency Status](https://img.shields.io/david/compwright/worker-bee.svg?style=flat-square)](https://david-dm.org/compwright/worker-bee)
[![Download Status](https://img.shields.io/npm/dm/@compwright/worker-bee.svg?style=flat-square)](https://www.npmjs.com/package/@compwright/worker-bee)

A process wrapper for [Bee-Queue](https://www.npmjs.com/package/bee-queue) workers.

## Installation

```
npm install --save @compwright/worker-bee
```

## Basic Usage

Single-threaded usage: 

```javascript
const Queue = require('bee-queue');
const Worker = require('@compwright/worker-bee');

const queue = new Queue('test-queue');

worker = new Worker(queue);

worker.start(async (job) => {
  job.reportProgress(100);
  console.log(`Job ${job.id} completed`);
});
```

Pressing CTRL+C or sending a SIGINT or SIGTERM signal will cause the worker to gracefully shut down and exit.

## Cluster Usage

Bee-Queue supports workers in multiple processes or servers. Here is a multi-process worker example using the [throng](https://npmjs.org/package/throng) process manager:

```javascript
const throng = require('throng');
const Queue = require('bee-queue');
const Worker = require('@compwright/worker-bee');

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// throng by default forks one worker per CPU
throng(pid => {
  console.log(`Worker ${pid} started`);

  const queue = new Queue('test-queue');

  const logger = {
    log: (...args) => console.log(`[${pid}]`, ...args),
    error: (...args) => console.error(`[${pid}]`, ...args),
  };

  // handle six jobs concurrently per worker process
  worker = new Worker(queue, { concurrency: 6, logger });

  worker.start(async (job) => {
    for (var i = 0; i < 5; i++) {
      job.reportProgress(100 * i / 5);
    }
    console.log(`Job ${job.id} completed`);
  });
});
```

Throng will relay the shutdown signal to each worker process to tell them to gracefully shut down and exit.

## Documentation

### `new Worker(queue, [options])`

Returns a new worker instance initialized with the given options.

__Options:__

- `queue` - A Bee-Queue queue instance
- `shutdownTimeout` (*optional*) - time to wait in milliseconds for worker processing to stop before terminating (see `Queue.close()`)
- `stalledCheckInterval` (*optional*) - how often to check for stalled jobs in milliseconds (see `Queue.checkStalledJobs()`)
- `concurrency` (*optional*) - how many jobs to process concurrently within the worker thread (see `Queue.process()`)
- `logger` (*optional*) - logger instance to use instead of `console` (must be interface-compatible with `console`)

### `worker.start(callbackFn)`

Listen for jobs to process.

__Options:__

- `callbackFn` - a function to execute the job. Receives the `job` as the first argument.

### `worker.stop(error)`

Stop listening for jobs to process.

Called automatically on SIGINT or SIGTERM signals (such as CTRL+C), and if an uncaught exception occurs.

__Options:__

- `error` - an error object to associate with the shutdown. If passed, causes a non-zero exit code.

## License

Copyright (c) 2019

Licensed under the [MIT license](LICENSE).
