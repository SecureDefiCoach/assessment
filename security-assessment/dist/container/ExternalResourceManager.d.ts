/**
 * ExternalResourceManager - Manages secure access to external resources with validation
 */
import { ExternalResourceConfig, ProxyConfig } from '../types';
export declare class ExternalResourceManager {
    private docker;
    private config;
    private proxyConfig?;
    constructor(config: ExternalResourceConfig, proxyConfig?: ProxyConfig);
    /**
     * Downloads and validates external dependencies safely
     */
    downloadDependency(containerId: string, packageName: string, version: string, expectedChecksum?: string): Promise<boolean>;
    /**
     * Installs npm packages with security validation
     */
    installNpmPackages(containerId: string, packages: string[]): Promise<void>;
    /**
     * Downloads and validates container images
     */
    pullContainerImage(imageName: string, expectedDigest?: string): Promise<void>;
    /**
     * Validates file integrity using checksums
     */
    validateIntegrity(containerId: string, filePath: string, expectedChecksum: string): Promise<boolean>;
    /**
     * Checks if a package registry is allowed
     */
    private isRegistryAllowed;
    /**
     * Checks if an image registry is allowed
     */
    private isImageRegistryAllowed;
    /**
     * Extracts registry information from package name
     */
    private extractRegistry;
    /**
     * Configures proxy settings in container
     */
    private configureProxy;
    /**
     * Configures npm proxy settings
     */
    private configureNpmProxy;
    /**
     * Creates secure npm configuration
     */
    private createSecureNpmConfig;
    /**
     * Creates download directory in container
     */
    private createDownloadDirectory;
    /**
     * Builds download command based on package type
     */
    private buildDownloadCommand;
    /**
     * Cleans up downloaded files
     */
    private cleanupDownload;
    /**
     * Parses size string to bytes
     */
    private parseSize;
    /**
     * Creates default external resource configuration
     */
    static createDefaultConfig(): ExternalResourceConfig;
}
//# sourceMappingURL=ExternalResourceManager.d.ts.map