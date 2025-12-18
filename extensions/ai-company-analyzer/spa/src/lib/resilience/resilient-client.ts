import { CircuitBreaker } from './circuit-breaker';
import { retry, type RetryOptions } from './retry';
import type { IExtensionHandler } from '@/lib/extension-client/types';

interface ResilientClientOptions {
  circuitBreaker?: Partial<ConstructorParameters<typeof CircuitBreaker>[0]>;
  retry?: RetryOptions;
}

export class ResilientClient {
  private readonly client: IExtensionHandler;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly retryOptions?: RetryOptions;

  constructor(client: IExtensionHandler, options: ResilientClientOptions = {}) {
    this.client = client;
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
    this.retryOptions = options.retry;
  }

  async send<T extends string>(type: T, payload?: any): Promise<any> {
    return this.circuitBreaker.execute(() => {
      if (this.retryOptions) {
        return retry(() => this.client.send(type as any, payload), this.retryOptions);
      }
      return this.client.send(type as any, payload);
    });
  }

  getCircuitStatus() {
    return this.circuitBreaker.getStatus();
  }

  resetCircuit() {
    this.circuitBreaker.reset();
  }

  isCircuitOpen(): boolean {
    return this.circuitBreaker.getState() === 'OPEN';
  }
}
