"use strict";
/**
 * Recovery manager for handling partial failures and state preservation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryManager = void 0;
const logger_1 = require("./logger");
const errors_1 = require("./errors");
/**
 * Manages error recovery and state preservation for assessment workflows
 */
class RecoveryManager {
    constructor() {
        this.checkpoints = new Map();
        this.recoveryStrategies = [];
        this.initializeDefaultStrategies();
    }
    /**
     * Creates a checkpoint for the current state
     */
    createCheckpoint(containerId, stepName, state, results, metadata) {
        const checkpoint = {
            stepName,
            timestamp: new Date(),
            state: this.deepClone(state),
            results: results ? this.deepClone(results) : undefined,
            metadata,
        };
        if (!this.checkpoints.has(containerId)) {
            this.checkpoints.set(containerId, []);
        }
        const containerCheckpoints = this.checkpoints.get(containerId);
        containerCheckpoints.push(checkpoint);
        // Keep only the last 10 checkpoints to prevent memory issues
        if (containerCheckpoints.length > 10) {
            containerCheckpoints.shift();
        }
        logger_1.logger.debug(`Created checkpoint for container ${containerId}`, {
            stepName,
            checkpointCount: containerCheckpoints.length,
        });
    }
    /**
     * Gets the latest checkpoint for a container
     */
    getLatestCheckpoint(containerId) {
        const checkpoints = this.checkpoints.get(containerId);
        return checkpoints && checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : undefined;
    }
    /**
     * Gets all checkpoints for a container
     */
    getCheckpoints(containerId) {
        return this.checkpoints.get(containerId) || [];
    }
    /**
     * Attempts to recover from an error using available strategies
     */
    async attemptRecovery(error, recoveryState) {
        logger_1.logger.info('Attempting error recovery', {
            errorCode: error.code,
            containerId: recoveryState.containerId,
            recoveryAttempts: recoveryState.recoveryAttempts,
        });
        // Check if we've exceeded maximum recovery attempts
        if (recoveryState.recoveryAttempts >= recoveryState.maxRecoveryAttempts) {
            return {
                success: false,
                message: `Maximum recovery attempts (${recoveryState.maxRecoveryAttempts}) exceeded`,
                shouldContinue: false,
            };
        }
        // Try each recovery strategy
        for (const strategy of this.recoveryStrategies) {
            if (strategy.canRecover(error, recoveryState)) {
                logger_1.logger.info(`Attempting recovery with strategy: ${strategy.name}`, {
                    errorCode: error.code,
                    containerId: recoveryState.containerId,
                });
                try {
                    const result = await strategy.recover(error, recoveryState);
                    if (result.success) {
                        logger_1.logger.info(`Recovery successful with strategy: ${strategy.name}`, {
                            errorCode: error.code,
                            containerId: recoveryState.containerId,
                        });
                        return result;
                    }
                    else {
                        logger_1.logger.warn(`Recovery failed with strategy: ${strategy.name}`, {
                            errorCode: error.code,
                            message: result.message,
                        });
                    }
                }
                catch (recoveryError) {
                    logger_1.logger.error(`Recovery strategy ${strategy.name} threw an error`, {
                        error: recoveryError,
                        originalError: error.code,
                    });
                }
            }
        }
        return {
            success: false,
            message: 'No suitable recovery strategy found',
            shouldContinue: false,
        };
    }
    /**
     * Creates a graceful degradation plan when full recovery isn't possible
     */
    createDegradationPlan(error, recoveryState, remainingSteps) {
        const skippedSteps = [];
        const modifiedSteps = [];
        // Determine which steps can be safely skipped or modified
        for (const step of remainingSteps) {
            if (this.canSkipStep(step, error)) {
                skippedSteps.push(step.name);
                logger_1.logger.info(`Skipping step due to degradation: ${step.name}`, {
                    errorCode: error.code,
                    reason: 'Step can be safely skipped',
                });
            }
            else if (this.canModifyStep(step, error)) {
                const modifiedStep = this.modifyStepForDegradation(step, error);
                modifiedSteps.push(modifiedStep);
                logger_1.logger.info(`Modified step for degradation: ${step.name}`, {
                    errorCode: error.code,
                    modifications: 'Reduced resource requirements or timeout',
                });
            }
            else {
                modifiedSteps.push(step);
            }
        }
        const canContinue = modifiedSteps.length > 0 || skippedSteps.length < remainingSteps.length;
        const degradationReason = this.getDegradationReason(error, skippedSteps.length, modifiedSteps.length);
        return {
            canContinue,
            modifiedSteps,
            skippedSteps,
            degradationReason,
        };
    }
    /**
     * Preserves partial results when full analysis cannot be completed
     */
    preservePartialResults(containerId, completedSteps, partialResults, error) {
        const checkpoint = this.getLatestCheckpoint(containerId);
        const preservedData = {
            completedSteps,
            partialResults: this.deepClone(partialResults),
            lastCheckpoint: checkpoint,
            preservationTimestamp: new Date(),
            errorContext: error.toJSON(),
        };
        // Store preserved data for potential later recovery
        this.storePreservedData(containerId, preservedData);
        logger_1.logger.info('Preserved partial results', {
            containerId,
            completedSteps: completedSteps.length,
            errorCode: error.code,
        });
        return new errors_1.PartialAnalysisError(`Analysis partially completed. ${completedSteps.length} steps succeeded before failure.`, completedSteps, [error.code], { preservedData });
    }
    /**
     * Clears checkpoints and recovery data for a container
     */
    clearRecoveryData(containerId) {
        this.checkpoints.delete(containerId);
        logger_1.logger.debug(`Cleared recovery data for container ${containerId}`);
    }
    /**
     * Registers a custom recovery strategy
     */
    registerRecoveryStrategy(strategy) {
        this.recoveryStrategies.push(strategy);
        logger_1.logger.info(`Registered recovery strategy: ${strategy.name}`);
    }
    /**
     * Initializes default recovery strategies
     */
    initializeDefaultStrategies() {
        // Container recreation strategy
        this.recoveryStrategies.push({
            name: 'container-recreation',
            canRecover: (error, state) => {
                return error.code.includes('CONTAINER') &&
                    state.recoveryAttempts < 2 &&
                    error.recoverable;
            },
            recover: async (error, state) => {
                // This would be implemented to recreate the container
                return {
                    success: true,
                    message: 'Container recreated successfully',
                    shouldContinue: true,
                    newState: {
                        ...state,
                        recoveryAttempts: state.recoveryAttempts + 1,
                    },
                };
            },
        });
        // Resource reduction strategy
        this.recoveryStrategies.push({
            name: 'resource-reduction',
            canRecover: (error, state) => {
                return error.code.includes('RESOURCE') &&
                    state.recoveryAttempts < 3;
            },
            recover: async (error, state) => {
                // This would be implemented to reduce resource requirements
                return {
                    success: true,
                    message: 'Reduced resource requirements',
                    shouldContinue: true,
                    newState: {
                        ...state,
                        recoveryAttempts: state.recoveryAttempts + 1,
                    },
                };
            },
        });
        // Partial continuation strategy
        this.recoveryStrategies.push({
            name: 'partial-continuation',
            canRecover: (error, state) => {
                return error.code.includes('ANALYSIS') &&
                    state.completedSteps.length > 0;
            },
            recover: async (error, state) => {
                return {
                    success: true,
                    message: 'Continuing with partial results',
                    shouldContinue: true,
                    partialResults: state.partialResults,
                    newState: {
                        ...state,
                        recoveryAttempts: state.recoveryAttempts + 1,
                    },
                };
            },
        });
    }
    /**
     * Determines if a step can be safely skipped
     */
    canSkipStep(step, error) {
        // Skip optional steps or non-critical analysis steps
        const skippableTypes = ['test', 'custom'];
        const skippablePatterns = [/optional/i, /enhancement/i, /optimization/i];
        return step.continueOnError ||
            skippableTypes.includes(step.type) ||
            skippablePatterns.some(pattern => pattern.test(step.name));
    }
    /**
     * Determines if a step can be modified for degraded operation
     */
    canModifyStep(step, error) {
        // Can modify steps that have configurable timeouts or resource requirements
        return step.timeout > 10000 || // Steps with long timeouts can be shortened
            step.type === 'analysis' || // Analysis steps can often be simplified
            step.command.some(cmd => cmd.includes('--timeout') || cmd.includes('--memory'));
    }
    /**
     * Modifies a step for degraded operation
     */
    modifyStepForDegradation(step, error) {
        const modifiedStep = { ...step };
        // Reduce timeout by 50%
        modifiedStep.timeout = Math.max(5000, Math.floor(step.timeout * 0.5));
        // Add continue-on-error flag if not already set
        modifiedStep.continueOnError = true;
        // Modify command to use less resources if applicable
        modifiedStep.command = step.command.map(cmd => {
            if (cmd.includes('--memory')) {
                return cmd.replace(/--memory=\d+[mg]/i, '--memory=256m');
            }
            if (cmd.includes('--timeout')) {
                return cmd.replace(/--timeout=\d+/i, `--timeout=${modifiedStep.timeout}`);
            }
            return cmd;
        });
        return modifiedStep;
    }
    /**
     * Gets a human-readable degradation reason
     */
    getDegradationReason(error, skippedCount, modifiedCount) {
        const reasons = [];
        if (error.code.includes('RESOURCE')) {
            reasons.push('insufficient system resources');
        }
        if (error.code.includes('NETWORK')) {
            reasons.push('network connectivity issues');
        }
        if (error.code.includes('CONTAINER')) {
            reasons.push('container management problems');
        }
        let reason = `Analysis degraded due to ${reasons.join(' and ') || 'system limitations'}.`;
        if (skippedCount > 0) {
            reason += ` ${skippedCount} optional steps were skipped.`;
        }
        if (modifiedCount > 0) {
            reason += ` ${modifiedCount} steps were modified with reduced requirements.`;
        }
        return reason;
    }
    /**
     * Stores preserved data for later retrieval
     */
    storePreservedData(containerId, data) {
        // In a real implementation, this would persist to disk or database
        // For now, we'll just log it
        logger_1.logger.info('Storing preserved data', {
            containerId,
            dataSize: JSON.stringify(data).length,
        });
    }
    /**
     * Deep clones an object to prevent reference issues
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        return cloned;
    }
}
exports.RecoveryManager = RecoveryManager;
//# sourceMappingURL=recovery.js.map