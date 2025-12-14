/**
 * NetworkMonitor - Monitors and logs network activity for security assessment containers
 */
import { EventEmitter } from 'events';
import { NetworkActivity, NetworkMonitoringConfig } from '../types';
export declare class NetworkMonitor extends EventEmitter {
    private docker;
    private monitoringConfig;
    private activeMonitors;
    private networkLogs;
    constructor(config: NetworkMonitoringConfig);
    /**
     * Starts network monitoring for a container
     */
    startMonitoring(containerId: string): Promise<void>;
    /**
     * Stops network monitoring for a container
     */
    stopMonitoring(containerId: string): Promise<void>;
    /**
     * Gets network activity logs for a container
     */
    getNetworkLogs(containerId: string): NetworkActivity[];
    /**
     * Clears network logs for a container
     */
    clearNetworkLogs(containerId: string): void;
    /**
     * Creates isolated network namespace with no internet access
     */
    createIsolatedNamespace(containerId: string): Promise<void>;
    /**
     * Sets up controlled proxy access for package installation
     */
    setupProxyAccess(containerId: string, proxyHost: string, proxyPort: number, allowedDomains: string[]): Promise<void>;
    /**
     * Logs network activity and checks for suspicious patterns
     */
    private logNetworkActivity;
    /**
     * Checks if network activity matches suspicious patterns
     */
    private isSuspiciousActivity;
    /**
     * Checks if activity matches a specific suspicious pattern
     */
    private matchesPattern;
    /**
     * Simple IP range check (supports CIDR notation)
     */
    private isIpInRange;
    /**
     * Checks alert thresholds and emits alerts if exceeded
     */
    private checkAlertThresholds;
    /**
     * Sets up network namespace monitoring using netstat
     */
    private setupNetworkNamespace;
    /**
     * Collects current network activity from container
     */
    private collectNetworkActivity;
    /**
     * Parses netstat output to extract network connections
     */
    private parseNetstatOutput;
    /**
     * Cleans up network namespace monitoring
     */
    private cleanupNetworkNamespace;
    /**
     * Creates default network monitoring configuration
     */
    static createDefaultConfig(): NetworkMonitoringConfig;
}
//# sourceMappingURL=NetworkMonitor.d.ts.map