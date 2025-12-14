"use strict";
/**
 * CLI command definitions and handlers
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
exports.CLICommands = void 0;
const ContainerManager_1 = require("../container/ContainerManager");
const SecurityPolicyEngine_1 = require("../container/SecurityPolicyEngine");
const AnalysisOrchestrator_1 = require("../analysis/AnalysisOrchestrator");
const ProgressReporter_1 = require("./ProgressReporter");
const WorkflowExecutor_1 = require("../workflows/WorkflowExecutor");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class CLICommands {
    constructor() {
        this.containerManager = new ContainerManager_1.ContainerManager();
        this.securityEngine = new SecurityPolicyEngine_1.SecurityPolicyEngine();
        this.analysisOrchestrator = new AnalysisOrchestrator_1.AnalysisOrchestrator();
        this.workflowExecutor = new WorkflowExecutor_1.WorkflowExecutor();
    }
    /**
     * Get all available CLI commands
     */
    getCommands() {
        return [
            {
                name: 'assess',
                description: 'Start a security assessment of a codebase',
                options: [
                    {
                        name: 'codebase',
                        alias: 'c',
                        description: 'Path to the codebase to assess',
                        type: 'string',
                        required: true
                    },
                    {
                        name: 'output',
                        alias: 'o',
                        description: 'Output directory for results',
                        type: 'string',
                        default: './assessment-results'
                    },
                    {
                        name: 'type',
                        alias: 't',
                        description: 'Type of analysis to perform',
                        type: 'string',
                        choices: ['nodejs', 'solidity', 'mixed', 'auto'],
                        default: 'auto'
                    },
                    {
                        name: 'security-level',
                        alias: 's',
                        description: 'Security isolation level',
                        type: 'string',
                        choices: ['basic', 'standard', 'strict'],
                        default: 'standard'
                    },
                    {
                        name: 'network',
                        alias: 'n',
                        description: 'Allow network access for package installation',
                        type: 'boolean',
                        default: false
                    },
                    {
                        name: 'workflow',
                        alias: 'w',
                        description: 'Custom workflow configuration file',
                        type: 'string'
                    },
                    {
                        name: 'verbose',
                        alias: 'v',
                        description: 'Enable verbose output',
                        type: 'boolean',
                        default: false
                    },
                    {
                        name: 'format',
                        alias: 'f',
                        description: 'Output format for results',
                        type: 'string',
                        choices: ['json', 'html', 'text'],
                        default: 'json'
                    }
                ],
                handler: this.handleAssess.bind(this)
            },
            {
                name: 'status',
                description: 'Check status of running assessments',
                options: [
                    {
                        name: 'assessment-id',
                        alias: 'i',
                        description: 'Specific assessment ID to check',
                        type: 'string'
                    }
                ],
                handler: this.handleStatus.bind(this)
            },
            {
                name: 'stop',
                description: 'Stop a running assessment',
                options: [
                    {
                        name: 'assessment-id',
                        alias: 'i',
                        description: 'Assessment ID to stop',
                        type: 'string',
                        required: true
                    }
                ],
                handler: this.handleStop.bind(this)
            },
            {
                name: 'cleanup',
                description: 'Clean up assessment environments and resources',
                options: [
                    {
                        name: 'all',
                        alias: 'a',
                        description: 'Clean up all environments',
                        type: 'boolean',
                        default: false
                    },
                    {
                        name: 'assessment-id',
                        alias: 'i',
                        description: 'Specific assessment to clean up',
                        type: 'string'
                    }
                ],
                handler: this.handleCleanup.bind(this)
            },
            {
                name: 'extract',
                description: 'Extract results from completed assessment',
                options: [
                    {
                        name: 'assessment-id',
                        alias: 'i',
                        description: 'Assessment ID to extract results from',
                        type: 'string',
                        required: true
                    },
                    {
                        name: 'output',
                        alias: 'o',
                        description: 'Output directory for extracted results',
                        type: 'string',
                        required: true
                    },
                    {
                        name: 'format',
                        alias: 'f',
                        description: 'Output format',
                        type: 'string',
                        choices: ['json', 'html', 'text'],
                        default: 'json'
                    }
                ],
                handler: this.handleExtract.bind(this)
            }
        ];
    }
    /**
     * Handle assess command
     */
    async handleAssess(options) {
        const reporter = new ProgressReporter_1.ProgressReporter(options.verbose);
        try {
            reporter.reportInfo('Starting security assessment...');
            reporter.startOperation();
            // Validate codebase path
            if (!fs.existsSync(options.codebasePath)) {
                throw new Error(`Codebase path does not exist: ${options.codebasePath}`);
            }
            // Create security configuration
            const securityConfig = this.createSecurityConfiguration(options);
            // Create analysis configuration
            const analysisConfig = await this.createAnalysisConfiguration(options);
            reporter.reportProgress({
                stage: 'Setup',
                progress: 10,
                message: 'Creating assessment environment',
                timestamp: new Date()
            });
            // Create assessment environment
            const environment = await this.containerManager.createAssessmentEnvironment(securityConfig, analysisConfig);
            reporter.reportProgress({
                stage: 'Environment',
                progress: 30,
                message: 'Mounting codebase',
                timestamp: new Date()
            });
            // Mount codebase
            await this.containerManager.mountCodebase(options.codebasePath, '/workspace', environment.containerId);
            reporter.reportProgress({
                stage: 'Analysis',
                progress: 50,
                message: 'Starting analysis workflow',
                timestamp: new Date()
            });
            // Execute workflow
            const results = await this.workflowExecutor.executeWorkflow(environment, options.customWorkflow, (update) => reporter.reportProgress(update));
            reporter.reportProgress({
                stage: 'Results',
                progress: 90,
                message: 'Generating report',
                timestamp: new Date()
            });
            // Extract and save results
            const outputPath = await this.extractResults(environment.containerId, options.outputPath || './assessment-results', options.format || 'json');
            reporter.reportProgress({
                stage: 'Complete',
                progress: 100,
                message: 'Assessment completed successfully',
                timestamp: new Date()
            });
            reporter.reportSuccess(`Assessment completed in ${Math.floor(reporter.getElapsedTime() / 1000)}s`);
            reporter.reportInfo(`Results saved to: ${outputPath}`);
            return {
                success: true,
                assessmentId: environment.containerId,
                outputPath,
                summary: `Assessment completed with ${results.securityFindings.length} security findings`
            };
        }
        catch (error) {
            reporter.reportError(error instanceof Error ? error.message : 'Unknown error occurred');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }
    /**
     * Handle status command
     */
    async handleStatus(options) {
        try {
            if (options.assessmentId) {
                const status = await this.containerManager.getEnvironmentStatus(options.assessmentId);
                console.log(`Assessment ${options.assessmentId}: ${status}`);
            }
            else {
                const environments = await this.containerManager.listEnvironments();
                console.log('Active assessments:');
                environments.forEach(env => {
                    console.log(`  ${env.containerId}: ${env.status} (${env.createdAt})`);
                });
            }
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get status'
            };
        }
    }
    /**
     * Handle stop command
     */
    async handleStop(options) {
        try {
            await this.containerManager.stopEnvironment(options.assessmentId);
            console.log(`Assessment ${options.assessmentId} stopped successfully`);
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to stop assessment'
            };
        }
    }
    /**
     * Handle cleanup command
     */
    async handleCleanup(options) {
        try {
            if (options.all) {
                await this.containerManager.cleanupAllEnvironments();
                console.log('All assessment environments cleaned up');
            }
            else if (options.assessmentId) {
                await this.containerManager.destroyEnvironment(options.assessmentId);
                console.log(`Assessment ${options.assessmentId} cleaned up`);
            }
            else {
                throw new Error('Must specify either --all or --assessment-id');
            }
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to cleanup'
            };
        }
    }
    /**
     * Handle extract command
     */
    async handleExtract(options) {
        try {
            const outputPath = await this.extractResults(options.assessmentId, options.output, options.format);
            console.log(`Results extracted to: ${outputPath}`);
            return {
                success: true,
                outputPath
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to extract results'
            };
        }
    }
    /**
     * Create security configuration from CLI options
     */
    createSecurityConfiguration(options) {
        const securityLevels = {
            basic: {
                networkIsolation: false,
                allowedNetworkAccess: ['*'],
                resourceLimits: { cpu: '1', memory: '1g', diskSpace: '5g' }
            },
            standard: {
                networkIsolation: true,
                allowedNetworkAccess: options.networkAccess ? ['registry.npmjs.org', 'github.com'] : [],
                resourceLimits: { cpu: '0.5', memory: '512m', diskSpace: '2g' }
            },
            strict: {
                networkIsolation: true,
                allowedNetworkAccess: [],
                resourceLimits: { cpu: '0.25', memory: '256m', diskSpace: '1g' }
            }
        };
        const level = options.securityLevel || 'standard';
        const baseConfig = securityLevels[level];
        return {
            networkIsolation: baseConfig.networkIsolation,
            allowedNetworkAccess: baseConfig.allowedNetworkAccess,
            resourceLimits: baseConfig.resourceLimits,
            filesystemAccess: {
                readOnlyMounts: ['/workspace'],
                writableMounts: ['/tmp', '/var/tmp']
            },
            securityPolicies: ['no-privileged', 'no-host-network', 'no-host-pid']
        };
    }
    /**
     * Create analysis configuration from CLI options
     */
    async createAnalysisConfiguration(options) {
        let codebaseType = options.analysisType;
        // Auto-detect codebase type if not specified
        if (options.analysisType === 'auto') {
            const detected = await this.detectCodebaseType(options.codebasePath);
            codebaseType = detected;
        }
        const toolMappings = {
            nodejs: ['eslint', 'npm-audit', 'semgrep'],
            solidity: ['slither', 'mythx', 'hardhat'],
            mixed: ['eslint', 'npm-audit', 'semgrep', 'slither', 'mythx', 'hardhat']
        };
        return {
            codebaseType,
            analysisTools: toolMappings[codebaseType] || [],
            testFrameworks: ['jest', 'mocha', 'hardhat'],
            reportFormats: [options.format || 'json'],
            customWorkflows: options.customWorkflow ? [options.customWorkflow] : undefined
        };
    }
    /**
     * Auto-detect codebase type based on files present
     */
    async detectCodebaseType(codebasePath) {
        const hasPackageJson = fs.existsSync(path.join(codebasePath, 'package.json'));
        const hasSolidityFiles = fs.readdirSync(codebasePath, { recursive: true })
            .some(file => typeof file === 'string' && file.endsWith('.sol'));
        if (hasPackageJson && hasSolidityFiles) {
            return 'mixed';
        }
        else if (hasSolidityFiles) {
            return 'solidity';
        }
        else if (hasPackageJson) {
            return 'nodejs';
        }
        return 'nodejs'; // Default fallback
    }
    /**
     * Extract results from assessment environment
     */
    async extractResults(assessmentId, outputPath, format) {
        // Ensure output directory exists
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }
        // Extract results from container
        const results = await this.containerManager.extractResults(assessmentId, outputPath);
        // Generate formatted report
        const reportPath = path.join(outputPath, `assessment-report.${format}`);
        await this.generateReport(results, reportPath, format);
        return reportPath;
    }
    /**
     * Generate formatted report
     */
    async generateReport(results, outputPath, format) {
        switch (format) {
            case 'json':
                fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
                break;
            case 'html':
                // Simple HTML report generation
                const html = this.generateHTMLReport(results);
                fs.writeFileSync(outputPath, html);
                break;
            case 'text':
                const text = this.generateTextReport(results);
                fs.writeFileSync(outputPath, text);
                break;
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }
    /**
     * Generate HTML report
     */
    generateHTMLReport(results) {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Security Assessment Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .finding { margin: 10px 0; padding: 10px; border-left: 4px solid #ff6b6b; }
        .severity-high { border-color: #ff6b6b; }
        .severity-medium { border-color: #ffa726; }
        .severity-low { border-color: #66bb6a; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Assessment Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>
    </div>
    <h2>Summary</h2>
    <p>Total findings: ${results.securityFindings?.length || 0}</p>
    <h2>Security Findings</h2>
    ${results.securityFindings?.map((finding) => `
        <div class="finding severity-${finding.severity}">
            <h3>${finding.title}</h3>
            <p>${finding.description}</p>
            <p><strong>Severity:</strong> ${finding.severity}</p>
        </div>
    `).join('') || '<p>No security findings</p>'}
</body>
</html>`;
    }
    /**
     * Generate text report
     */
    generateTextReport(results) {
        let report = 'SECURITY ASSESSMENT REPORT\n';
        report += '========================\n\n';
        report += `Generated: ${new Date().toISOString()}\n\n`;
        report += `Total findings: ${results.securityFindings?.length || 0}\n\n`;
        if (results.securityFindings?.length > 0) {
            report += 'SECURITY FINDINGS:\n';
            report += '-----------------\n\n';
            results.securityFindings.forEach((finding, index) => {
                report += `${index + 1}. ${finding.title}\n`;
                report += `   Severity: ${finding.severity}\n`;
                report += `   Description: ${finding.description}\n\n`;
            });
        }
        return report;
    }
}
exports.CLICommands = CLICommands;
//# sourceMappingURL=CLICommands.js.map