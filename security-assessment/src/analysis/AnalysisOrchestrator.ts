/**
 * AnalysisOrchestrator - Coordinates execution of various analysis tools
 */

import Docker from 'dockerode';
import { 
  AnalysisResults, 
  AssessmentWorkflow, 
  WorkflowStep, 
  SecurityFinding, 
  CodeQualityIssue, 
  TestResult, 
  PerformanceMetric 
} from '../types';

export class AnalysisOrchestrator {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  /**
   * Executes static code analysis with support for ESLint, SonarJS, and other tools
   */
  async runStaticAnalysis(containerId: string, language: string, rules?: string[]): Promise<SecurityFinding[]> {
    const container = this.docker.getContainer(containerId);
    const findings: SecurityFinding[] = [];

    try {
      // Ensure container is running
      await this.ensureContainerRunning(container);

      // Install and run analysis tools based on language
      switch (language.toLowerCase()) {
        case 'javascript':
        case 'typescript':
        case 'nodejs':
          findings.push(...await this.runJavaScriptAnalysis(container, rules));
          break;
        case 'solidity':
          findings.push(...await this.runSolidityAnalysis(container, rules));
          break;
        default:
          findings.push(...await this.runGenericAnalysis(container, language, rules));
      }

      return findings;
    } catch (error) {
      console.error(`Static analysis failed for container ${containerId}:`, error);
      throw new Error(`Static analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Runs security-focused scans integrating npm audit and security scanners
   */
  async performSecurityScan(containerId: string, scanType: string): Promise<SecurityFinding[]> {
    const container = this.docker.getContainer(containerId);
    const findings: SecurityFinding[] = [];

    try {
      await this.ensureContainerRunning(container);

      switch (scanType.toLowerCase()) {
        case 'npm':
        case 'dependencies':
          findings.push(...await this.runNpmAudit(container));
          break;
        case 'secrets':
          findings.push(...await this.runSecretScan(container));
          break;
        case 'vulnerabilities':
          findings.push(...await this.runVulnerabilityScan(container));
          break;
        case 'all':
          findings.push(...await this.runNpmAudit(container));
          findings.push(...await this.runSecretScan(container));
          findings.push(...await this.runVulnerabilityScan(container));
          break;
        default:
          throw new Error(`Unsupported scan type: ${scanType}`);
      }

      return findings;
    } catch (error) {
      console.error(`Security scan failed for container ${containerId}:`, error);
      throw new Error(`Security scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Safely runs test suites
   */
  async executeTests(containerId: string, testSuite: string): Promise<TestResult[]> {
    const container = this.docker.getContainer(containerId);
    const results: TestResult[] = [];

    try {
      await this.ensureContainerRunning(container);

      // Detect test framework and run appropriate commands
      const testFramework = await this.detectTestFramework(container, testSuite);
      
      switch (testFramework) {
        case 'jest':
          results.push(...await this.runJestTests(container, testSuite));
          break;
        case 'mocha':
          results.push(...await this.runMochaTests(container, testSuite));
          break;
        case 'hardhat':
          results.push(...await this.runHardhatTests(container, testSuite));
          break;
        case 'truffle':
          results.push(...await this.runTruffleTests(container, testSuite));
          break;
        default:
          results.push(...await this.runGenericTests(container, testSuite));
      }

      return results;
    } catch (error) {
      console.error(`Test execution failed for container ${containerId}:`, error);
      throw new Error(`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compiles analysis results into structured output
   */
  async generateReport(containerId: string, findings: any[]): Promise<AnalysisResults> {
    try {
      const securityFindings: SecurityFinding[] = [];
      const codeQualityIssues: CodeQualityIssue[] = [];
      const testResults: TestResult[] = [];
      const performanceMetrics: PerformanceMetric[] = [];

      // Categorize findings by type
      for (const finding of findings) {
        if (finding.type === 'security') {
          securityFindings.push(finding as SecurityFinding);
        } else if (finding.type === 'quality') {
          codeQualityIssues.push(finding as CodeQualityIssue);
        } else if (finding.type === 'test') {
          testResults.push(finding as TestResult);
        } else if (finding.type === 'performance') {
          performanceMetrics.push(finding as PerformanceMetric);
        }
      }

      // Generate recommendations based on findings
      const recommendations = this.generateRecommendations(securityFindings, codeQualityIssues);

      return {
        securityFindings,
        codeQualityIssues,
        testResults,
        performanceMetrics,
        recommendations
      };
    } catch (error) {
      console.error(`Report generation failed for container ${containerId}:`, error);
      throw new Error(`Report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Executes a predefined workflow
   */
  async executeWorkflow(containerId: string, workflow: AssessmentWorkflow): Promise<AnalysisResults> {
    const container = this.docker.getContainer(containerId);
    const allFindings: any[] = [];

    try {
      await this.ensureContainerRunning(container);

      // Validate required tools are available
      const toolsAvailable = await this.validateToolsAvailable(containerId, workflow.requiredTools);
      if (!toolsAvailable) {
        throw new Error('Required tools are not available in the container');
      }

      // Execute each workflow step
      for (const step of workflow.steps) {
        console.log(`Executing workflow step: ${step.name}`);
        
        try {
          const stepResults = await this.executeWorkflowStep(container, step);
          allFindings.push(...stepResults);
        } catch (error) {
          if (!step.continueOnError) {
            throw new Error(`Workflow step '${step.name}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
          console.warn(`Workflow step '${step.name}' failed but continuing: ${error}`);
        }
      }

      return await this.generateReport(containerId, allFindings);
    } catch (error) {
      console.error(`Workflow execution failed for container ${containerId}:`, error);
      throw new Error(`Workflow execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates that required tools are available
   */
  async validateToolsAvailable(containerId: string, requiredTools: string[]): Promise<boolean> {
    const container = this.docker.getContainer(containerId);

    try {
      await this.ensureContainerRunning(container);

      for (const tool of requiredTools) {
        const isAvailable = await this.checkToolAvailable(container, tool);
        if (!isAvailable) {
          console.warn(`Required tool '${tool}' is not available in container ${containerId}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error(`Tool validation failed for container ${containerId}:`, error);
      return false;
    }
  }

  // Private helper methods

  private async ensureContainerRunning(container: Docker.Container): Promise<void> {
    const info = await container.inspect();
    if (info.State.Status !== 'running') {
      throw new Error('Container is not running');
    }
  }

  private async executeCommand(container: Docker.Container, command: string[]): Promise<string> {
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ hijack: true, stdin: false });
    
    return new Promise((resolve, reject) => {
      let output = '';
      
      stream.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });
      
      stream.on('end', () => {
        resolve(output);
      });
      
      stream.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  private async runJavaScriptAnalysis(container: Docker.Container, rules?: string[]): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      // Install ESLint if not available
      await this.executeCommand(container, ['npm', 'install', '-g', 'eslint', '@typescript-eslint/parser', '@typescript-eslint/eslint-plugin']);
      
      // Run ESLint analysis
      const eslintOutput = await this.executeCommand(container, [
        'eslint', 
        '/workspace', 
        '--format', 'json',
        '--ext', '.js,.ts,.jsx,.tsx'
      ]);

      const eslintResults = JSON.parse(eslintOutput);
      
      for (const file of eslintResults) {
        for (const message of file.messages) {
          findings.push({
            id: `eslint-${message.ruleId || 'unknown'}-${file.filePath}-${message.line}`,
            severity: this.mapESLintSeverity(message.severity),
            title: message.message,
            description: `ESLint rule violation: ${message.ruleId || 'unknown'}`,
            location: {
              file: file.filePath,
              line: message.line,
              column: message.column
            },
            tool: 'ESLint',
            category: 'code-quality',
            recommendation: `Fix ${message.ruleId} violation: ${message.message}`
          });
        }
      }
    } catch (error) {
      console.warn('ESLint analysis failed:', error);
    }

    return findings;
  }

  private async runSolidityAnalysis(container: Docker.Container, rules?: string[]): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      // Install Slither if not available
      await this.executeCommand(container, ['pip3', 'install', 'slither-analyzer']);
      
      // Run Slither analysis
      const slitherOutput = await this.executeCommand(container, [
        'slither', 
        '/workspace',
        '--json', '-'
      ]);

      const slitherResults = JSON.parse(slitherOutput);
      
      for (const result of slitherResults.results?.detectors || []) {
        findings.push({
          id: `slither-${result.check}-${result.first_markdown_element}`,
          severity: this.mapSlitherSeverity(result.impact),
          title: result.description,
          description: `Slither detector: ${result.check}`,
          location: {
            file: result.elements?.[0]?.source_mapping?.filename || 'unknown',
            line: result.elements?.[0]?.source_mapping?.lines?.[0] || 0
          },
          tool: 'Slither',
          category: 'security',
          recommendation: `Review and fix ${result.check} issue`
        });
      }
    } catch (error) {
      console.warn('Slither analysis failed:', error);
    }

    return findings;
  }

  private async runGenericAnalysis(container: Docker.Container, language: string, rules?: string[]): Promise<SecurityFinding[]> {
    // Placeholder for generic analysis tools
    console.log(`Running generic analysis for language: ${language}`);
    return [];
  }

  private async runNpmAudit(container: Docker.Container): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      const auditOutput = await this.executeCommand(container, ['npm', 'audit', '--json']);
      const auditResults = JSON.parse(auditOutput);

      for (const [packageName, vulnerability] of Object.entries(auditResults.vulnerabilities || {})) {
        const vuln = vulnerability as any;
        findings.push({
          id: `npm-audit-${packageName}-${vuln.via?.[0]?.source || 'unknown'}`,
          severity: this.mapNpmSeverity(vuln.severity),
          title: `Vulnerable dependency: ${packageName}`,
          description: vuln.via?.[0]?.title || 'Security vulnerability in dependency',
          location: {
            file: 'package.json',
            line: 0
          },
          tool: 'npm audit',
          category: 'dependency-security',
          recommendation: `Update ${packageName} to version ${vuln.fixAvailable?.version || 'latest'}`
        });
      }
    } catch (error) {
      console.warn('npm audit failed:', error);
    }

    return findings;
  }

  private async runSecretScan(container: Docker.Container): Promise<SecurityFinding[]> {
    // Placeholder for secret scanning (could integrate with tools like truffleHog)
    console.log('Running secret scan...');
    return [];
  }

  private async runVulnerabilityScan(container: Docker.Container): Promise<SecurityFinding[]> {
    // Placeholder for vulnerability scanning
    console.log('Running vulnerability scan...');
    return [];
  }

  private async detectTestFramework(container: Docker.Container, testSuite: string): Promise<string> {
    try {
      // Check package.json for test framework dependencies
      const packageJsonOutput = await this.executeCommand(container, ['cat', '/workspace/package.json']);
      const packageJson = JSON.parse(packageJsonOutput);
      
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (dependencies.jest) return 'jest';
      if (dependencies.mocha) return 'mocha';
      if (dependencies.hardhat) return 'hardhat';
      if (dependencies.truffle) return 'truffle';
      
      return 'generic';
    } catch (error) {
      return 'generic';
    }
  }

  private async runJestTests(container: Docker.Container, testSuite: string): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    try {
      const jestOutput = await this.executeCommand(container, ['npx', 'jest', '--json', '--testPathPattern', testSuite]);
      const jestResults = JSON.parse(jestOutput);
      
      for (const testResult of jestResults.testResults || []) {
        for (const assertionResult of testResult.assertionResults || []) {
          results.push({
            suite: testResult.name,
            test: assertionResult.title,
            status: assertionResult.status === 'passed' ? 'passed' : 'failed',
            duration: assertionResult.duration || 0,
            error: assertionResult.failureMessages?.[0],
            framework: 'jest'
          });
        }
      }
    } catch (error) {
      console.warn('Jest test execution failed:', error);
    }
    
    return results;
  }

  private async runMochaTests(container: Docker.Container, testSuite: string): Promise<TestResult[]> {
    // Placeholder for Mocha test execution
    console.log('Running Mocha tests...');
    return [];
  }

  private async runHardhatTests(container: Docker.Container, testSuite: string): Promise<TestResult[]> {
    // Placeholder for Hardhat test execution
    console.log('Running Hardhat tests...');
    return [];
  }

  private async runTruffleTests(container: Docker.Container, testSuite: string): Promise<TestResult[]> {
    // Placeholder for Truffle test execution
    console.log('Running Truffle tests...');
    return [];
  }

  private async runGenericTests(container: Docker.Container, testSuite: string): Promise<TestResult[]> {
    // Placeholder for generic test execution
    console.log('Running generic tests...');
    return [];
  }

  private async executeWorkflowStep(container: Docker.Container, step: WorkflowStep): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      const output = await this.executeCommand(container, step.command);
      const duration = Date.now() - startTime;
      
      // Parse output based on step type
      if (step.type === 'analysis') {
        return this.parseAnalysisOutput(output, step.name);
      } else if (step.type === 'test') {
        return this.parseTestOutput(output, step.name, duration);
      }
      
      return [];
    } catch (error) {
      if (!step.continueOnError) {
        throw error;
      }
      return [];
    }
  }

  private parseAnalysisOutput(output: string, stepName: string): any[] {
    // Placeholder for parsing analysis output
    return [];
  }

  private parseTestOutput(output: string, stepName: string, duration: number): any[] {
    // Placeholder for parsing test output
    return [];
  }

  private async checkToolAvailable(container: Docker.Container, tool: string): Promise<boolean> {
    try {
      await this.executeCommand(container, ['which', tool]);
      return true;
    } catch (error) {
      return false;
    }
  }

  private generateRecommendations(securityFindings: SecurityFinding[], codeQualityIssues: CodeQualityIssue[]): string[] {
    const recommendations: string[] = [];
    
    const criticalFindings = securityFindings.filter(f => f.severity === 'critical').length;
    const highFindings = securityFindings.filter(f => f.severity === 'high').length;
    
    if (criticalFindings > 0) {
      recommendations.push(`Address ${criticalFindings} critical security findings immediately`);
    }
    
    if (highFindings > 0) {
      recommendations.push(`Review and fix ${highFindings} high-severity security issues`);
    }
    
    if (codeQualityIssues.length > 10) {
      recommendations.push('Consider implementing automated code quality checks in CI/CD pipeline');
    }
    
    return recommendations;
  }

  private mapESLintSeverity(severity: number): SecurityFinding['severity'] {
    switch (severity) {
      case 2: return 'high';
      case 1: return 'medium';
      default: return 'low';
    }
  }

  private mapSlitherSeverity(impact: string): SecurityFinding['severity'] {
    switch (impact?.toLowerCase()) {
      case 'high': return 'critical';
      case 'medium': return 'high';
      case 'low': return 'medium';
      default: return 'low';
    }
  }

  private mapNpmSeverity(severity: string): SecurityFinding['severity'] {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'moderate': return 'medium';
      case 'low': return 'low';
      default: return 'info';
    }
  }
}