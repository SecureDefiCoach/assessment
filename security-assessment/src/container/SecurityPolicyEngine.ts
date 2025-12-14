/**
 * SecurityPolicyEngine - Enforces security constraints and isolation policies
 */

import Docker from 'dockerode';
import { SecurityConfiguration, NetworkConfig, NetworkMonitoringConfig } from '../types';
import { NetworkMonitor } from './NetworkMonitor';
import { ExternalResourceManager } from './ExternalResourceManager';
import { 
  SecurityViolationError,
  NetworkSecurityViolationError,
  FilesystemSecurityViolationError,
  ResourceAllocationError,
  ErrorHandler,
  logger
} from '../utils';
import { withRetry, DEFAULT_RETRY_OPTIONS } from '../utils/retry';

export class SecurityPolicyEngine {
  private docker: Docker;
  private networkMonitor: NetworkMonitor;
  private externalResourceManager: ExternalResourceManager;

  constructor(networkMonitoringConfig?: NetworkMonitoringConfig) {
    this.docker = new Docker();
    this.networkMonitor = new NetworkMonitor(
      networkMonitoringConfig || NetworkMonitor.createDefaultConfig()
    );
    this.externalResourceManager = new ExternalResourceManager(
      ExternalResourceManager.createDefaultConfig()
    );

    // Set up event listeners for network monitoring
    this.setupNetworkMonitoringEvents();
  }

  /**
   * Configures network namespace restrictions with comprehensive error handling
   */
  async applyNetworkIsolation(containerId: string, config: NetworkConfig): Promise<void> {
    try {
      // Validate network configuration
      this.validateNetworkConfig(config);

      const result = await withRetry(
        async () => {
          const container = this.docker.getContainer(containerId);
          
          // Verify container exists and is accessible
          const containerInfo = await container.inspect();
          
          if (config.isolated) {
            // Disconnect from all networks with security validation
            const networks = containerInfo.NetworkSettings.Networks;
            
            for (const networkName of Object.keys(networks)) {
              try {
                // Check if this is a security-sensitive network
                if (this.isSecuritySensitiveNetwork(networkName)) {
                  throw new NetworkSecurityViolationError(
                    `Attempt to disconnect from security-sensitive network: ${networkName}`,
                    { containerId, networkName }
                  );
                }

                const network = this.docker.getNetwork(networkName);
                await network.disconnect({ Container: containerId, Force: true });
                
                logger.debug(`Disconnected container ${containerId} from network ${networkName}`);
              } catch (error) {
                if (error instanceof NetworkSecurityViolationError) {
                  throw error;
                }
                
                // Log warning for non-critical network disconnection failures
                logger.warn(`Failed to disconnect from network ${networkName}`, {
                  containerId,
                  networkName,
                  error: (error as Error).message,
                });
              }
            }
            
            // Create isolated network if needed
            if (config.allowedHosts.length > 0) {
              await this.createRestrictedNetwork(containerId, config);
            }
          } else {
            // Ensure container is connected to default bridge network
            const defaultNetwork = this.docker.getNetwork('bridge');
            await defaultNetwork.connect({ Container: containerId });
          }
        },
        DEFAULT_RETRY_OPTIONS.networkOperation,
        `applyNetworkIsolation-${containerId}`
      );

      if (!result.success) {
        throw new NetworkSecurityViolationError(
          `Failed to apply network isolation after ${result.attempts} attempts: ${result.error?.message}`,
          { containerId, attempts: result.attempts }
        );
      }
      
      logger.info(`Applied network isolation for container ${containerId}`, {
        isolated: config.isolated,
        allowedHosts: config.allowedHosts.length,
        attempts: result.attempts,
      });

    } catch (error) {
      const assessmentError = ErrorHandler.createFromGenericError(error as Error, { 
        containerId,
        networkConfig: config 
      });

      // Security violations should trigger immediate response
      if (ErrorHandler.isSecurityViolation(assessmentError)) {
        logger.error(`Network security violation detected`, {
          containerId,
          error: assessmentError.message,
          code: assessmentError.code,
        });
        
        // Trigger security monitoring alert
        await this.triggerSecurityAlert(containerId, assessmentError);
      }

      logger.error(`Failed to apply network isolation for container ${containerId}`, {
        error: assessmentError.message,
        code: assessmentError.code,
      });
      
      throw assessmentError;
    }
  }

  /**
   * Applies resource constraints with graceful degradation
   */
  async setResourceLimits(
    containerId: string,
    limits: {
      cpu: string;
      memory: string;
      diskSpace: string;
    }
  ): Promise<void> {
    try {
      // Validate resource limits
      this.validateResourceLimits(limits);

      const result = await withRetry(
        async () => {
          const container = this.docker.getContainer(containerId);
          
          // Parse resource limits with validation
          const memoryBytes = this.parseMemoryLimit(limits.memory);
          const cpuQuota = this.parseCpuLimit(limits.cpu);
          
          // Check if requested resources are available
          await this.checkResourceAvailability(memoryBytes, cpuQuota);
          
          // Update container resource limits
          await container.update({
            Memory: memoryBytes,
            CpuQuota: cpuQuota,
            CpuPeriod: 100000, // Standard CPU period (100ms)
            
            // Disk space limits (using device mapper if available)
            StorageOpt: {
              size: limits.diskSpace
            }
          });

          return { memoryBytes, cpuQuota };
        },
        DEFAULT_RETRY_OPTIONS.resourceAllocation,
        `setResourceLimits-${containerId}`
      );

      if (!result.success) {
        // Attempt graceful degradation
        const degradedLimits = this.createDegradedResourceLimits(limits);
        
        logger.warn(`Resource allocation failed, attempting degraded limits`, {
          containerId,
          originalLimits: limits,
          degradedLimits,
        });

        // Try with reduced resources
        const degradedResult = await withRetry(
          async () => {
            const container = this.docker.getContainer(containerId);
            const memoryBytes = this.parseMemoryLimit(degradedLimits.memory);
            const cpuQuota = this.parseCpuLimit(degradedLimits.cpu);
            
            await container.update({
              Memory: memoryBytes,
              CpuQuota: cpuQuota,
              CpuPeriod: 100000,
              StorageOpt: {
                size: degradedLimits.diskSpace
              }
            });

            return { memoryBytes, cpuQuota };
          },
          { ...DEFAULT_RETRY_OPTIONS.resourceAllocation, maxAttempts: 2 },
          `setResourceLimits-degraded-${containerId}`
        );

        if (!degradedResult.success) {
          throw new ResourceAllocationError(
            `Failed to set resource limits even with degraded values after ${result.attempts + degradedResult.attempts} total attempts`,
            { containerId, originalLimits: limits, degradedLimits }
          );
        }

        logger.info(`Applied degraded resource limits for container ${containerId}`, {
          memory: `${degradedResult.result?.memoryBytes} bytes`,
          cpu: `${degradedResult.result?.cpuQuota} quota`,
          disk: degradedLimits.diskSpace,
          attempts: degradedResult.attempts,
        });
      } else {
        logger.info(`Applied resource limits for container ${containerId}`, {
          memory: `${result.result?.memoryBytes} bytes`,
          cpu: `${result.result?.cpuQuota} quota`,
          disk: limits.diskSpace,
          attempts: result.attempts,
        });
      }

    } catch (error) {
      const assessmentError = ErrorHandler.createFromGenericError(error as Error, { 
        containerId,
        resourceLimits: limits 
      });

      logger.error(`Failed to set resource limits for container ${containerId}`, {
        error: assessmentError.message,
        code: assessmentError.code,
        limits,
      });
      
      throw assessmentError;
    }
  }

  /**
   * Sets filesystem access controls
   */
  async configureFilesystemAccess(
    containerId: string,
    permissions: {
      readOnlyMounts: string[];
      writableMounts: string[];
    }
  ): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      
      // Validate that the container exists and is accessible
      await container.inspect();
      
      // Configure read-only mounts
      for (const mountPath of permissions.readOnlyMounts) {
        await this.setMountPermissions(containerId, mountPath, true);
      }
      
      // Configure writable mounts
      for (const mountPath of permissions.writableMounts) {
        await this.setMountPermissions(containerId, mountPath, false);
      }
      
      // Set restrictive permissions on root filesystem
      await this.applyRootfsRestrictions(containerId);
      
      console.log(`Configured filesystem access for container ${containerId}:`, {
        readOnly: permissions.readOnlyMounts,
        writable: permissions.writableMounts
      });
    } catch (error) {
      console.error(`Failed to configure filesystem access for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Validates security configuration
   */
  validateSecurityConfig(config: SecurityConfiguration): boolean {
    // Basic validation - will be expanded in subsequent tasks
    if (!config.resourceLimits) {
      return false;
    }

    if (!config.resourceLimits.cpu || !config.resourceLimits.memory || !config.resourceLimits.diskSpace) {
      return false;
    }

    return true;
  }

  /**
   * Enables security monitoring for a container
   */
  async enableSecurityMonitoring(containerId: string): Promise<void> {
    try {
      await this.networkMonitor.startMonitoring(containerId);
      console.log(`Enabled security monitoring for container ${containerId}`);
    } catch (error) {
      console.error(`Failed to enable security monitoring for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Disables security monitoring for a container
   */
  async disableSecurityMonitoring(containerId: string): Promise<void> {
    try {
      await this.networkMonitor.stopMonitoring(containerId);
      console.log(`Disabled security monitoring for container ${containerId}`);
    } catch (error) {
      console.error(`Failed to disable security monitoring for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Creates isolated network namespace with no internet access
   */
  async createIsolatedNetworkNamespace(containerId: string): Promise<void> {
    try {
      await this.networkMonitor.createIsolatedNamespace(containerId);
      console.log(`Created isolated network namespace for container ${containerId}`);
    } catch (error) {
      console.error(`Failed to create isolated network namespace for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Sets up controlled proxy access for package installation
   */
  async setupControlledProxyAccess(
    containerId: string,
    proxyHost: string,
    proxyPort: number,
    allowedDomains: string[]
  ): Promise<void> {
    try {
      await this.networkMonitor.setupProxyAccess(containerId, proxyHost, proxyPort, allowedDomains);
      console.log(`Set up controlled proxy access for container ${containerId}`);
    } catch (error) {
      console.error(`Failed to setup controlled proxy access for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Gets network activity logs for a container
   */
  getNetworkActivityLogs(containerId: string) {
    return this.networkMonitor.getNetworkLogs(containerId);
  }

  /**
   * Installs external dependencies securely
   */
  async installSecureDependencies(containerId: string, packages: string[]): Promise<void> {
    try {
      await this.externalResourceManager.installNpmPackages(containerId, packages);
      console.log(`Installed secure dependencies for container ${containerId}`);
    } catch (error) {
      console.error(`Failed to install secure dependencies for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Downloads external resources with validation
   */
  async downloadExternalResource(
    containerId: string,
    resourceName: string,
    version: string,
    expectedChecksum?: string
  ): Promise<boolean> {
    try {
      return await this.externalResourceManager.downloadDependency(
        containerId,
        resourceName,
        version,
        expectedChecksum
      );
    } catch (error) {
      console.error(`Failed to download external resource ${resourceName}:`, error);
      throw error;
    }
  }

  /**
   * Creates default security configuration
   */
  createDefaultSecurityConfig(): SecurityConfiguration {
    return {
      networkIsolation: true,
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
      securityPolicies: ['no-privileged', 'no-host-network', 'no-host-pid'],
    };
  }

  /**
   * Creates a restricted network for controlled access
   */
  private async createRestrictedNetwork(containerId: string, config: NetworkConfig): Promise<void> {
    const networkName = `restricted-${containerId}`;
    
    try {
      // Create custom network with restricted access
      const network = await this.docker.createNetwork({
        Name: networkName,
        Driver: 'bridge',
        Internal: true, // No external access by default
        IPAM: {
          Config: [{
            Subnet: '172.20.0.0/16',
            Gateway: '172.20.0.1'
          }]
        },
        Options: {
          'com.docker.network.bridge.enable_icc': 'false', // Disable inter-container communication
          'com.docker.network.bridge.enable_ip_masquerade': 'false'
        }
      });
      
      // Connect container to the restricted network
      await network.connect({ Container: containerId });
      
      console.log(`Created restricted network ${networkName} for container ${containerId}`);
    } catch (error) {
      console.error(`Failed to create restricted network for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Sets mount permissions for a specific path
   */
  private async setMountPermissions(containerId: string, mountPath: string, readOnly: boolean): Promise<void> {
    const container = this.docker.getContainer(containerId);
    
    try {
      // Execute chmod command inside container to set permissions
      const permissions = readOnly ? '444' : '755';
      const exec = await container.exec({
        Cmd: ['chmod', '-R', permissions, mountPath],
        AttachStdout: true,
        AttachStderr: true,
      });
      
      await exec.start({ hijack: true, stdin: false });
      
      console.log(`Set ${readOnly ? 'read-only' : 'writable'} permissions for ${mountPath} in container ${containerId}`);
    } catch (error) {
      // Don't fail if the path doesn't exist yet
      console.warn(`Could not set permissions for ${mountPath} in container ${containerId}:`, error);
    }
  }

  /**
   * Applies restrictive permissions to root filesystem
   */
  private async applyRootfsRestrictions(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    
    try {
      // Remove write permissions from sensitive directories
      const restrictedPaths = ['/etc', '/usr', '/bin', '/sbin', '/lib'];
      
      for (const path of restrictedPaths) {
        const exec = await container.exec({
          Cmd: ['chmod', '-R', 'a-w', path],
          AttachStdout: true,
          AttachStderr: true,
        });
        
        await exec.start({ hijack: true, stdin: false });
      }
      
      console.log(`Applied root filesystem restrictions for container ${containerId}`);
    } catch (error) {
      console.warn(`Could not apply all root filesystem restrictions for container ${containerId}:`, error);
    }
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
   * Sets up event listeners for network monitoring
   */
  private setupNetworkMonitoringEvents(): void {
    this.networkMonitor.on('suspiciousActivity', (activity) => {
      logger.warn('Suspicious network activity detected', { activity });
      // In a real implementation, this could trigger alerts, logging, or container termination
    });

    this.networkMonitor.on('alertThresholdExceeded', (alert) => {
      logger.warn('Network alert threshold exceeded', { alert });
      // In a real implementation, this could trigger automated responses
    });
  }

  /**
   * Validates network configuration
   */
  private validateNetworkConfig(config: NetworkConfig): void {
    if (config.allowedHosts && config.allowedHosts.length > 100) {
      throw new NetworkSecurityViolationError(
        'Too many allowed hosts specified (maximum 100)',
        { allowedHostsCount: config.allowedHosts.length }
      );
    }

    // Validate allowed hosts format
    if (config.allowedHosts) {
      for (const host of config.allowedHosts) {
        if (!this.isValidHostname(host)) {
          throw new NetworkSecurityViolationError(
            `Invalid hostname format: ${host}`,
            { invalidHost: host }
          );
        }
      }
    }
  }

  /**
   * Checks if a hostname is valid
   */
  private isValidHostname(hostname: string): boolean {
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return hostnameRegex.test(hostname) && hostname.length <= 253;
  }

  /**
   * Checks if a network is security-sensitive
   */
  private isSecuritySensitiveNetwork(networkName: string): boolean {
    const sensitiveNetworks = ['host', 'none', 'container'];
    return sensitiveNetworks.includes(networkName);
  }

  /**
   * Validates resource limits
   */
  private validateResourceLimits(limits: { cpu: string; memory: string; diskSpace: string }): void {
    // Validate memory limit
    const memoryBytes = this.parseMemoryLimit(limits.memory);
    if (memoryBytes < 64 * 1024 * 1024) { // Minimum 64MB
      throw new ResourceAllocationError(
        'Memory limit too low (minimum 64MB)',
        { memoryLimit: limits.memory }
      );
    }
    if (memoryBytes > 8 * 1024 * 1024 * 1024) { // Maximum 8GB
      throw new ResourceAllocationError(
        'Memory limit too high (maximum 8GB)',
        { memoryLimit: limits.memory }
      );
    }

    // Validate CPU limit
    const cpuFloat = parseFloat(limits.cpu);
    if (cpuFloat < 0.1) {
      throw new ResourceAllocationError(
        'CPU limit too low (minimum 0.1)',
        { cpuLimit: limits.cpu }
      );
    }
    if (cpuFloat > 4.0) {
      throw new ResourceAllocationError(
        'CPU limit too high (maximum 4.0)',
        { cpuLimit: limits.cpu }
      );
    }

    // Validate disk space
    if (!limits.diskSpace.match(/^\d+[kmg]$/i)) {
      throw new ResourceAllocationError(
        'Invalid disk space format (use format like 1g, 512m, etc.)',
        { diskSpace: limits.diskSpace }
      );
    }
  }

  /**
   * Checks if requested resources are available on the system
   */
  private async checkResourceAvailability(memoryBytes: number, cpuQuota: number): Promise<void> {
    try {
      // Get system information
      const systemInfo = await this.docker.info();
      
      // Check memory availability
      if (systemInfo.MemTotal && memoryBytes > systemInfo.MemTotal * 0.8) {
        throw new ResourceAllocationError(
          'Requested memory exceeds 80% of system memory',
          { 
            requestedMemory: memoryBytes,
            systemMemory: systemInfo.MemTotal,
            maxAllowed: Math.floor(systemInfo.MemTotal * 0.8)
          }
        );
      }

      // Check CPU availability
      const requestedCores = cpuQuota / 100000;
      if (systemInfo.NCPU && requestedCores > systemInfo.NCPU * 0.8) {
        throw new ResourceAllocationError(
          'Requested CPU exceeds 80% of system CPU',
          { 
            requestedCores,
            systemCores: systemInfo.NCPU,
            maxAllowed: systemInfo.NCPU * 0.8
          }
        );
      }

    } catch (error) {
      if (error instanceof ResourceAllocationError) {
        throw error;
      }
      
      // If we can't check system resources, log a warning but don't fail
      logger.warn('Could not check system resource availability', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Creates degraded resource limits for graceful degradation
   */
  private createDegradedResourceLimits(originalLimits: { cpu: string; memory: string; diskSpace: string }): { cpu: string; memory: string; diskSpace: string } {
    // Reduce memory by 50%
    const originalMemoryBytes = this.parseMemoryLimit(originalLimits.memory);
    const degradedMemoryBytes = Math.max(64 * 1024 * 1024, Math.floor(originalMemoryBytes * 0.5));
    
    // Reduce CPU by 50%
    const originalCpu = parseFloat(originalLimits.cpu);
    const degradedCpu = Math.max(0.1, originalCpu * 0.5);
    
    // Reduce disk space by 50%
    const diskMatch = originalLimits.diskSpace.match(/^(\d+)([kmg])$/i);
    if (diskMatch) {
      const value = parseInt(diskMatch[1], 10);
      const unit = diskMatch[2].toLowerCase();
      const degradedValue = Math.max(100, Math.floor(value * 0.5));
      
      return {
        cpu: degradedCpu.toString(),
        memory: this.formatMemoryLimit(degradedMemoryBytes),
        diskSpace: `${degradedValue}${unit}`,
      };
    }

    return {
      cpu: degradedCpu.toString(),
      memory: this.formatMemoryLimit(degradedMemoryBytes),
      diskSpace: '500m', // Default fallback
    };
  }

  /**
   * Formats memory bytes back to string format
   */
  private formatMemoryLimit(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${Math.floor(bytes / (1024 * 1024 * 1024))}g`;
    } else if (bytes >= 1024 * 1024) {
      return `${Math.floor(bytes / (1024 * 1024))}m`;
    } else if (bytes >= 1024) {
      return `${Math.floor(bytes / 1024)}k`;
    } else {
      return `${bytes}`;
    }
  }

  /**
   * Triggers security alert for violations
   */
  private async triggerSecurityAlert(containerId: string, violation: SecurityViolationError): Promise<void> {
    logger.error('SECURITY ALERT: Violation detected', {
      containerId,
      violationType: violation.code,
      message: violation.message,
      severity: violation.severity,
      timestamp: violation.timestamp,
      context: violation.context,
    });

    // In a real implementation, this would:
    // 1. Send alerts to security monitoring systems
    // 2. Trigger automated incident response
    // 3. Notify security teams
    // 4. Update security dashboards
    
    // For now, we'll just ensure it's logged at the highest level
    console.error(`SECURITY VIOLATION: ${violation.message}`, {
      containerId,
      code: violation.code,
    });
  }
}