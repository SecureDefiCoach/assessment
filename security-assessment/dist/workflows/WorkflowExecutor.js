"use strict";
/**
 * Workflow execution engine
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowExecutor = void 0;
const WorkflowDefinition_1 = require("./WorkflowDefinition");
const PredefinedWorkflows_1 = require("./PredefinedWorkflows");
const AnalysisOrchestrator_1 = require("../analysis/AnalysisOrchestrator");
const logger_1 = require("../utils/logger");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class WorkflowExecutor {
    constructor() {
        this.analysisOrchestrator = new AnalysisOrchestrator_1.AnalysisOrchestrator();
    }
    /**
     * Execute workflow in assessment environment
     */
    async executeWorkflow(environment, customWorkflowPath, progressCallback) {
        const startTime = Date.now();
        let workflow;
        try {
            // Load workflow definition
            if (customWorkflowPath) {
                workflow = WorkflowDefinition_1.WorkflowDefinitionManager.loadFromFile(customWorkflowPath);
            }
            else {
                // Auto-select appropriate workflow
                workflow = this.autoSelectWorkflow(environment);
            }
            logger_1.logger.info(`Executing workflow: ${workflow.name}`, {
                environmentId: environment.containerId,
                workflowVersion: workflow.version
            });
            // Create workflow context
            const context = await this.createWorkflowContext(environment);
            // Execute workflow steps
            const result = await this.executeWorkflowSteps(workflow, context, progressCallback);
            logger_1.logger.info(`Workflow completed successfully`, {
                environmentId: environment.containerId,
                duration: Date.now() - startTime,
                executedSteps: result.executedSteps.length
            });
            return result.results;
        }
        catch (error) {
            logger_1.logger.error('Workflow execution failed', {
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
    async executeWorkflowSteps(workflow, context, progressCallback) {
        const result = {
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
        const parallelGroups = WorkflowDefinition_1.WorkflowDefinitionManager.getParallelSteps(workflow);
        try {
            // Track which steps are part of parallel groups
            const parallelStepNames = new Set();
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
        }
        catch (error) {
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
    async executeStep(step, context, result) {
        try {
            // Check step condition
            if (step.condition && !WorkflowDefinition_1.WorkflowDefinitionManager.evaluateCondition(step.condition, context)) {
                logger_1.logger.info(`Skipping step due to condition: ${step.name}`);
                result.skippedSteps.push(step.name);
                return;
            }
            logger_1.logger.info(`Executing step: ${step.name}`, { tool: step.tool });
            // Execute step with retries
            const maxRetries = step.retries || 0;
            let lastError = null;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    const stepResult = await this.executeStepTool(step, context);
                    // Merge results
                    this.mergeStepResults(stepResult, result.results);
                    result.executedSteps.push(step.name);
                    logger_1.logger.info(`Step completed successfully: ${step.name}`);
                    return;
                }
                catch (error) {
                    lastError = error instanceof Error ? error : new Error('Unknown error');
                    if (attempt < maxRetries) {
                        logger_1.logger.warn(`Step failed, retrying (${attempt + 1}/${maxRetries}): ${step.name}`, {
                            error: lastError.message
                        });
                        // Wait before retry (exponential backoff)
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                    }
                }
            }
            // All retries failed
            throw lastError || new Error('Step execution failed');
        }
        catch (error) {
            const workflowError = {
                step: step.name,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date(),
                recoverable: (step.retries || 0) > 0
            };
            result.errors.push(workflowError);
            logger_1.logger.error(`Step execution failed: ${step.name}`, {
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
    async executeParallelSteps(steps, context, result) {
        const promises = steps.map(step => this.executeStep(step, context, result));
        try {
            await Promise.all(promises);
        }
        catch (error) {
            // Some parallel steps failed, but continue with available results
            logger_1.logger.warn('Some parallel steps failed', {
                totalSteps: steps.length,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Execute step tool
     */
    async executeStepTool(step, context) {
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
    async executeSetupTool(config, context) {
        logger_1.logger.info('Executing setup tool', { config });
        // Create output directory
        if (config.createOutputDir && !fs.existsSync(context.outputPath)) {
            fs.mkdirSync(context.outputPath, { recursive: true });
        }
        // Install dependencies if requested
        if (config.installDependencies) {
            const packageJsonPath = path.join(context.workspacePath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                // This would typically run npm install in the container
                logger_1.logger.info('Dependencies installation requested');
            }
        }
        return { success: true, message: 'Setup completed' };
    }
    /**
     * Execute npm audit tool
     */
    async executeNpmAuditTool(config, context) {
        logger_1.logger.info('Executing npm audit', { config });
        // This would run npm audit in the container and return security findings
        return {
            securityFindings: [
                {
                    id: 'npm-audit-example',
                    severity: 'medium',
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
    async executeESLintTool(config, context) {
        logger_1.logger.info('Executing ESLint', { config });
        return {
            codeQualityIssues: [
                {
                    id: 'eslint-example',
                    severity: 'low',
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
    async executeSemgrepTool(config, context) {
        logger_1.logger.info('Executing Semgrep', { config });
        return {
            securityFindings: [
                {
                    id: 'semgrep-example',
                    severity: 'high',
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
    async executeSlitherTool(config, context) {
        logger_1.logger.info('Executing Slither', { config });
        return {
            securityFindings: [
                {
                    id: 'slither-example',
                    severity: 'critical',
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
    async executeMythXTool(config, context) {
        logger_1.logger.info('Executing MythX', { config });
        return {
            securityFindings: [
                {
                    id: 'mythx-example',
                    severity: 'high',
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
    async executeSolidityCompilerTool(config, context) {
        logger_1.logger.info('Executing Solidity compiler', { config });
        return {
            success: true,
            compiledContracts: ['Token.sol', 'Exchange.sol'],
            warnings: []
        };
    }
    /**
     * Execute gas analyzer tool
     */
    async executeGasAnalyzerTool(config, context) {
        logger_1.logger.info('Executing gas analyzer', { config });
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
    async executeTestRunnerTool(config, context) {
        logger_1.logger.info('Executing test runner', { config });
        return {
            testResults: [
                {
                    suite: 'Unit Tests',
                    test: 'should transfer tokens correctly',
                    status: 'passed',
                    duration: 150,
                    framework: 'jest'
                }
            ]
        };
    }
    /**
     * Execute Hardhat test tool
     */
    async executeHardhatTestTool(config, context) {
        logger_1.logger.info('Executing Hardhat tests', { config });
        return {
            testResults: [
                {
                    suite: 'Contract Tests',
                    test: 'should deploy correctly',
                    status: 'passed',
                    duration: 2500,
                    framework: 'hardhat'
                }
            ]
        };
    }
    /**
     * Merge step results into overall results
     */
    mergeStepResults(stepResult, overallResults) {
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
    autoSelectWorkflow(environment) {
        const codebaseType = environment.analysisConfig.codebaseType;
        // For now, use predefined workflow selection logic
        // In a real implementation, this could analyze the mounted codebase
        const detectedLanguages = this.detectLanguages(environment);
        const detectedFrameworks = this.detectFrameworks(environment);
        return PredefinedWorkflows_1.PredefinedWorkflows.autoSelectWorkflow(codebaseType, detectedLanguages, detectedFrameworks);
    }
    /**
     * Create workflow context from environment
     */
    async createWorkflowContext(environment) {
        return {
            workspacePath: '/workspace', // Container workspace path
            outputPath: '/output', // Container output path
            codebaseType: environment.analysisConfig.codebaseType,
            detectedLanguages: this.detectLanguages(environment),
            detectedFrameworks: this.detectFrameworks(environment),
            environment: process.env
        };
    }
    /**
     * Detect programming languages in codebase
     */
    detectLanguages(environment) {
        // This would analyze the mounted codebase to detect languages
        // For now, return based on analysis configuration
        const languages = [];
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
    detectFrameworks(environment) {
        // This would analyze package.json and other config files
        // For now, return common frameworks based on type
        const frameworks = [];
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
    getAvailableWorkflows() {
        return PredefinedWorkflows_1.PredefinedWorkflows.getAllWorkflows();
    }
    /**
     * Get workflow by name
     */
    getWorkflow(name) {
        return PredefinedWorkflows_1.PredefinedWorkflows.getWorkflow(name);
    }
}
exports.WorkflowExecutor = WorkflowExecutor;
//# sourceMappingURL=WorkflowExecutor.js.map