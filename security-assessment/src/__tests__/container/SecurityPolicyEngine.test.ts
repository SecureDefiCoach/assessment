/**
 * Tests for SecurityPolicyEngine
 */

import { SecurityPolicyEngine } from '../../container/SecurityPolicyEngine';
import { SecurityConfiguration } from '../../types';

describe('SecurityPolicyEngine', () => {
  let engine: SecurityPolicyEngine;

  beforeEach(() => {
    engine = new SecurityPolicyEngine();
  });

  describe('validateSecurityConfig', () => {
    it('should validate correct security configuration', () => {
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

      expect(engine.validateSecurityConfig(validConfig)).toBe(true);
    });

    it('should reject configuration without resource limits', () => {
      const invalidConfig = {
        networkIsolation: true,
        allowedNetworkAccess: [],
        filesystemAccess: {
          readOnlyMounts: ['/code'],
          writableMounts: ['/tmp'],
        },
        securityPolicies: [],
      } as unknown as SecurityConfiguration;

      expect(engine.validateSecurityConfig(invalidConfig)).toBe(false);
    });

    it('should reject configuration with incomplete resource limits', () => {
      const invalidConfig: SecurityConfiguration = {
        networkIsolation: true,
        allowedNetworkAccess: [],
        resourceLimits: {
          cpu: '1.0',
          memory: '', // missing memory
          diskSpace: '1g',
        },
        filesystemAccess: {
          readOnlyMounts: ['/code'],
          writableMounts: ['/tmp'],
        },
        securityPolicies: [],
      };

      expect(engine.validateSecurityConfig(invalidConfig)).toBe(false);
    });
  });

  describe('createDefaultSecurityConfig', () => {
    it('should create valid default configuration', () => {
      const defaultConfig = engine.createDefaultSecurityConfig();
      
      expect(defaultConfig.networkIsolation).toBe(true);
      expect(defaultConfig.resourceLimits.cpu).toBe('1.0');
      expect(defaultConfig.resourceLimits.memory).toBe('512m');
      expect(defaultConfig.resourceLimits.diskSpace).toBe('1g');
      expect(defaultConfig.filesystemAccess.readOnlyMounts).toContain('/code');
      expect(defaultConfig.securityPolicies).toContain('no-privileged');
      
      // Validate the default config passes validation
      expect(engine.validateSecurityConfig(defaultConfig)).toBe(true);
    });
  });
});