"use strict";
/**
 * Predefined workflows for common assessment scenarios
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredefinedWorkflows = void 0;
class PredefinedWorkflows {
    /**
     * Get all predefined workflows
     */
    static getAllWorkflows() {
        return [
            this.getNodeJSWorkflow(),
            this.getSolidityWorkflow(),
            this.getMixedWorkflow(),
            this.getQuickScanWorkflow(),
            this.getDeepAnalysisWorkflow()
        ];
    }
    /**
     * Get workflow by name
     */
    static getWorkflow(name) {
        return this.getAllWorkflows().find(workflow => workflow.name === name);
    }
    /**
     * Get workflows compatible with codebase type
     */
    static getCompatibleWorkflows(codebaseType) {
        return this.getAllWorkflows().filter(workflow => workflow.codebaseTypes.includes(codebaseType) || workflow.codebaseTypes.includes('*'));
    }
    /**
     * Node.js focused workflow
     */
    static getNodeJSWorkflow() {
        return {
            name: 'nodejs-standard',
            description: 'Standard security assessment for Node.js applications',
            version: '1.0.0',
            codebaseTypes: ['nodejs', 'mixed'],
            steps: [
                {
                    name: 'setup-nodejs',
                    description: 'Set up Node.js environment',
                    tool: 'setup',
                    config: {
                        nodeVersion: 'lts',
                        installDependencies: true,
                        createOutputDir: true
                    }
                },
                {
                    name: 'dependency-audit',
                    description: 'Audit npm dependencies for vulnerabilities',
                    tool: 'npm-audit',
                    config: {
                        auditLevel: 'moderate',
                        includeDevDependencies: true,
                        outputFormat: 'json'
                    },
                    condition: {
                        type: 'file-exists',
                        value: 'package.json'
                    }
                },
                {
                    name: 'static-analysis',
                    description: 'Run ESLint static analysis',
                    tool: 'eslint',
                    config: {
                        configFile: '.eslintrc.js',
                        extensions: ['.js', '.ts', '.jsx', '.tsx'],
                        outputFormat: 'json'
                    }
                },
                {
                    name: 'security-scan',
                    description: 'Run Semgrep security analysis',
                    tool: 'semgrep',
                    config: {
                        rules: ['javascript', 'typescript', 'security'],
                        outputFormat: 'json'
                    }
                },
                {
                    name: 'test-execution',
                    description: 'Run test suite safely',
                    tool: 'test-runner',
                    config: {
                        framework: 'auto-detect',
                        timeout: 300,
                        coverage: true
                    },
                    condition: {
                        type: 'file-exists',
                        value: 'package.json'
                    }
                }
            ],
            parallelSteps: [
                ['static-analysis', 'security-scan']
            ]
        };
    }
    /**
     * Solidity focused workflow
     */
    static getSolidityWorkflow() {
        return {
            name: 'solidity-standard',
            description: 'Standard security assessment for Solidity smart contracts',
            version: '1.0.0',
            codebaseTypes: ['solidity', 'mixed'],
            steps: [
                {
                    name: 'setup-solidity',
                    description: 'Set up Solidity development environment',
                    tool: 'setup',
                    config: {
                        solidityVersion: 'latest',
                        installHardhat: true,
                        createOutputDir: true
                    }
                },
                {
                    name: 'compile-contracts',
                    description: 'Compile Solidity contracts',
                    tool: 'solidity-compiler',
                    config: {
                        version: 'auto',
                        optimizer: true,
                        outputFormat: 'json'
                    },
                    condition: {
                        type: 'file-exists',
                        value: 'contracts'
                    }
                },
                {
                    name: 'slither-analysis',
                    description: 'Run Slither security analysis',
                    tool: 'slither',
                    config: {
                        detectors: 'all',
                        outputFormat: 'json',
                        excludeInformational: false
                    }
                },
                {
                    name: 'mythx-analysis',
                    description: 'Run MythX security analysis',
                    tool: 'mythx',
                    config: {
                        mode: 'quick',
                        outputFormat: 'json'
                    },
                    timeout: 600
                },
                {
                    name: 'gas-analysis',
                    description: 'Analyze gas usage patterns',
                    tool: 'gas-analyzer',
                    config: {
                        optimizationLevel: 200,
                        reportThreshold: 100000
                    }
                },
                {
                    name: 'contract-tests',
                    description: 'Run smart contract tests',
                    tool: 'hardhat-test',
                    config: {
                        network: 'hardhat',
                        coverage: true,
                        timeout: 300
                    },
                    condition: {
                        type: 'file-exists',
                        value: 'test'
                    }
                }
            ],
            parallelSteps: [
                ['slither-analysis', 'mythx-analysis', 'gas-analysis']
            ]
        };
    }
    /**
     * Mixed codebase workflow
     */
    static getMixedWorkflow() {
        return {
            name: 'mixed-comprehensive',
            description: 'Comprehensive assessment for mixed Node.js and Solidity projects',
            version: '1.0.0',
            codebaseTypes: ['mixed'],
            steps: [
                {
                    name: 'setup-mixed',
                    description: 'Set up mixed development environment',
                    tool: 'setup',
                    config: {
                        nodeVersion: 'lts',
                        solidityVersion: 'latest',
                        installDependencies: true,
                        installHardhat: true,
                        createOutputDir: true
                    }
                },
                {
                    name: 'dependency-audit',
                    description: 'Audit npm dependencies',
                    tool: 'npm-audit',
                    config: {
                        auditLevel: 'moderate',
                        includeDevDependencies: true,
                        outputFormat: 'json'
                    },
                    condition: {
                        type: 'file-exists',
                        value: 'package.json'
                    }
                },
                {
                    name: 'compile-contracts',
                    description: 'Compile Solidity contracts',
                    tool: 'solidity-compiler',
                    config: {
                        version: 'auto',
                        optimizer: true,
                        outputFormat: 'json'
                    },
                    condition: {
                        type: 'file-exists',
                        value: 'contracts'
                    }
                },
                {
                    name: 'nodejs-static-analysis',
                    description: 'Run ESLint on Node.js code',
                    tool: 'eslint',
                    config: {
                        configFile: '.eslintrc.js',
                        extensions: ['.js', '.ts', '.jsx', '.tsx'],
                        outputFormat: 'json'
                    }
                },
                {
                    name: 'nodejs-security-scan',
                    description: 'Run Semgrep on Node.js code',
                    tool: 'semgrep',
                    config: {
                        rules: ['javascript', 'typescript', 'security'],
                        outputFormat: 'json'
                    }
                },
                {
                    name: 'solidity-security-scan',
                    description: 'Run Slither on smart contracts',
                    tool: 'slither',
                    config: {
                        detectors: 'all',
                        outputFormat: 'json'
                    }
                },
                {
                    name: 'integration-tests',
                    description: 'Run integration tests',
                    tool: 'test-runner',
                    config: {
                        framework: 'auto-detect',
                        includeIntegration: true,
                        timeout: 600,
                        coverage: true
                    }
                }
            ],
            parallelSteps: [
                ['nodejs-static-analysis', 'nodejs-security-scan', 'solidity-security-scan']
            ]
        };
    }
    /**
     * Quick scan workflow for fast assessment
     */
    static getQuickScanWorkflow() {
        return {
            name: 'quick-scan',
            description: 'Fast security scan for quick assessment',
            version: '1.0.0',
            codebaseTypes: ['*'],
            steps: [
                {
                    name: 'setup-quick',
                    description: 'Quick environment setup',
                    tool: 'setup',
                    config: {
                        minimal: true,
                        createOutputDir: true
                    }
                },
                {
                    name: 'dependency-check',
                    description: 'Quick dependency vulnerability check',
                    tool: 'npm-audit',
                    config: {
                        auditLevel: 'high',
                        quick: true,
                        outputFormat: 'json'
                    },
                    condition: {
                        type: 'file-exists',
                        value: 'package.json'
                    }
                },
                {
                    name: 'basic-static-analysis',
                    description: 'Basic static analysis',
                    tool: 'semgrep',
                    config: {
                        rules: ['security'],
                        quick: true,
                        outputFormat: 'json'
                    }
                },
                {
                    name: 'contract-quick-scan',
                    description: 'Quick contract security scan',
                    tool: 'slither',
                    config: {
                        detectors: 'high,medium',
                        quick: true,
                        outputFormat: 'json'
                    },
                    condition: {
                        type: 'language-detected',
                        value: 'solidity'
                    }
                }
            ]
        };
    }
    /**
     * Deep analysis workflow for thorough assessment
     */
    static getDeepAnalysisWorkflow() {
        return {
            name: 'deep-analysis',
            description: 'Comprehensive deep security analysis',
            version: '1.0.0',
            codebaseTypes: ['*'],
            steps: [
                {
                    name: 'setup-comprehensive',
                    description: 'Comprehensive environment setup',
                    tool: 'setup',
                    config: {
                        nodeVersion: 'lts',
                        solidityVersion: 'latest',
                        installAllTools: true,
                        createOutputDir: true
                    }
                },
                {
                    name: 'comprehensive-dependency-audit',
                    description: 'Comprehensive dependency analysis',
                    tool: 'npm-audit',
                    config: {
                        auditLevel: 'low',
                        includeDevDependencies: true,
                        checkLicenses: true,
                        outputFormat: 'json'
                    },
                    condition: {
                        type: 'file-exists',
                        value: 'package.json'
                    }
                },
                {
                    name: 'advanced-static-analysis',
                    description: 'Advanced static code analysis',
                    tool: 'semgrep',
                    config: {
                        rules: ['security', 'performance', 'correctness'],
                        deep: true,
                        outputFormat: 'json'
                    }
                },
                {
                    name: 'comprehensive-contract-analysis',
                    description: 'Comprehensive smart contract analysis',
                    tool: 'slither',
                    config: {
                        detectors: 'all',
                        deep: true,
                        outputFormat: 'json'
                    },
                    condition: {
                        type: 'language-detected',
                        value: 'solidity'
                    }
                },
                {
                    name: 'mythx-deep-analysis',
                    description: 'MythX deep security analysis',
                    tool: 'mythx',
                    config: {
                        mode: 'deep',
                        timeout: 1800,
                        outputFormat: 'json'
                    },
                    condition: {
                        type: 'language-detected',
                        value: 'solidity'
                    },
                    timeout: 1800
                },
                {
                    name: 'comprehensive-testing',
                    description: 'Comprehensive test execution',
                    tool: 'test-runner',
                    config: {
                        framework: 'auto-detect',
                        includeIntegration: true,
                        includeFuzz: true,
                        coverage: true,
                        timeout: 900
                    }
                },
                {
                    name: 'performance-analysis',
                    description: 'Performance and gas optimization analysis',
                    tool: 'gas-analyzer',
                    config: {
                        comprehensive: true,
                        optimizationSuggestions: true
                    },
                    condition: {
                        type: 'language-detected',
                        value: 'solidity'
                    }
                }
            ],
            parallelSteps: [
                ['advanced-static-analysis', 'comprehensive-contract-analysis'],
                ['mythx-deep-analysis', 'performance-analysis']
            ]
        };
    }
    /**
     * Auto-select appropriate workflow based on codebase characteristics
     */
    static autoSelectWorkflow(codebaseType, detectedLanguages, detectedFrameworks, quickScan = false) {
        if (quickScan) {
            return this.getQuickScanWorkflow();
        }
        // Select based on codebase type and detected characteristics
        if (codebaseType === 'mixed' ||
            (detectedLanguages.includes('javascript') && detectedLanguages.includes('solidity'))) {
            return this.getMixedWorkflow();
        }
        if (codebaseType === 'solidity' || detectedLanguages.includes('solidity')) {
            return this.getSolidityWorkflow();
        }
        if (codebaseType === 'nodejs' ||
            detectedLanguages.includes('javascript') ||
            detectedLanguages.includes('typescript')) {
            return this.getNodeJSWorkflow();
        }
        // Default to quick scan for unknown types
        return this.getQuickScanWorkflow();
    }
}
exports.PredefinedWorkflows = PredefinedWorkflows;
//# sourceMappingURL=PredefinedWorkflows.js.map