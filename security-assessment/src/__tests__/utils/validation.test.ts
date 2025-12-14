/**
 * Tests for validation utilities
 */

import { 
  validateSecurityConfiguration, 
  validateAnalysisConfiguration,
  isValidContainerId,
  sanitizePath 
} from '../../utils/validation';
import { SecurityConfiguration, AnalysisConfiguration } from '../../types';

describe('Validation Utilities', () => {
  describe('validateSecurityConfiguration', () => {
    it('should pass validation for valid configuration', () => {
      const validConfig: SecurityConfiguration = {
        networkIsolation: true,
        allowedNetworkAccess: [],
        resourceLimits: {
          cpu: '1.0',
          memory: '512m',
          diskSpace: '1g',
        },
        filesystemAccess: {
          readOnlyMounts: ['/code'],
          writableMounts: ['/tmp'],
        },
        securityPolicies: [],
      };

      const errors = validateSecurityConfiguration(validConfig);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for missing resource limits', () => {
      const invalidConfig = {
        networkIsolation: true,
        allowedNetworkAccess: [],
        filesystemAccess: {
          readOnlyMounts: ['/code'],
          writableMounts: ['/tmp'],
        },
        securityPolicies: [],
      } as unknown as SecurityConfiguration;

      const errors = validateSecurityConfiguration(invalidConfig);
      expect(errors).toContain('Resource limits are required');
    });
  });

  describe('validateAnalysisConfiguration', () => {
    it('should pass validation for valid configuration', () => {
      const validConfig: AnalysisConfiguration = {
        codebaseType: 'nodejs',
        analysisTools: ['eslint'],
        testFrameworks: ['jest'],
        reportFormats: ['json'],
      };

      const errors = validateAnalysisConfiguration(validConfig);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for invalid codebase type', () => {
      const invalidConfig = {
        codebaseType: 'invalid',
        analysisTools: ['eslint'],
        testFrameworks: ['jest'],
        reportFormats: ['json'],
      } as unknown as AnalysisConfiguration;

      const errors = validateAnalysisConfiguration(invalidConfig);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Invalid codebase type');
    });
  });

  describe('isValidContainerId', () => {
    it('should validate correct container IDs', () => {
      expect(isValidContainerId('assessment-123-abc')).toBe(true);
      expect(isValidContainerId('test_container_1')).toBe(true);
    });

    it('should reject invalid container IDs', () => {
      expect(isValidContainerId('')).toBe(false);
      expect(isValidContainerId('a')).toBe(false); // too short
      expect(isValidContainerId('container with spaces')).toBe(false);
      expect(isValidContainerId('container@invalid')).toBe(false);
    });
  });

  describe('sanitizePath', () => {
    it('should sanitize dangerous characters from paths', () => {
      expect(sanitizePath('/safe/path')).toBe('/safe/path');
      expect(sanitizePath('/path/with/../traversal')).toBe('/path/with/traversal');
      expect(sanitizePath('/path/with;command')).toBe('/path/withcommand');
    });
  });
});