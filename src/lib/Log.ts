import { Api } from './Api';

// creates a log class singleton that has console.log and console.error and console.warn. It should console log but also save all input to a string and once the app closes, we should send it to the server.
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
};

export class Log {
  private static instance: Log;
  private logs: string = '';

  private constructor() {}

  public static getInstance(): Log {
    if (!Log.instance) {
      Log.instance = new Log();
    }
    return Log.instance;
  }

  public log(...data: any[]): void {
    this.logs += data.join('\n') + '\n';
    originalConsole.log(...data);
  }

  public error(message: unknown, err?: unknown): void {
    this.logs += message + '\n';
    originalConsole.error(message);
  }

  public warn(message: string): void {
    this.logs += message + '\n';
    originalConsole.warn(message);
  }

  public async sendLogs(): Promise<void> {
    await Api.SendLogs(this.logs);
  }
}

const LOGGER = Log.getInstance();
export default LOGGER;

declare var console: {
  log: typeof LOGGER.log;
  error: typeof LOGGER.error;
  warn: typeof LOGGER.warn;
};

console = {
  log: LOGGER.log.bind(LOGGER),
  error: LOGGER.error.bind(LOGGER),
  warn: LOGGER.warn.bind(LOGGER),
};
