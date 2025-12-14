"use strict";
/**
 * Comprehensive error handling classes and utilities for the security assessment system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = exports.TimeoutError = exports.ExternalResourceError = exports.NetworkError = exports.ValidationError = exports.ConfigurationError = exports.PartialAnalysisError = exports.WorkflowExecutionError = exports.AnalysisError = exports.PrivilegeEscalationError = exports.FilesystemSecurityViolationError = exports.NetworkSecurityViolationError = exports.SecurityViolationError = exports.InsufficientResourcesError = exports.ResourceLimitExceededError = exports.ResourceAllocationError = exports.ContainerDestroyError = exports.ContainerStopError = exports.ContainerStartError = exports.ContainerCreationError = exports.SecurityAssessmentError = void 0;
const logger_1 = require("./logger");
/**
 * Base error class for all security assessment errors
 */
class SecurityAssessmentError extends Error {
    constructor(message, code, severity, recoverable = true, context) {
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
    logError() {
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
                logger_1.logger.error('Critical security assessment error', logData);
                break;
            case 'high':
                logger_1.logger.error('High severity security assessment error', logData);
                break;
            case 'medium':
                logger_1.logger.warn('Medium severity security assessment error', logData);
                break;
            case 'low':
                logger_1.logger.info('Low severity security assessment error', logData);
                break;
        }
    }
    toJSON() {
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
exports.SecurityAssessmentError = SecurityAssessmentError;
/**
 * Container creation and management errors
 */
class ContainerCreationError extends SecurityAssessmentError {
    constructor(message, context) {
        super(message, 'CONTAINER_CREATION_FAILED', 'high', true, context);
    }
}
exports.ContainerCreationError = ContainerCreationError;
class ContainerStartError extends SecurityAssessmentError {
    constructor(message, context) {
        super(message, 'CONTAINER_START_FAILED', 'high', true, context);
    }
}
exports.ContainerStartError = ContainerStartError;
class ContainerStopError extends SecurityAssessmentError {
    constructor(message, context) {
        super(message, 'CONTAINER_STOP_FAILED', 'medium', true, context);
    }
}
exports.ContainerStopError = ContainerStopError;
class ContainerDestroyError extends SecurityAssessmentError {
    constructor(message, context) {
        super(message, 'CONTAINER_DESTROY_FAILED', 'medium', true, context);
    }
}
exports.ContainerDestroyError = ContainerDestroyError;
/**
 * Resource allocation and limit errors
 */
class ResourceAllocationError extends SecurityAssessmentError {
    constructor(message, context) {
        super(message, 'RESOURCE_ALLOCATION_FAILED', 'medium', true, context);
    }
}
exports.ResourceAllocationError = ResourceAllocationError;
class ResourceLimitExceededError extends SecurityAssessmentError {
    constructor(message, context) {
        super(message, 'RESOURCE_LIMIT_EXCEEDED', 'high', false, context);
    }
}
exports.ResourceLimitExceededError = ResourceLimitExceededError;
class InsufficientResourcesError extends SecurityAssessmentError {
    constructor(message, context) {
        super(message, 'INSUFFICIENT_RESOURCES', 'medium', true, context);
    }
}
exports.InsufficientResourcesError = InsufficientResourcesError;
/**
 * Security violation errors - these are non-recoverable and require immediate termination
 */
class SecurityViolationError extends SecurityAssessmentError {
    constructor(message, violationType, context) {
        super(message, `SECURITY_VIOLATION_${violationType.toUpperCase()}`, 'critical', false, { violationType, ...context });
    }
}
exports.SecurityViolationError = SecurityViolationError;
class NetworkSecurityViolationError extends SecurityViolationError {
    constructor(message, context) {
        super(message, 'NETWORK', context);
    }
}
exports.NetworkSecurityViolationError = NetworkSecurityViolationError;
class FilesystemSecurityViolationError extends SecurityViolationError {
    constructor(message, context) {
        super(message, 'FILESYSTEM', context);
    }
}
exports.FilesystemSecurityViolationError = FilesystemSecurityViolationError;
class PrivilegeEscalationError extends SecurityViolationError {
    constructor(message, context) {
        super(message, 'PRIVILEGE_ESCALATION', context);
    }
}
exports.PrivilegeEscalationError = PrivilegeEscalationError;
/**
 * Analysis and workflow errors
 */
class AnalysisError extends SecurityAssessmentError {
    constructor(message, context) {
        super(message, 'ANALYSIS_FAILED', 'medium', true, context);
    }
}
exports.AnalysisError = AnalysisError;
class WorkflowExecutionError extends SecurityAssessmentError {
    constructor(message, context) {
        super(message, 'WORKFLOW_EXECUTION_FAILED', 'medium', true, context);
    }
}
exports.WorkflowExecutionError = WorkflowExecutionError;
class PartialAnalysisError extends SecurityAssessmentError {
    constructor(message, completedSteps, failedSteps, context) {
        super(message, 'PARTIAL_ANALYSIS_FAILURE', 'medium', true, { completedSteps, failedSteps, ...context });
    }
}
exports.PartialAnalysisError = PartialAnalysisError;
/**
 * Configuration and validation errors
 */
class ConfigurationError extends SecurityAssessmentError {
    constructor(message, context) {
        super(message, 'CONFIGURATION_ERROR', 'high', false, context);
    }
}
exports.ConfigurationError = ConfigurationError;
class ValidationError extends SecurityAssessmentError {
    constructor(message, context) {
        super(message, 'VALIDATION_ERROR', 'medium', false, context);
    }
}
exports.ValidationError = ValidationError;
/**
 * Network and external resource errors
 */
class NetworkError extends SecurityAssessmentError {
    constructor(message, context) {
        super(message, 'NETWORK_ERROR', 'medium', true, context);
    }
}
exports.NetworkError = NetworkError;
class ExternalResourceError extends SecurityAssessmentError {
    constructor(message, context) {
        super(message, 'EXTERNAL_RESOURCE_ERROR', 'medium', true, context);
    }
}
exports.ExternalResourceError = ExternalResourceError;
/**
 * Timeout and performance errors
 */
class TimeoutError extends SecurityAssessmentError {
    constructor(message, timeoutMs, context) {
        super(message, 'TIMEOUT_ERROR', 'medium', true, { timeoutMs, ...context });
    }
}
exports.TimeoutError = TimeoutError;
/**
 * Utility functions for error handling
 */
class ErrorHandler {
    /**
     * Determines if an error is recoverable
     */
    static isRecoverable(error) {
        if (error instanceof SecurityAssessmentError) {
            return error.recoverable;
        }
        // For non-SecurityAssessmentError instances, assume recoverable unless it's a critical system error
        return !ErrorHandler.isCriticalSystemError(error);
    }
    /**
     * Determines if an error is a critical system error
     */
    static isCriticalSystemError(error) {
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
    static isSecurityViolation(error) {
        return error instanceof SecurityViolationError;
    }
    /**
     * Gets the severity level of an error
     */
    static getSeverity(error) {
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
    static createFromGenericError(error, context) {
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
    static formatForUser(error) {
        const timestamp = error.timestamp.toISOString();
        return `[${timestamp}] ${error.severity.toUpperCase()}: ${error.message} (Code: ${error.code})`;
    }
    /**
     * Formats error for logging
     */
    static formatForLogging(error) {
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
exports.ErrorHandler = ErrorHandler;
//# sourceMappingURL=errors.js.map