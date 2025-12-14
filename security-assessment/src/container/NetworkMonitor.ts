/**
 * NetworkMonitor - Monitors and logs network activity for security assessment containers
 */

import { EventEmitter } from 'events';
import Docker from 'dockerode';
import { NetworkActivity, NetworkMonitoringConfig, SuspiciousPattern } from '../types';

export class NetworkMonitor extends EventEmitter {
  private docker: Docker;
  private monitoringConfig: NetworkMonitoringConfig;
  private activeMonitors: Map<string, NodeJS.Timeout> = new Map();
  private networkLogs: Map<string, NetworkActivity[]> = new Map();

  constructor(config: NetworkMonitoringConfig) {
    super();
    this.docker = new Docker();
    this.monitoringConfig = config;
  }

  /**
   * Starts network monitoring for a container
   */
  async startMonitoring(containerId: string): Promise<void> {
    if (!this.monitoringConfig.enabled) {
      return;
    }

    try {
      // Initialize network logs for this container
      this.networkLogs.set(containerId, []);

      // Start network traffic monitoring
      await this.setupNetworkNamespace(containerId);
      
      // Start periodic network activity collection
      const monitor = setInterval(async () => {
        await this.collectNetworkActivity(containerId);
      }, 5000); // Check every 5 seconds

      this.activeMonitors.set(containerId, monitor);

      console.log(`Started network monitoring for container ${containerId}`);
    } catch (error) {
      console.error(`Failed to start network monitoring for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Stops network monitoring for a container
   */
  async stopMonitoring(containerId: string): Promise<void> {
    const monitor = this.activeMonitors.get(containerId);
    if (monitor) {
      clearInterval(monitor);
      this.activeMonitors.delete(containerId);
    }

    // Clean up network namespace monitoring
    await this.cleanupNetworkNamespace(containerId);

    console.log(`Stopped network monitoring for container ${containerId}`);
  }

  /**
   * Gets network activity logs for a container
   */
  getNetworkLogs(containerId: string): NetworkActivity[] {
    return this.networkLogs.get(containerId) || [];
  }

  /**
   * Clears network logs for a container
   */
  clearNetworkLogs(containerId: string): void {
    this.networkLogs.delete(containerId);
  }

  /**
   * Creates isolated network namespace with no internet access
   */
  async createIsolatedNamespace(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      
      // Create custom isolated network
      const networkName = `isolated-${containerId}`;
      
      const network = await this.docker.createNetwork({
        Name: networkName,
        Driver: 'bridge',
        Internal: true, // No external access
        IPAM: {
          Config: [{
            Subnet: '172.30.0.0/16',
            Gateway: '172.30.0.1'
          }]
        },
        Options: {
          'com.docker.network.bridge.enable_icc': 'false',
          'com.docker.network.bridge.enable_ip_masquerade': 'false',
          'com.docker.network.driver.mtu': '1500'
        }
      });

      // Disconnect from default networks
      const containerInfo = await container.inspect();
      const networks = containerInfo.NetworkSettings.Networks;
      
      for (const networkName of Object.keys(networks)) {
        if (networkName !== 'none') {
          try {
            const existingNetwork = this.docker.getNetwork(networkName);
            await existingNetwork.disconnect({ Container: containerId, Force: true });
          } catch (error) {
            console.warn(`Failed to disconnect from network ${networkName}:`, error);
          }
        }
      }

      // Connect to isolated network
      await network.connect({ Container: containerId });

      console.log(`Created isolated network namespace for container ${containerId}`);
    } catch (error) {
      console.error(`Failed to create isolated namespace for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Sets up controlled proxy access for package installation
   */
  async setupProxyAccess(containerId: string, proxyHost: string, proxyPort: number, allowedDomains: string[]): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);

      // Configure proxy environment variables
      const proxyUrl = `http://${proxyHost}:${proxyPort}`;
      const exec = await container.exec({
        Cmd: [
          'sh', '-c', 
          `export http_proxy=${proxyUrl} && ` +
          `export https_proxy=${proxyUrl} && ` +
          `export HTTP_PROXY=${proxyUrl} && ` +
          `export HTTPS_PROXY=${proxyUrl} && ` +
          `export no_proxy=localhost,127.0.0.1,::1`
        ],
        AttachStdout: true,
        AttachStderr: true,
        Env: [
          `http_proxy=${proxyUrl}`,
          `https_proxy=${proxyUrl}`,
          `HTTP_PROXY=${proxyUrl}`,
          `HTTPS_PROXY=${proxyUrl}`,
          `no_proxy=localhost,127.0.0.1,::1`
        ]
      });

      await exec.start({ hijack: true, stdin: false });

      // Log proxy configuration
      this.logNetworkActivity(containerId, {
        timestamp: new Date(),
        containerId,
        sourceIp: '172.30.0.2',
        destinationIp: proxyHost,
        destinationPort: proxyPort,
        protocol: 'tcp',
        action: 'allowed',
        bytes: 0,
        reason: `Proxy access configured for domains: ${allowedDomains.join(', ')}`
      });

      console.log(`Configured proxy access for container ${containerId} via ${proxyHost}:${proxyPort}`);
    } catch (error) {
      console.error(`Failed to setup proxy access for container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Logs network activity and checks for suspicious patterns
   */
  private logNetworkActivity(containerId: string, activity: NetworkActivity): void {
    const logs = this.networkLogs.get(containerId) || [];
    logs.push(activity);
    this.networkLogs.set(containerId, logs);

    // Check for suspicious patterns
    if (this.isSuspiciousActivity(activity)) {
      activity.action = 'suspicious';
      this.emit('suspiciousActivity', activity);
      console.warn(`Suspicious network activity detected for container ${containerId}:`, activity);
    }

    // Check alert thresholds
    this.checkAlertThresholds(containerId);

    if (this.monitoringConfig.logAllConnections) {
      console.log(`Network activity for container ${containerId}:`, activity);
    }
  }

  /**
   * Checks if network activity matches suspicious patterns
   */
  private isSuspiciousActivity(activity: NetworkActivity): boolean {
    for (const pattern of this.monitoringConfig.suspiciousPatterns) {
      if (this.matchesPattern(activity, pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if activity matches a specific suspicious pattern
   */
  private matchesPattern(activity: NetworkActivity, pattern: SuspiciousPattern): boolean {
    // Check destination ports
    if (pattern.pattern.destinationPorts && 
        !pattern.pattern.destinationPorts.includes(activity.destinationPort)) {
      return false;
    }

    // Check protocols
    if (pattern.pattern.protocols && 
        !pattern.pattern.protocols.includes(activity.protocol)) {
      return false;
    }

    // Check IP ranges (simplified check)
    if (pattern.pattern.ipRanges) {
      const matchesIpRange = pattern.pattern.ipRanges.some(range => 
        this.isIpInRange(activity.destinationIp, range)
      );
      if (!matchesIpRange) {
        return false;
      }
    }

    return true;
  }

  /**
   * Simple IP range check (supports CIDR notation)
   */
  private isIpInRange(ip: string, range: string): boolean {
    // Simplified implementation - in production, use a proper IP library
    if (range.includes('/')) {
      const [network, prefixLength] = range.split('/');
      // For now, just check if IP starts with network prefix
      return ip.startsWith(network.split('.').slice(0, parseInt(prefixLength) / 8).join('.'));
    }
    return ip === range;
  }

  /**
   * Checks alert thresholds and emits alerts if exceeded
   */
  private checkAlertThresholds(containerId: string): void {
    const logs = this.networkLogs.get(containerId) || [];
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    // Filter logs from the last minute
    const recentLogs = logs.filter(log => log.timestamp >= oneMinuteAgo);

    // Check connections per minute
    if (recentLogs.length > this.monitoringConfig.alertThresholds.connectionsPerMinute) {
      this.emit('alertThresholdExceeded', {
        containerId,
        type: 'connectionsPerMinute',
        value: recentLogs.length,
        threshold: this.monitoringConfig.alertThresholds.connectionsPerMinute
      });
    }

    // Check bytes per minute
    const totalBytes = recentLogs.reduce((sum, log) => sum + log.bytes, 0);
    if (totalBytes > this.monitoringConfig.alertThresholds.bytesPerMinute) {
      this.emit('alertThresholdExceeded', {
        containerId,
        type: 'bytesPerMinute',
        value: totalBytes,
        threshold: this.monitoringConfig.alertThresholds.bytesPerMinute
      });
    }

    // Check unique destinations
    const uniqueDestinations = new Set(recentLogs.map(log => log.destinationIp)).size;
    if (uniqueDestinations > this.monitoringConfig.alertThresholds.uniqueDestinations) {
      this.emit('alertThresholdExceeded', {
        containerId,
        type: 'uniqueDestinations',
        value: uniqueDestinations,
        threshold: this.monitoringConfig.alertThresholds.uniqueDestinations
      });
    }
  }

  /**
   * Sets up network namespace monitoring using netstat
   */
  private async setupNetworkNamespace(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      
      // Install network monitoring tools if not present
      const installExec = await container.exec({
        Cmd: ['sh', '-c', 'which netstat || (apt-get update && apt-get install -y net-tools) || (apk add --no-cache net-tools) || true'],
        AttachStdout: true,
        AttachStderr: true,
      });

      await installExec.start({ hijack: true, stdin: false });
      
      console.log(`Set up network namespace monitoring for container ${containerId}`);
    } catch (error) {
      console.warn(`Could not setup network namespace monitoring for container ${containerId}:`, error);
    }
  }

  /**
   * Collects current network activity from container
   */
  private async collectNetworkActivity(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      
      // Get network connections using netstat
      const exec = await container.exec({
        Cmd: ['netstat', '-tuln'],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ hijack: true, stdin: false });
      
      let output = '';
      stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });

      stream.on('end', () => {
        this.parseNetstatOutput(containerId, output);
      });

    } catch (error) {
      // Silently fail if netstat is not available
      console.debug(`Could not collect network activity for container ${containerId}:`, error);
    }
  }

  /**
   * Parses netstat output to extract network connections
   */
  private parseNetstatOutput(containerId: string, output: string): void {
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('ESTABLISHED') || line.includes('LISTEN')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const localAddress = parts[3];
          const foreignAddress = parts[4];
          
          if (localAddress && foreignAddress && foreignAddress !== '0.0.0.0:*') {
            const [destIp, destPort] = foreignAddress.split(':');
            
            if (destIp && destPort && destIp !== '127.0.0.1' && destIp !== '::1') {
              this.logNetworkActivity(containerId, {
                timestamp: new Date(),
                containerId,
                sourceIp: localAddress.split(':')[0],
                destinationIp: destIp,
                destinationPort: parseInt(destPort) || 0,
                protocol: parts[0].toLowerCase().includes('tcp') ? 'tcp' : 'udp',
                action: 'allowed',
                bytes: 0,
                reason: 'Active connection detected'
              });
            }
          }
        }
      }
    }
  }

  /**
   * Cleans up network namespace monitoring
   */
  private async cleanupNetworkNamespace(containerId: string): Promise<void> {
    try {
      // Remove custom network if it exists
      const networkName = `isolated-${containerId}`;
      
      try {
        const network = this.docker.getNetwork(networkName);
        await network.remove();
        console.log(`Removed isolated network ${networkName}`);
      } catch (error) {
        // Network might not exist, ignore error
        console.debug(`Could not remove network ${networkName}:`, error);
      }
      
    } catch (error) {
      console.warn(`Error during network namespace cleanup for container ${containerId}:`, error);
    }
  }

  /**
   * Creates default network monitoring configuration
   */
  static createDefaultConfig(): NetworkMonitoringConfig {
    return {
      enabled: true,
      logAllConnections: false,
      suspiciousPatterns: [
        {
          name: 'Cryptocurrency Mining',
          description: 'Common cryptocurrency mining pool ports',
          pattern: {
            destinationPorts: [3333, 4444, 8333, 9999, 14444],
          },
          severity: 'high'
        },
        {
          name: 'Suspicious Protocols',
          description: 'Protocols commonly used for malicious purposes',
          pattern: {
            protocols: ['icmp'],
            destinationPorts: [22, 23, 135, 139, 445, 1433, 3389]
          },
          severity: 'medium'
        },
        {
          name: 'External Communication',
          description: 'Communication to external IP ranges',
          pattern: {
            ipRanges: ['0.0.0.0/0']
          },
          severity: 'low'
        }
      ],
      alertThresholds: {
        connectionsPerMinute: 50,
        bytesPerMinute: 10485760, // 10MB
        uniqueDestinations: 10
      }
    };
  }
}