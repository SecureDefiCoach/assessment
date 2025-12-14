"use strict";
/**
 * Retry mechanism utilities for handling transient failures
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.DEFAULT_RETRY_OPTIONS = void 0;
exports.withRetry = withRetry;
exports.retry = retry;
const logger_1 = require("./logger");
const errors_1 = require("./errors");
/**
 * Default retry options for different operation types
 */
exports.DEFAULT_RETRY_OPTIONS = {
    containerCreation: {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        jitterMs: 500,
        retryCondition: (error) => {
            // Retry on transient Docker errors but not on configuration errors
            const transientPatterns = [
                /network.*not.*found/i,
                /image.*not.*found/i,
                /temporary.*failure/i,
                /connection.*refused/i,
                /timeout/i,
            ];
            return transientPatterns.some(pattern => pattern.test(error.message)) &&
                errors_1.ErrorHandler.isRecoverable(error);
        },
    },
    resourceAllocation: {
        maxAttempts: 5,
        baseDelayMs: 500,
        maxDelayMs: 5000,
        backoffMultiplier: 1.5,
        jitterMs: 200,
        retryCondition: (error) => {
            // Retry on resource contention but not on hard limits
            const retryablePatterns = [
                /resource.*temporarily.*unavailable/i,
                /device.*busy/i,
                /try.*again/i,
            ];
            return retryablePatterns.some(pattern => pattern.test(error.message)) &&
                !error.message.includes('exceeded') &&
                errors_1.ErrorHandler.isRecoverable(error);
        },
    },
    networkOperation: {
        maxAttempts: 4,
        baseDelayMs: 2000,
        maxDelayMs: 15000,
        backoffMultiplier: 2,
        jitterMs: 1000,
        retryCondition: (error) => {
            // Retry on network errors but not on security violations
            return !errors_1.ErrorHandler.isSecurityViolation(error) &&
                errors_1.ErrorHandler.isRecoverable(error);
        },
    },
    analysisExecution: {
        maxAttempts: 2,
        baseDelayMs: 3000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        jitterMs: 500,
        retryCondition: (error) => {
            // Limited retries for analysis operations
            const retryablePatterns = [
                /tool.*not.*ready/i,
                /temporary.*lock/i,
                /resource.*busy/i,
            ];
            return retryablePatterns.some(pattern => pattern.test(error.message)) &&
                errors_1.ErrorHandler.isRecoverable(error);
        },
    },
};
/**
 * Executes a function with retry logic and exponential backoff
 */
async function withRetry(operation, options, operationName = 'operation') {
    const startTime = Date.now();
    let lastError;
    let actualAttempts = 0;
    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
        actualAttempts = attempt;
        try {
            logger_1.logger.debug(`Executing ${operationName}, attempt ${attempt}/${options.maxAttempts}`);
            const result = await operation();
            const duration = Date.now() - startTime;
            logger_1.logger.info(`${operationName} succeeded on attempt ${attempt}`, {
                attempts: attempt,
                duration,
            });
            return {
                success: true,
                result,
                attempts: attempt,
                totalDuration: duration,
            };
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            logger_1.logger.warn(`${operationName} failed on attempt ${attempt}`, {
                error: lastError.message,
                attempt,
                maxAttempts: options.maxAttempts,
            });
            // Check if we should retry this error
            const shouldRetry = options.retryCondition ? options.retryCondition(lastError) : true;
            if (!shouldRetry) {
                logger_1.logger.info(`${operationName} failed with non-retryable error`, {
                    error: lastError.message,
                    attempt,
                });
                break;
            }
            // Don't wait after the last attempt
            if (attempt < options.maxAttempts) {
                const delay = calculateDelay(attempt, options);
                logger_1.logger.debug(`Waiting ${delay}ms before retry ${attempt + 1}`, {
                    operationName,
                    attempt,
                    delay,
                });
                // Call onRetry callback if provided
                if (options.onRetry) {
                    try {
                        options.onRetry(lastError, attempt);
                    }
                    catch (callbackError) {
                        logger_1.logger.warn('Error in retry callback', { error: callbackError });
                    }
                }
                await sleep(delay);
            }
        }
    }
    const duration = Date.now() - startTime;
    logger_1.logger.error(`${operationName} failed after ${actualAttempts} attempts`, {
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
function calculateDelay(attempt, options) {
    // Calculate exponential backoff delay
    const exponentialDelay = Math.min(options.baseDelayMs * Math.pow(options.backoffMultiplier, attempt - 1), options.maxDelayMs);
    // Add jitter to prevent thundering herd
    const jitter = options.jitterMs ? Math.random() * options.jitterMs : 0;
    return Math.floor(exponentialDelay + jitter);
}
/**
 * Sleep utility function
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Retry decorator for class methods
 */
function retry(options) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            const result = await withRetry(() => method.apply(this, args), options, `${target.constructor.name}.${propertyName}`);
            if (result.success) {
                return result.result;
            }
            else {
                throw result.error || new Error(`${propertyName} failed after ${result.attempts} attempts`);
            }
        };
        return descriptor;
    };
}
/**
 * Circuit breaker pattern for preventing cascading failures
 */
class CircuitBreaker {
    constructor(failureThreshold = 5, recoveryTimeoutMs = 60000, successThreshold = 2) {
        this.failureThreshold = failureThreshold;
        this.recoveryTimeoutMs = recoveryTimeoutMs;
        this.successThreshold = successThreshold;
        this.failures = 0;
        this.lastFailureTime = 0;
        this.state = 'closed';
    }
    async execute(operation, operationName = 'operation') {
        if (this.state === 'open') {
            if (Date.now() - this.lastFailureTime < this.recoveryTimeoutMs) {
                throw new Error(`Circuit breaker is open for ${operationName}`);
            }
            else {
                this.state = 'half-open';
                logger_1.logger.info(`Circuit breaker transitioning to half-open for ${operationName}`);
            }
        }
        try {
            const result = await operation();
            if (this.state === 'half-open') {
                this.failures = 0; // Reset failures on success in half-open state
                this.state = 'closed';
                logger_1.logger.info(`Circuit breaker closed for ${operationName}`);
            }
            return result;
        }
        catch (error) {
            this.failures++;
            this.lastFailureTime = Date.now();
            if (this.failures >= this.failureThreshold) {
                this.state = 'open';
                logger_1.logger.warn(`Circuit breaker opened for ${operationName}`, {
                    failures: this.failures,
                    threshold: this.failureThreshold,
                });
            }
            throw error;
        }
    }
    getState() {
        return this.state;
    }
    reset() {
        this.failures = 0;
        this.lastFailureTime = 0;
        this.state = 'closed';
    }
}
exports.CircuitBreaker = CircuitBreaker;
//# sourceMappingURL=retry.js.map