/**
 * Predefined workflows for common assessment scenarios
 */
import { WorkflowDefinition } from './types';
export declare class PredefinedWorkflows {
    /**
     * Get all predefined workflows
     */
    static getAllWorkflows(): WorkflowDefinition[];
    /**
     * Get workflow by name
     */
    static getWorkflow(name: string): WorkflowDefinition | undefined;
    /**
     * Get workflows compatible with codebase type
     */
    static getCompatibleWorkflows(codebaseType: string): WorkflowDefinition[];
    /**
     * Node.js focused workflow
     */
    static getNodeJSWorkflow(): WorkflowDefinition;
    /**
     * Solidity focused workflow
     */
    static getSolidityWorkflow(): WorkflowDefinition;
    /**
     * Mixed codebase workflow
     */
    static getMixedWorkflow(): WorkflowDefinition;
    /**
     * Quick scan workflow for fast assessment
     */
    static getQuickScanWorkflow(): WorkflowDefinition;
    /**
     * Deep analysis workflow for thorough assessment
     */
    static getDeepAnalysisWorkflow(): WorkflowDefinition;
    /**
     * Auto-select appropriate workflow based on codebase characteristics
     */
    static autoSelectWorkflow(codebaseType: string, detectedLanguages: string[], detectedFrameworks: string[], quickScan?: boolean): WorkflowDefinition;
}
//# sourceMappingURL=PredefinedWorkflows.d.ts.map