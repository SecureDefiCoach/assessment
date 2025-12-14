"use strict";
/**
 * AnalysisOrchestrator - Coordinates execution of various analysis tools
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisOrchestrator = void 0;
const dockerode_1 = __importDefault(require("dockerode"));
class AnalysisOrchestrator {
    constructor() {
        this.docker = new dockerode_1.default();
    }
    /**
     * Executes static code analysis with support for ESLint, SonarJS, and other tools
     */
    async runStaticAnalysis(containerId, language, rules) {
        const container = this.docker.getContainer(containerId);
        const findings = [];
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
        }
        catch (error) {
            console.error(`Static analysis failed for container ${containerId}:`, error);
            throw new Error(`Static analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Runs security-focused scans integrating npm audit and security scanners
     */
    async performSecurityScan(containerId, scanType) {
        const container = this.docker.getContainer(containerId);
        const findings = [];
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
        }
        catch (error) {
            console.error(`Security scan failed for container ${containerId}:`, error);
            throw new Error(`Security scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Safely runs test suites
     */
    async executeTests(containerId, testSuite) {
        const container = this.docker.getContainer(containerId);
        const results = [];
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
        }
        catch (error) {
            console.error(`Test execution failed for container ${containerId}:`, error);
            throw new Error(`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Compiles analysis results into structured output
     */
    async generateReport(containerId, findings) {
        try {
            const securityFindings = [];
            const codeQualityIssues = [];
            const testResults = [];
            const performanceMetrics = [];
            // Categorize findings by type
            for (const finding of findings) {
                if (finding.type === 'security') {
                    securityFindings.push(finding);
                }
                else if (finding.type === 'quality') {
                    codeQualityIssues.push(finding);
                }
                else if (finding.type === 'test') {
                    testResults.push(finding);
                }
                else if (finding.type === 'performance') {
                    performanceMetrics.push(finding);
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
        }
        catch (error) {
            console.error(`Report generation failed for container ${containerId}:`, error);
            throw new Error(`Report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Executes a predefined workflow
     */
    async executeWorkflow(containerId, workflow) {
        const container = this.docker.getContainer(containerId);
        const allFindings = [];
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
                }
                catch (error) {
                    if (!step.continueOnError) {
                        throw new Error(`Workflow step '${step.name}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                    console.warn(`Workflow step '${step.name}' failed but continuing: ${error}`);
                }
            }
            return await this.generateReport(containerId, allFindings);
        }
        catch (error) {
            console.error(`Workflow execution failed for container ${containerId}:`, error);
            throw new Error(`Workflow execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Validates that required tools are available
     */
    async validateToolsAvailable(containerId, requiredTools) {
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
        }
        catch (error) {
            console.error(`Tool validation failed for container ${containerId}:`, error);
            return false;
        }
    }
    // Private helper methods
    async ensureContainerRunning(container) {
        const info = await container.inspect();
        if (info.State.Status !== 'running') {
            throw new Error('Container is not running');
        }
    }
    async executeCommand(container, command) {
        const exec = await container.exec({
            Cmd: command,
            AttachStdout: true,
            AttachStderr: true,
        });
        const stream = await exec.start({ hijack: true, stdin: false });
        return new Promise((resolve, reject) => {
            let output = '';
            stream.on('data', (chunk) => {
                output += chunk.toString();
            });
            stream.on('end', () => {
                resolve(output);
            });
            stream.on('error', (error) => {
                reject(error);
            });
        });
    }
    async runJavaScriptAnalysis(container, rules) {
        const findings = [];
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
        }
        catch (error) {
            console.warn('ESLint analysis failed:', error);
        }
        return findings;
    }
    async runSolidityAnalysis(container, rules) {
        const findings = [];
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
        }
        catch (error) {
            console.warn('Slither analysis failed:', error);
        }
        return findings;
    }
    async runGenericAnalysis(container, language, rules) {
        // Placeholder for generic analysis tools
        console.log(`Running generic analysis for language: ${language}`);
        return [];
    }
    async runNpmAudit(container) {
        const findings = [];
        try {
            const auditOutput = await this.executeCommand(container, ['npm', 'audit', '--json']);
            const auditResults = JSON.parse(auditOutput);
            for (const [packageName, vulnerability] of Object.entries(auditResults.vulnerabilities || {})) {
                const vuln = vulnerability;
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
        }
        catch (error) {
            console.warn('npm audit failed:', error);
        }
        return findings;
    }
    async runSecretScan(container) {
        // Placeholder for secret scanning (could integrate with tools like truffleHog)
        console.log('Running secret scan...');
        return [];
    }
    async runVulnerabilityScan(container) {
        // Placeholder for vulnerability scanning
        console.log('Running vulnerability scan...');
        return [];
    }
    async detectTestFramework(container, testSuite) {
        try {
            // Check package.json for test framework dependencies
            const packageJsonOutput = await this.executeCommand(container, ['cat', '/workspace/package.json']);
            const packageJson = JSON.parse(packageJsonOutput);
            const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
            if (dependencies.jest)
                return 'jest';
            if (dependencies.mocha)
                return 'mocha';
            if (dependencies.hardhat)
                return 'hardhat';
            if (dependencies.truffle)
                return 'truffle';
            return 'generic';
        }
        catch (error) {
            return 'generic';
        }
    }
    async runJestTests(container, testSuite) {
        const results = [];
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
        }
        catch (error) {
            console.warn('Jest test execution failed:', error);
        }
        return results;
    }
    async runMochaTests(container, testSuite) {
        // Placeholder for Mocha test execution
        console.log('Running Mocha tests...');
        return [];
    }
    async runHardhatTests(container, testSuite) {
        // Placeholder for Hardhat test execution
        console.log('Running Hardhat tests...');
        return [];
    }
    async runTruffleTests(container, testSuite) {
        // Placeholder for Truffle test execution
        console.log('Running Truffle tests...');
        return [];
    }
    async runGenericTests(container, testSuite) {
        // Placeholder for generic test execution
        console.log('Running generic tests...');
        return [];
    }
    async executeWorkflowStep(container, step) {
        const startTime = Date.now();
        try {
            const output = await this.executeCommand(container, step.command);
            const duration = Date.now() - startTime;
            // Parse output based on step type
            if (step.type === 'analysis') {
                return this.parseAnalysisOutput(output, step.name);
            }
            else if (step.type === 'test') {
                return this.parseTestOutput(output, step.name, duration);
            }
            return [];
        }
        catch (error) {
            if (!step.continueOnError) {
                throw error;
            }
            return [];
        }
    }
    parseAnalysisOutput(output, stepName) {
        // Placeholder for parsing analysis output
        return [];
    }
    parseTestOutput(output, stepName, duration) {
        // Placeholder for parsing test output
        return [];
    }
    async checkToolAvailable(container, tool) {
        try {
            await this.executeCommand(container, ['which', tool]);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    generateRecommendations(securityFindings, codeQualityIssues) {
        const recommendations = [];
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
    mapESLintSeverity(severity) {
        switch (severity) {
            case 2: return 'high';
            case 1: return 'medium';
            default: return 'low';
        }
    }
    mapSlitherSeverity(impact) {
        switch (impact?.toLowerCase()) {
            case 'high': return 'critical';
            case 'medium': return 'high';
            case 'low': return 'medium';
            default: return 'low';
        }
    }
    mapNpmSeverity(severity) {
        switch (severity?.toLowerCase()) {
            case 'critical': return 'critical';
            case 'high': return 'high';
            case 'moderate': return 'medium';
            case 'low': return 'low';
            default: return 'info';
        }
    }
}
exports.AnalysisOrchestrator = AnalysisOrchestrator;
//# sourceMappingURL=AnalysisOrchestrator.js.map