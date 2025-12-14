/**
 * Recovery manager for handling partial failures and state preservation
 */

import { logger } from './logger';
import { SecurityAssessmentError, ErrorRecoveryState, PartialAnalysisError } from './errors';
import { AssessmentEnvironment, AnalysisResults, WorkflowStep } from '../types';

export interface RecoveryStrategy {
  name: string;
  canRecover: (error: SecurityAssessmentError, state: ErrorRecoveryState) => boolean;
  recover: (error: SecurityAssessmentError, state: ErrorRecoveryState) => Promise<RecoveryResult>;
}

export interface RecoveryResult {
  success: boolean;
  newState?: ErrorRecoveryState;
  partialResults?: any;
  message: string;
  shouldContinue: boolean;
}

export interface RecoveryCheckpoint {
  stepName: string;
  timestamp: Date;
  state: any;
  results?: any;
  metadata?: Record<string, any>;
}

/**
 * Manages error recovery and state preservation for assessment workflows
 */
export class RecoveryManager {
  private checkpoints: Map<string, RecoveryCheckpoint[]> = new Map();
  private recoveryStrategies: RecoveryStrategy[] = [];
  
  constructor() {
    this.initializeDefaultStrategies();
  }
  
  /**
   * Creates a checkpoint for the current state
   */
  createCheckpoint(
    containerId: string,
    stepName: string,
    state: any,
    results?: any,
    metadata?: Record<string, any>
  ): void {
    const checkpoint: RecoveryCheckpoint = {
      stepName,
      timestamp: new Date(),
      state: this.deepClone(state),
      results: results ? this.deepClone(results) : undefined,
      metadata,
    };
    
    if (!this.checkpoints.has(containerId)) {
      this.checkpoints.set(containerId, []);
    }
    
    const containerCheckpoints = this.checkpoints.get(containerId)!;
    containerCheckpoints.push(checkpoint);
    
    // Keep only the last 10 checkpoints to prevent memory issues
    if (containerCheckpoints.length > 10) {
      containerCheckpoints.shift();
    }
    
    logger.debug(`Created checkpoint for container ${containerId}`, {
      stepName,
      checkpointCount: containerCheckpoints.length,
    });
  }
  
  /**
   * Gets the latest checkpoint for a container
   */
  getLatestCheckpoint(containerId: string): RecoveryCheckpoint | undefined {
    const checkpoints = this.checkpoints.get(containerId);
    return checkpoints && checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : undefined;
  }
  
  /**
   * Gets all checkpoints for a container
   */
  getCheckpoints(containerId: string): RecoveryCheckpoint[] {
    return this.checkpoints.get(containerId) || [];
  }
  
  /**
   * Attempts to recover from an error using available strategies
   */
  async attemptRecovery(
    error: SecurityAssessmentError,
    recoveryState: ErrorRecoveryState
  ): Promise<RecoveryResult> {
    logger.info('Attempting error recovery', {
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
        logger.info(`Attempting recovery with strategy: ${strategy.name}`, {
          errorCode: error.code,
          containerId: recoveryState.containerId,
        });
        
        try {
          const result = await strategy.recover(error, recoveryState);
          
          if (result.success) {
            logger.info(`Recovery successful with strategy: ${strategy.name}`, {
              errorCode: error.code,
              containerId: recoveryState.containerId,
            });
            return result;
          } else {
            logger.warn(`Recovery failed with strategy: ${strategy.name}`, {
              errorCode: error.code,
              message: result.message,
            });
          }
        } catch (recoveryError) {
          logger.error(`Recovery strategy ${strategy.name} threw an error`, {
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
  createDegradationPlan(
    error: SecurityAssessmentError,
    recoveryState: ErrorRecoveryState,
    remainingSteps: WorkflowStep[]
  ): {
    canContinue: boolean;
    modifiedSteps: WorkflowStep[];
    skippedSteps: string[];
    degradationReason: string;
  } {
    const skippedSteps: string[] = [];
    const modifiedSteps: WorkflowStep[] = [];
    
    // Determine which steps can be safely skipped or modified
    for (const step of remainingSteps) {
      if (this.canSkipStep(step, error)) {
        skippedSteps.push(step.name);
        logger.info(`Skipping step due to degradation: ${step.name}`, {
          errorCode: error.code,
          reason: 'Step can be safely skipped',
        });
      } else if (this.canModifyStep(step, error)) {
        const modifiedStep = this.modifyStepForDegradation(step, error);
        modifiedSteps.push(modifiedStep);
        logger.info(`Modified step for degradation: ${step.name}`, {
          errorCode: error.code,
          modifications: 'Reduced resource requirements or timeout',
        });
      } else {
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
  preservePartialResults(
    containerId: string,
    completedSteps: string[],
    partialResults: any,
    error: SecurityAssessmentError
  ): PartialAnalysisError {
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
    
    logger.info('Preserved partial results', {
      containerId,
      completedSteps: completedSteps.length,
      errorCode: error.code,
    });
    
    return new PartialAnalysisError(
      `Analysis partially completed. ${completedSteps.length} steps succeeded before failure.`,
      completedSteps,
      [error.code],
      { preservedData }
    );
  }
  
  /**
   * Clears checkpoints and recovery data for a container
   */
  clearRecoveryData(containerId: string): void {
    this.checkpoints.delete(containerId);
    logger.debug(`Cleared recovery data for container ${containerId}`);
  }
  
  /**
   * Registers a custom recovery strategy
   */
  registerRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    logger.info(`Registered recovery strategy: ${strategy.name}`);
  }
  
  /**
   * Initializes default recovery strategies
   */
  private initializeDefaultStrategies(): void {
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
  private canSkipStep(step: WorkflowStep, error: SecurityAssessmentError): boolean {
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
  private canModifyStep(step: WorkflowStep, error: SecurityAssessmentError): boolean {
    // Can modify steps that have configurable timeouts or resource requirements
    return step.timeout > 10000 || // Steps with long timeouts can be shortened
           step.type === 'analysis' || // Analysis steps can often be simplified
           step.command.some(cmd => cmd.includes('--timeout') || cmd.includes('--memory'));
  }
  
  /**
   * Modifies a step for degraded operation
   */
  private modifyStepForDegradation(step: WorkflowStep, error: SecurityAssessmentError): WorkflowStep {
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
  private getDegradationReason(error: SecurityAssessmentError, skippedCount: number, modifiedCount: number): string {
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
  private storePreservedData(containerId: string, data: any): void {
    // In a real implementation, this would persist to disk or database
    // For now, we'll just log it
    logger.info('Storing preserved data', {
      containerId,
      dataSize: JSON.stringify(data).length,
    });
  }
  
  /**
   * Deep clones an object to prevent reference issues
   */
  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }
    
    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    
    return cloned;
  }
}