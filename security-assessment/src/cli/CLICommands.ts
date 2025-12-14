/**
 * CLI command definitions and handlers
 */

import { AssessmentCommand, CLIOptions, CLIResult } from './types';
import { ContainerManager } from '../container/ContainerManager';
import { SecurityPolicyEngine } from '../container/SecurityPolicyEngine';
import { AnalysisOrchestrator } from '../analysis/AnalysisOrchestrator';
import { ProgressReporter } from './ProgressReporter';
import { WorkflowExecutor } from '../workflows/WorkflowExecutor';
import { AssessmentEnvironment, SecurityConfiguration, AnalysisConfiguration } from '../types';
import * as path from 'path';
import * as fs from 'fs';

export class CLICommands {
  private containerManager: ContainerManager;
  private securityEngine: SecurityPolicyEngine;
  private analysisOrchestrator: AnalysisOrchestrator;
  private workflowExecutor: WorkflowExecutor;

  constructor() {
    this.containerManager = new ContainerManager();
    this.securityEngine = new SecurityPolicyEngine();
    this.analysisOrchestrator = new AnalysisOrchestrator();
    this.workflowExecutor = new WorkflowExecutor();
  }

  /**
   * Get all available CLI commands
   */
  public getCommands(): AssessmentCommand[] {
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
  private async handleAssess(options: CLIOptions): Promise<CLIResult> {
    const reporter = new ProgressReporter(options.verbose);
    
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
      const environment = await this.containerManager.createAssessmentEnvironment(
        securityConfig,
        analysisConfig
      );

      reporter.reportProgress({
        stage: 'Environment',
        progress: 30,
        message: 'Mounting codebase',
        timestamp: new Date()
      });

      // Mount codebase
      await this.containerManager.mountCodebase(
        options.codebasePath,
        '/workspace',
        environment.containerId
      );

      reporter.reportProgress({
        stage: 'Analysis',
        progress: 50,
        message: 'Starting analysis workflow',
        timestamp: new Date()
      });

      // Execute workflow
      const results = await this.workflowExecutor.executeWorkflow(
        environment,
        options.customWorkflow,
        (update) => reporter.reportProgress(update)
      );

      reporter.reportProgress({
        stage: 'Results',
        progress: 90,
        message: 'Generating report',
        timestamp: new Date()
      });

      // Extract and save results
      const outputPath = await this.extractResults(
        environment.containerId,
        options.outputPath || './assessment-results',
        options.format || 'json'
      );

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

    } catch (error) {
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
  private async handleStatus(options: any): Promise<CLIResult> {
    try {
      if (options.assessmentId) {
        const status = await this.containerManager.getEnvironmentStatus(options.assessmentId);
        console.log(`Assessment ${options.assessmentId}: ${status}`);
      } else {
        const environments = await this.containerManager.listEnvironments();
        console.log('Active assessments:');
        environments.forEach(env => {
          console.log(`  ${env.containerId}: ${env.status} (${env.createdAt})`);
        });
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status'
      };
    }
  }

  /**
   * Handle stop command
   */
  private async handleStop(options: any): Promise<CLIResult> {
    try {
      await this.containerManager.stopEnvironment(options.assessmentId);
      console.log(`Assessment ${options.assessmentId} stopped successfully`);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop assessment'
      };
    }
  }

  /**
   * Handle cleanup command
   */
  private async handleCleanup(options: any): Promise<CLIResult> {
    try {
      if (options.all) {
        await this.containerManager.cleanupAllEnvironments();
        console.log('All assessment environments cleaned up');
      } else if (options.assessmentId) {
        await this.containerManager.destroyEnvironment(options.assessmentId);
        console.log(`Assessment ${options.assessmentId} cleaned up`);
      } else {
        throw new Error('Must specify either --all or --assessment-id');
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cleanup'
      };
    }
  }

  /**
   * Handle extract command
   */
  private async handleExtract(options: any): Promise<CLIResult> {
    try {
      const outputPath = await this.extractResults(
        options.assessmentId,
        options.output,
        options.format
      );
      
      console.log(`Results extracted to: ${outputPath}`);
      
      return {
        success: true,
        outputPath
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract results'
      };
    }
  }

  /**
   * Create security configuration from CLI options
   */
  private createSecurityConfiguration(options: CLIOptions): SecurityConfiguration {
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
    const baseConfig = securityLevels[level as keyof typeof securityLevels];

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
  private async createAnalysisConfiguration(options: CLIOptions): Promise<AnalysisConfiguration> {
    let codebaseType: 'nodejs' | 'solidity' | 'mixed' = options.analysisType as 'nodejs' | 'solidity' | 'mixed';
    
    // Auto-detect codebase type if not specified
    if (options.analysisType === 'auto') {
      const detected = await this.detectCodebaseType(options.codebasePath);
      codebaseType = detected as 'nodejs' | 'solidity' | 'mixed';
    }

    const toolMappings = {
      nodejs: ['eslint', 'npm-audit', 'semgrep'],
      solidity: ['slither', 'mythx', 'hardhat'],
      mixed: ['eslint', 'npm-audit', 'semgrep', 'slither', 'mythx', 'hardhat']
    };

    return {
      codebaseType,
      analysisTools: toolMappings[codebaseType as keyof typeof toolMappings] || [],
      testFrameworks: ['jest', 'mocha', 'hardhat'],
      reportFormats: [options.format || 'json'],
      customWorkflows: options.customWorkflow ? [options.customWorkflow] : undefined
    };
  }

  /**
   * Auto-detect codebase type based on files present
   */
  private async detectCodebaseType(codebasePath: string): Promise<string> {
    const hasPackageJson = fs.existsSync(path.join(codebasePath, 'package.json'));
    const hasSolidityFiles = fs.readdirSync(codebasePath, { recursive: true })
      .some(file => typeof file === 'string' && file.endsWith('.sol'));

    if (hasPackageJson && hasSolidityFiles) {
      return 'mixed';
    } else if (hasSolidityFiles) {
      return 'solidity';
    } else if (hasPackageJson) {
      return 'nodejs';
    }

    return 'nodejs'; // Default fallback
  }

  /**
   * Extract results from assessment environment
   */
  private async extractResults(
    assessmentId: string,
    outputPath: string,
    format: string
  ): Promise<string> {
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
  private async generateReport(results: any, outputPath: string, format: string): Promise<void> {
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
  private generateHTMLReport(results: any): string {
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
    ${results.securityFindings?.map((finding: any) => `
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
  private generateTextReport(results: any): string {
    let report = 'SECURITY ASSESSMENT REPORT\n';
    report += '========================\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    report += `Total findings: ${results.securityFindings?.length || 0}\n\n`;
    
    if (results.securityFindings?.length > 0) {
      report += 'SECURITY FINDINGS:\n';
      report += '-----------------\n\n';
      
      results.securityFindings.forEach((finding: any, index: number) => {
        report += `${index + 1}. ${finding.title}\n`;
        report += `   Severity: ${finding.severity}\n`;
        report += `   Description: ${finding.description}\n\n`;
      });
    }
    
    return report;
  }
}