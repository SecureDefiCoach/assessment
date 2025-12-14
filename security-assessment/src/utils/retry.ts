/**
 * Retry mechanism utilities for handling transient failures
 */

import { logger } from './logger';
import { SecurityAssessmentError, ErrorHandler } from './errors';

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
export const DEFAULT_RETRY_OPTIONS: Record<string, RetryOptions> = {
  containerCreation: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterMs: 500,
    retryCondition: (error: Error) => {
      // Retry on transient Docker errors but not on configuration errors
      const transientPatterns = [
        /network.*not.*found/i,
        /image.*not.*found/i,
        /temporary.*failure/i,
        /connection.*refused/i,
        /timeout/i,
      ];
      
      return transientPatterns.some(pattern => pattern.test(error.message)) &&
             ErrorHandler.isRecoverable(error);
    },
  },
  
  resourceAllocation: {
    maxAttempts: 5,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 1.5,
    jitterMs: 200,
    retryCondition: (error: Error) => {
      // Retry on resource contention but not on hard limits
      const retryablePatterns = [
        /resource.*temporarily.*unavailable/i,
        /device.*busy/i,
        /try.*again/i,
      ];
      
      return retryablePatterns.some(pattern => pattern.test(error.message)) &&
             !error.message.includes('exceeded') &&
             ErrorHandler.isRecoverable(error);
    },
  },
  
  networkOperation: {
    maxAttempts: 4,
    baseDelayMs: 2000,
    maxDelayMs: 15000,
    backoffMultiplier: 2,
    jitterMs: 1000,
    retryCondition: (error: Error) => {
      // Retry on network errors but not on security violations
      return !ErrorHandler.isSecurityViolation(error) &&
             ErrorHandler.isRecoverable(error);
    },
  },
  
  analysisExecution: {
    maxAttempts: 2,
    baseDelayMs: 3000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterMs: 500,
    retryCondition: (error: Error) => {
      // Limited retries for analysis operations
      const retryablePatterns = [
        /tool.*not.*ready/i,
        /temporary.*lock/i,
        /resource.*busy/i,
      ];
      
      return retryablePatterns.some(pattern => pattern.test(error.message)) &&
             ErrorHandler.isRecoverable(error);
    },
  },
};

/**
 * Executes a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
  operationName: string = 'operation'
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let lastError: Error | undefined;
  let actualAttempts = 0;
  
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    actualAttempts = attempt;
    
    try {
      logger.debug(`Executing ${operationName}, attempt ${attempt}/${options.maxAttempts}`);
      
      const result = await operation();
      
      const duration = Date.now() - startTime;
      logger.info(`${operationName} succeeded on attempt ${attempt}`, {
        attempts: attempt,
        duration,
      });
      
      return {
        success: true,
        result,
        attempts: attempt,
        totalDuration: duration,
      };
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      logger.warn(`${operationName} failed on attempt ${attempt}`, {
        error: lastError.message,
        attempt,
        maxAttempts: options.maxAttempts,
      });
      
      // Check if we should retry this error
      const shouldRetry = options.retryCondition ? options.retryCondition(lastError) : true;
      
      if (!shouldRetry) {
        logger.info(`${operationName} failed with non-retryable error`, {
          error: lastError.message,
          attempt,
        });
        break;
      }
      
      // Don't wait after the last attempt
      if (attempt < options.maxAttempts) {
        const delay = calculateDelay(attempt, options);
        
        logger.debug(`Waiting ${delay}ms before retry ${attempt + 1}`, {
          operationName,
          attempt,
          delay,
        });
        
        // Call onRetry callback if provided
        if (options.onRetry) {
          try {
            options.onRetry(lastError, attempt);
          } catch (callbackError) {
            logger.warn('Error in retry callback', { error: callbackError });
          }
        }
        
        await sleep(delay);
      }
    }
  }
  
  const duration = Date.now() - startTime;
  logger.error(`${operationName} failed after ${actualAttempts} attempts`, {
    error: lastError?.message,
    attempts: actualAttempts,
    duration,
  });
  
  return {
    success: false,
    error: lastError,
    attempts: actualAttempts,
    totalDuration: duration,
  };
}

/**
 * Calculates delay for exponential backoff with jitter
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  // Calculate exponential backoff delay
  const exponentialDelay = Math.min(
    options.baseDelayMs * Math.pow(options.backoffMultiplier, attempt - 1),
    options.maxDelayMs
  );
  
  // Add jitter to prevent thundering herd
  const jitter = options.jitterMs ? Math.random() * options.jitterMs : 0;
  
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Sleep utility function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry decorator for class methods
 */
export function retry(options: RetryOptions) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const result = await withRetry(
        () => method.apply(this, args),
        options,
        `${target.constructor.name}.${propertyName}`
      );
      
      if (result.success) {
        return result.result;
      } else {
        throw result.error || new Error(`${propertyName} failed after ${result.attempts} attempts`);
      }
    };
    
    return descriptor;
  };
}

/**
 * Circuit breaker pattern for preventing cascading failures
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeoutMs: number = 60000,
    private readonly successThreshold: number = 2
  ) {}
  
  async execute<T>(operation: () => Promise<T>, operationName: string = 'operation'): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeoutMs) {
        throw new Error(`Circuit breaker is open for ${operationName}`);
      } else {
        this.state = 'half-open';
        logger.info(`Circuit breaker transitioning to half-open for ${operationName}`);
      }
    }
    
    try {
      const result = await operation();
      
      if (this.state === 'half-open') {
        this.failures = 0; // Reset failures on success in half-open state
        this.state = 'closed';
        logger.info(`Circuit breaker closed for ${operationName}`);
      }
      
      return result;
      
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.failureThreshold) {
        this.state = 'open';
        logger.warn(`Circuit breaker opened for ${operationName}`, {
          failures: this.failures,
          threshold: this.failureThreshold,
        });
      }
      
      throw error;
    }
  }
  
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
  
  reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'closed';
  }
}