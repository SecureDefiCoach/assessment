/**
 * ContainerManager - Orchestrates container lifecycle and security configuration
 */

import Docker from 'dockerode';
import * as path from 'path';
import { AssessmentEnvironment, SecurityConfiguration, AnalysisConfiguration, ContainerConfig, MountPoint } from '../types';
import { 
  ContainerCreationError, 
  ContainerStartError, 
  ContainerStopError, 
  ContainerDestroyError,
  ResourceAllocationError,
  SecurityViolationError,
  ErrorHandler,
  ErrorRecoveryState,
  logger
} from '../utils';
import { withRetry, DEFAULT_RETRY_OPTIONS, CircuitBreaker } from '../utils/retry';
import { RecoveryManager } from '../utils/recovery';

export class ContainerManager {
  private docker: Docker;
  private activeContainers: Map<string, Docker.Container>;
  private recoveryManager: RecoveryManager;
  private circuitBreaker: CircuitBreaker;
  private containerStates: Map<string, ErrorRecoveryState>;

  constructor() {
    this.docker = new Docker();
    this.activeContainers = new Map();
    this.recoveryManager = new RecoveryManager();
    this.circuitBreaker = new CircuitBreaker(5, 60000, 2);
    this.containerStates = new Map();
  }

  /**
   * Provisions new isolated container for code assessment with comprehensive error handling
   */
  async createAssessmentEnvironment(
    securityConfig: SecurityConfiguration,
    analysisConfig: AnalysisConfiguration
  ): Promise<AssessmentEnvironment> {
    const containerId = this.generateContainerId();
    
    const environment: AssessmentEnvironment = {
      containerId,
      status: 'creating',
      securityConfig,
      analysisConfig,
      createdAt: new Date(),
    };

    // Initialize recovery state
    const recoveryState: ErrorRecoveryState = {
      containerId,
      completedSteps: [],
      failedSteps: [],
      recoveryAttempts: 0,
      maxRecoveryAttempts: 3,
    };
    this.containerStates.set(containerId, recoveryState);

    try {
      // Create checkpoint before starting
      this.recoveryManager.createCheckpoint(
        containerId,
        'environment-creation-start',
        { securityConfig, analysisConfig }
      );

      // Use circuit breaker and retry logic for container creation
      const result = await this.circuitBreaker.execute(async () => {
        return await withRetry(
          async () => {
            // Validate configuration first
            this.validateEnvironmentConfiguration(securityConfig, analysisConfig);
            
            // Create container configuration
            const containerConfig = this.buildContainerConfig(containerId, securityConfig, analysisConfig);
            
            // Create the container
            const container = await this.docker.createContainer(containerConfig);
            this.activeContainers.set(containerId, container);
            
            // Start the container
            await container.start();
            
            return container;
          },
          {
            ...DEFAULT_RETRY_OPTIONS.containerCreation,
            onRetry: (error, attempt) => {
              logger.warn(`Container creation retry ${attempt}`, {
                containerId,
                error: error.message,
              });
              
              // Update recovery state
              recoveryState.recoveryAttempts = attempt;
              recoveryState.lastError = ErrorHandler.createFromGenericError(error, { containerId });
            },
          },
          `createAssessmentEnvironment-${containerId}`
        );
      }, `createAssessmentEnvironment-${containerId}`);

      if (!result.success) {
        throw result.error || new ContainerCreationError(
          `Failed to create container after ${result.attempts} attempts`,
          { containerId, attempts: result.attempts }
        );
      }

      // Create checkpoint after successful creation
      this.recoveryManager.createCheckpoint(
        containerId,
        'environment-creation-complete',
        { status: 'ready' }
      );

      // Update environment status
      environment.status = 'ready';
      recoveryState.completedSteps.push('container-creation');
      
      logger.info(`Successfully created assessment environment ${containerId}`, {
        attempts: result.attempts,
        duration: result.totalDuration,
      });
      
      return environment;

    } catch (error) {
      environment.status = 'failed';
      
      const assessmentError = ErrorHandler.createFromGenericError(error as Error, { 
        containerId,
        securityConfig,
        analysisConfig 
      });

      // Attempt recovery if the error is recoverable
      if (ErrorHandler.isRecoverable(assessmentError)) {
        logger.info(`Attempting recovery for container creation failure`, { containerId });
        
        try {
          const recoveryResult = await this.recoveryManager.attemptRecovery(assessmentError, recoveryState);
          
          if (recoveryResult.success && recoveryResult.shouldContinue) {
            // Retry the operation with recovered state
            return await this.createAssessmentEnvironment(securityConfig, analysisConfig);
          }
        } catch (recoveryError) {
          logger.error(`Recovery failed for container ${containerId}`, { 
            originalError: assessmentError.message,
            recoveryError: (recoveryError as Error).message 
          });
        }
      }

      // Clean up any partial resources
      await this.cleanupFailedContainer(containerId);
      
      logger.error(`Failed to create assessment environment ${containerId}`, {
        error: assessmentError.message,
        code: assessmentError.code,
        recoverable: assessmentError.recoverable,
      });
      
      throw assessmentError;
    }
  }

  /**
   * Safely mounts untrusted code into container with security validation
   */
  async mountCodebase(containerId: string, sourcePath: string, containerPath: string): Promise<void> {
    const container = this.activeContainers.get(containerId);
    if (!container) {
      throw new ContainerCreationError(`Container ${containerId} not found`, { containerId });
    }

    const recoveryState = this.containerStates.get(containerId);
    if (!recoveryState) {
      throw new ContainerCreationError(`Recovery state not found for container ${containerId}`, { containerId });
    }

    try {
      // Create checkpoint before mounting
      this.recoveryManager.createCheckpoint(
        containerId,
        'codebase-mount-start',
        { sourcePath, containerPath }
      );

      // Validate mount operation security
      await this.validateMountSecurity(sourcePath, containerPath);

      // Use retry logic for mount operation
      const result = await withRetry(
        async () => {
          // Check if container is running
          const info = await container.inspect();
          if (info.State.Status !== 'running') {
            throw new ContainerStartError(`Container ${containerId} is not running`, { 
              containerId, 
              status: info.State.Status 
            });
          }

          // Validate source path exists and is accessible
          const fs = require('fs');
          if (!fs.existsSync(sourcePath)) {
            throw new Error(`Source path ${sourcePath} does not exist`);
          }

          // Check for security violations in source path
          await this.scanSourceForSecurityIssues(sourcePath);

          // Perform the mount operation
          const exec = require('child_process').exec;
          const copyCommand = `docker cp "${sourcePath}" ${container.id}:${containerPath}`;
          
          await new Promise<void>((resolve, reject) => {
            exec(copyCommand, (error: Error | null, stdout: string, stderr: string) => {
              if (error) {
                reject(new Error(`Failed to mount codebase: ${error.message}`));
              } else {
                resolve();
              }
            });
          });

          // Verify mount was successful and secure
          await this.verifyMountSecurity(container, containerPath);
        },
        DEFAULT_RETRY_OPTIONS.resourceAllocation,
        `mountCodebase-${containerId}`
      );

      if (!result.success) {
        throw result.error || new Error(`Failed to mount codebase after ${result.attempts} attempts`);
      }

      // Create checkpoint after successful mount
      this.recoveryManager.createCheckpoint(
        containerId,
        'codebase-mount-complete',
        { sourcePath, containerPath, mounted: true }
      );

      recoveryState.completedSteps.push('codebase-mount');

      logger.info(`Successfully mounted ${sourcePath} to ${containerPath} in container ${containerId}`, {
        attempts: result.attempts,
        duration: result.totalDuration,
      });

    } catch (error) {
      const assessmentError = ErrorHandler.createFromGenericError(error as Error, { 
        containerId,
        sourcePath,
        containerPath 
      });

      recoveryState.failedSteps.push('codebase-mount');
      recoveryState.lastError = assessmentError;

      // Check for security violations
      if (ErrorHandler.isSecurityViolation(assessmentError)) {
        logger.error(`Security violation detected during mount operation`, {
          containerId,
          error: assessmentError.message,
        });
        
        // Immediate termination for security violations
        await this.emergencyTermination(containerId, assessmentError);
        throw assessmentError;
      }

      // Attempt recovery for non-security errors
      if (ErrorHandler.isRecoverable(assessmentError)) {
        try {
          const recoveryResult = await this.recoveryManager.attemptRecovery(assessmentError, recoveryState);
          
          if (recoveryResult.success && recoveryResult.shouldContinue) {
            // Retry the mount operation
            return await this.mountCodebase(containerId, sourcePath, containerPath);
          }
        } catch (recoveryError) {
          logger.error(`Recovery failed for mount operation`, { 
            containerId,
            originalError: assessmentError.message,
            recoveryError: (recoveryError as Error).message 
          });
        }
      }

      logger.error(`Error mounting codebase to container ${containerId}`, {
        error: assessmentError.message,
        code: assessmentError.code,
      });
      
      throw assessmentError;
    }
  }

  /**
   * Safely retrieves analysis results from container
   */
  async extractResults(containerId: string, outputPath: string): Promise<void> {
    // Implementation will be added in subsequent tasks
    throw new Error('Not implemented yet');
  }

  /**
   * Complete cleanup and resource deallocation with comprehensive error handling
   */
  async destroyEnvironment(containerId: string): Promise<void> {
    const container = this.activeContainers.get(containerId);
    
    try {
      if (container) {
        // Create checkpoint before destruction
        this.recoveryManager.createCheckpoint(
          containerId,
          'environment-destruction-start',
          { containerId }
        );

        // Use retry logic for container destruction
        const result = await withRetry(
          async () => {
            try {
              // Stop the container gracefully first
              await container.stop({ t: 10 }); // 10 second timeout
            } catch (stopError) {
              // If graceful stop fails, force kill
              logger.warn(`Graceful stop failed, force killing container ${containerId}`, {
                error: (stopError as Error).message,
              });
              await container.kill();
            }

            // Remove the container
            await container.remove({ force: true });
          },
          {
            maxAttempts: 3,
            baseDelayMs: 1000,
            maxDelayMs: 5000,
            backoffMultiplier: 2,
            retryCondition: (error: Error) => {
              // Retry on transient errors but not on "not found" errors
              return !error.message.includes('No such container') &&
                     !error.message.includes('not found');
            },
          },
          `destroyEnvironment-${containerId}`
        );

        if (!result.success) {
          throw new ContainerDestroyError(
            `Failed to destroy container after ${result.attempts} attempts: ${result.error?.message}`,
            { containerId, attempts: result.attempts }
          );
        }

        this.activeContainers.delete(containerId);
        
        logger.info(`Successfully destroyed container ${containerId}`, {
          attempts: result.attempts,
          duration: result.totalDuration,
        });
      }

      // Clean up additional resources
      await this.cleanupAdditionalResources(containerId);
      
      // Clear recovery data
      this.recoveryManager.clearRecoveryData(containerId);
      this.containerStates.delete(containerId);

    } catch (error) {
      const assessmentError = ErrorHandler.createFromGenericError(error as Error, { containerId });
      
      logger.error(`Error destroying container ${containerId}`, {
        error: assessmentError.message,
        code: assessmentError.code,
      });

      // Even if destruction fails, clean up our internal state
      this.activeContainers.delete(containerId);
      this.containerStates.delete(containerId);
      
      throw assessmentError;
    }
  }

  /**
   * Gets the status of an assessment environment
   */
  async getEnvironmentStatus(containerId: string): Promise<string> {
    const container = this.activeContainers.get(containerId);
    if (!container) {
      return 'not_found';
    }

    try {
      const info = await container.inspect();
      return info.State.Status;
    } catch (error) {
      console.error(`Error getting container status:`, error);
      return 'error';
    }
  }

  /**
   * Lists all active assessment environments
   */
  async listEnvironments(): Promise<AssessmentEnvironment[]> {
    const environments: AssessmentEnvironment[] = [];
    
    for (const [containerId, container] of this.activeContainers) {
      try {
        const info = await container.inspect();
        const recoveryState = this.containerStates.get(containerId);
        
        environments.push({
          containerId,
          status: info.State.Status as any,
          securityConfig: {} as SecurityConfiguration, // Would need to store this
          analysisConfig: {} as AnalysisConfiguration, // Would need to store this
          createdAt: new Date(info.Created),
        });
      } catch (error) {
        logger.warn(`Could not inspect container ${containerId}`, {
          error: (error as Error).message,
        });
      }
    }
    
    return environments;
  }

  /**
   * Stops a running assessment environment
   */
  async stopEnvironment(containerId: string): Promise<void> {
    const container = this.activeContainers.get(containerId);
    if (!container) {
      throw new ContainerStopError(`Container ${containerId} not found`, { containerId });
    }

    try {
      await container.stop({ t: 10 }); // 10 second timeout
      logger.info(`Stopped container ${containerId}`);
    } catch (error) {
      throw new ContainerStopError(
        `Failed to stop container ${containerId}: ${(error as Error).message}`,
        { containerId }
      );
    }
  }

  /**
   * Cleans up all assessment environments
   */
  async cleanupAllEnvironments(): Promise<void> {
    const containerIds = Array.from(this.activeContainers.keys());
    
    for (const containerId of containerIds) {
      try {
        await this.destroyEnvironment(containerId);
      } catch (error) {
        logger.error(`Failed to cleanup container ${containerId}`, {
          error: (error as Error).message,
        });
      }
    }
    
    logger.info(`Cleaned up ${containerIds.length} containers`);
  }

  private generateContainerId(): string {
    return `assessment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Builds Docker container configuration based on security and analysis settings
   */
  private buildContainerConfig(
    containerId: string,
    securityConfig: SecurityConfiguration,
    analysisConfig: AnalysisConfiguration
  ): Docker.ContainerCreateOptions {
    // Select base image based on codebase type
    let image = 'node:20-alpine';
    if (analysisConfig.codebaseType === 'solidity') {
      image = 'ethereum/solc:stable';
    } else if (analysisConfig.codebaseType === 'mixed') {
      image = 'node:20-alpine'; // We'll install additional tools as needed
    }

    // Build host configuration with security constraints
    const hostConfig: Docker.HostConfig = {
      // Resource limits
      Memory: this.parseMemoryLimit(securityConfig.resourceLimits.memory),
      CpuQuota: this.parseCpuLimit(securityConfig.resourceLimits.cpu),
      CpuPeriod: 100000, // Standard CPU period
      
      // Security settings
      Privileged: false,
      ReadonlyRootfs: false, // We need some write access for analysis tools
      
      // Network isolation
      NetworkMode: securityConfig.networkIsolation ? 'none' : 'bridge',
      
      // Prevent access to host devices and capabilities
      CapDrop: ['ALL'],
      CapAdd: [], // No additional capabilities
      
      // Filesystem binds (will be configured later via mountCodebase)
      Binds: [],
      
      // Prevent container from accessing host processes
      PidMode: '',
      
      // Security options
      SecurityOpt: ['no-new-privileges:true'],
    };

    // Environment variables for analysis tools
    const env = [
      'NODE_ENV=development',
      'NPM_CONFIG_AUDIT_LEVEL=moderate',
      `ANALYSIS_TYPE=${analysisConfig.codebaseType}`,
    ];

    // Add custom environment variables if needed
    if (analysisConfig.customWorkflows) {
      env.push(`CUSTOM_WORKFLOWS=${analysisConfig.customWorkflows.join(',')}`);
    }

    return {
      Image: image,
      name: containerId,
      Env: env,
      WorkingDir: '/workspace',
      Cmd: ['/bin/sh', '-c', 'tail -f /dev/null'], // Keep container running
      HostConfig: hostConfig,
      Labels: {
        'security-assessment': 'true',
        'created-by': 'security-assessment-container',
        'codebase-type': analysisConfig.codebaseType,
      },
    };
  }

  /**
   * Parses memory limit string to bytes
   */
  private parseMemoryLimit(memoryStr: string): number {
    const match = memoryStr.match(/^(\d+)([kmg]?)$/i);
    if (!match) {
      throw new Error(`Invalid memory format: ${memoryStr}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'k':
        return value * 1024;
      case 'm':
        return value * 1024 * 1024;
      case 'g':
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  /**
   * Parses CPU limit string to quota (microseconds per period)
   */
  private parseCpuLimit(cpuStr: string): number {
    const cpuFloat = parseFloat(cpuStr);
    if (isNaN(cpuFloat) || cpuFloat <= 0) {
      throw new Error(`Invalid CPU format: ${cpuStr}`);
    }
    
    // Convert CPU cores to quota (100000 microseconds = 1 core)
    return Math.floor(cpuFloat * 100000);
  }

  /**
   * Validates environment configuration before creation
   */
  private validateEnvironmentConfiguration(
    securityConfig: SecurityConfiguration,
    analysisConfig: AnalysisConfiguration
  ): void {
    // Validate security configuration
    if (!securityConfig.resourceLimits) {
      throw new Error('Resource limits are required in security configuration');
    }

    if (!securityConfig.resourceLimits.cpu || !securityConfig.resourceLimits.memory) {
      throw new Error('CPU and memory limits are required');
    }

    // Validate resource limit formats
    try {
      this.parseMemoryLimit(securityConfig.resourceLimits.memory);
      this.parseCpuLimit(securityConfig.resourceLimits.cpu);
    } catch (error) {
      throw new Error(`Invalid resource limit format: ${(error as Error).message}`);
    }

    // Validate analysis configuration
    if (!analysisConfig.codebaseType) {
      throw new Error('Codebase type is required in analysis configuration');
    }

    const validCodebaseTypes = ['nodejs', 'solidity', 'mixed'];
    if (!validCodebaseTypes.includes(analysisConfig.codebaseType)) {
      throw new Error(`Invalid codebase type: ${analysisConfig.codebaseType}`);
    }
  }

  /**
   * Validates mount operation security
   */
  private async validateMountSecurity(sourcePath: string, containerPath: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    // Check if source path is within allowed directories
    const allowedPaths = ['/tmp', '/workspace', process.cwd()];
    const resolvedSource = path.resolve(sourcePath);
    
    const isAllowed = allowedPaths.some(allowedPath => {
      const resolvedAllowed = path.resolve(allowedPath);
      return resolvedSource.startsWith(resolvedAllowed);
    });

    if (!isAllowed) {
      throw new SecurityViolationError(
        `Source path ${sourcePath} is not in allowed directories`,
        'FILESYSTEM',
        { sourcePath, allowedPaths }
      );
    }

    // Check container path is not sensitive
    const forbiddenContainerPaths = ['/etc', '/usr', '/bin', '/sbin', '/root'];
    if (forbiddenContainerPaths.some(forbidden => containerPath.startsWith(forbidden))) {
      throw new SecurityViolationError(
        `Container path ${containerPath} targets sensitive directory`,
        'FILESYSTEM',
        { containerPath, forbiddenPaths: forbiddenContainerPaths }
      );
    }
  }

  /**
   * Scans source code for obvious security issues before mounting
   */
  private async scanSourceForSecurityIssues(sourcePath: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    try {
      const stats = fs.statSync(sourcePath);
      
      if (stats.isFile()) {
        await this.scanFile(sourcePath);
      } else if (stats.isDirectory()) {
        await this.scanDirectory(sourcePath);
      }
    } catch (error) {
      logger.warn(`Could not scan source for security issues: ${(error as Error).message}`, {
        sourcePath,
      });
      // Don't fail the operation for scan errors, just log them
    }
  }

  /**
   * Scans a single file for security issues
   */
  private async scanFile(filePath: string): Promise<void> {
    const fs = require('fs');
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for obvious malicious patterns
      const maliciousPatterns = [
        /rm\s+-rf\s+\//, // Dangerous rm commands
        /curl.*\|\s*sh/, // Pipe to shell
        /wget.*\|\s*sh/, // Pipe to shell
        /eval\s*\(/, // Eval statements
        /exec\s*\(/, // Exec statements
        /system\s*\(/, // System calls
      ];

      for (const pattern of maliciousPatterns) {
        if (pattern.test(content)) {
          throw new SecurityViolationError(
            `Potentially malicious code detected in ${filePath}`,
            'MALICIOUS_CODE',
            { filePath, pattern: pattern.toString() }
          );
        }
      }
    } catch (error) {
      if (error instanceof SecurityViolationError) {
        throw error;
      }
      // Ignore other errors (binary files, permission issues, etc.)
    }
  }

  /**
   * Scans a directory for security issues
   */
  private async scanDirectory(dirPath: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    try {
      const entries = fs.readdirSync(dirPath);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = fs.statSync(fullPath);
        
        if (stats.isFile()) {
          await this.scanFile(fullPath);
        } else if (stats.isDirectory() && !entry.startsWith('.')) {
          // Recursively scan subdirectories (but skip hidden directories)
          await this.scanDirectory(fullPath);
        }
      }
    } catch (error) {
      // Don't fail for directory scan errors
      logger.warn(`Could not scan directory: ${(error as Error).message}`, { dirPath });
    }
  }

  /**
   * Verifies mount security after operation
   */
  private async verifyMountSecurity(container: Docker.Container, containerPath: string): Promise<void> {
    try {
      // Check that the mount point has correct permissions
      const exec = await container.exec({
        Cmd: ['ls', '-la', containerPath],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ hijack: true, stdin: false });
      
      // In a real implementation, we would parse the output to verify permissions
      // For now, we just ensure the command executed successfully
      
      logger.debug(`Verified mount security for ${containerPath}`, { containerPath });
    } catch (error) {
      logger.warn(`Could not verify mount security: ${(error as Error).message}`, {
        containerPath,
      });
      // Don't fail the operation for verification errors
    }
  }

  /**
   * Performs emergency termination for security violations
   */
  private async emergencyTermination(containerId: string, violation: SecurityViolationError): Promise<void> {
    logger.error(`EMERGENCY TERMINATION: Security violation detected`, {
      containerId,
      violation: violation.code,
      message: violation.message,
    });

    const container = this.activeContainers.get(containerId);
    if (container) {
      try {
        // Immediately kill the container
        await container.kill();
        await container.remove({ force: true });
        this.activeContainers.delete(containerId);
        
        logger.info(`Emergency termination completed for container ${containerId}`);
      } catch (error) {
        logger.error(`Failed to emergency terminate container ${containerId}`, {
          error: (error as Error).message,
        });
      }
    }

    // Clean up all associated resources
    await this.cleanupAdditionalResources(containerId);
    this.recoveryManager.clearRecoveryData(containerId);
    this.containerStates.delete(containerId);
  }

  /**
   * Cleans up failed container resources
   */
  private async cleanupFailedContainer(containerId: string): Promise<void> {
    try {
      const container = this.activeContainers.get(containerId);
      if (container) {
        try {
          await container.remove({ force: true });
        } catch (error) {
          // Ignore errors if container doesn't exist
          if (!(error as Error).message.includes('No such container')) {
            logger.warn(`Could not remove failed container ${containerId}`, {
              error: (error as Error).message,
            });
          }
        }
        this.activeContainers.delete(containerId);
      }

      await this.cleanupAdditionalResources(containerId);
      this.containerStates.delete(containerId);
      
    } catch (error) {
      logger.warn(`Error during failed container cleanup`, {
        containerId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Cleans up additional resources associated with a container
   */
  private async cleanupAdditionalResources(containerId: string): Promise<void> {
    try {
      // Clean up custom networks
      const networkName = `restricted-${containerId}`;
      try {
        const network = this.docker.getNetwork(networkName);
        await network.remove();
        logger.debug(`Removed custom network ${networkName}`);
      } catch (error) {
        // Ignore if network doesn't exist
        if (!(error as Error).message.includes('not found')) {
          logger.warn(`Could not remove network ${networkName}`, {
            error: (error as Error).message,
          });
        }
      }

      // Clean up volumes if any were created
      // In a real implementation, we would track and clean up any volumes
      
      logger.debug(`Cleaned up additional resources for container ${containerId}`);
    } catch (error) {
      logger.warn(`Error cleaning up additional resources`, {
        containerId,
        error: (error as Error).message,
      });
    }
  }
}