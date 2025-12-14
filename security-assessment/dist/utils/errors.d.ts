/**
 * Comprehensive error handling classes and utilities for the security assessment system
 */
/**
 * Base error class for all security assessment errors
 */
export declare abstract class SecurityAssessmentError extends Error {
    readonly code: string;
    readonly severity: 'low' | 'medium' | 'high' | 'critical';
    readonly recoverable: boolean;
    readonly timestamp: Date;
    readonly context?: Record<string, any>;
    constructor(message: string, code: string, severity: 'low' | 'medium' | 'high' | 'critical', recoverable?: boolean, context?: Record<string, any>);
    private logError;
    toJSON(): Record<string, any>;
}
/**
 * Container creation and management errors
 */
export declare class ContainerCreationError extends SecurityAssessmentError {
    constructor(message: string, context?: Record<string, any>);
}
export declare class ContainerStartError extends SecurityAssessmentError {
    constructor(message: string, context?: Record<string, any>);
}
export declare class ContainerStopError extends SecurityAssessmentError {
    constructor(message: string, context?: Record<string, any>);
}
export declare class ContainerDestroyError extends SecurityAssessmentError {
    constructor(message: string, context?: Record<string, any>);
}
/**
 * Resource allocation and limit errors
 */
export declare class ResourceAllocationError extends SecurityAssessmentError {
    constructor(message: string, context?: Record<string, any>);
}
export declare class ResourceLimitExceededError extends SecurityAssessmentError {
    constructor(message: string, context?: Record<string, any>);
}
export declare class InsufficientResourcesError extends SecurityAssessmentError {
    constructor(message: string, context?: Record<string, any>);
}
/**
 * Security violation errors - these are non-recoverable and require immediate termination
 */
export declare class SecurityViolationError extends SecurityAssessmentError {
    constructor(message: string, violationType: string, context?: Record<string, any>);
}
export declare class NetworkSecurityViolationError extends SecurityViolationError {
    constructor(message: string, context?: Record<string, any>);
}
export declare class FilesystemSecurityViolationError extends SecurityViolationError {
    constructor(message: string, context?: Record<string, any>);
}
export declare class PrivilegeEscalationError extends SecurityViolationError {
    constructor(message: string, context?: Record<string, any>);
}
/**
 * Analysis and workflow errors
 */
export declare class AnalysisError extends SecurityAssessmentError {
    constructor(message: string, context?: Record<string, any>);
}
export declare class WorkflowExecutionError extends SecurityAssessmentError {
    constructor(message: string, context?: Record<string, any>);
}
export declare class PartialAnalysisError extends SecurityAssessmentError {
    constructor(message: string, completedSteps: string[], failedSteps: string[], context?: Record<string, any>);
}
/**
 * Configuration and validation errors
 */
export declare class ConfigurationError extends SecurityAssessmentError {
    constructor(message: string, context?: Record<string, any>);
}
export declare class ValidationError extends SecurityAssessmentError {
    constructor(message: string, context?: Record<string, any>);
}
/**
 * Network and external resource errors
 */
export declare class NetworkError extends SecurityAssessmentError {
    constructor(message: string, context?: Record<string, any>);
}
export declare class ExternalResourceError extends SecurityAssessmentError {
    constructor(message: string, context?: Record<string, any>);
}
/**
 * Timeout and performance errors
 */
export declare class TimeoutError extends SecurityAssessmentError {
    constructor(message: string, timeoutMs: number, context?: Record<string, any>);
}
/**
 * Error recovery state interface
 */
export interface ErrorRecoveryState {
    containerId?: string;
    lastSuccessfulStep?: string;
    completedSteps: string[];
    failedSteps: string[];
    partialResults?: any;
    recoveryAttempts: number;
    maxRecoveryAttempts: number;
    lastError?: SecurityAssessmentError;
}
/**
 * Utility functions for error handling
 */
export declare class ErrorHandler {
    /**
     * Determines if an error is recoverable
     */
    static isRecoverable(error: Error): boolean;
    /**
     * Determines if an error is a critical system error
     */
    static isCriticalSystemError(error: Error): boolean;
    /**
     * Determines if an error indicates a security violation
     */
    static isSecurityViolation(error: Error): boolean;
    /**
     * Gets the severity level of an error
     */
    static getSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical';
    /**
     * Creates an appropriate error instance from a generic error
     */
    static createFromGenericError(error: Error, context?: Record<string, any>): SecurityAssessmentError;
    /**
     * Formats error for user display
     */
    static formatForUser(error: SecurityAssessmentError): string;
    /**
     * Formats error for logging
     */
    static formatForLogging(error: SecurityAssessmentError): Record<string, any>;
}
//# sourceMappingURL=errors.d.ts.map