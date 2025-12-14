/**
 * Workflow definition and validation
 */
import { WorkflowDefinition, WorkflowCondition, WorkflowContext } from './types';
export declare class WorkflowDefinitionManager {
    /**
     * Load workflow definition from file
     */
    static loadFromFile(filePath: string): WorkflowDefinition;
    /**
     * Save workflow definition to file
     */
    static saveToFile(workflow: WorkflowDefinition, filePath: string): void;
    /**
     * Validate workflow definition
     */
    static validateWorkflow(workflow: WorkflowDefinition): void;
    /**
     * Validate individual workflow step
     */
    private static validateStep;
    /**
     * Validate workflow condition
     */
    private static validateCondition;
    /**
     * Check if workflow is compatible with codebase type
     */
    static isCompatible(workflow: WorkflowDefinition, codebaseType: string): boolean;
    /**
     * Evaluate workflow condition
     */
    static evaluateCondition(condition: WorkflowCondition, context: WorkflowContext): boolean;
    /**
     * Check condition against array values
     */
    private static checkArrayCondition;
    /**
     * Get steps that should run in parallel
     */
    static getParallelSteps(workflow: WorkflowDefinition): Map<string, string[]>;
    /**
     * Create a basic workflow template
     */
    static createTemplate(name: string, codebaseType: string): WorkflowDefinition;
}
//# sourceMappingURL=WorkflowDefinition.d.ts.map