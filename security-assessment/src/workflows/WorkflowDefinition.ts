/**
 * Workflow definition and validation
 */

import { WorkflowDefinition, WorkflowStep, WorkflowCondition, WorkflowContext } from './types';
import * as fs from 'fs';
import * as path from 'path';

export class WorkflowDefinitionManager {
  
  /**
   * Load workflow definition from file
   */
  public static loadFromFile(filePath: string): WorkflowDefinition {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Workflow file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    
    try {
      const workflow = JSON.parse(content) as WorkflowDefinition;
      this.validateWorkflow(workflow);
      return workflow;
    } catch (error) {
      throw new Error(`Invalid workflow file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save workflow definition to file
   */
  public static saveToFile(workflow: WorkflowDefinition, filePath: string): void {
    this.validateWorkflow(workflow);
    
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2));
  }

  /**
   * Validate workflow definition
   */
  public static validateWorkflow(workflow: WorkflowDefinition): void {
    if (!workflow.name || typeof workflow.name !== 'string') {
      throw new Error('Workflow must have a valid name');
    }

    if (!workflow.version || typeof workflow.version !== 'string') {
      throw new Error('Workflow must have a valid version');
    }

    if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
      throw new Error('Workflow must have at least one step');
    }

    if (!Array.isArray(workflow.codebaseTypes)) {
      throw new Error('Workflow must specify supported codebase types');
    }

    // Validate each step
    workflow.steps.forEach((step, index) => {
      this.validateStep(step, index);
    });

    // Validate parallel steps references
    if (workflow.parallelSteps) {
      workflow.parallelSteps.forEach(parallelGroup => {
        parallelGroup.forEach(stepName => {
          if (!workflow.steps.find(step => step.name === stepName)) {
            throw new Error(`Parallel step reference not found: ${stepName}`);
          }
        });
      });
    }
  }

  /**
   * Validate individual workflow step
   */
  private static validateStep(step: WorkflowStep, index: number): void {
    if (!step.name || typeof step.name !== 'string') {
      throw new Error(`Step ${index} must have a valid name`);
    }

    if (!step.tool || typeof step.tool !== 'string') {
      throw new Error(`Step ${index} (${step.name}) must specify a tool`);
    }

    if (!step.config || typeof step.config !== 'object') {
      throw new Error(`Step ${index} (${step.name}) must have a config object`);
    }

    if (step.condition) {
      this.validateCondition(step.condition, step.name);
    }

    if (step.timeout && (typeof step.timeout !== 'number' || step.timeout <= 0)) {
      throw new Error(`Step ${step.name} timeout must be a positive number`);
    }

    if (step.retries && (typeof step.retries !== 'number' || step.retries < 0)) {
      throw new Error(`Step ${step.name} retries must be a non-negative number`);
    }
  }

  /**
   * Validate workflow condition
   */
  private static validateCondition(condition: WorkflowCondition, stepName: string): void {
    const validTypes = ['file-exists', 'language-detected', 'framework-detected', 'custom'];
    
    if (!validTypes.includes(condition.type)) {
      throw new Error(`Step ${stepName} has invalid condition type: ${condition.type}`);
    }

    if (!condition.value || typeof condition.value !== 'string') {
      throw new Error(`Step ${stepName} condition must have a valid value`);
    }

    if (condition.operator) {
      const validOperators = ['equals', 'contains', 'matches'];
      if (!validOperators.includes(condition.operator)) {
        throw new Error(`Step ${stepName} has invalid condition operator: ${condition.operator}`);
      }
    }
  }

  /**
   * Check if workflow is compatible with codebase type
   */
  public static isCompatible(workflow: WorkflowDefinition, codebaseType: string): boolean {
    return workflow.codebaseTypes.includes(codebaseType) || workflow.codebaseTypes.includes('*');
  }

  /**
   * Evaluate workflow condition
   */
  public static evaluateCondition(condition: WorkflowCondition, context: WorkflowContext): boolean {
    switch (condition.type) {
      case 'file-exists':
        return fs.existsSync(path.join(context.workspacePath, condition.value));
      
      case 'language-detected':
        return this.checkArrayCondition(context.detectedLanguages, condition);
      
      case 'framework-detected':
        return this.checkArrayCondition(context.detectedFrameworks, condition);
      
      case 'custom':
        // Custom conditions would need to be implemented based on specific needs
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Check condition against array values
   */
  private static checkArrayCondition(values: string[], condition: WorkflowCondition): boolean {
    const operator = condition.operator || 'equals';
    
    switch (operator) {
      case 'equals':
        return values.includes(condition.value);
      
      case 'contains':
        return values.some(value => value.includes(condition.value));
      
      case 'matches':
        const regex = new RegExp(condition.value);
        return values.some(value => regex.test(value));
      
      default:
        return false;
    }
  }

  /**
   * Get steps that should run in parallel
   */
  public static getParallelSteps(workflow: WorkflowDefinition): Map<string, string[]> {
    const parallelMap = new Map<string, string[]>();
    
    if (workflow.parallelSteps) {
      workflow.parallelSteps.forEach((group, index) => {
        const groupKey = `parallel-${index}`;
        parallelMap.set(groupKey, group);
      });
    }
    
    return parallelMap;
  }

  /**
   * Create a basic workflow template
   */
  public static createTemplate(name: string, codebaseType: string): WorkflowDefinition {
    return {
      name,
      description: `Auto-generated workflow for ${codebaseType} projects`,
      version: '1.0.0',
      codebaseTypes: [codebaseType],
      steps: [
        {
          name: 'setup',
          description: 'Initialize analysis environment',
          tool: 'setup',
          config: {
            installDependencies: true,
            createOutputDir: true
          }
        }
      ]
    };
  }
}