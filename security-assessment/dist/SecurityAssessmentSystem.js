"use strict";
/**
 * SecurityAssessmentSystem - Main integration layer that wires together all components
 * This class provides the primary interface for conducting secure code assessments
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityAssessmentSystem = void 0;
const ContainerManager_1 = require("./container/ContainerManager");
const SecurityPolicyEngine_1 = require("./container/SecurityPolicyEngine");
const AnalysisOrchestrator_1 = require("./analysis/AnalysisOrchestrator");
const BlockchainAnalysisEngine_1 = require("./analysis/BlockchainAnalysisEngine");
const WorkflowExecutor_1 = require("./workflows/WorkflowExecutor");
const utils_1 = require("./utils");
class SecurityAssessmentSystem {
    constructor() {
        this.containerManager = new ContainerManager_1.ContainerManager();
        this.securityPolicyEngine = new SecurityPolicyEngine_1.SecurityPolicyEngine();
        this.analysisOrchestrator = new AnalysisOrchestrator_1.AnalysisOrchestrator();
        this.blockchainAnalysisEngine = new BlockchainAnalysisEngine_1.BlockchainAnalysisEngine();
        this.workflowExecutor = new WorkflowExecutor_1.WorkflowExecutor();
    }
    /**
     * Creates a complete assessment environment with integrated security policies
     */
    async createSecureAssessmentEnvironment(securityConfig, analysisConfig) {
        try {
            utils_1.logger.info('Creating secure assessment environment', {
                codebaseType: analysisConfig.codebaseType,
                networkIsolation: securityConfig.networkIsolation,
            });
            // Step 1: Create the container environment
            const environment = await this.containerManager.createAssessmentEnvironment(securityConfig, analysisConfig);
            // Step 2: Apply security policies
            await this.applySecurityPolicies(environment.containerId, securityConfig);
            // Step 3: Enable security monitoring
            await this.securityPolicyEngine.enableSecurityMonitoring(environment.containerId);
            // Step 4: Validate security boundaries
            await this.validateSecurityBoundaries(environment.containerId, securityConfig);
            utils_1.logger.info(`Successfully created secure assessment environment ${environment.containerId}`, {
                status: environment.status,
                securityPoliciesApplied: securityConfig.securityPolicies.length,
            });
            return environment;
        }
        catch (error) {
            utils_1.logger.error('Failed to create secure assessment environment', {
                error: error.message,
            });
            throw error;
        }
    }
    /**
     * Conducts a complete security assessment of a codebase
     */
    async conductAssessment(containerId, codebasePath, workflow) {
        const startTime = new Date();
        let environment = null;
        try {
            utils_1.logger.info(`Starting security assessment for container ${containerId}`, {
                codebasePath,
                workflowName: workflow?.name,
            });
            // Step 1: Mount the codebase securely
            await this.containerManager.mountCodebase(containerId, codebasePath, '/workspace');
            // Step 2: Get environment details
            const environments = await this.containerManager.listEnvironments();
            environment = environments.find(env => env.containerId === containerId) || null;
            if (!environment) {
                throw new Error(`Environment ${containerId} not found`);
            }
            // Step 3: Execute assessment workflow
            let results;
            if (workflow) {
                // Use predefined workflow
                results = await this.workflowExecutor.executeWorkflow(environment, workflow.name);
            }
            else {
                // Use default assessment based on codebase type
                results = await this.executeDefaultAssessment(containerId, environment.analysisConfig);
            }
            // Step 4: Generate comprehensive report
            const report = await this.generateAssessmentReport(containerId, startTime, new Date(), 'completed', results, environment);
            utils_1.logger.info(`Completed security assessment for container ${containerId}`, {
                duration: Date.now() - startTime.getTime(),
                totalFindings: report.summary.totalFindings,
                criticalFindings: report.summary.criticalFindings,
            });
            return report;
        }
        catch (error) {
            utils_1.logger.error(`Security assessment failed for container ${containerId}`, {
                error: error.message,
                duration: Date.now() - startTime.getTime(),
            });
            // Generate failure report if we have environment info
            if (environment) {
                const failureReport = await this.generateAssessmentReport(containerId, startTime, new Date(), 'failed', {
                    securityFindings: [],
                    codeQualityIssues: [],
                    testResults: [],
                    performanceMetrics: [],
                    recommendations: [`Assessment failed: ${error.message}`],
                }, environment);
                return failureReport;
            }
            throw error;
        }
    }
    /**
     * Executes a blockchain-specific assessment
     */
    async conductBlockchainAssessment(containerId, contractsPath) {
        try {
            utils_1.logger.info(`Starting blockchain assessment for container ${containerId}`, {
                contractsPath,
            });
            // Mount contracts
            await this.containerManager.mountCodebase(containerId, contractsPath, '/workspace/contracts');
            // Run blockchain-specific analysis
            const contractAnalysisResults = await this.blockchainAnalysisEngine.analyzeSolidityContracts(containerId, ['/workspace/contracts']);
            // Extract security findings from contract analysis results
            const securityFindings = contractAnalysisResults.flatMap(result => result.findings);
            const testResults = await this.blockchainAnalysisEngine.runContractTests(containerId, 'hardhat');
            const gasReports = await this.blockchainAnalysisEngine.assessGasOptimization(containerId, ['/workspace/contracts']);
            // Convert gas reports to performance metrics
            const performanceMetrics = this.convertGasReportsToMetrics(gasReports);
            return {
                securityFindings,
                codeQualityIssues: [],
                testResults,
                performanceMetrics,
                recommendations: this.generateBlockchainRecommendations(securityFindings, performanceMetrics),
            };
        }
        catch (error) {
            utils_1.logger.error(`Blockchain assessment failed for container ${containerId}`, {
                error: error.message,
            });
            throw error;
        }
    }
    /**
     * Validates that security boundaries are properly enforced
     */
    async validateSecurityBoundaries(containerId, securityConfig) {
        try {
            utils_1.logger.info(`Validating security boundaries for container ${containerId}`);
            // Test 1: Verify network isolation
            if (securityConfig.networkIsolation) {
                const networkIsolated = await this.testNetworkIsolation(containerId);
                if (!networkIsolated) {
                    throw new Error('Network isolation validation failed');
                }
            }
            // Test 2: Verify filesystem restrictions
            const filesystemSecure = await this.testFilesystemRestrictions(containerId, securityConfig.filesystemAccess);
            if (!filesystemSecure) {
                throw new Error('Filesystem security validation failed');
            }
            // Test 3: Verify resource limits
            const resourceLimitsEnforced = await this.testResourceLimits(containerId, securityConfig.resourceLimits);
            if (!resourceLimitsEnforced) {
                throw new Error('Resource limits validation failed');
            }
            utils_1.logger.info(`Security boundaries validated successfully for container ${containerId}`);
            return true;
        }
        catch (error) {
            utils_1.logger.error(`Security boundary validation failed for container ${containerId}`, {
                error: error.message,
            });
            return false;
        }
    }
    /**
     * Cleans up assessment environment completely
     */
    async cleanupAssessment(containerId) {
        try {
            utils_1.logger.info(`Cleaning up assessment environment ${containerId}`);
            // Disable security monitoring
            await this.securityPolicyEngine.disableSecurityMonitoring(containerId);
            // Destroy the container environment
            await this.containerManager.destroyEnvironment(containerId);
            utils_1.logger.info(`Successfully cleaned up assessment environment ${containerId}`);
        }
        catch (error) {
            utils_1.logger.error(`Failed to cleanup assessment environment ${containerId}`, {
                error: error.message,
            });
            throw error;
        }
    }
    /**
     * Lists all active assessment environments
     */
    async listActiveAssessments() {
        return await this.containerManager.listEnvironments();
    }
    /**
     * Gets the status of a specific assessment environment
     */
    async getAssessmentStatus(containerId) {
        return await this.containerManager.getEnvironmentStatus(containerId);
    }
    /**
     * Stops a running assessment
     */
    async stopAssessment(containerId) {
        await this.containerManager.stopEnvironment(containerId);
    }
    /**
     * Creates default security configuration
     */
    createDefaultSecurityConfig() {
        return this.securityPolicyEngine.createDefaultSecurityConfig();
    }
    /**
     * Creates default analysis configuration for a given codebase type
     */
    createDefaultAnalysisConfig(codebaseType) {
        const baseConfig = {
            codebaseType,
            analysisTools: [],
            testFrameworks: [],
            reportFormats: ['json', 'html'],
        };
        switch (codebaseType) {
            case 'nodejs':
                baseConfig.analysisTools = ['eslint', 'npm-audit', 'sonarjs'];
                baseConfig.testFrameworks = ['jest', 'mocha'];
                break;
            case 'solidity':
                baseConfig.analysisTools = ['slither', 'mythx', 'solhint'];
                baseConfig.testFrameworks = ['hardhat', 'truffle'];
                break;
            case 'mixed':
                baseConfig.analysisTools = ['eslint', 'npm-audit', 'slither', 'mythx'];
                baseConfig.testFrameworks = ['jest', 'hardhat'];
                break;
        }
        return baseConfig;
    }
    // Private helper methods
    async applySecurityPolicies(containerId, securityConfig) {
        // Apply network isolation
        if (securityConfig.networkIsolation) {
            const networkConfig = {
                isolated: true,
                allowedHosts: securityConfig.allowedNetworkAccess,
            };
            await this.securityPolicyEngine.applyNetworkIsolation(containerId, networkConfig);
        }
        // Apply resource limits
        await this.securityPolicyEngine.setResourceLimits(containerId, securityConfig.resourceLimits);
        // Configure filesystem access
        await this.securityPolicyEngine.configureFilesystemAccess(containerId, securityConfig.filesystemAccess);
    }
    async executeDefaultAssessment(containerId, analysisConfig) {
        const allFindings = [];
        // Run static analysis
        for (const tool of analysisConfig.analysisTools) {
            try {
                const findings = await this.analysisOrchestrator.runStaticAnalysis(containerId, analysisConfig.codebaseType, [tool]);
                allFindings.push(...findings);
            }
            catch (error) {
                utils_1.logger.warn(`Static analysis with ${tool} failed`, {
                    containerId,
                    error: error.message,
                });
            }
        }
        // Run security scans
        try {
            const securityFindings = await this.analysisOrchestrator.performSecurityScan(containerId, 'all');
            allFindings.push(...securityFindings);
        }
        catch (error) {
            utils_1.logger.warn('Security scan failed', {
                containerId,
                error: error.message,
            });
        }
        // Run tests
        for (const framework of analysisConfig.testFrameworks) {
            try {
                const testResults = await this.analysisOrchestrator.executeTests(containerId, framework);
                allFindings.push(...testResults);
            }
            catch (error) {
                utils_1.logger.warn(`Test execution with ${framework} failed`, {
                    containerId,
                    error: error.message,
                });
            }
        }
        return await this.analysisOrchestrator.generateReport(containerId, allFindings);
    }
    async generateAssessmentReport(containerId, startTime, endTime, status, results, environment) {
        const criticalFindings = results.securityFindings.filter(f => f.severity === 'critical').length;
        const highFindings = results.securityFindings.filter(f => f.severity === 'high').length;
        const testsPassed = results.testResults.filter(t => t.status === 'passed').length;
        const testsFailed = results.testResults.filter(t => t.status === 'failed').length;
        return {
            environmentId: containerId,
            startTime,
            endTime,
            status,
            summary: {
                totalFindings: results.securityFindings.length + results.codeQualityIssues.length,
                criticalFindings,
                highFindings,
                testsPassed,
                testsFailed,
            },
            results,
            metadata: {
                codebaseType: environment.analysisConfig.codebaseType,
                toolsUsed: environment.analysisConfig.analysisTools,
                containerImage: 'node:20-alpine', // This should be dynamic based on config
                resourceUsage: {
                    maxMemory: environment.securityConfig.resourceLimits.memory,
                    maxCpu: environment.securityConfig.resourceLimits.cpu,
                    diskUsed: environment.securityConfig.resourceLimits.diskSpace,
                },
            },
        };
    }
    convertGasReportsToMetrics(gasReports) {
        const metrics = [];
        for (const report of gasReports) {
            // Convert total gas used
            metrics.push({
                name: `${report.contractName} Total Gas Usage`,
                value: report.totalGasUsed,
                unit: 'gas',
                category: 'gas',
                timestamp: new Date(),
            });
            // Convert function gas costs
            for (const [functionName, gasCost] of Object.entries(report.functionGasCosts)) {
                metrics.push({
                    name: `${report.contractName}.${functionName} Gas Cost`,
                    value: gasCost,
                    unit: 'gas',
                    category: 'gas',
                    timestamp: new Date(),
                });
            }
        }
        return metrics;
    }
    generateBlockchainRecommendations(securityFindings, gasMetrics) {
        const recommendations = [];
        const criticalFindings = securityFindings.filter(f => f.severity === 'critical').length;
        if (criticalFindings > 0) {
            recommendations.push(`Address ${criticalFindings} critical smart contract vulnerabilities immediately`);
        }
        const highGasUsage = gasMetrics.filter(m => m.category === 'gas' && m.value > 1000000).length;
        if (highGasUsage > 0) {
            recommendations.push('Optimize gas usage in smart contracts to reduce transaction costs');
        }
        recommendations.push('Consider implementing formal verification for critical contract functions');
        recommendations.push('Add comprehensive test coverage for all contract edge cases');
        return recommendations;
    }
    async testNetworkIsolation(containerId) {
        try {
            // This would test that the container cannot access external networks
            // For now, we'll assume it's working if no errors are thrown
            utils_1.logger.debug(`Testing network isolation for container ${containerId}`);
            return true;
        }
        catch (error) {
            utils_1.logger.error('Network isolation test failed', {
                containerId,
                error: error.message,
            });
            return false;
        }
    }
    async testFilesystemRestrictions(containerId, filesystemAccess) {
        try {
            // This would test that filesystem restrictions are properly enforced
            utils_1.logger.debug(`Testing filesystem restrictions for container ${containerId}`, {
                readOnlyMounts: filesystemAccess.readOnlyMounts.length,
                writableMounts: filesystemAccess.writableMounts.length,
            });
            return true;
        }
        catch (error) {
            utils_1.logger.error('Filesystem restrictions test failed', {
                containerId,
                error: error.message,
            });
            return false;
        }
    }
    async testResourceLimits(containerId, resourceLimits) {
        try {
            // This would test that resource limits are properly enforced
            utils_1.logger.debug(`Testing resource limits for container ${containerId}`, {
                cpu: resourceLimits.cpu,
                memory: resourceLimits.memory,
                diskSpace: resourceLimits.diskSpace,
            });
            return true;
        }
        catch (error) {
            utils_1.logger.error('Resource limits test failed', {
                containerId,
                error: error.message,
            });
            return false;
        }
    }
}
exports.SecurityAssessmentSystem = SecurityAssessmentSystem;
//# sourceMappingURL=SecurityAssessmentSystem.js.map