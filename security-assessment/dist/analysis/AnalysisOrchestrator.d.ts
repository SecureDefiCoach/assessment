/**
 * AnalysisOrchestrator - Coordinates execution of various analysis tools
 */
import { AnalysisResults, AssessmentWorkflow, SecurityFinding, TestResult } from '../types';
export declare class AnalysisOrchestrator {
    private docker;
    constructor();
    /**
     * Executes static code analysis with support for ESLint, SonarJS, and other tools
     */
    runStaticAnalysis(containerId: string, language: string, rules?: string[]): Promise<SecurityFinding[]>;
    /**
     * Runs security-focused scans integrating npm audit and security scanners
     */
    performSecurityScan(containerId: string, scanType: string): Promise<SecurityFinding[]>;
    /**
     * Safely runs test suites
     */
    executeTests(containerId: string, testSuite: string): Promise<TestResult[]>;
    /**
     * Compiles analysis results into structured output
     */
    generateReport(containerId: string, findings: any[]): Promise<AnalysisResults>;
    /**
     * Executes a predefined workflow
     */
    executeWorkflow(containerId: string, workflow: AssessmentWorkflow): Promise<AnalysisResults>;
    /**
     * Validates that required tools are available
     */
    validateToolsAvailable(containerId: string, requiredTools: string[]): Promise<boolean>;
    private ensureContainerRunning;
    private executeCommand;
    private runJavaScriptAnalysis;
    private runSolidityAnalysis;
    private runGenericAnalysis;
    private runNpmAudit;
    private runSecretScan;
    private runVulnerabilityScan;
    private detectTestFramework;
    private runJestTests;
    private runMochaTests;
    private runHardhatTests;
    private runTruffleTests;
    private runGenericTests;
    private executeWorkflowStep;
    private parseAnalysisOutput;
    private parseTestOutput;
    private checkToolAvailable;
    private generateRecommendations;
    private mapESLintSeverity;
    private mapSlitherSeverity;
    private mapNpmSeverity;
}
//# sourceMappingURL=AnalysisOrchestrator.d.ts.map