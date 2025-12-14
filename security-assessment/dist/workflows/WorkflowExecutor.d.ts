/**
 * Workflow execution engine
 */
import { WorkflowDefinition, ProgressCallback } from './types';
import { AssessmentEnvironment, AnalysisResults } from '../types';
export declare class WorkflowExecutor {
    private analysisOrchestrator;
    constructor();
    /**
     * Execute workflow in assessment environment
     */
    executeWorkflow(environment: AssessmentEnvironment, customWorkflowPath?: string, progressCallback?: ProgressCallback): Promise<AnalysisResults>;
    /**
     * Execute all workflow steps
     */
    private executeWorkflowSteps;
    /**
     * Execute a single workflow step
     */
    private executeStep;
    /**
     * Execute multiple steps in parallel
     */
    private executeParallelSteps;
    /**
     * Execute step tool
     */
    private executeStepTool;
    /**
     * Execute setup tool
     */
    private executeSetupTool;
    /**
     * Execute npm audit tool
     */
    private executeNpmAuditTool;
    /**
     * Execute ESLint tool
     */
    private executeESLintTool;
    /**
     * Execute Semgrep tool
     */
    private executeSemgrepTool;
    /**
     * Execute Slither tool
     */
    private executeSlitherTool;
    /**
     * Execute MythX tool
     */
    private executeMythXTool;
    /**
     * Execute Solidity compiler tool
     */
    private executeSolidityCompilerTool;
    /**
     * Execute gas analyzer tool
     */
    private executeGasAnalyzerTool;
    /**
     * Execute test runner tool
     */
    private executeTestRunnerTool;
    /**
     * Execute Hardhat test tool
     */
    private executeHardhatTestTool;
    /**
     * Merge step results into overall results
     */
    private mergeStepResults;
    /**
     * Auto-select appropriate workflow for environment
     */
    private autoSelectWorkflow;
    /**
     * Create workflow context from environment
     */
    private createWorkflowContext;
    /**
     * Detect programming languages in codebase
     */
    private detectLanguages;
    /**
     * Detect frameworks in codebase
     */
    private detectFrameworks;
    /**
     * Get available workflows
     */
    getAvailableWorkflows(): WorkflowDefinition[];
    /**
     * Get workflow by name
     */
    getWorkflow(name: string): WorkflowDefinition | undefined;
}
//# sourceMappingURL=WorkflowExecutor.d.ts.map