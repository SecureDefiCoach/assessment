# Security Assessment Container - Base Image
# Multi-stage build for security and minimal attack surface

# Build stage for tools compilation
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Install global tools that need compilation
RUN npm install -g \
    hardhat \
    truffle \
    @truffle/hdwallet-provider \
    slither-analyzer \
    mythx-cli \
    solhint \
    prettier \
    eslint

# Production stage - minimal base image
FROM node:20-alpine AS production

# Security hardening - create non-root user
RUN addgroup -g 1001 -S assessor && \
    adduser -S assessor -u 1001 -G assessor

# Install runtime dependencies and security tools
RUN apk add --no-cache \
    # Basic utilities
    curl \
    wget \
    git \
    # Python for analysis tools
    python3 \
    py3-pip \
    # Security and analysis tools
    bash \
    jq \
    # Clean up
    && rm -rf /var/cache/apk/* \
    && rm -rf /tmp/*

# Install Python security tools
RUN pip3 install --no-cache-dir \
    slither-analyzer \
    mythril \
    bandit \
    safety \
    semgrep

# Copy compiled tools from builder stage
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=builder /usr/local/bin /usr/local/bin

# Create secure directory structure
RUN mkdir -p /app/workspace /app/results /app/tools /app/config && \
    chown -R assessor:assessor /app

# Set up workspace with restricted permissions
WORKDIR /app/workspace

# Copy package.json for npm audit capabilities
COPY --chown=assessor:assessor package*.json ./

# Install additional Node.js security tools
RUN npm install --global \
    npm-audit-resolver \
    retire \
    nsp \
    snyk \
    audit-ci \
    && npm cache clean --force

# Security configurations
# Disable unnecessary services and reduce attack surface
RUN rm -rf /usr/share/man/* \
    /usr/share/doc/* \
    /var/cache/apk/* \
    /tmp/* \
    /var/tmp/*

# Set security-focused environment variables
ENV NODE_ENV=production
ENV NPM_CONFIG_AUDIT_LEVEL=moderate
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Switch to non-root user
USER assessor

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node --version || exit 1

# Default command
CMD ["/bin/sh"]

# Security labels
LABEL security.scan="enabled" \
      security.user="non-root" \
      security.network="isolated" \
      maintainer="security-assessment-team"