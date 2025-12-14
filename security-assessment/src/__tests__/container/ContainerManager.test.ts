/**
 * Tests for ContainerManager with comprehensive error handling
 */

import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
import { ContainerManager } from '../../container/ContainerManager';
import { SecurityConfiguration, AnalysisConfiguration } from '../../types';
import { 
  ContainerCreationError, 
  SecurityViolationError,
  ValidationError 
} from '../../utils/errors';

// Mock the utilities
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}));
jest.mock('../../utils/retry', () => ({
  withRetry: jest.fn().mockImplementation(async (operation) => {
    try {
      const result = await operation();
      return { success: true, result, attempts: 1, totalDuration: 10 };
    } catch (error) {
      return { success: false, error, attempts: 1, totalDuration: 10 };
    }
  }),
  DEFAULT_RETRY_OPTIONS: {
    containerCreation: { maxAttempts: 3 },
    resourceAllocation: { maxAttempts: 3 },
  },
  CircuitBreaker: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockImplementation(async (operation) => operation()),
  })),
}));
jest.mock('../../utils/recovery', () => ({
  RecoveryManager: jest.fn().mockImplementation(() => ({
    createCheckpoint: jest.fn(),
    attemptRecovery: jest.fn().mockResolvedValue({ success: false, shouldContinue: false }),
    clearRecoveryData: jest.fn(),
  })),
}));

// Mock Docker for testing
const mockContainer = {
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  kill: jest.fn().mockResolvedValue(undefined),
  inspect: jest.fn().mockResolvedValue({
    State: { Status: 'running' },
    NetworkSettings: { Networks: {} },
    id: 'mock-container-id'
  }),
  exec: jest.fn().mockResolvedValue({
    start: jest.fn().mockResolvedValue(undefined)
  }),
  id: 'mock-container-id'
};

const mockDocker = {
  createContainer: jest.fn().mockResolvedValue(mockContainer),
  getContainer: jest.fn().mockReturnValue(mockContainer),
  getNetwork: jest.fn().mockReturnValue({
    remove: jest.fn().mockResolvedValue(undefined)
  })
};

jest.mock('dockerode', () => {
  return jest.fn().mockImplementation(() => mockDocker);
});

// Mock fs for file operations
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  statSync: jest.fn().mockReturnValue({ isFile: () => true, isDirectory: () => false }),
  readFileSync: jest.fn().mockReturnValue('console.log("safe code");'),
  readdirSync: jest.fn().mockReturnValue([])
}));

// Mock child_process
const mockExec = jest.fn((command, callback) => {
  callback(null, 'success', '');
});

jest.mock('child_process', () => ({
  exec: mockExec
}));

describe('ContainerManager', () => {
  let manager: ContainerManager;
  let mockSecurityConfig: SecurityConfiguration;
  let mockAnalysisConfig: AnalysisConfiguration;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    manager = new ContainerManager();
    
    mockSecurityConfig = {
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

    mockAnalysisConfig = {
      codebaseType: 'nodejs',
      analysisTools: ['eslint', 'npm-audit'],
      testFrameworks: ['jest'],
      reportFormats: ['json'],
    };
  });

  describe('createAssessmentEnvironment', () => {
    it('should create assessment environment with correct configuration', async () => {
      const environment = await manager.createAssessmentEnvironment(
        mockSecurityConfig,
        mockAnalysisConfig
      );

      expect(environment.containerId).toBeDefined();
      expect(environment.containerId).toMatch(/^assessment-\d+-[a-z0-9]+$/);
      expect(environment.status).toBe('ready');
      expect(environment.securityConfig).toBe(mockSecurityConfig);
      expect(environment.analysisConfig).toBe(mockAnalysisConfig);
      expect(environment.createdAt).toBeInstanceOf(Date);
    });

    it('should validate configuration before creation', async () => {
      const invalidConfig = {
        ...mockSecurityConfig,
        resourceLimits: {
          cpu: 'invalid',
          memory: '512m',
          diskSpace: '1g',
        },
      };

      await expect(
        manager.createAssessmentEnvironment(invalidConfig, mockAnalysisConfig)
      ).rejects.toThrow();
    });

    it('should handle container creation failures', async () => {
      mockDocker.createContainer.mockRejectedValueOnce(new Error('Docker daemon not available'));

      await expect(
        manager.createAssessmentEnvironment(mockSecurityConfig, mockAnalysisConfig)
      ).rejects.toThrow(ContainerCreationError);
    });

    it('should validate codebase type', async () => {
      const invalidAnalysisConfig = {
        ...mockAnalysisConfig,
        codebaseType: 'invalid' as any,
      };

      await expect(
        manager.createAssessmentEnvironment(mockSecurityConfig, invalidAnalysisConfig)
      ).rejects.toThrow('Invalid codebase type');
    });

    it('should generate unique container IDs', async () => {
      const env1 = await manager.createAssessmentEnvironment(mockSecurityConfig, mockAnalysisConfig);
      const env2 = await manager.createAssessmentEnvironment(mockSecurityConfig, mockAnalysisConfig);

      expect(env1.containerId).not.toBe(env2.containerId);
    });
  });

  describe('mountCodebase', () => {
    let containerId: string;

    beforeEach(async () => {
      const env = await manager.createAssessmentEnvironment(mockSecurityConfig, mockAnalysisConfig);
      containerId = env.containerId;
    });

    it('should mount codebase successfully', async () => {
      const sourcePath = '/tmp/test-code';
      const containerPath = '/workspace/code';

      await expect(
        manager.mountCodebase(containerId, sourcePath, containerPath)
      ).resolves.not.toThrow();

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('docker cp'),
        expect.any(Function)
      );
    });

    it('should validate mount security', async () => {
      const sourcePath = '/etc/passwd'; // Forbidden path
      const containerPath = '/workspace/code';

      await expect(
        manager.mountCodebase(containerId, sourcePath, containerPath)
      ).rejects.toThrow(SecurityViolationError);
    });

    it('should detect malicious code patterns', async () => {
      const fs = require('fs');
      fs.readFileSync.mockReturnValueOnce('rm -rf / # malicious code');

      const sourcePath = '/tmp/malicious-code';
      const containerPath = '/workspace/code';

      await expect(
        manager.mountCodebase(containerId, sourcePath, containerPath)
      ).rejects.toThrow(SecurityViolationError);
    });

    it('should handle non-existent container', async () => {
      await expect(
        manager.mountCodebase('non-existent', '/tmp/code', '/workspace')
      ).rejects.toThrow(ContainerCreationError);
    });

    it('should handle non-existent source path', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValueOnce(false);

      await expect(
        manager.mountCodebase(containerId, '/non-existent', '/workspace')
      ).rejects.toThrow('Source path /non-existent does not exist');
    });

    it('should prevent mounting to sensitive container paths', async () => {
      const sourcePath = '/tmp/test-code';
      const containerPath = '/etc/sensitive'; // Forbidden container path

      await expect(
        manager.mountCodebase(containerId, sourcePath, containerPath)
      ).rejects.toThrow(SecurityViolationError);
    });
  });

  describe('destroyEnvironment', () => {
    it('should destroy environment successfully', async () => {
      const env = await manager.createAssessmentEnvironment(mockSecurityConfig, mockAnalysisConfig);
      
      await expect(
        manager.destroyEnvironment(env.containerId)
      ).resolves.not.toThrow();

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 10 });
      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
    });

    it('should handle graceful stop failure by force killing', async () => {
      const env = await manager.createAssessmentEnvironment(mockSecurityConfig, mockAnalysisConfig);
      
      mockContainer.stop.mockRejectedValueOnce(new Error('Stop failed'));

      await expect(
        manager.destroyEnvironment(env.containerId)
      ).resolves.not.toThrow();

      expect(mockContainer.stop).toHaveBeenCalled();
      expect(mockContainer.kill).toHaveBeenCalled();
      expect(mockContainer.remove).toHaveBeenCalled();
    });

    it('should handle destroying non-existent container gracefully', async () => {
      await expect(manager.destroyEnvironment('non-existent-id')).resolves.not.toThrow();
    });

    it('should clean up additional resources', async () => {
      const env = await manager.createAssessmentEnvironment(mockSecurityConfig, mockAnalysisConfig);
      
      await manager.destroyEnvironment(env.containerId);

      // Should attempt to remove custom network
      expect(mockDocker.getNetwork).toHaveBeenCalledWith(`restricted-${env.containerId}`);
    });
  });

  describe('getEnvironmentStatus', () => {
    it('should return container status', async () => {
      const env = await manager.createAssessmentEnvironment(mockSecurityConfig, mockAnalysisConfig);
      
      const status = await manager.getEnvironmentStatus(env.containerId);
      expect(status).toBe('running');
    });

    it('should return not_found for non-existent container', async () => {
      const status = await manager.getEnvironmentStatus('non-existent-id');
      expect(status).toBe('not_found');
    });

    it('should return error on inspection failure', async () => {
      const env = await manager.createAssessmentEnvironment(mockSecurityConfig, mockAnalysisConfig);
      
      mockContainer.inspect.mockRejectedValueOnce(new Error('Inspection failed'));
      
      const status = await manager.getEnvironmentStatus(env.containerId);
      expect(status).toBe('error');
    });
  });

  describe('error handling and recovery', () => {
    it('should handle emergency termination for security violations', async () => {
      const env = await manager.createAssessmentEnvironment(mockSecurityConfig, mockAnalysisConfig);
      
      // Simulate security violation during mount
      const fs = require('fs');
      fs.readFileSync.mockReturnValueOnce('eval(maliciousCode)');
      
      await expect(
        manager.mountCodebase(env.containerId, '/tmp/malicious', '/workspace')
      ).rejects.toThrow(SecurityViolationError);

      // Container should be killed immediately
      expect(mockContainer.kill).toHaveBeenCalled();
    });

    it('should validate resource limits format', async () => {
      const invalidConfig = {
        ...mockSecurityConfig,
        resourceLimits: {
          cpu: '1.0',
          memory: 'invalid-format',
          diskSpace: '1g',
        },
      };

      await expect(
        manager.createAssessmentEnvironment(invalidConfig, mockAnalysisConfig)
      ).rejects.toThrow('Invalid resource limit format');
    });

    it('should handle file scanning errors gracefully', async () => {
      const env = await manager.createAssessmentEnvironment(mockSecurityConfig, mockAnalysisConfig);
      
      // Mock file read error (e.g., binary file)
      const fs = require('fs');
      fs.readFileSync.mockImplementationOnce(() => {
        throw new Error('Binary file');
      });

      // Should not fail the mount operation for scan errors
      await expect(
        manager.mountCodebase(env.containerId, '/tmp/binary-file', '/workspace')
      ).resolves.not.toThrow();
    });
  });
});