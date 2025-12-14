/**
 * Core type definitions for the Security Assessment Container system
 */

export interface AssessmentEnvironment {
  containerId: string;
  status: 'creating' | 'ready' | 'analyzing' | 'completed' | 'failed';
  securityConfig: SecurityConfiguration;
  analysisConfig: AnalysisConfiguration;
  createdAt: Date;
  completedAt?: Date;
  results?: AnalysisResults;
}

export interface SecurityConfiguration {
  networkIsolation: boolean;
  allowedNetworkAccess: string[];
  resourceLimits: {
    cpu: string;
    memory: string;
    diskSpace: string;
  };
  filesystemAccess: {
    readOnlyMounts: string[];
    writableMounts: string[];
  };
  securityPolicies: string[];
}

export interface AnalysisConfiguration {
  codebaseType: 'nodejs' | 'solidity' | 'mixed';
  analysisTools: string[];
  testFrameworks: string[];
  reportFormats: string[];
  customWorkflows?: string[];
}

export interface AnalysisResults {
  securityFindings: SecurityFinding[];
  codeQualityIssues: CodeQualityIssue[];
  testResults: TestResult[];
  performanceMetrics: PerformanceMetric[];
  recommendations: string[];
}

export interface SecurityFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  location: {
    file: string;
    line?: number;
    column?: number;
  };
  tool: string;
  category: string;
  recommendation?: string;
}

export interface CodeQualityIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  location: {
    file: string;
    line?: number;
    column?: number;
  };
  rule: string;
  tool: string;
}

export interface TestResult {
  suite: string;
  test: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  framework: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  category: 'memory' | 'cpu' | 'disk' | 'network' | 'gas';
  timestamp: Date;
}

export interface ContainerConfig {
  image: string;
  name: string;
  securityConfig: SecurityConfiguration;
  environmentVariables: Record<string, string>;
  workingDirectory: string;
  command?: string[];
}

export interface MountPoint {
  source: string;
  target: string;
  readonly: boolean;
}

export interface NetworkConfig {
  isolated: boolean;
  allowedHosts: string[];
  proxyConfig?: {
    host: string;
    port: number;
    allowedDomains: string[];
  };
}

export interface WorkflowStep {
  name: string;
  type: 'analysis' | 'test' | 'build' | 'custom';
  command: string[];
  timeout: number;
  continueOnError: boolean;
  outputCapture: boolean;
}

export interface AssessmentWorkflow {
  name: string;
  description: string;
  codebaseType: AnalysisConfiguration['codebaseType'];
  steps: WorkflowStep[];
  requiredTools: string[];
}

export interface AssessmentReport {
  environmentId: string;
  startTime: Date;
  endTime: Date;
  status: 'completed' | 'failed' | 'partial';
  summary: {
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    testsPassed: number;
    testsFailed: number;
  };
  results: AnalysisResults;
  metadata: {
    codebaseType: string;
    toolsUsed: string[];
    containerImage: string;
    resourceUsage: {
      maxMemory: string;
      maxCpu: string;
      diskUsed: string;
    };
  };
}

export interface NetworkActivity {
  timestamp: Date;
  containerId: string;
  sourceIp: string;
  destinationIp: string;
  destinationPort: number;
  protocol: 'tcp' | 'udp' | 'icmp';
  action: 'allowed' | 'blocked' | 'suspicious';
  bytes: number;
  reason?: string;
}

export interface NetworkMonitoringConfig {
  enabled: boolean;
  logAllConnections: boolean;
  suspiciousPatterns: SuspiciousPattern[];
  alertThresholds: {
    connectionsPerMinute: number;
    bytesPerMinute: number;
    uniqueDestinations: number;
  };
}

export interface SuspiciousPattern {
  name: string;
  description: string;
  pattern: {
    destinationPorts?: number[];
    protocols?: string[];
    ipRanges?: string[];
    domainPatterns?: string[];
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ProxyConfig {
  enabled: boolean;
  host: string;
  port: number;
  allowedDomains: string[];
  allowedPorts: number[];
  authentication?: {
    username: string;
    password: string;
  };
}

export interface ExternalResourceConfig {
  allowedRegistries: string[];
  integrityValidation: boolean;
  checksumAlgorithm: 'sha256' | 'sha512';
  maxDownloadSize: string;
  timeout: number;
}