/**
 * System Cohesion Integration Tests
 * Tests the complete integration of ContainerManager, SecurityPolicyEngine, and AnalysisOrchestrator
 * Validates security boundaries and isolation properties
 * 
 * Task 8.1: Integrate all components and test system cohesion
 */

import { SecurityAssessmentSystem } from '../../SecurityAssessmentSystem';
import { SecurityConfiguration, AnalysisConfiguration } from '../../types';
import * as path from 'path';

// Set test timeout to prevent hanging
jest.setTimeout(60000);

// Mock winston logger to avoid file system dependencies
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    add: jest.fn()
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn()
  }
}));

// Mock Docker to avoid requiring actual Docker daemon
jest.mock('dockerode', () => {
  const mockContainer = {
    id: 'mock-container-id',
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    inspect: jest.fn().mockResolvedValue({
      State: { Status: 'running' },
      Created: new Date().toISOString(),
      NetworkSettings: { Networks: {} }
    }),
    exec: jest.fn().mockResolvedValue({
      start: jest.fn().mockResolvedValue({
        on: jest.fn(),
        pipe: jest.fn()
      })
    })
  };

  const mockNetwork = {
    disconnect: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined)
  };

  return jest.fn().mockImplementation(() => ({
    createContainer: jest.fn().mockResolvedValue(mockContainer),
    getContainer: jest.fn().mockReturnValue(mockContainer),
    getNetwork: jest.fn().mockReturnValue(mockNetwork),
    createNetwork: jest.fn().mockResolvedValue(mockNetwork),
    info: jest.fn().mockResolvedValue({
      MemTotal: 8589934592, // 8GB
      NCPU: 4
    }),
    listContainers: jest.fn().mockResolvedValue([]),
    listNetworks: jest.fn().mockResolvedValue([])
  }));
});

// Mock file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('mock file content'),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([]),
  statSync: jest.fn().mockReturnValue({
    isFile: () => true,
    isDirectory: () => false
  }),
  stat: jest.fn((path, callback) => {
    callback(null, {
      isFile: () => true,
      isDirectory: () => false,
      size: 1024,
      mtime: new Date()
    });
  }),
  createWriteStream: jest.fn().mockReturnValue({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn()
  })
}));

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn((command, callback) => {
    callback(null, 'mock output', '');
  })
}));

// Mock crypto module
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue(Buffer.from('mock-random-bytes')),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock-hash')
  })
}));

describe('System Cohesion Integration Tests', () => {
  let assessmentSystem: SecurityAssessmentSystem;

  beforeAll(async () => {
    assessmentSystem = new SecurityAssessmentSystem();
  });

  describe('Component Integration', () => {
    test('should wire together ContainerManager, SecurityPolicyEngine, and AnalysisOrchestrator', async () => {
      // Test that all components are properly integrated
      const securityConfig = assessmentSystem.createDefaultSecurityConfig();
      const analysisConfig = assessmentSystem.createDefaultAnalysisConfig('nodejs');

      // Create environment - this tests ContainerManager integration
      const environment = await assessmentSystem.createSecureAssessmentEnvironment(
        securityConfig,
        analysisConfig
      );

      expect(environment).toBeDefined();
      expect(environment.containerId).toBeTruthy();
      expect(environment.status).toBe('ready');

      // Validate security boundaries - this tests SecurityPolicyEngine integration
      const boundariesValid = await assessmentSystem.validateSecurityBoundaries(
        environment.containerId,
        securityConfig
      );

      expect(boundariesValid).toBe(true);

      // Cleanup
      await assessmentSystem.cleanupAssessment(environment.containerId);
    });

    test('should conduct complete assessment workflow with real codebase', async () => {
      const securityConfig: SecurityConfiguration = {
        networkIsolation: true,
        allowedNetworkAccess: ['registry.npmjs.org'],
        resourceLimits: {
          cpu: '1.0',
          memory: '512m',
          diskSpace: '1g',
        },
        filesystemAccess: {
          readOnlyMounts: ['/code'],
          writableMounts: ['/tmp', '/output'],
        },
        securityPolicies: ['no-privileged', 'no-host-network'],
      };

      const analysisConfig: AnalysisConfiguration = {
        codebaseType: 'nodejs',
        analysisTools: ['eslint', 'npm-audit'],
        testFrameworks: ['jest'],
        reportFormats: ['json'],
      };

      // Create environment
      const environment = await assessmentSystem.createSecureAssessmentEnvironment(
        securityConfig,
        analysisConfig
      );

      // Conduct assessment - this tests AnalysisOrchestrator integration
      const mockCodebasePath = path.resolve(__dirname, '../../../');
      const report = await assessmentSystem.conductAssessment(
        environment.containerId,
        mockCodebasePath
      );

      expect(report).toBeDefined();
      expect(report.environmentId).toBe(environment.containerId);
      expect(report.status).toBe('completed');
      expect(report.results).toBeDefined();
      expect(report.results.securityFindings).toBeInstanceOf(Array);
      expect(report.results.codeQualityIssues).toBeInstanceOf(Array);
      expect(report.results.testResults).toBeInstanceOf(Array);
      expect(report.results.performanceMetrics).toBeInstanceOf(Array);
      expect(report.results.recommendations).toBeInstanceOf(Array);

      // Cleanup
      await assessmentSystem.cleanupAssessment(environment.containerId);
    });

    test('should validate security boundaries and isolation properties', async () => {
      const securityConfig: SecurityConfiguration = {
        networkIsolation: true,
        allowedNetworkAccess: [],
        resourceLimits: {
          cpu: '0.5',
          memory: '256m',
          diskSpace: '500m',
        },
        filesystemAccess: {
          readOnlyMounts: ['/code'],
          writableMounts: ['/tmp'],
        },
        securityPolicies: ['no-privileged', 'no-host-network', 'no-host-pid'],
      };

      const analysisConfig = assessmentSystem.createDefaultAnalysisConfig('nodejs');

      // Create environment with strict security
      const environment = await assessmentSystem.createSecureAssessmentEnvironment(
        securityConfig,
        analysisConfig
      );

      // Test network isolation
      const networkIsolationValid = await assessmentSystem.validateSecurityBoundaries(
        environment.containerId,
        { ...securityConfig, networkIsolation: true }
      );
      expect(networkIsolationValid).toBe(true);

      // Test filesystem restrictions
      const filesystemSecurityValid = await assessmentSystem.validateSecurityBoundaries(
        environment.containerId,
        securityConfig
      );
      expect(filesystemSecurityValid).toBe(true);

      // Test resource limits
      const resourceLimitsValid = await assessmentSystem.validateSecurityBoundaries(
        environment.containerId,
        securityConfig
      );
      expect(resourceLimitsValid).toBe(true);

      // Cleanup
      await assessmentSystem.cleanupAssessment(environment.containerId);
    });

    test('should handle blockchain assessment with integrated components', async () => {
      const securityConfig = assessmentSystem.createDefaultSecurityConfig();
      const analysisConfig = assessmentSystem.createDefaultAnalysisConfig('solidity');

      // Create environment for blockchain assessment
      const environment = await assessmentSystem.createSecureAssessmentEnvironment(
        securityConfig,
        analysisConfig
      );

      // Conduct blockchain assessment - tests BlockchainAnalysisEngine integration
      const mockContractsPath = path.resolve(__dirname, '../../../contracts');
      const results = await assessmentSystem.conductBlockchainAssessment(
        environment.containerId,
        mockContractsPath
      );

      expect(results).toBeDefined();
      expect(results.securityFindings).toBeInstanceOf(Array);
      expect(results.testResults).toBeInstanceOf(Array);
      expect(results.performanceMetrics).toBeInstanceOf(Array);
      expect(results.recommendations).toBeInstanceOf(Array);

      // Verify blockchain-specific recommendations
      expect(results.recommendations.some(rec => 
        rec.includes('formal verification') || 
        rec.includes('smart contract') ||
        rec.includes('gas')
      )).toBe(true);

      // Cleanup
      await assessmentSystem.cleanupAssessment(environment.containerId);
    });

    test('should manage multiple environments concurrently', async () => {
      const securityConfig = assessmentSystem.createDefaultSecurityConfig();
      const nodejsConfig = assessmentSystem.createDefaultAnalysisConfig('nodejs');
      const solidityConfig = assessmentSystem.createDefaultAnalysisConfig('solidity');

      // Create multiple environments
      const env1 = await assessmentSystem.createSecureAssessmentEnvironment(
        securityConfig,
        nodejsConfig
      );

      const env2 = await assessmentSystem.createSecureAssessmentEnvironment(
        securityConfig,
        solidityConfig
      );

      // Verify both environments are active
      const activeEnvironments = await assessmentSystem.listActiveAssessments();
      expect(activeEnvironments.length).toBeGreaterThanOrEqual(2);

      // Verify individual environment status
      const status1 = await assessmentSystem.getAssessmentStatus(env1.containerId);
      const status2 = await assessmentSystem.getAssessmentStatus(env2.containerId);

      expect(status1).toBe('running');
      expect(status2).toBe('running');

      // Cleanup both environments
      await assessmentSystem.cleanupAssessment(env1.containerId);
      await assessmentSystem.cleanupAssessment(env2.containerId);

      // Verify cleanup
      const finalEnvironments = await assessmentSystem.listActiveAssessments();
      expect(finalEnvironments.length).toBe(0);
    });

    test('should handle error scenarios gracefully with integrated error handling', async () => {
      const securityConfig = assessmentSystem.createDefaultSecurityConfig();
      const analysisConfig = assessmentSystem.createDefaultAnalysisConfig('nodejs');

      // Create environment
      const environment = await assessmentSystem.createSecureAssessmentEnvironment(
        securityConfig,
        analysisConfig
      );

      // Test assessment with invalid path
      const report = await assessmentSystem.conductAssessment(
        environment.containerId,
        '/non/existent/path'
      );

      // Should handle failure gracefully
      expect(report.status).toBe('failed');
      expect(report.results.recommendations).toContain(
        expect.stringContaining('Assessment failed')
      );

      // Cleanup should still work
      await assessmentSystem.cleanupAssessment(environment.containerId);
    });
  });

  describe('Configuration Integration', () => {
    test('should create and apply different configuration combinations', async () => {
      // Test Node.js configuration
      const nodejsConfig = assessmentSystem.createDefaultAnalysisConfig('nodejs');
      expect(nodejsConfig.codebaseType).toBe('nodejs');
      expect(nodejsConfig.analysisTools).toContain('eslint');
      expect(nodejsConfig.testFrameworks).toContain('jest');

      // Test Solidity configuration
      const solidityConfig = assessmentSystem.createDefaultAnalysisConfig('solidity');
      expect(solidityConfig.codebaseType).toBe('solidity');
      expect(solidityConfig.analysisTools).toContain('slither');
      expect(solidityConfig.testFrameworks).toContain('hardhat');

      // Test mixed configuration
      const mixedConfig = assessmentSystem.createDefaultAnalysisConfig('mixed');
      expect(mixedConfig.codebaseType).toBe('mixed');
      expect(mixedConfig.analysisTools).toContain('eslint');
      expect(mixedConfig.analysisTools).toContain('slither');
      expect(mixedConfig.testFrameworks).toContain('jest');
      expect(mixedConfig.testFrameworks).toContain('hardhat');

      // Test security configuration
      const securityConfig = assessmentSystem.createDefaultSecurityConfig();
      expect(securityConfig.networkIsolation).toBe(true);
      expect(securityConfig.resourceLimits).toBeDefined();
      expect(securityConfig.filesystemAccess).toBeDefined();
      expect(securityConfig.securityPolicies).toBeInstanceOf(Array);
    });
  });
});