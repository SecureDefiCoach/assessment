/**
 * Recovery manager for handling partial failures and state preservation
 */
import { SecurityAssessmentError, ErrorRecoveryState, PartialAnalysisError } from './errors';
import { WorkflowStep } from '../types';
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
export declare class RecoveryManager {
    private checkpoints;
    private recoveryStrategies;
    constructor();
    /**
     * Creates a checkpoint for the current state
     */
    createCheckpoint(containerId: string, stepName: string, state: any, results?: any, metadata?: Record<string, any>): void;
    /**
     * Gets the latest checkpoint for a container
     */
    getLatestCheckpoint(containerId: string): RecoveryCheckpoint | undefined;
    /**
     * Gets all checkpoints for a container
     */
    getCheckpoints(containerId: string): RecoveryCheckpoint[];
    /**
     * Attempts to recover from an error using available strategies
     */
    attemptRecovery(error: SecurityAssessmentError, recoveryState: ErrorRecoveryState): Promise<RecoveryResult>;
    /**
     * Creates a graceful degradation plan when full recovery isn't possible
     */
    createDegradationPlan(error: SecurityAssessmentError, recoveryState: ErrorRecoveryState, remainingSteps: WorkflowStep[]): {
        canContinue: boolean;
        modifiedSteps: WorkflowStep[];
        skippedSteps: string[];
        degradationReason: string;
    };
    /**
     * Preserves partial results when full analysis cannot be completed
     */
    preservePartialResults(containerId: string, completedSteps: string[], partialResults: any, error: SecurityAssessmentError): PartialAnalysisError;
    /**
     * Clears checkpoints and recovery data for a container
     */
    clearRecoveryData(containerId: string): void;
    /**
     * Registers a custom recovery strategy
     */
    registerRecoveryStrategy(strategy: RecoveryStrategy): void;
    /**
     * Initializes default recovery strategies
     */
    private initializeDefaultStrategies;
    /**
     * Determines if a step can be safely skipped
     */
    private canSkipStep;
    /**
     * Determines if a step can be modified for degraded operation
     */
    private canModifyStep;
    /**
     * Modifies a step for degraded operation
     */
    private modifyStepForDegradation;
    /**
     * Gets a human-readable degradation reason
     */
    private getDegradationReason;
    /**
     * Stores preserved data for later retrieval
     */
    private storePreservedData;
    /**
     * Deep clones an object to prevent reference issues
     */
    private deepClone;
}
//# sourceMappingURL=recovery.d.ts.map