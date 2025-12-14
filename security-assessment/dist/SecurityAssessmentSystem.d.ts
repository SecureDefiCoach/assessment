/**
 * SecurityAssessmentSystem - Main integration layer that wires together all components
 * This class provides the primary interface for conducting secure code assessments
 */
import { AssessmentEnvironment, SecurityConfiguration, AnalysisConfiguration, AnalysisResults, AssessmentWorkflow, AssessmentReport } from './types';
export declare class SecurityAssessmentSystem {
    private containerManager;
    private securityPolicyEngine;
    private analysisOrchestrator;
    private blockchainAnalysisEngine;
    private workflowExecutor;
    constructor();
    /**
     * Creates a complete assessment environment with integrated security policies
     */
    createSecureAssessmentEnvironment(securityConfig: SecurityConfiguration, analysisConfig: AnalysisConfiguration): Promise<AssessmentEnvironment>;
    /**
     * Conducts a complete security assessment of a codebase
     */
    conductAssessment(containerId: string, codebasePath: string, workflow?: AssessmentWorkflow): Promise<AssessmentReport>;
    /**
     * Executes a blockchain-specific assessment
     */
    conductBlockchainAssessment(containerId: string, contractsPath: string): Promise<AnalysisResults>;
    /**
     * Validates that security boundaries are properly enforced
     */
    validateSecurityBoundaries(containerId: string, securityConfig: SecurityConfiguration): Promise<boolean>;
    /**
     * Cleans up assessment environment completely
     */
    cleanupAssessment(containerId: string): Promise<void>;
    /**
     * Lists all active assessment environments
     */
    listActiveAssessments(): Promise<AssessmentEnvironment[]>;
    /**
     * Gets the status of a specific assessment environment
     */
    getAssessmentStatus(containerId: string): Promise<string>;
    /**
     * Stops a running assessment
     */
    stopAssessment(containerId: string): Promise<void>;
    /**
     * Creates default security configuration
     */
    createDefaultSecurityConfig(): SecurityConfiguration;
    /**
     * Creates default analysis configuration for a given codebase type
     */
    createDefaultAnalysisConfig(codebaseType: 'nodejs' | 'solidity' | 'mixed'): AnalysisConfiguration;
    private applySecurityPolicies;
    private executeDefaultAssessment;
    private generateAssessmentReport;
    private convertGasReportsToMetrics;
    private generateBlockchainRecommendations;
    private testNetworkIsolation;
    private testFilesystemRestrictions;
    private testResourceLimits;
}
//# sourceMappingURL=SecurityAssessmentSystem.d.ts.map