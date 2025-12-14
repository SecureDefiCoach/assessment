/**
 * Workflow execution engine
 */

import { 
  WorkflowDefinition, 
  WorkflowContext, 
  WorkflowResult, 
  WorkflowStep, 
  WorkflowError,
  ProgressCallback 
} from './types';
import { WorkflowDefinitionManager } from './WorkflowDefinition';
import { PredefinedWorkflows } from './PredefinedWorkflows';
import { AssessmentEnvironment, AnalysisResults } from '../types';
import { AnalysisOrchestrator } from '../analysis/AnalysisOrchestrator';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export class WorkflowExecutor {
  private analysisOrchestrator: AnalysisOrchestrator;

  constructor() {
    this.analysisOrchestrator = new AnalysisOrchestrator();
  }

  /**
   * Execute workflow in assessment environment
   */
  public async executeWorkflow(
    environment: AssessmentEnvironment,
    customWorkflowPath?: string,
    progressCallback?: ProgressCallback
  ): Promise<AnalysisResults> {
    
    const startTime = Date.now();
    let workflow: WorkflowDefinition;
    
    try {
      // Load workflow definition
      if (customWorkflowPath) {
        workflow = WorkflowDefinitionManager.loadFromFile(customWorkflowPath);
      } else {
        // Auto-select appropriate workflow
        workflow = this.autoSelectWorkflow(environment);
      }

      logger.info(`Executing workflow: ${workflow.name}`, { 
        environmentId: environment.containerId,
        workflowVersion: workflow.version 
      });

      // Create workflow context
      const context = await this.createWorkflowContext(environment);

      // Execute workflow steps
      const result = await this.executeWorkflowSteps(workflow, context, progressCallback);

      logger.info(`Workflow completed successfully`, {
        environmentId: environment.containerId,
        duration: Date.now() - startTime,
        executedSteps: result.executedSteps.length
      });

      return result.results;

    } catch (error) {
      logger.error('Workflow execution failed', {
        environmentId: environment.containerId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
      
      throw error;
    }
  }

  /**
   * Execute all workflow steps
   */
  private async executeWorkflowSteps(
    workflow: WorkflowDefinition,
    context: WorkflowContext,
    progressCallback?: ProgressCallback
  ): Promise<WorkflowResult> {
    
    const result: WorkflowResult = {
      success: true,
      results: {
        securityFindings: [],
        codeQualityIssues: [],
        testResults: [],
        performanceMetrics: [],
        recommendations: []
      },
      executedSteps: [],
      skippedSteps: [],
      errors: [],
      duration: 0
    };

    const startTime = Date.now();
    const totalSteps = workflow.steps.length;
    const parallelGroups = WorkflowDefinitionManager.getParallelSteps(workflow);

    try {
      // Track which steps are part of parallel groups
      const parallelStepNames = new Set<string>();
      parallelGroups.forEach(steps => {
        steps.forEach(stepName => parallelStepNames.add(stepName));
      });

      // Execute sequential steps and parallel groups
      let stepIndex = 0;
      
      for (const step of workflow.steps) {
        // Skip if this step is part of a parallel group (will be handled separately)
        if (parallelStepNames.has(step.name)) {
          continue;
        }

        const progress = Math.floor((stepIndex / totalSteps) * 100);
        progressCallback?.({
          stage: 'Analysis',
          progress,
          message: `Executing: ${step.description}`,
          timestamp: new Date()
        });

        await this.executeStep(step, context, result);
        stepIndex++;
      }

      // Execute parallel groups
      for (const [groupKey, stepNames] of parallelGroups) {
        const parallelSteps = workflow.steps.filter(step => stepNames.includes(step.name));
        
        progressCallback?.({
          stage: 'Analysis',
          progress: Math.floor((stepIndex / totalSteps) * 100),
          message: `Executing parallel group: ${stepNames.join(', ')}`,
          timestamp: new Date()
        });

        await this.executeParallelSteps(parallelSteps, context, result);
        stepIndex += parallelSteps.length;
      }

      // Execute cleanup steps if defined
      if (workflow.cleanup) {
        progressCallback?.({
          stage: 'Cleanup',
          progress: 95,
          message: 'Running cleanup steps',
          timestamp: new Date()
        });

        for (const cleanupStep of workflow.cleanup) {
          await this.executeStep(cleanupStep, context, result);
        }
      }

      result.duration = Date.now() - startTime;
      result.success = result.errors.length === 0;

      return result;

    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      result.errors.push({
        step: 'workflow-execution',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        recoverable: false
      });

      throw error;
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext,
    result: WorkflowResult
  ): Promise<void> {
    
    try {
      // Check step condition
      if (step.condition && !WorkflowDefinitionManager.evaluateCondition(step.condition, context)) {
        logger.info(`Skipping step due to condition: ${step.name}`);
        result.skippedSteps.push(step.name);
        return;
      }

      logger.info(`Executing step: ${step.name}`, { tool: step.tool });

      // Execute step with retries
      const maxRetries = step.retries || 0;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const stepResult = await this.executeStepTool(step, context);
          
          // Merge results
          this.mergeStepResults(stepResult, result.results);
          result.executedSteps.push(step.name);
          
          logger.info(`Step completed successfully: ${step.name}`);
          return;

        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          
          if (attempt < maxRetries) {
            logger.warn(`Step failed, retrying (${attempt + 1}/${maxRetries}): ${step.name}`, {
              error: lastError.message
            });
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          }
        }
      }

      // All retries failed
      throw lastError || new Error('Step execution failed');

    } catch (error) {
      const workflowError: WorkflowError = {
        step: step.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        recoverable: (step.retries || 0) > 0
      };

      result.errors.push(workflowError);
      
      logger.error(`Step execution failed: ${step.name}`, {
        error: workflowError.error,
        recoverable: workflowError.recoverable
      });

      // Continue execution for recoverable errors, throw for non-recoverable
      if (!workflowError.recoverable) {
        throw error;
      }
    }
  }

  /**
   * Execute multiple steps in parallel
   */
  private async executeParallelSteps(
    steps: WorkflowStep[],
    context: WorkflowContext,
    result: WorkflowResult
  ): Promise<void> {
    
    const promises = steps.map(step => this.executeStep(step, context, result));
    
    try {
      await Promise.all(promises);
    } catch (error) {
      // Some parallel steps failed, but continue with available results
      logger.warn('Some parallel steps failed', {
        totalSteps: steps.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Execute step tool
   */
  private async executeStepTool(step: WorkflowStep, context: WorkflowContext): Promise<any> {
    switch (step.tool) {
      case 'setup':
        return this.executeSetupTool(step.config, context);
      
      case 'npm-audit':
        return this.executeNpmAuditTool(step.config, context);
      
      case 'eslint':
        return this.executeESLintTool(step.config, context);
      
      case 'semgrep':
        return this.executeSemgrepTool(step.config, context);
      
      case 'slither':
        return this.executeSlitherTool(step.config, context);
      
      case 'mythx':
        return this.executeMythXTool(step.config, context);
      
      case 'solidity-compiler':
        return this.executeSolidityCompilerTool(step.config, context);
      
      case 'gas-analyzer':
        return this.executeGasAnalyzerTool(step.config, context);
      
      case 'test-runner':
        return this.executeTestRunnerTool(step.config, context);
      
      case 'hardhat-test':
        return this.executeHardhatTestTool(step.config, context);
      
      default:
        throw new Error(`Unknown tool: ${step.tool}`);
    }
  }

  /**
   * Execute setup tool
   */
  private async executeSetupTool(config: any, context: WorkflowContext): Promise<any> {
    logger.info('Executing setup tool', { config });

    // Create output directory
    if (config.createOutputDir && !fs.existsSync(context.outputPath)) {
      fs.mkdirSync(context.outputPath, { recursive: true });
    }

    // Install dependencies if requested
    if (config.installDependencies) {
      const packageJsonPath = path.join(context.workspacePath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        // This would typically run npm install in the container
        logger.info('Dependencies installation requested');
      }
    }

    return { success: true, message: 'Setup completed' };
  }

  /**
   * Execute npm audit tool
   */
  private async executeNpmAuditTool(config: any, context: WorkflowContext): Promise<any> {
    logger.info('Executing npm audit', { config });
    
    // This would run npm audit in the container and return security findings
    return {
      securityFindings: [
        {
          id: 'npm-audit-example',
          severity: 'medium' as const,
          title: 'Example npm audit finding',
          description: 'This is a placeholder for npm audit results',
          location: { file: 'package.json', line: 1 },
          tool: 'npm-audit',
          category: 'dependency-security',
          recommendation: 'Update vulnerable dependencies'
        }
      ]
    };
  }

  /**
   * Execute ESLint tool
   */
  private async executeESLintTool(config: any, context: WorkflowContext): Promise<any> {
    logger.info('Executing ESLint', { config });
    
    return {
      codeQualityIssues: [
        {
          id: 'eslint-example',
          severity: 'low' as const,
          title: 'Example ESLint finding',
          description: 'This is a placeholder for ESLint results',
          location: { file: 'src/index.js', line: 10 },
          tool: 'eslint',
          category: 'code-quality'
        }
      ]
    };
  }

  /**
   * Execute Semgrep tool
   */
  private async executeSemgrepTool(config: any, context: WorkflowContext): Promise<any> {
    logger.info('Executing Semgrep', { config });
    
    return {
      securityFindings: [
        {
          id: 'semgrep-example',
          severity: 'high' as const,
          title: 'Example Semgrep security finding',
          description: 'This is a placeholder for Semgrep results',
          location: { file: 'src/auth.js', line: 25 },
          tool: 'semgrep',
          category: 'security',
          recommendation: 'Review security implementation'
        }
      ]
    };
  }

  /**
   * Execute Slither tool
   */
  private async executeSlitherTool(config: any, context: WorkflowContext): Promise<any> {
    logger.info('Executing Slither', { config });
    
    return {
      securityFindings: [
        {
          id: 'slither-example',
          severity: 'critical' as const,
          title: 'Example Slither finding',
          description: 'This is a placeholder for Slither results',
          location: { file: 'contracts/Token.sol', line: 42 },
          tool: 'slither',
          category: 'smart-contract-security',
          recommendation: 'Fix smart contract vulnerability'
        }
      ]
    };
  }

  /**
   * Execute MythX tool
   */
  private async executeMythXTool(config: any, context: WorkflowContext): Promise<any> {
    logger.info('Executing MythX', { config });
    
    return {
      securityFindings: [
        {
          id: 'mythx-example',
          severity: 'high' as const,
          title: 'Example MythX finding',
          description: 'This is a placeholder for MythX results',
          location: { file: 'contracts/Exchange.sol', line: 78 },
          tool: 'mythx',
          category: 'smart-contract-security',
          recommendation: 'Review contract logic for vulnerabilities'
        }
      ]
    };
  }

  /**
   * Execute Solidity compiler tool
   */
  private async executeSolidityCompilerTool(config: any, context: WorkflowContext): Promise<any> {
    logger.info('Executing Solidity compiler', { config });
    
    return {
      success: true,
      compiledContracts: ['Token.sol', 'Exchange.sol'],
      warnings: []
    };
  }

  /**
   * Execute gas analyzer tool
   */
  private async executeGasAnalyzerTool(config: any, context: WorkflowContext): Promise<any> {
    logger.info('Executing gas analyzer', { config });
    
    return {
      performanceMetrics: [
        {
          metric: 'gas-usage',
          value: 150000,
          unit: 'gas',
          context: 'Token transfer function',
          recommendation: 'Consider gas optimization techniques'
        }
      ]
    };
  }

  /**
   * Execute test runner tool
   */
  private async executeTestRunnerTool(config: any, context: WorkflowContext): Promise<any> {
    logger.info('Executing test runner', { config });
    
    return {
      testResults: [
        {
          suite: 'Unit Tests',
          test: 'should transfer tokens correctly',
          status: 'passed' as const,
          duration: 150,
          framework: 'jest'
        }
      ]
    };
  }

  /**
   * Execute Hardhat test tool
   */
  private async executeHardhatTestTool(config: any, context: WorkflowContext): Promise<any> {
    logger.info('Executing Hardhat tests', { config });
    
    return {
      testResults: [
        {
          suite: 'Contract Tests',
          test: 'should deploy correctly',
          status: 'passed' as const,
          duration: 2500,
          framework: 'hardhat'
        }
      ]
    };
  }

  /**
   * Merge step results into overall results
   */
  private mergeStepResults(stepResult: any, overallResults: AnalysisResults): void {
    if (stepResult.securityFindings) {
      overallResults.securityFindings.push(...stepResult.securityFindings);
    }
    
    if (stepResult.codeQualityIssues) {
      overallResults.codeQualityIssues.push(...stepResult.codeQualityIssues);
    }
    
    if (stepResult.testResults) {
      overallResults.testResults.push(...stepResult.testResults);
    }
    
    if (stepResult.performanceMetrics) {
      overallResults.performanceMetrics.push(...stepResult.performanceMetrics);
    }
    
    if (stepResult.recommendations) {
      overallResults.recommendations.push(...stepResult.recommendations);
    }
  }

  /**
   * Auto-select appropriate workflow for environment
   */
  private autoSelectWorkflow(environment: AssessmentEnvironment): WorkflowDefinition {
    const codebaseType = environment.analysisConfig.codebaseType;
    
    // For now, use predefined workflow selection logic
    // In a real implementation, this could analyze the mounted codebase
    const detectedLanguages = this.detectLanguages(environment);
    const detectedFrameworks = this.detectFrameworks(environment);
    
    return PredefinedWorkflows.autoSelectWorkflow(
      codebaseType,
      detectedLanguages,
      detectedFrameworks
    );
  }

  /**
   * Create workflow context from environment
   */
  private async createWorkflowContext(environment: AssessmentEnvironment): Promise<WorkflowContext> {
    return {
      workspacePath: '/workspace', // Container workspace path
      outputPath: '/output',       // Container output path
      codebaseType: environment.analysisConfig.codebaseType,
      detectedLanguages: this.detectLanguages(environment),
      detectedFrameworks: this.detectFrameworks(environment),
      environment: process.env as Record<string, string>
    };
  }

  /**
   * Detect programming languages in codebase
   */
  private detectLanguages(environment: AssessmentEnvironment): string[] {
    // This would analyze the mounted codebase to detect languages
    // For now, return based on analysis configuration
    const languages: string[] = [];
    
    if (environment.analysisConfig.codebaseType === 'nodejs' || 
        environment.analysisConfig.codebaseType === 'mixed') {
      languages.push('javascript', 'typescript');
    }
    
    if (environment.analysisConfig.codebaseType === 'solidity' || 
        environment.analysisConfig.codebaseType === 'mixed') {
      languages.push('solidity');
    }
    
    return languages;
  }

  /**
   * Detect frameworks in codebase
   */
  private detectFrameworks(environment: AssessmentEnvironment): string[] {
    // This would analyze package.json and other config files
    // For now, return common frameworks based on type
    const frameworks: string[] = [];
    
    if (environment.analysisConfig.testFrameworks.includes('hardhat')) {
      frameworks.push('hardhat');
    }
    
    if (environment.analysisConfig.testFrameworks.includes('truffle')) {
      frameworks.push('truffle');
    }
    
    if (environment.analysisConfig.testFrameworks.includes('jest')) {
      frameworks.push('jest');
    }
    
    return frameworks;
  }

  /**
   * Get available workflows
   */
  public getAvailableWorkflows(): WorkflowDefinition[] {
    return PredefinedWorkflows.getAllWorkflows();
  }

  /**
   * Get workflow by name
   */
  public getWorkflow(name: string): WorkflowDefinition | undefined {
    return PredefinedWorkflows.getWorkflow(name);
  }
}