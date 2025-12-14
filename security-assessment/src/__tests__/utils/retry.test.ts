/**
 * Tests for retry mechanism utilities
 */

import { withRetry, DEFAULT_RETRY_OPTIONS, CircuitBreaker } from '../../utils/retry';

describe('withRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should succeed on first attempt', async () => {
    const operation = jest.fn().mockResolvedValue('success');
    const options = {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
    };

    const result = await withRetry(operation, options, 'test-operation');

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('success');

    const options = {
      maxAttempts: 3,
      baseDelayMs: 10, // Short delay for testing
      maxDelayMs: 100,
      backoffMultiplier: 2,
    };

    const result = await withRetry(operation, options, 'test-operation');

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(3);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should fail after max attempts', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));
    const options = {
      maxAttempts: 2,
      baseDelayMs: 10,
      maxDelayMs: 100,
      backoffMultiplier: 2,
    };

    const result = await withRetry(operation, options, 'test-operation');

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('Persistent failure');
    expect(result.attempts).toBe(2);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should respect retry condition', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Non-retryable error'));
    const options = {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 100,
      backoffMultiplier: 2,
      retryCondition: (error: Error) => !error.message.includes('Non-retryable'),
    };

    const result = await withRetry(operation, options, 'test-operation');

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1); // Should stop after first attempt due to retry condition
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should call onRetry callback', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValue('success');

    const onRetry = jest.fn();
    const options = {
      maxAttempts: 2,
      baseDelayMs: 10,
      maxDelayMs: 100,
      backoffMultiplier: 2,
      onRetry,
    };

    const result = await withRetry(operation, options, 'test-operation');

    expect(result.success).toBe(true);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  it('should handle onRetry callback errors gracefully', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValue('success');

    const onRetry = jest.fn().mockImplementation(() => {
      throw new Error('Callback error');
    });

    const options = {
      maxAttempts: 2,
      baseDelayMs: 10,
      maxDelayMs: 100,
      backoffMultiplier: 2,
      onRetry,
    };

    // Should not throw despite callback error
    const result = await withRetry(operation, options, 'test-operation');

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
  });
});

describe('DEFAULT_RETRY_OPTIONS', () => {
  it('should have container creation options', () => {
    const options = DEFAULT_RETRY_OPTIONS.containerCreation;
    
    expect(options.maxAttempts).toBe(3);
    expect(options.baseDelayMs).toBe(1000);
    expect(options.retryCondition).toBeDefined();
  });

  it('should have resource allocation options', () => {
    const options = DEFAULT_RETRY_OPTIONS.resourceAllocation;
    
    expect(options.maxAttempts).toBe(5);
    expect(options.baseDelayMs).toBe(500);
    expect(options.retryCondition).toBeDefined();
  });

  it('container creation retry condition should work correctly', () => {
    const options = DEFAULT_RETRY_OPTIONS.containerCreation;
    const retryCondition = options.retryCondition!;

    // Should retry on transient errors
    expect(retryCondition(new Error('network not found'))).toBe(true);
    expect(retryCondition(new Error('image not found'))).toBe(true);
    expect(retryCondition(new Error('temporary failure'))).toBe(true);

    // Should not retry on configuration errors
    expect(retryCondition(new Error('invalid configuration'))).toBe(false);
  });
});

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(2, 1000, 1); // 2 failures, 1s timeout, 1 success to close
  });

  it('should start in closed state', () => {
    expect(circuitBreaker.getState()).toBe('closed');
  });

  it('should open after failure threshold', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Failure'));

    // First failure
    await expect(circuitBreaker.execute(operation, 'test')).rejects.toThrow('Failure');
    expect(circuitBreaker.getState()).toBe('closed');

    // Second failure - should open circuit
    await expect(circuitBreaker.execute(operation, 'test')).rejects.toThrow('Failure');
    expect(circuitBreaker.getState()).toBe('open');
  });

  it('should reject immediately when open', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Failure'));

    // Trigger failures to open circuit
    await expect(circuitBreaker.execute(operation, 'test')).rejects.toThrow();
    await expect(circuitBreaker.execute(operation, 'test')).rejects.toThrow();
    expect(circuitBreaker.getState()).toBe('open');

    // Should reject immediately without calling operation
    operation.mockClear();
    await expect(circuitBreaker.execute(operation, 'test')).rejects.toThrow('Circuit breaker is open');
    expect(operation).not.toHaveBeenCalled();
  });

  it('should transition to half-open after timeout', async () => {
    // Use a circuit breaker with shorter timeout for testing
    const testCircuitBreaker = new CircuitBreaker(2, 10, 1); // 2 failures, 10ms timeout, 1 success to close
    const operation = jest.fn().mockRejectedValue(new Error('Failure'));

    // Open the circuit
    await expect(testCircuitBreaker.execute(operation, 'test')).rejects.toThrow();
    await expect(testCircuitBreaker.execute(operation, 'test')).rejects.toThrow();
    expect(testCircuitBreaker.getState()).toBe('open');

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 15));

    // Next call should transition to half-open and then succeed
    operation.mockResolvedValueOnce('success');
    const result = await testCircuitBreaker.execute(operation, 'test');
    expect(result).toBe('success');
    expect(testCircuitBreaker.getState()).toBe('closed');
  });

  it('should reset state', () => {
    circuitBreaker.reset();
    expect(circuitBreaker.getState()).toBe('closed');
  });
});