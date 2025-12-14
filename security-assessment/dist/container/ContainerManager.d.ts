/**
 * ContainerManager - Orchestrates container lifecycle and security configuration
 */
import { AssessmentEnvironment, SecurityConfiguration, AnalysisConfiguration } from '../types';
export declare class ContainerManager {
    private docker;
    private activeContainers;
    private recoveryManager;
    private circuitBreaker;
    private containerStates;
    constructor();
    /**
     * Provisions new isolated container for code assessment with comprehensive error handling
     */
    createAssessmentEnvironment(securityConfig: SecurityConfiguration, analysisConfig: AnalysisConfiguration): Promise<AssessmentEnvironment>;
    /**
     * Safely mounts untrusted code into container with security validation
     */
    mountCodebase(containerId: string, sourcePath: string, containerPath: string): Promise<void>;
    /**
     * Safely retrieves analysis results from container
     */
    extractResults(containerId: string, outputPath: string): Promise<void>;
    /**
     * Complete cleanup and resource deallocation with comprehensive error handling
     */
    destroyEnvironment(containerId: string): Promise<void>;
    /**
     * Gets the status of an assessment environment
     */
    getEnvironmentStatus(containerId: string): Promise<string>;
    /**
     * Lists all active assessment environments
     */
    listEnvironments(): Promise<AssessmentEnvironment[]>;
    /**
     * Stops a running assessment environment
     */
    stopEnvironment(containerId: string): Promise<void>;
    /**
     * Cleans up all assessment environments
     */
    cleanupAllEnvironments(): Promise<void>;
    private generateContainerId;
    /**
     * Builds Docker container configuration based on security and analysis settings
     */
    private buildContainerConfig;
    /**
     * Parses memory limit string to bytes
     */
    private parseMemoryLimit;
    /**
     * Parses CPU limit string to quota (microseconds per period)
     */
    private parseCpuLimit;
    /**
     * Validates environment configuration before creation
     */
    private validateEnvironmentConfiguration;
    /**
     * Validates mount operation security
     */
    private validateMountSecurity;
    /**
     * Scans source code for obvious security issues before mounting
     */
    private scanSourceForSecurityIssues;
    /**
     * Scans a single file for security issues
     */
    private scanFile;
    /**
     * Scans a directory for security issues
     */
    private scanDirectory;
    /**
     * Verifies mount security after operation
     */
    private verifyMountSecurity;
    /**
     * Performs emergency termination for security violations
     */
    private emergencyTermination;
    /**
     * Cleans up failed container resources
     */
    private cleanupFailedContainer;
    /**
     * Cleans up additional resources associated with a container
     */
    private cleanupAdditionalResources;
}
//# sourceMappingURL=ContainerManager.d.ts.map