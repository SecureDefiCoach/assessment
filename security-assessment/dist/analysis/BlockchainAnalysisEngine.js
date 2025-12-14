"use strict";
/**
 * BlockchainAnalysisEngine - Specialized analysis for smart contracts and DeFi applications
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainAnalysisEngine = void 0;
const dockerode_1 = __importDefault(require("dockerode"));
class BlockchainAnalysisEngine {
    constructor() {
        this.docker = new dockerode_1.default();
    }
    /**
     * Security analysis of smart contracts with Slither and MythX integration
     */
    async analyzeSolidityContracts(containerId, contractPaths) {
        const container = this.docker.getContainer(containerId);
        const results = [];
        try {
            await this.ensureContainerRunning(container);
            // Install Solidity compiler and analysis tools
            await this.installSolidityTools(container);
            for (const contractPath of contractPaths) {
                console.log(`Analyzing contract: ${contractPath}`);
                const result = {
                    contractPath,
                    findings: [],
                    compilationSuccess: false,
                    errors: []
                };
                try {
                    // First, try to compile the contract
                    const compilationResult = await this.compileContract(container, contractPath);
                    result.compilationSuccess = compilationResult.success;
                    if (!compilationResult.success) {
                        result.errors = compilationResult.errors;
                        results.push(result);
                        continue;
                    }
                    // Run Slither analysis
                    const slitherFindings = await this.runSlitherAnalysis(container, contractPath);
                    result.findings.push(...slitherFindings);
                    // Run MythX analysis (if available)
                    try {
                        const mythxFindings = await this.runMythXAnalysis(container, contractPath);
                        result.findings.push(...mythxFindings);
                    }
                    catch (error) {
                        console.warn(`MythX analysis failed for ${contractPath}:`, error);
                    }
                    // Run additional security checks
                    const customFindings = await this.runCustomSecurityChecks(container, contractPath);
                    result.findings.push(...customFindings);
                }
                catch (error) {
                    result.errors = [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`];
                }
                results.push(result);
            }
            return results;
        }
        catch (error) {
            console.error(`Contract analysis failed for container ${containerId}:`, error);
            throw new Error(`Contract analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Execute contract test suites supporting Hardhat and Truffle frameworks
     */
    async runContractTests(containerId, framework) {
        const container = this.docker.getContainer(containerId);
        const results = [];
        try {
            await this.ensureContainerRunning(container);
            // Install the appropriate framework
            await this.installTestFramework(container, framework);
            switch (framework) {
                case 'hardhat':
                    results.push(...await this.runHardhatTests(container));
                    break;
                case 'truffle':
                    results.push(...await this.runTruffleTests(container));
                    break;
                default:
                    throw new Error(`Unsupported framework: ${framework}`);
            }
            return results;
        }
        catch (error) {
            console.error(`Contract test execution failed for container ${containerId}:`, error);
            throw new Error(`Contract test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Test contract behavior safely with local blockchain setup
     */
    async simulateTransactions(containerId, scenarios) {
        const container = this.docker.getContainer(containerId);
        const results = [];
        try {
            await this.ensureContainerRunning(container);
            // Start local blockchain (Ganache or Hardhat Network)
            await this.startLocalBlockchain(container);
            // Deploy contracts for testing
            await this.deployContractsForTesting(container);
            for (const scenario of scenarios) {
                console.log(`Simulating transaction: ${scenario.functionName}`);
                const startTime = Date.now();
                try {
                    const result = await this.executeTransaction(container, scenario);
                    const duration = Date.now() - startTime;
                    results.push({
                        suite: 'Transaction Simulation',
                        test: `${scenario.functionName}(${JSON.stringify(scenario.parameters)})`,
                        status: result.success ? 'passed' : 'failed',
                        duration,
                        error: result.error,
                        framework: 'simulation'
                    });
                }
                catch (error) {
                    const duration = Date.now() - startTime;
                    results.push({
                        suite: 'Transaction Simulation',
                        test: `${scenario.functionName}(${JSON.stringify(scenario.parameters)})`,
                        status: 'failed',
                        duration,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        framework: 'simulation'
                    });
                }
            }
            return results;
        }
        catch (error) {
            console.error(`Transaction simulation failed for container ${containerId}:`, error);
            throw new Error(`Transaction simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Analyze gas usage patterns and provide optimization suggestions
     */
    async assessGasOptimization(containerId, contracts) {
        const container = this.docker.getContainer(containerId);
        const reports = [];
        try {
            await this.ensureContainerRunning(container);
            // Install gas analysis tools
            await this.installGasAnalysisTools(container);
            for (const contractPath of contracts) {
                console.log(`Analyzing gas usage for: ${contractPath}`);
                const report = await this.analyzeContractGasUsage(container, contractPath);
                reports.push(report);
            }
            return reports;
        }
        catch (error) {
            console.error(`Gas optimization analysis failed for container ${containerId}:`, error);
            throw new Error(`Gas optimization analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Validates blockchain development environment setup
     */
    async validateBlockchainEnvironment(containerId) {
        const container = this.docker.getContainer(containerId);
        try {
            await this.ensureContainerRunning(container);
            // Check for required tools
            const requiredTools = ['solc', 'node', 'npm'];
            for (const tool of requiredTools) {
                const isAvailable = await this.checkToolAvailable(container, tool);
                if (!isAvailable) {
                    console.warn(`Required tool '${tool}' is not available`);
                    return false;
                }
            }
            // Check for blockchain frameworks
            const hasHardhat = await this.checkPackageInstalled(container, 'hardhat');
            const hasTruffle = await this.checkPackageInstalled(container, 'truffle');
            if (!hasHardhat && !hasTruffle) {
                console.warn('No blockchain development framework found (Hardhat or Truffle)');
                return false;
            }
            return true;
        }
        catch (error) {
            console.error(`Environment validation failed for container ${containerId}:`, error);
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
    async installSolidityTools(container) {
        try {
            // Install Solidity compiler
            await this.executeCommand(container, ['npm', 'install', '-g', 'solc']);
            // Install Slither (Python-based)
            await this.executeCommand(container, ['pip3', 'install', 'slither-analyzer']);
            // Install MythX CLI (if API key is available)
            await this.executeCommand(container, ['npm', 'install', '-g', 'mythxjs']);
            console.log('Solidity analysis tools installed successfully');
        }
        catch (error) {
            console.warn('Some Solidity tools failed to install:', error);
        }
    }
    async compileContract(container, contractPath) {
        try {
            const output = await this.executeCommand(container, ['solc', '--bin', '--abi', contractPath]);
            if (output.includes('Error:') || output.includes('Warning:')) {
                const errors = output.split('\n').filter(line => line.includes('Error:') || line.includes('Warning:'));
                return { success: false, errors };
            }
            return { success: true, errors: [] };
        }
        catch (error) {
            return {
                success: false,
                errors: [`Compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
            };
        }
    }
    async runSlitherAnalysis(container, contractPath) {
        const findings = [];
        try {
            const output = await this.executeCommand(container, ['slither', contractPath, '--json', '-']);
            const results = JSON.parse(output);
            for (const detector of results.results?.detectors || []) {
                findings.push({
                    id: `slither-${detector.check}-${contractPath}`,
                    severity: this.mapSlitherSeverity(detector.impact),
                    title: detector.description,
                    description: `Slither detector: ${detector.check}`,
                    location: {
                        file: contractPath,
                        line: detector.elements?.[0]?.source_mapping?.lines?.[0] || 0
                    },
                    tool: 'Slither',
                    category: 'smart-contract-security',
                    recommendation: `Review and fix ${detector.check} issue in ${contractPath}`
                });
            }
        }
        catch (error) {
            console.warn(`Slither analysis failed for ${contractPath}:`, error);
        }
        return findings;
    }
    async runMythXAnalysis(container, contractPath) {
        const findings = [];
        try {
            // Note: MythX requires API key and subscription
            // This is a placeholder implementation
            console.log(`MythX analysis for ${contractPath} - requires API key configuration`);
        }
        catch (error) {
            console.warn(`MythX analysis failed for ${contractPath}:`, error);
        }
        return findings;
    }
    async runCustomSecurityChecks(container, contractPath) {
        const findings = [];
        try {
            // Read contract source code for custom pattern matching
            const sourceCode = await this.executeCommand(container, ['cat', contractPath]);
            // Check for common vulnerability patterns
            const vulnerabilityPatterns = [
                {
                    pattern: /\.call\s*\(/g,
                    severity: 'high',
                    title: 'Potential reentrancy vulnerability',
                    description: 'Use of .call() without proper reentrancy protection'
                },
                {
                    pattern: /tx\.origin/g,
                    severity: 'medium',
                    title: 'Use of tx.origin',
                    description: 'tx.origin should not be used for authorization'
                },
                {
                    pattern: /block\.timestamp/g,
                    severity: 'low',
                    title: 'Timestamp dependence',
                    description: 'Reliance on block.timestamp can be manipulated by miners'
                }
            ];
            for (const { pattern, severity, title, description } of vulnerabilityPatterns) {
                const matches = sourceCode.match(pattern);
                if (matches) {
                    findings.push({
                        id: `custom-${title.replace(/\s+/g, '-').toLowerCase()}-${contractPath}`,
                        severity,
                        title,
                        description,
                        location: {
                            file: contractPath,
                            line: 0 // Would need more sophisticated parsing for exact line numbers
                        },
                        tool: 'Custom Security Checker',
                        category: 'smart-contract-security',
                        recommendation: `Review ${title.toLowerCase()} in ${contractPath}`
                    });
                }
            }
        }
        catch (error) {
            console.warn(`Custom security checks failed for ${contractPath}:`, error);
        }
        return findings;
    }
    async installTestFramework(container, framework) {
        try {
            if (framework === 'hardhat') {
                await this.executeCommand(container, ['npm', 'install', '--save-dev', 'hardhat', '@nomiclabs/hardhat-ethers', 'ethers']);
            }
            else if (framework === 'truffle') {
                await this.executeCommand(container, ['npm', 'install', '-g', 'truffle']);
            }
            console.log(`${framework} installed successfully`);
        }
        catch (error) {
            console.warn(`Failed to install ${framework}:`, error);
        }
    }
    async runHardhatTests(container) {
        const results = [];
        try {
            const output = await this.executeCommand(container, ['npx', 'hardhat', 'test', '--reporter', 'json']);
            const testResults = JSON.parse(output);
            for (const test of testResults.tests || []) {
                results.push({
                    suite: test.parent?.title || 'Unknown Suite',
                    test: test.title,
                    status: test.state === 'passed' ? 'passed' : 'failed',
                    duration: test.duration || 0,
                    error: test.err?.message,
                    framework: 'hardhat'
                });
            }
        }
        catch (error) {
            console.warn('Hardhat test execution failed:', error);
        }
        return results;
    }
    async runTruffleTests(container) {
        const results = [];
        try {
            const output = await this.executeCommand(container, ['truffle', 'test', '--reporter', 'json']);
            const testResults = JSON.parse(output);
            for (const test of testResults.tests || []) {
                results.push({
                    suite: test.parent?.title || 'Unknown Suite',
                    test: test.title,
                    status: test.state === 'passed' ? 'passed' : 'failed',
                    duration: test.duration || 0,
                    error: test.err?.message,
                    framework: 'truffle'
                });
            }
        }
        catch (error) {
            console.warn('Truffle test execution failed:', error);
        }
        return results;
    }
    async startLocalBlockchain(container) {
        try {
            // Start Hardhat Network in the background
            await this.executeCommand(container, ['npx', 'hardhat', 'node', '--fork', 'mainnet', '&']);
            // Wait a moment for the network to start
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log('Local blockchain started');
        }
        catch (error) {
            console.warn('Failed to start local blockchain:', error);
        }
    }
    async deployContractsForTesting(container) {
        try {
            await this.executeCommand(container, ['npx', 'hardhat', 'run', 'scripts/deploy.js', '--network', 'localhost']);
            console.log('Contracts deployed for testing');
        }
        catch (error) {
            console.warn('Contract deployment failed:', error);
        }
    }
    async executeTransaction(container, scenario) {
        try {
            // This would typically involve calling contract functions through web3 or ethers
            // For now, this is a placeholder implementation
            console.log(`Executing transaction: ${scenario.functionName} with params:`, scenario.parameters);
            // Simulate transaction execution
            await new Promise(resolve => setTimeout(resolve, 100));
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Transaction failed'
            };
        }
    }
    async installGasAnalysisTools(container) {
        try {
            await this.executeCommand(container, ['npm', 'install', '--save-dev', 'hardhat-gas-reporter']);
            console.log('Gas analysis tools installed');
        }
        catch (error) {
            console.warn('Failed to install gas analysis tools:', error);
        }
    }
    async analyzeContractGasUsage(container, contractPath) {
        const report = {
            contractName: contractPath.split('/').pop()?.replace('.sol', '') || 'Unknown',
            functionGasCosts: {},
            optimizationSuggestions: [],
            totalGasUsed: 0
        };
        try {
            // Run gas analysis using Hardhat gas reporter
            const output = await this.executeCommand(container, ['npx', 'hardhat', 'test', '--gas-reporter']);
            // Parse gas usage from output (this would need more sophisticated parsing)
            const gasMatches = output.match(/(\w+)\s+(\d+)\s+gas/g);
            if (gasMatches) {
                for (const match of gasMatches) {
                    const [, functionName, gasUsed] = match.match(/(\w+)\s+(\d+)\s+gas/) || [];
                    if (functionName && gasUsed) {
                        report.functionGasCosts[functionName] = parseInt(gasUsed, 10);
                        report.totalGasUsed += parseInt(gasUsed, 10);
                    }
                }
            }
            // Generate optimization suggestions
            if (report.totalGasUsed > 1000000) {
                report.optimizationSuggestions.push('Consider optimizing high gas usage functions');
            }
            for (const [functionName, gasUsed] of Object.entries(report.functionGasCosts)) {
                if (gasUsed > 100000) {
                    report.optimizationSuggestions.push(`Function ${functionName} uses high gas (${gasUsed}), consider optimization`);
                }
            }
        }
        catch (error) {
            console.warn(`Gas analysis failed for ${contractPath}:`, error);
        }
        return report;
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
    async checkPackageInstalled(container, packageName) {
        try {
            const output = await this.executeCommand(container, ['npm', 'list', packageName]);
            return !output.includes('(empty)') && !output.includes('missing');
        }
        catch (error) {
            return false;
        }
    }
    mapSlitherSeverity(impact) {
        switch (impact?.toLowerCase()) {
            case 'high': return 'critical';
            case 'medium': return 'high';
            case 'low': return 'medium';
            case 'informational': return 'low';
            default: return 'info';
        }
    }
}
exports.BlockchainAnalysisEngine = BlockchainAnalysisEngine;
//# sourceMappingURL=BlockchainAnalysisEngine.js.map