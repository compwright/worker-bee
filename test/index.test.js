const assert = require('assert');
const sinon = require('sinon');
const Worker = require('../lib');

function applyMocks () {
  sinon.stub(process, 'exit');
  sinon.stub(process, 'on');
  sinon.stub(process, 'uptime');
}

function removeMocks () {
  process.exit.restore();
  process.on.restore();
  process.uptime.restore();
}

function mockQueue () {
  const fakeQueue = {
    ready: sinon.fake.resolves(),
    checkStalledJobs: sinon.fake(
      (interval, fn = () => {}) => fn()
    ),
    process: sinon.fake(
      (concurrency, fn = () => {}) => fn({ id: 1 })
    ),
    close: sinon.fake.resolves(),
    checkHealth: sinon.fake.returns({
      waiting: 1,
      active: 2,
      succeeded: 3,
      failed: 4,
      delayed: 5
    })
  };
  sinon.mock(fakeQueue);
  return fakeQueue;
}

function mockLogger () {
  const fakeLogger = {
    log: sinon.fake(),
    error: sinon.fake()
  };
  sinon.mock(fakeLogger);
  return fakeLogger;
}

describe('Worker', () => {
  describe('.construct()', () => {
    it('is a class constructor', () => {
      assert.strictEqual(typeof Worker, 'function');
      const w = new Worker(null);
      assert(w instanceof Worker);
    });

    it('default logger = console', () => {
      const w = new Worker(null);
      assert.strictEqual(w.logger, console);
    });

    it('default concurrency = 1', () => {
      const w = new Worker(null);
      assert.strictEqual(w.options.concurrency, 1);
    });

    it('default stalledCheckInterval = 5s', () => {
      const w = new Worker(null);
      assert.strictEqual(w.options.stalledCheckInterval, 5 * 1000);
    });

    it('default shutdownTimeout = 10s', () => {
      const w = new Worker(null);
      assert.strictEqual(w.options.shutdownTimeout, 10 * 1000);
    });

    it('applies option overrides correctly', () => {
      const w = new Worker(null, { concurrency: 10 });
      assert.strictEqual(w.options.concurrency, 10);
      assert.strictEqual(w.options.stalledCheckInterval, 5 * 1000);
    });
  });

  describe('.start()', () => {
    beforeEach(applyMocks);
    afterEach(removeMocks);

    it('is a function', () => {
      const w = new Worker(null);
      assert.strictEqual(typeof w.start, 'function');
    });

    it('listens for uncaughtException', async () => {
      const w = new Worker(mockQueue(), {
        logger: mockLogger()
      });
      await w.start();
      sinon.assert.calledWith(process.on, 'uncaughtException');
    });

    it('listens for SIGINT and SIGTERM', async () => {
      const w = new Worker(mockQueue(), {
        logger: mockLogger()
      });
      await w.start();
      sinon.assert.calledWith(process.on, 'SIGINT');
      sinon.assert.calledWith(process.on, 'SIGTERM');
    });

    it('waits for the queue to be ready', async () => {
      const queue = mockQueue();
      const w = new Worker(queue, {
        logger: mockLogger()
      });
      await w.start();
      sinon.assert.called(queue.ready);
    });

    it('starts stalled job checking', async () => {
      const queue = mockQueue();
      const w = new Worker(queue, {
        logger: mockLogger()
      });
      sinon.stub(w, 'report');
      await w.start();
      sinon.assert.calledWith(queue.checkStalledJobs, 5000);
      sinon.assert.called(w.report);
    });

    it('starts job processing', async () => {
      const queue = mockQueue();
      const w = new Worker(queue, {
        concurrency: 10,
        logger: mockLogger()
      });
      const fakeHandler = sinon.fake();
      await w.start(fakeHandler);
      sinon.assert.calledWith(queue.process, 10, fakeHandler);
    });
  });

  describe('.stop()', () => {
    beforeEach(applyMocks);
    afterEach(removeMocks);

    it('is a function', () => {
      const w = new Worker(null);
      assert.strictEqual(typeof w.stop, 'function');
    });

    it('is idempotent', async () => {
      const w = new Worker(mockQueue(), {
        logger: mockLogger()
      });
      await Promise.all([w.stop(), w.stop()]);
      sinon.assert.calledOnce(process.exit);
      sinon.assert.calledWith(process.exit, 0);
    });

    it('waits for the queue to close', async () => {
      const queue = mockQueue();
      const w = new Worker(queue, {
        shutdownTimeout: 3,
        logger: mockLogger()
      });
      await w.stop();
      sinon.assert.calledWith(queue.close, 3);
      sinon.assert.calledWith(process.exit, 0);
    });

    it('exits with a non-zero exit code on error', async () => {
      const queue = mockQueue();
      const logger = mockLogger();
      const w = new Worker(queue, { logger });
      const error = new Error();
      await w.stop(error);
      sinon.assert.calledWith(logger.error, 'Error, shutting down', error);
      sinon.assert.calledWith(queue.close, 10000);
      sinon.assert.calledWith(process.exit, 1);
    });
  });

  describe('.report()', () => {
    beforeEach(applyMocks);
    afterEach(removeMocks);

    it('is a function', () => {
      const w = new Worker(null);
      assert.strictEqual(typeof w.report, 'function');
    });

    it('reports queue stats and uptime', async () => {
      const queue = mockQueue();
      const logger = mockLogger();
      const w = new Worker(queue, { logger });
      process.uptime.callsFake(() => 6);
      await w.report();
      sinon.assert.called(queue.checkHealth);
      sinon.assert.calledWith(logger.log,
        'waiting: 1, active: 2, succeeded: 3, failed: 4, delayed: 5, uptime: 6'
      );
    });
  });
});
