/**
 * Comprehensive error handling classes and utilities for the security assessment system
 */

import { logger } from './logger';

/**
 * Base error class for all security assessment errors
 */
export abstract class SecurityAssessmentError extends Error {
  public readonly code: string;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';
  public readonly recoverable: boolean;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    recoverable: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.severity = severity;
    this.recoverable = recoverable;
    this.timestamp = new Date();
    this.context = context;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    // Log the error immediately
    this.logError();
  }

  private logError(): void {
    const logData = {
      error: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    };

    switch (this.severity) {
      case 'critical':
        logger.error('Critical security assessment error', logData);
        break;
      case 'high':
        logger.error('High severity security assessment error', logData);
        break;
      case 'medium':
        logger.warn('Medium severity security assessment error', logData);
        break;
      case 'low':
        logger.info('Low severity security assessment error', logData);
        break;
    }
  }

  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      context: this.context,
    };
  }
}

/**
 * Container creation and management errors
 */
export class ContainerCreationError extends SecurityAssessmentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONTAINER_CREATION_FAILED', 'high', true, context);
  }
}

export class ContainerStartError extends SecurityAssessmentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONTAINER_START_FAILED', 'high', true, context);
  }
}

export class ContainerStopError extends SecurityAssessmentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONTAINER_STOP_FAILED', 'medium', true, context);
  }
}

export class ContainerDestroyError extends SecurityAssessmentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONTAINER_DESTROY_FAILED', 'medium', true, context);
  }
}

/**
 * Resource allocation and limit errors
 */
export class ResourceAllocationError extends SecurityAssessmentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'RESOURCE_ALLOCATION_FAILED', 'medium', true, context);
  }
}

export class ResourceLimitExceededError extends SecurityAssessmentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'RESOURCE_LIMIT_EXCEEDED', 'high', false, context);
  }
}

export class InsufficientResourcesError extends SecurityAssessmentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'INSUFFICIENT_RESOURCES', 'medium', true, context);
  }
}

/**
 * Security violation errors - these are non-recoverable and require immediate termination
 */
export class SecurityViolationError extends SecurityAssessmentError {
  constructor(message: string, violationType: string, context?: Record<string, any>) {
    super(
      message,
      `SECURITY_VIOLATION_${violationType.toUpperCase()}`,
      'critical',
      false,
      { violationType, ...context }
    );
  }
}

export class NetworkSecurityViolationError extends SecurityViolationError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'NETWORK', context);
  }
}

export class FilesystemSecurityViolationError extends SecurityViolationError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'FILESYSTEM', context);
  }
}

export class PrivilegeEscalationError extends SecurityViolationError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'PRIVILEGE_ESCALATION', context);
  }
}

/**
 * Analysis and workflow errors
 */
export class AnalysisError extends SecurityAssessmentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'ANALYSIS_FAILED', 'medium', true, context);
  }
}

export class WorkflowExecutionError extends SecurityAssessmentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'WORKFLOW_EXECUTION_FAILED', 'medium', true, context);
  }
}

export class PartialAnalysisError extends SecurityAssessmentError {
  constructor(message: string, completedSteps: string[], failedSteps: string[], context?: Record<string, any>) {
    super(
      message,
      'PARTIAL_ANALYSIS_FAILURE',
      'medium',
      true,
      { completedSteps, failedSteps, ...context }
    );
  }
}

/**
 * Configuration and validation errors
 */
export class ConfigurationError extends SecurityAssessmentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONFIGURATION_ERROR', 'high', false, context);
  }
}

export class ValidationError extends SecurityAssessmentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 'medium', false, context);
  }
}

/**
 * Network and external resource errors
 */
export class NetworkError extends SecurityAssessmentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', 'medium', true, context);
  }
}

export class ExternalResourceError extends SecurityAssessmentError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'EXTERNAL_RESOURCE_ERROR', 'medium', true, context);
  }
}

/**
 * Timeout and performance errors
 */
export class TimeoutError extends SecurityAssessmentError {
  constructor(message: string, timeoutMs: number, context?: Record<string, any>) {
    super(
      message,
      'TIMEOUT_ERROR',
      'medium',
      true,
      { timeoutMs, ...context }
    );
  }
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
export class ErrorHandler {
  /**
   * Determines if an error is recoverable
   */
  static isRecoverable(error: Error): boolean {
    if (error instanceof SecurityAssessmentError) {
      return error.recoverable;
    }
    // For non-SecurityAssessmentError instances, assume recoverable unless it's a critical system error
    return !ErrorHandler.isCriticalSystemError(error);
  }

  /**
   * Determines if an error is a critical system error
   */
  static isCriticalSystemError(error: Error): boolean {
    const criticalPatterns = [
      /ENOSPC/i, // No space left on device
      /ENOMEM/i, // Out of memory
      /EMFILE/i, // Too many open files
      /ENOTFOUND/i, // DNS resolution failed
      /ECONNREFUSED/i, // Connection refused
    ];

    return criticalPatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Determines if an error indicates a security violation
   */
  static isSecurityViolation(error: Error): boolean {
    return error instanceof SecurityViolationError;
  }

  /**
   * Gets the severity level of an error
   */
  static getSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    if (error instanceof SecurityAssessmentError) {
      return error.severity;
    }

    // Classify unknown errors based on patterns
    if (ErrorHandler.isCriticalSystemError(error)) {
      return 'critical';
    }

    return 'medium'; // Default severity for unknown errors
  }

  /**
   * Creates an appropriate error instance from a generic error
   */
  static createFromGenericError(error: Error, context?: Record<string, any>): SecurityAssessmentError {
    if (error instanceof SecurityAssessmentError) {
      return error;
    }

    // Classify the error and create appropriate instance
    if (error.message.includes('container') && error.message.includes('create')) {
      return new ContainerCreationError(error.message, { originalError: error.message, ...context });
    }

    if (error.message.includes('resource') || error.message.includes('memory') || error.message.includes('cpu')) {
      return new ResourceAllocationError(error.message, { originalError: error.message, ...context });
    }

    if (error.message.includes('network') || error.message.includes('connection')) {
      return new NetworkError(error.message, { originalError: error.message, ...context });
    }

    if (error.message.includes('timeout')) {
      return new TimeoutError(error.message, 30000, { originalError: error.message, ...context });
    }

    // Default to generic analysis error
    return new AnalysisError(error.message, { originalError: error.message, ...context });
  }

  /**
   * Formats error for user display
   */
  static formatForUser(error: SecurityAssessmentError): string {
    const timestamp = error.timestamp.toISOString();
    return `[${timestamp}] ${error.severity.toUpperCase()}: ${error.message} (Code: ${error.code})`;
  }

  /**
   * Formats error for logging
   */
  static formatForLogging(error: SecurityAssessmentError): Record<string, any> {
    return {
      timestamp: error.timestamp,
      severity: error.severity,
      code: error.code,
      message: error.message,
      recoverable: error.recoverable,
      context: error.context,
      stack: error.stack,
    };
  }
}