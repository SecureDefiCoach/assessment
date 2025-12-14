/**
 * Retry mechanism utilities for handling transient failures
 */
export interface RetryOptions {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    jitterMs?: number;
    retryCondition?: (error: Error) => boolean;
    onRetry?: (error: Error, attempt: number) => void;
}
export interface RetryResult<T> {
    success: boolean;
    result?: T;
    error?: Error;
    attempts: number;
    totalDuration: number;
}
/**
 * Default retry options for different operation types
 */
export declare const DEFAULT_RETRY_OPTIONS: Record<string, RetryOptions>;
/**
 * Executes a function with retry logic and exponential backoff
 */
export declare function withRetry<T>(operation: () => Promise<T>, options: RetryOptions, operationName?: string): Promise<RetryResult<T>>;
/**
 * Retry decorator for class methods
 */
export declare function retry(options: RetryOptions): (target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Circuit breaker pattern for preventing cascading failures
 */
export declare class CircuitBreaker {
    private readonly failureThreshold;
    private readonly recoveryTimeoutMs;
    private readonly successThreshold;
    private failures;
    private lastFailureTime;
    private state;
    constructor(failureThreshold?: number, recoveryTimeoutMs?: number, successThreshold?: number);
    execute<T>(operation: () => Promise<T>, operationName?: string): Promise<T>;
    getState(): 'closed' | 'open' | 'half-open';
    reset(): void;
}
//# sourceMappingURL=retry.d.ts.map