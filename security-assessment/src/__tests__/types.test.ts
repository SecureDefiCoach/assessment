/**
 * Tests for type definitions and interfaces
 */

import { 
  AssessmentEnvironment, 
  SecurityConfiguration, 
  AnalysisConfiguration,
  SecurityFinding,
  AnalysisResults 
} from '../types';

describe('Type Definitions', () => {
  describe('SecurityConfiguration', () => {
    it('should have all required properties', () => {
      const config: SecurityConfiguration = {
        networkIsolation: true,
        allowedNetworkAccess: ['npm.registry.com'],
        resourceLimits: {
          cpu: '1.0',
          memory: '512m',
          diskSpace: '1g',
        },
        filesystemAccess: {
          readOnlyMounts: ['/code'],
          writableMounts: ['/tmp'],
        },
        securityPolicies: ['no-privileged'],
      };

      expect(config.networkIsolation).toBe(true);
      expect(config.resourceLimits.cpu).toBe('1.0');
      expect(config.filesystemAccess.readOnlyMounts).toContain('/code');
    });
  });

  describe('AnalysisConfiguration', () => {
    it('should support different codebase types', () => {
      const nodejsConfig: AnalysisConfiguration = {
        codebaseType: 'nodejs',
        analysisTools: ['eslint', 'npm-audit'],
        testFrameworks: ['jest'],
        reportFormats: ['json', 'html'],
      };

      const solidityConfig: AnalysisConfiguration = {
        codebaseType: 'solidity',
        analysisTools: ['slither', 'mythx'],
        testFrameworks: ['hardhat'],
        reportFormats: ['json'],
      };

      expect(nodejsConfig.codebaseType).toBe('nodejs');
      expect(solidityConfig.codebaseType).toBe('solidity');
    });
  });

  describe('AssessmentEnvironment', () => {
    it('should create valid assessment environment', () => {
      const securityConfig: SecurityConfiguration = {
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

      const analysisConfig: AnalysisConfiguration = {
        codebaseType: 'nodejs',
        analysisTools: ['eslint'],
        testFrameworks: ['jest'],
        reportFormats: ['json'],
      };

      const environment: AssessmentEnvironment = {
        containerId: 'test-container-123',
        status: 'creating',
        securityConfig,
        analysisConfig,
        createdAt: new Date(),
      };

      expect(environment.containerId).toBe('test-container-123');
      expect(environment.status).toBe('creating');
      expect(environment.securityConfig).toBe(securityConfig);
      expect(environment.analysisConfig).toBe(analysisConfig);
    });
  });
});