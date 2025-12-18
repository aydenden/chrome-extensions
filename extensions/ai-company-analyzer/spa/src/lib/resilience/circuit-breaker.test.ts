import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 1000 });
  });

  it('초기 상태는 CLOSED', () => {
    expect(cb.getState()).toBe('CLOSED');
  });

  it('성공 시 CLOSED 유지', async () => {
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getState()).toBe('CLOSED');
  });

  it('임계치 도달 시 OPEN', async () => {
    for (let i = 0; i < 3; i++) {
      try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
    }
    expect(cb.getState()).toBe('OPEN');
  });

  it('OPEN 상태에서 CircuitOpenError', async () => {
    cb.trip();
    await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toThrow(CircuitOpenError);
  });

  it('타임아웃 후 HALF_OPEN', async () => {
    vi.useFakeTimers();
    cb.trip();
    expect(cb.getState()).toBe('OPEN');
    vi.advanceTimersByTime(1000);
    expect(cb.getState()).toBe('HALF_OPEN');
    vi.useRealTimers();
  });

  it('HALF_OPEN에서 성공 시 CLOSED', async () => {
    vi.useFakeTimers();
    cb.trip();
    vi.advanceTimersByTime(1000);
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getState()).toBe('CLOSED');
    vi.useRealTimers();
  });
});
