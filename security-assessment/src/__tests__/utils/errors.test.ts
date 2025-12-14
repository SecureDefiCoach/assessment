/**
 * Tests for error handling utilities
 */

import {
  SecurityAssessmentError,
  ContainerCreationError,
  SecurityViolationError,
  NetworkSecurityViolationError,
  ResourceAllocationError,
  ErrorHandler,
  ErrorRecoveryState,
} from '../../utils/errors';

describe('SecurityAssessmentError', () => {
  it('should create error with correct properties', () => {
    const error = new ContainerCreationError('Test error message', { containerId: 'test-123' });

    expect(error.message).toBe('Test error message');
    expect(error.code).toBe('CONTAINER_CREATION_FAILED');
    expect(error.severity).toBe('high');
    expect(error.recoverable).toBe(true);
    expect(error.context).toEqual({ containerId: 'test-123' });
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  it('should be instanceof Error and SecurityAssessmentError', () => {
    const error = new ContainerCreationError('Test error');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SecurityAssessmentError);
    expect(error).toBeInstanceOf(ContainerCreationError);
  });

  it('should serialize to JSON correctly', () => {
    const error = new ResourceAllocationError('Memory allocation failed', { memory: '1g' });
    const json = error.toJSON();

    expect(json).toEqual({
      name: 'ResourceAllocationError',
      code: 'RESOURCE_ALLOCATION_FAILED',
      message: 'Memory allocation failed',
      severity: 'medium',
      recoverable: true,
      timestamp: error.timestamp,
      context: { memory: '1g' },
    });
  });
});

describe('SecurityViolationError', () => {
  it('should create non-recoverable security violation', () => {
    const error = new NetworkSecurityViolationError('Unauthorized network access', { 
      destination: '192.168.1.1' 
    });

    expect(error.code).toBe('SECURITY_VIOLATION_NETWORK');
    expect(error.severity).toBe('critical');
    expect(error.recoverable).toBe(false);
    expect(error.context).toEqual({ 
      violationType: 'NETWORK',
      destination: '192.168.1.1' 
    });
  });
});

describe('ErrorHandler', () => {
  describe('isRecoverable', () => {
    it('should return true for recoverable SecurityAssessmentError', () => {
      const error = new ContainerCreationError('Container creation failed');
      expect(ErrorHandler.isRecoverable(error)).toBe(true);
    });

    it('should return false for non-recoverable SecurityAssessmentError', () => {
      const error = new SecurityViolationError('Security violation', 'NETWORK');
      expect(ErrorHandler.isRecoverable(error)).toBe(false);
    });

    it('should return false for critical system errors', () => {
      const error = new Error('ENOSPC: no space left on device');
      expect(ErrorHandler.isRecoverable(error)).toBe(false);
    });

    it('should return true for generic errors', () => {
      const error = new Error('Generic error message');
      expect(ErrorHandler.isRecoverable(error)).toBe(true);
    });
  });

  describe('isCriticalSystemError', () => {
    it('should identify critical system errors', () => {
      const errors = [
        new Error('ENOSPC: no space left on device'),
        new Error('ENOMEM: out of memory'),
        new Error('EMFILE: too many open files'),
        new Error('ENOTFOUND: getaddrinfo ENOTFOUND'),
        new Error('ECONNREFUSED: connect ECONNREFUSED'),
      ];

      errors.forEach(error => {
        expect(ErrorHandler.isCriticalSystemError(error)).toBe(true);
      });
    });

    it('should not identify non-critical errors as critical', () => {
      const error = new Error('Regular error message');
      expect(ErrorHandler.isCriticalSystemError(error)).toBe(false);
    });
  });

  describe('isSecurityViolation', () => {
    it('should identify security violations', () => {
      const error = new SecurityViolationError('Security violation', 'FILESYSTEM');
      expect(ErrorHandler.isSecurityViolation(error)).toBe(true);
    });

    it('should not identify regular errors as security violations', () => {
      const error = new ContainerCreationError('Container creation failed');
      expect(ErrorHandler.isSecurityViolation(error)).toBe(false);
    });
  });

  describe('getSeverity', () => {
    it('should return correct severity for SecurityAssessmentError', () => {
      const error = new ContainerCreationError('Container creation failed');
      expect(ErrorHandler.getSeverity(error)).toBe('high');
    });

    it('should return critical for critical system errors', () => {
      const error = new Error('ENOSPC: no space left on device');
      expect(ErrorHandler.getSeverity(error)).toBe('critical');
    });

    it('should return medium for generic errors', () => {
      const error = new Error('Generic error');
      expect(ErrorHandler.getSeverity(error)).toBe('medium');
    });
  });

  describe('createFromGenericError', () => {
    it('should return SecurityAssessmentError as-is', () => {
      const originalError = new ContainerCreationError('Container creation failed');
      const result = ErrorHandler.createFromGenericError(originalError);
      expect(result).toBe(originalError);
    });

    it('should create ContainerCreationError for container-related errors', () => {
      const error = new Error('Failed to create container: image not found');
      const result = ErrorHandler.createFromGenericError(error, { containerId: 'test-123' });
      
      expect(result).toBeInstanceOf(ContainerCreationError);
      expect(result.message).toBe('Failed to create container: image not found');
      expect(result.context).toEqual({ originalError: error.message, containerId: 'test-123' });
    });

    it('should create ResourceAllocationError for resource-related errors', () => {
      const error = new Error('Insufficient memory available');
      const result = ErrorHandler.createFromGenericError(error);
      
      expect(result).toBeInstanceOf(ResourceAllocationError);
    });

    it('should create default AnalysisError for unknown errors', () => {
      const error = new Error('Unknown error occurred');
      const result = ErrorHandler.createFromGenericError(error);
      
      expect(result.code).toBe('ANALYSIS_FAILED');
    });
  });

  describe('formatForUser', () => {
    it('should format error for user display', () => {
      const error = new ContainerCreationError('Container creation failed');
      const formatted = ErrorHandler.formatForUser(error);
      
      expect(formatted).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] HIGH: Container creation failed \(Code: CONTAINER_CREATION_FAILED\)$/);
    });
  });

  describe('formatForLogging', () => {
    it('should format error for logging', () => {
      const error = new ContainerCreationError('Container creation failed', { containerId: 'test-123' });
      const formatted = ErrorHandler.formatForLogging(error);
      
      expect(formatted).toEqual({
        timestamp: error.timestamp,
        severity: 'high',
        code: 'CONTAINER_CREATION_FAILED',
        message: 'Container creation failed',
        recoverable: true,
        context: { containerId: 'test-123' },
        stack: error.stack,
      });
    });
  });
});