/**
 * SecurityPolicyEngine - Enforces security constraints and isolation policies
 */
import { SecurityConfiguration, NetworkConfig, NetworkMonitoringConfig } from '../types';
export declare class SecurityPolicyEngine {
    private docker;
    private networkMonitor;
    private externalResourceManager;
    constructor(networkMonitoringConfig?: NetworkMonitoringConfig);
    /**
     * Configures network namespace restrictions with comprehensive error handling
     */
    applyNetworkIsolation(containerId: string, config: NetworkConfig): Promise<void>;
    /**
     * Applies resource constraints with graceful degradation
     */
    setResourceLimits(containerId: string, limits: {
        cpu: string;
        memory: string;
        diskSpace: string;
    }): Promise<void>;
    /**
     * Sets filesystem access controls
     */
    configureFilesystemAccess(containerId: string, permissions: {
        readOnlyMounts: string[];
        writableMounts: string[];
    }): Promise<void>;
    /**
     * Validates security configuration
     */
    validateSecurityConfig(config: SecurityConfiguration): boolean;
    /**
     * Enables security monitoring for a container
     */
    enableSecurityMonitoring(containerId: string): Promise<void>;
    /**
     * Disables security monitoring for a container
     */
    disableSecurityMonitoring(containerId: string): Promise<void>;
    /**
     * Creates isolated network namespace with no internet access
     */
    createIsolatedNetworkNamespace(containerId: string): Promise<void>;
    /**
     * Sets up controlled proxy access for package installation
     */
    setupControlledProxyAccess(containerId: string, proxyHost: string, proxyPort: number, allowedDomains: string[]): Promise<void>;
    /**
     * Gets network activity logs for a container
     */
    getNetworkActivityLogs(containerId: string): import("../types").NetworkActivity[];
    /**
     * Installs external dependencies securely
     */
    installSecureDependencies(containerId: string, packages: string[]): Promise<void>;
    /**
     * Downloads external resources with validation
     */
    downloadExternalResource(containerId: string, resourceName: string, version: string, expectedChecksum?: string): Promise<boolean>;
    /**
     * Creates default security configuration
     */
    createDefaultSecurityConfig(): SecurityConfiguration;
    /**
     * Creates a restricted network for controlled access
     */
    private createRestrictedNetwork;
    /**
     * Sets mount permissions for a specific path
     */
    private setMountPermissions;
    /**
     * Applies restrictive permissions to root filesystem
     */
    private applyRootfsRestrictions;
    /**
     * Parses memory limit string to bytes
     */
    private parseMemoryLimit;
    /**
     * Parses CPU limit string to quota (microseconds per period)
     */
    private parseCpuLimit;
    /**
     * Sets up event listeners for network monitoring
     */
    private setupNetworkMonitoringEvents;
    /**
     * Validates network configuration
     */
    private validateNetworkConfig;
    /**
     * Checks if a hostname is valid
     */
    private isValidHostname;
    /**
     * Checks if a network is security-sensitive
     */
    private isSecuritySensitiveNetwork;
    /**
     * Validates resource limits
     */
    private validateResourceLimits;
    /**
     * Checks if requested resources are available on the system
     */
    private checkResourceAvailability;
    /**
     * Creates degraded resource limits for graceful degradation
     */
    private createDegradedResourceLimits;
    /**
     * Formats memory bytes back to string format
     */
    private formatMemoryLimit;
    /**
     * Triggers security alert for violations
     */
    private triggerSecurityAlert;
}
//# sourceMappingURL=SecurityPolicyEngine.d.ts.map