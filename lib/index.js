const defaults = {
  stalledCheckInterval: 5 * 1000,
  shutdownTimeout: 10 * 1000,
  concurrency: 1,
  logger: console
};

class Worker {
  constructor (queue, options = {}) {
    this.dying = false;
    this.queue = queue;
    this.options = Object.assign({}, defaults, options);
    this.logger = this.options.logger;
  }

  async start (handler) {
    process.on('uncaughtException', this.stop.bind(this));
    process.on('SIGINT', this.stop.bind(this));
    process.on('SIGTERM', this.stop.bind(this));

    this.logger.log('Awaiting queue...');

    await this.queue.ready();

    this.queue.checkStalledJobs(
      this.options.stalledCheckInterval,
      this.report.bind(this)
    );

    this.logger.log('Queue ready, awaiting jobs...');

    this.queue.process(this.options.concurrency, handler);
  }

  async stop (error) {
    if (this.dying) {
      return;
    }

    this.dying = true;

    if (error) {
      this.logger.error('Error, shutting down', error);
    } else {
      this.logger.log('Shutting down on signal');
    }

    try {
      await this.queue.close(this.options.shutdownTimeout);
      process.exit(error ? 1 : 0);
    } catch (e) {
      this.logger.error('Failed to shut down gracefully', e);
      process.exit(8);
    }
  }

  async report () {
    const uptime = process.uptime();
    const { waiting, active, succeeded, failed, delayed } = await this.queue.checkHealth();
    this.logger.log(`waiting: ${waiting}, active: ${active}, succeeded: ${succeeded}, failed: ${failed}, delayed: ${delayed}, uptime: ${uptime}`);
  }
}

module.exports = Worker;
