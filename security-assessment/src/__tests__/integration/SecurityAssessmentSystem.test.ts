/**
 * Integration tests for SecurityAssessmentSystem
 * Tests the complete system cohesion and component integration
 * Note: These tests mock Docker to avoid requiring actual Docker daemon
 */

import { SecurityAssessmentSystem } from '../../SecurityAssessmentSystem';
import { SecurityConfiguration, AnalysisConfiguration } from '../../types';

// Set test timeout to prevent hanging
jest.setTimeout(30000);

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

describe('SecurityAssessmentSystem Integration Tests', () => {
  let assessmentSystem: SecurityAssessmentSystem;

  beforeAll(async () => {
    assessmentSystem = new SecurityAssessmentSystem();
  });

  describe('Environment Creation and Management', () => {
    let containerId: string;

    afterEach(async () => {
      if (containerId) {
        try {
          await assessmentSystem.cleanupAssessment(containerId);
        } catch (error) {
          // Ignore cleanup errors in tests
        }
      }
    });

    test('should create secure assessment environment with default configurations', async () => {
      const securityConfig = assessmentSystem.createDefaultSecurityConfig();
      const analysisConfig = assessmentSystem.createDefaultAnalysisConfig('nodejs');

      const environment = await assessmentSystem.createSecureAssessmentEnvironment(
        securityConfig,
        analysisConfig
      );

      containerId = environment.containerId;

      expect(environment).toBeDefined();
      expect(environment.containerId).toBeTruthy();
      expect(environment.status).toBe('ready');
      expect(environment.securityConfig).toEqual(securityConfig);
      expect(environment.analysisConfig).toEqual(analysisConfig);
      expect(environment.createdAt).toBeInstanceOf(Date);
    });

    test('should create environment with custom security configuration', async () => {
      const customSecurityConfig: SecurityConfiguration = {
        networkIsolation: true,
        allowedNetworkAccess: ['registry.npmjs.org'],
        resourceLimits: {
          cpu: '0.5',
          memory: '256m',
          diskSpace: '500m',
        },
        filesystemAccess: {
          readOnlyMounts: ['/code'],
          writableMounts: ['/tmp', '/output'],
        },
        securityPolicies: ['no-privileged', 'no-host-network'],
      };

      const analysisConfig = assessmentSystem.createDefaultAnalysisConfig('nodejs');

      const environment = await assessmentSystem.createSecureAssessmentEnvironment(
        customSecurityConfig,
        analysisConfig
      );

      containerId = environment.containerId;

      expect(environment.securityConfig).toEqual(customSecurityConfig);
      expect(environment.status).toBe('ready');
    });

    test('should validate security boundaries after environment creation', async () => {
      const securityConfig = assessmentSystem.createDefaultSecurityConfig();
      const analysisConfig = assessmentSystem.createDefaultAnalysisConfig('nodejs');

      const environment = await assessmentSystem.createSecureAssessmentEnvironment(
        securityConfig,
        analysisConfig
      );

      containerId = environment.containerId;

      const boundariesValid = await assessmentSystem.validateSecurityBoundaries(
        containerId,
        securityConfig
      );

      expect(boundariesValid).toBe(true);
    });

    test('should list active assessment environments', async () => {
      const securityConfig = assessmentSystem.createDefaultSecurityConfig();
      const analysisConfig = assessmentSystem.createDefaultAnalysisConfig('nodejs');

      const environment = await assessmentSystem.createSecureAssessmentEnvironment(
        securityConfig,
        analysisConfig
      );

      containerId = environment.containerId;

      const activeEnvironments = await assessmentSystem.listActiveAssessments();
      
      expect(activeEnvironments).toHaveLength(1);
      expect(activeEnvironments[0].containerId).toBe(containerId);
    });

    test('should get assessment status', async () => {
      const securityConfig = assessmentSystem.createDefaultSecurityConfig();
      const analysisConfig = assessmentSystem.createDefaultAnalysisConfig('nodejs');

      const environment = await assessmentSystem.createSecureAssessmentEnvironment(
        securityConfig,
        analysisConfig
      );

      containerId = environment.containerId;

      const status = await assessmentSystem.getAssessmentStatus(containerId);
      
      expect(status).toBe('running');
    });
  });

  describe('Complete Assessment Workflow', () => {
    let containerId: string;

    beforeEach(async () => {
      const securityConfig = assessmentSystem.createDefaultSecurityConfig();
      const analysisConfig = assessmentSystem.createDefaultAnalysisConfig('nodejs');

      const environment = await assessmentSystem.createSecureAssessmentEnvironment(
        securityConfig,
        analysisConfig
      );

      containerId = environment.containerId;
    });

    afterEach(async () => {
      if (containerId) {
        try {
          await assessmentSystem.cleanupAssessment(containerId);
        } catch (error) {
          // Ignore cleanup errors in tests
        }
      }
    });

    test('should conduct complete assessment with default workflow', async () => {
      // Mock file system operations to avoid actual file access
      const mockCodebasePath = '/mock/codebase';
      
      const report = await assessmentSystem.conductAssessment(
        containerId,
        mockCodebasePath
      );

      expect(report).toBeDefined();
      expect(report.environmentId).toBe(containerId);
      expect(report.status).toBe('completed');
      expect(report.startTime).toBeInstanceOf(Date);
      expect(report.endTime).toBeInstanceOf(Date);
      expect(report.summary).toBeDefined();
      expect(report.results).toBeDefined();
      expect(report.metadata).toBeDefined();

      // Verify report structure
      expect(report.results.securityFindings).toBeInstanceOf(Array);
      expect(report.results.codeQualityIssues).toBeInstanceOf(Array);
      expect(report.results.testResults).toBeInstanceOf(Array);
      expect(report.results.performanceMetrics).toBeInstanceOf(Array);
      expect(report.results.recommendations).toBeInstanceOf(Array);
    });

    test('should handle assessment failure gracefully', async () => {
      // Mock a failure scenario
      const mockCodebasePath = '/mock/failing/path';

      const report = await assessmentSystem.conductAssessment(
        containerId,
        mockCodebasePath
      );

      expect(report.status).toBe('failed');
      expect(report.results.recommendations).toContain(
        expect.stringContaining('Assessment failed')
      );
    });
  });

  describe('Blockchain Assessment Integration', () => {
    let containerId: string;

    beforeEach(async () => {
      const securityConfig = assessmentSystem.createDefaultSecurityConfig();
      const analysisConfig = assessmentSystem.createDefaultAnalysisConfig('solidity');

      const environment = await assessmentSystem.createSecureAssessmentEnvironment(
        securityConfig,
        analysisConfig
      );

      containerId = environment.containerId;
    });

    afterEach(async () => {
      if (containerId) {
        try {
          await assessmentSystem.cleanupAssessment(containerId);
        } catch (error) {
          // Ignore cleanup errors in tests
        }
      }
    });

    test('should conduct blockchain-specific assessment', async () => {
      const mockContractsPath = '/mock/contracts';
      
      const results = await assessmentSystem.conductBlockchainAssessment(
        containerId,
        mockContractsPath
      );

      expect(results).toBeDefined();
      expect(results.securityFindings).toBeInstanceOf(Array);
      expect(results.testResults).toBeInstanceOf(Array);
      expect(results.performanceMetrics).toBeInstanceOf(Array);
      expect(results.recommendations).toBeInstanceOf(Array);

      // Verify blockchain-specific recommendations
      expect(results.recommendations).toContain(
        expect.stringContaining('formal verification')
      );
    });
  });

  describe('Security Boundary Validation', () => {
    let containerId: string;

    beforeEach(async () => {
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
        securityPolicies: ['no-privileged', 'no-host-network'],
      };

      const analysisConfig = assessmentSystem.createDefaultAnalysisConfig('nodejs');

      const environment = await assessmentSystem.createSecureAssessmentEnvironment(
        securityConfig,
        analysisConfig
      );

      containerId = environment.containerId;
    });

    afterEach(async () => {
      if (containerId) {
        try {
          await assessmentSystem.cleanupAssessment(containerId);
        } catch (error) {
          // Ignore cleanup errors in tests
        }
      }
    });

    test('should validate network isolation', async () => {
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
        securityPolicies: ['no-privileged'],
      };

      const isValid = await assessmentSystem.validateSecurityBoundaries(
        containerId,
        securityConfig
      );

      expect(isValid).toBe(true);
    });

    test('should validate filesystem restrictions', async () => {
      const securityConfig: SecurityConfiguration = {
        networkIsolation: false,
        allowedNetworkAccess: [],
        resourceLimits: {
          cpu: '1.0',
          memory: '512m',
          diskSpace: '1g',
        },
        filesystemAccess: {
          readOnlyMounts: ['/code'],
          writableMounts: ['/tmp', '/output'],
        },
        securityPolicies: [],
      };

      const isValid = await assessmentSystem.validateSecurityBoundaries(
        containerId,
        securityConfig
      );

      expect(isValid).toBe(true);
    });

    test('should validate resource limits', async () => {
      const securityConfig: SecurityConfiguration = {
        networkIsolation: false,
        allowedNetworkAccess: [],
        resourceLimits: {
          cpu: '0.5',
          memory: '256m',
          diskSpace: '500m',
        },
        filesystemAccess: {
          readOnlyMounts: [],
          writableMounts: ['/tmp'],
        },
        securityPolicies: [],
      };

      const isValid = await assessmentSystem.validateSecurityBoundaries(
        containerId,
        securityConfig
      );

      expect(isValid).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    test('should create default security configuration', () => {
      const config = assessmentSystem.createDefaultSecurityConfig();

      expect(config).toBeDefined();
      expect(config.networkIsolation).toBe(true);
      expect(config.resourceLimits).toBeDefined();
      expect(config.filesystemAccess).toBeDefined();
      expect(config.securityPolicies).toBeInstanceOf(Array);
    });

    test('should create default analysis configuration for Node.js', () => {
      const config = assessmentSystem.createDefaultAnalysisConfig('nodejs');

      expect(config).toBeDefined();
      expect(config.codebaseType).toBe('nodejs');
      expect(config.analysisTools).toContain('eslint');
      expect(config.analysisTools).toContain('npm-audit');
      expect(config.testFrameworks).toContain('jest');
    });

    test('should create default analysis configuration for Solidity', () => {
      const config = assessmentSystem.createDefaultAnalysisConfig('solidity');

      expect(config).toBeDefined();
      expect(config.codebaseType).toBe('solidity');
      expect(config.analysisTools).toContain('slither');
      expect(config.testFrameworks).toContain('hardhat');
    });

    test('should create default analysis configuration for mixed codebase', () => {
      const config = assessmentSystem.createDefaultAnalysisConfig('mixed');

      expect(config).toBeDefined();
      expect(config.codebaseType).toBe('mixed');
      expect(config.analysisTools).toContain('eslint');
      expect(config.analysisTools).toContain('slither');
      expect(config.testFrameworks).toContain('jest');
      expect(config.testFrameworks).toContain('hardhat');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle container creation failure gracefully', async () => {
      // Create invalid configuration to trigger failure
      const invalidSecurityConfig: SecurityConfiguration = {
        networkIsolation: true,
        allowedNetworkAccess: [],
        resourceLimits: {
          cpu: 'invalid',
          memory: 'invalid',
          diskSpace: 'invalid',
        },
        filesystemAccess: {
          readOnlyMounts: [],
          writableMounts: [],
        },
        securityPolicies: [],
      };

      const analysisConfig = assessmentSystem.createDefaultAnalysisConfig('nodejs');

      await expect(
        assessmentSystem.createSecureAssessmentEnvironment(
          invalidSecurityConfig,
          analysisConfig
        )
      ).rejects.toThrow();
    });

    test('should cleanup resources after failure', async () => {
      const securityConfig = assessmentSystem.createDefaultSecurityConfig();
      const analysisConfig = assessmentSystem.createDefaultAnalysisConfig('nodejs');

      let environment;
      try {
        environment = await assessmentSystem.createSecureAssessmentEnvironment(
          securityConfig,
          analysisConfig
        );

        // Force an error during assessment
        await expect(
          assessmentSystem.conductAssessment(
            environment.containerId,
            '/non/existent/path'
          )
        ).resolves.toHaveProperty('status', 'failed');

      } finally {
        if (environment) {
          await assessmentSystem.cleanupAssessment(environment.containerId);
        }
      }

      // Verify cleanup
      const activeEnvironments = await assessmentSystem.listActiveAssessments();
      expect(activeEnvironments).toHaveLength(0);
    });
  });
});