# Docker Container Configurations

This directory contains Docker configurations for the Security Assessment Container system, providing isolated environments for safely analyzing untrusted code.

## Container Images

### Base Security Assessment Container (`Dockerfile`)
- **Purpose**: General-purpose security analysis container
- **Base Image**: `node:20-alpine`
- **Security Features**:
  - Non-root user execution
  - Minimal attack surface
  - Network isolation
  - Resource limits
- **Included Tools**:
  - Node.js security scanners (npm audit, retire, snyk)
  - Python security tools (bandit, safety, semgrep)
  - Static analysis tools (ESLint)
  - General security utilities

### Blockchain Assessment Container (`Dockerfile.blockchain`)
- **Purpose**: Specialized container for smart contract analysis
- **Base Image**: `node:20-alpine`
- **Additional Features**:
  - Solidity compiler (solc)
  - Hardhat and Truffle frameworks
  - Blockchain security scanners (Slither, Mythril)
  - Local blockchain simulation
- **Specialized Tools**:
  - Smart contract analyzers
  - Gas optimization tools
  - Contract testing frameworks

## Container Orchestration

### Docker Compose Configuration (`docker-compose.yml`)
Defines the complete isolated environment with:

- **Security Assessment Service**: Main analysis container
- **Blockchain Assessment Service**: Specialized blockchain container
- **Network Monitor Service**: Optional network monitoring
- **Isolated Networks**: Completely isolated from external access
- **Secure Volume Mounts**: Read-only code mounts, writable results
- **Resource Limits**: CPU, memory, and disk constraints

### Development Override (`docker-compose.override.yml`)
Development-specific configuration that adds:

- **Controlled External Access**: Proxy for package downloads
- **Interactive Mode**: TTY and stdin for debugging
- **Development Tools**: Additional debugging utilities
- **Relaxed Security**: Some restrictions lifted for development

## Security Features

### Network Isolation
- **Default**: Complete network isolation (no internet access)
- **Development**: Controlled proxy access for package installation
- **Monitoring**: All network activity logged and monitored

### Filesystem Security
- **Code Mounts**: Read-only access to source code
- **Results**: Writable access only to results directory
- **Temporary Files**: Isolated temporary filesystem
- **No Host Access**: Cannot access host filesystem outside mounts

### User Security
- **Non-root Execution**: All containers run as non-privileged users
- **User Namespaces**: Isolated user context
- **No New Privileges**: Cannot escalate privileges
- **Restricted Capabilities**: Minimal Linux capabilities

### Resource Limits
- **CPU**: Limited to prevent resource exhaustion
- **Memory**: Bounded memory usage
- **Disk**: Limited temporary storage
- **Time**: Analysis timeout protection

## Usage

### Quick Start
```bash
# Build containers
./scripts/manage-environment.sh build

# Start security assessment
./scripts/manage-environment.sh start-security --codebase /path/to/code

# Start blockchain assessment
./scripts/manage-environment.sh start-blockchain --contracts /path/to/contracts

# Check status
./scripts/manage-environment.sh status

# View logs
./scripts/manage-environment.sh logs

# Stop containers
./scripts/manage-environment.sh stop
```

### Development Mode
```bash
# Start with development configuration (allows controlled network access)
./scripts/manage-environment.sh start-all --dev

# Open shell for debugging
./scripts/manage-environment.sh shell security-assessment-main
```

### Environment Configuration
1. Copy `config/environment.env.template` to `.env`
2. Customize paths and settings
3. Use with Docker Compose: `docker-compose --env-file .env up`

## Scripts

### `scripts/setup-environment.sh`
- Verifies tool installation
- Configures analysis environment
- Sets up security policies
- Creates necessary directories

### `scripts/container-startup.sh`
- Container initialization script
- Environment variable setup
- Tool verification
- Health monitoring

### `scripts/manage-environment.sh`
- Complete environment management
- Container lifecycle operations
- Development and production modes
- Logging and monitoring

## Security Considerations

### Production Deployment
- **Network Isolation**: Ensure complete network isolation
- **Resource Monitoring**: Monitor resource usage
- **Log Analysis**: Review security logs regularly
- **Image Updates**: Keep base images updated
- **Vulnerability Scanning**: Scan container images

### Development Usage
- **Limited Network**: Even in dev mode, network access is controlled
- **Proxy Logs**: Monitor proxy access logs
- **Temporary Data**: Clean up development data regularly
- **Access Control**: Limit who can use development mode

## Troubleshooting

### Common Issues

1. **Container Won't Start**
   - Check Docker daemon is running
   - Verify image build completed successfully
   - Check resource availability (CPU, memory, disk)

2. **Permission Errors**
   - Ensure mounted directories have correct permissions
   - Check user ID mapping (should be 1001:1001)
   - Verify SELinux/AppArmor policies if applicable

3. **Network Issues**
   - Verify network isolation is working
   - Check proxy configuration in development mode
   - Review network monitoring logs

4. **Tool Failures**
   - Check tool installation in container
   - Verify tool-specific configuration
   - Review analysis logs for errors

### Debugging
```bash
# Check container health
docker ps
docker inspect <container-name>

# View detailed logs
docker logs -f <container-name>

# Open shell for investigation
docker exec -it <container-name> /bin/sh

# Check resource usage
docker stats <container-name>
```

## Maintenance

### Regular Tasks
- Update base images monthly
- Review security logs weekly
- Clean up unused containers and volumes
- Update analysis tools and configurations

### Security Updates
- Monitor security advisories for base images
- Update Node.js and Python dependencies
- Review and update security policies
- Test isolation boundaries regularly

## Contributing

When modifying container configurations:

1. **Security First**: Maintain security boundaries
2. **Minimal Changes**: Keep containers minimal
3. **Documentation**: Update this README
4. **Testing**: Test in isolated environment
5. **Review**: Have security review for changes