/**
 * BlockchainAnalysisEngine - Specialized analysis for smart contracts and DeFi applications
 */
import { SecurityFinding, TestResult, PerformanceMetric } from '../types';
export interface ContractAnalysisResult {
    contractPath: string;
    findings: SecurityFinding[];
    gasMetrics?: PerformanceMetric[];
    compilationSuccess: boolean;
    errors?: string[];
}
export interface TransactionSimulation {
    functionName: string;
    parameters: any[];
    expectedResult?: any;
    gasLimit?: number;
}
export interface GasOptimizationReport {
    contractName: string;
    functionGasCosts: {
        [functionName: string]: number;
    };
    optimizationSuggestions: string[];
    totalGasUsed: number;
}
export declare class BlockchainAnalysisEngine {
    private docker;
    constructor();
    /**
     * Security analysis of smart contracts with Slither and MythX integration
     */
    analyzeSolidityContracts(containerId: string, contractPaths: string[]): Promise<ContractAnalysisResult[]>;
    /**
     * Execute contract test suites supporting Hardhat and Truffle frameworks
     */
    runContractTests(containerId: string, framework: 'hardhat' | 'truffle'): Promise<TestResult[]>;
    /**
     * Test contract behavior safely with local blockchain setup
     */
    simulateTransactions(containerId: string, scenarios: TransactionSimulation[]): Promise<TestResult[]>;
    /**
     * Analyze gas usage patterns and provide optimization suggestions
     */
    assessGasOptimization(containerId: string, contracts: string[]): Promise<GasOptimizationReport[]>;
    /**
     * Validates blockchain development environment setup
     */
    validateBlockchainEnvironment(containerId: string): Promise<boolean>;
    private ensureContainerRunning;
    private executeCommand;
    private installSolidityTools;
    private compileContract;
    private runSlitherAnalysis;
    private runMythXAnalysis;
    private runCustomSecurityChecks;
    private installTestFramework;
    private runHardhatTests;
    private runTruffleTests;
    private startLocalBlockchain;
    private deployContractsForTesting;
    private executeTransaction;
    private installGasAnalysisTools;
    private analyzeContractGasUsage;
    private checkToolAvailable;
    private checkPackageInstalled;
    private mapSlitherSeverity;
}
//# sourceMappingURL=BlockchainAnalysisEngine.d.ts.map