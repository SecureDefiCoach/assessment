/**
 * Complete Assessment Example
 * Demonstrates the full integration of all system components
 */

import { SecurityAssessmentSystem } from '../src/SecurityAssessmentSystem';
import { SecurityConfiguration, AnalysisConfiguration, AssessmentWorkflow } from '../src/types';
import * as path from 'path';

async function runCompleteAssessmentExample() {
  console.log('🚀 Starting Complete Security Assessment Example');
  
  // Initialize the integrated assessment system
  const assessmentSystem = new SecurityAssessmentSystem();

  try {
    // Step 1: Create custom security configuration
    console.log('\n📋 Step 1: Creating Security Configuration');
    const securityConfig: SecurityConfiguration = {
      networkIsolation: true,
      allowedNetworkAccess: ['registry.npmjs.org', 'github.com'],
      resourceLimits: {
        cpu: '2.0',
        memory: '1g',
        diskSpace: '2g',
      },
      filesystemAccess: {
        readOnlyMounts: ['/code'],
        writableMounts: ['/tmp', '/output', '/workspace'],
      },
      securityPolicies: [
        'no-privileged',
        'no-host-network',
        'no-host-pid',
        'no-new-privileges'
      ],
    };

    console.log('✅ Security configuration created:', {
      networkIsolation: securityConfig.networkIsolation,
      resourceLimits: securityConfig.resourceLimits,
      securityPolicies: securityConfig.securityPolicies.length,
    });

    // Step 2: Create analysis configuration for mixed codebase
    console.log('\n📋 Step 2: Creating Analysis Configuration');
    const analysisConfig: AnalysisConfiguration = {
      codebaseType: 'mixed',
      analysisTools: [
        'eslint',
        'npm-audit',
        'sonarjs',
        'slither',
        'mythx',
        'solhint'
      ],
      testFrameworks: ['jest', 'hardhat', 'truffle'],
      reportFormats: ['json', 'html', 'sarif'],
      customWorkflows: ['defi-assessment', 'security-comprehensive'],
    };

    console.log('✅ Analysis configuration created:', {
      codebaseType: analysisConfig.codebaseType,
      analysisTools: analysisConfig.analysisTools.length,
      testFrameworks: analysisConfig.testFrameworks.length,
    });

    // Step 3: Create secure assessment environment
    console.log('\n🔒 Step 3: Creating Secure Assessment Environment');
    const environment = await assessmentSystem.createSecureAssessmentEnvironment(
      securityConfig,
      analysisConfig
    );

    console.log('✅ Environment created successfully:', {
      containerId: environment.containerId,
      status: environment.status,
      createdAt: environment.createdAt.toISOString(),
    });

    // Step 4: Validate security boundaries
    console.log('\n🛡️ Step 4: Validating Security Boundaries');
    const boundariesValid = await assessmentSystem.validateSecurityBoundaries(
      environment.containerId,
      securityConfig
    );

    if (boundariesValid) {
      console.log('✅ Security boundaries validated successfully');
    } else {
      throw new Error('Security boundary validation failed');
    }

    // Step 5: Conduct comprehensive assessment
    console.log('\n🔍 Step 5: Conducting Comprehensive Assessment');
    const codebasePath = path.resolve(__dirname, '../../'); // Assess the current project
    
    console.log(`📁 Assessing codebase at: ${codebasePath}`);
    
    const assessmentReport = await assessmentSystem.conductAssessment(
      environment.containerId,
      codebasePath
    );

    console.log('✅ Assessment completed:', {
      status: assessmentReport.status,
      duration: assessmentReport.endTime.getTime() - assessmentReport.startTime.getTime(),
      totalFindings: assessmentReport.summary.totalFindings,
      criticalFindings: assessmentReport.summary.criticalFindings,
      highFindings: assessmentReport.summary.highFindings,
    });

    // Step 6: Display detailed results
    console.log('\n📊 Step 6: Assessment Results Summary');
    displayAssessmentResults(assessmentReport);

    // Step 7: Demonstrate blockchain assessment (if contracts exist)
    const contractsPath = path.resolve(__dirname, '../../contracts');
    if (require('fs').existsSync(contractsPath)) {
      console.log('\n⛓️ Step 7: Conducting Blockchain Assessment');
      
      const blockchainResults = await assessmentSystem.conductBlockchainAssessment(
        environment.containerId,
        contractsPath
      );

      console.log('✅ Blockchain assessment completed:', {
        securityFindings: blockchainResults.securityFindings.length,
        testResults: blockchainResults.testResults.length,
        gasMetrics: blockchainResults.performanceMetrics.filter(m => m.category === 'gas').length,
      });

      displayBlockchainResults(blockchainResults);
    }

    // Step 8: Demonstrate environment management
    console.log('\n🎛️ Step 8: Environment Management');
    
    const activeEnvironments = await assessmentSystem.listActiveAssessments();
    console.log(`📋 Active environments: ${activeEnvironments.length}`);
    
    const status = await assessmentSystem.getAssessmentStatus(environment.containerId);
    console.log(`📊 Environment status: ${status}`);

    // Step 9: Cleanup
    console.log('\n🧹 Step 9: Cleaning Up Assessment Environment');
    await assessmentSystem.cleanupAssessment(environment.containerId);
    console.log('✅ Environment cleaned up successfully');

    console.log('\n🎉 Complete Assessment Example Finished Successfully!');

  } catch (error) {
    console.error('\n❌ Assessment Example Failed:', error);
    throw error;
  }
}

function displayAssessmentResults(report: any) {
  console.log('\n📈 Security Findings:');
  const findingsBySeverity = report.results.securityFindings.reduce((acc: any, finding: any) => {
    acc[finding.severity] = (acc[finding.severity] || 0) + 1;
    return acc;
  }, {});

  Object.entries(findingsBySeverity).forEach(([severity, count]) => {
    console.log(`  ${getSeverityIcon(severity)} ${severity}: ${count}`);
  });

  console.log('\n🔧 Code Quality Issues:');
  const qualityBySeverity = report.results.codeQualityIssues.reduce((acc: any, issue: any) => {
    acc[issue.severity] = (acc[issue.severity] || 0) + 1;
    return acc;
  }, {});

  Object.entries(qualityBySeverity).forEach(([severity, count]) => {
    console.log(`  ${getSeverityIcon(severity)} ${severity}: ${count}`);
  });

  console.log('\n🧪 Test Results:');
  const testsByStatus = report.results.testResults.reduce((acc: any, test: any) => {
    acc[test.status] = (acc[test.status] || 0) + 1;
    return acc;
  }, {});

  Object.entries(testsByStatus).forEach(([status, count]) => {
    console.log(`  ${getTestStatusIcon(status)} ${status}: ${count}`);
  });

  console.log('\n💡 Top Recommendations:');
  report.results.recommendations.slice(0, 3).forEach((rec: string, index: number) => {
    console.log(`  ${index + 1}. ${rec}`);
  });

  console.log('\n📋 Metadata:');
  console.log(`  🏗️ Codebase Type: ${report.metadata.codebaseType}`);
  console.log(`  🔧 Tools Used: ${report.metadata.toolsUsed.join(', ')}`);
  console.log(`  🐳 Container Image: ${report.metadata.containerImage}`);
  console.log(`  💾 Resource Usage:`);
  console.log(`    CPU: ${report.metadata.resourceUsage.maxCpu}`);
  console.log(`    Memory: ${report.metadata.resourceUsage.maxMemory}`);
  console.log(`    Disk: ${report.metadata.resourceUsage.diskUsed}`);
}

function displayBlockchainResults(results: any) {
  console.log('\n⛓️ Blockchain Assessment Results:');
  
  console.log('\n🔒 Smart Contract Security:');
  const contractFindings = results.securityFindings.filter((f: any) => 
    f.category === 'smart-contract' || f.tool.includes('slither') || f.tool.includes('mythx')
  );
  
  contractFindings.slice(0, 5).forEach((finding: any, index: number) => {
    console.log(`  ${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`);
    console.log(`     📁 ${finding.location.file}:${finding.location.line || 'N/A'}`);
  });

  console.log('\n⛽ Gas Optimization:');
  const gasMetrics = results.performanceMetrics.filter((m: any) => m.category === 'gas');
  gasMetrics.slice(0, 3).forEach((metric: any, index: number) => {
    console.log(`  ${index + 1}. ${metric.name}: ${metric.value} ${metric.unit}`);
  });

  console.log('\n🧪 Contract Tests:');
  const contractTests = results.testResults.filter((t: any) => 
    t.framework === 'hardhat' || t.framework === 'truffle'
  );
  
  const contractTestsByStatus = contractTests.reduce((acc: any, test: any) => {
    acc[test.status] = (acc[test.status] || 0) + 1;
    return acc;
  }, {});

  Object.entries(contractTestsByStatus).forEach(([status, count]) => {
    console.log(`  ${getTestStatusIcon(status)} ${status}: ${count}`);
  });
}

function getSeverityIcon(severity: string): string {
  const icons: Record<string, string> = {
    critical: '🚨',
    high: '🔴',
    medium: '🟡',
    low: '🟢',
    info: 'ℹ️',
    error: '❌',
    warning: '⚠️',
  };
  return icons[severity] || '📋';
}

function getTestStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    passed: '✅',
    failed: '❌',
    skipped: '⏭️',
  };
  return icons[status] || '📋';
}

// Example of creating a custom workflow
function createCustomWorkflow(): AssessmentWorkflow {
  return {
    name: 'comprehensive-defi-assessment',
    description: 'Comprehensive security assessment for DeFi applications',
    codebaseType: 'mixed',
    requiredTools: ['eslint', 'slither', 'hardhat', 'npm'],
    steps: [
      {
        name: 'install-dependencies',
        type: 'build',
        command: ['npm', 'install'],
        timeout: 300000, // 5 minutes
        continueOnError: false,
        outputCapture: true,
      },
      {
        name: 'lint-javascript',
        type: 'analysis',
        command: ['npx', 'eslint', '.', '--format', 'json'],
        timeout: 120000, // 2 minutes
        continueOnError: true,
        outputCapture: true,
      },
      {
        name: 'audit-dependencies',
        type: 'analysis',
        command: ['npm', 'audit', '--json'],
        timeout: 60000, // 1 minute
        continueOnError: true,
        outputCapture: true,
      },
      {
        name: 'analyze-contracts',
        type: 'analysis',
        command: ['slither', 'contracts/', '--json', '-'],
        timeout: 180000, // 3 minutes
        continueOnError: true,
        outputCapture: true,
      },
      {
        name: 'run-contract-tests',
        type: 'test',
        command: ['npx', 'hardhat', 'test'],
        timeout: 300000, // 5 minutes
        continueOnError: true,
        outputCapture: true,
      },
      {
        name: 'gas-analysis',
        type: 'analysis',
        command: ['npx', 'hardhat', 'test', '--gas-reporter'],
        timeout: 300000, // 5 minutes
        continueOnError: true,
        outputCapture: true,
      },
    ],
  };
}

// Run the example if this file is executed directly
if (require.main === module) {
  runCompleteAssessmentExample()
    .then(() => {
      console.log('\n✨ Example completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Example failed:', error);
      process.exit(1);
    });
}

export { runCompleteAssessmentExample, createCustomWorkflow };