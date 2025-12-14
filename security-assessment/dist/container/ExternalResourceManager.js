"use strict";
/**
 * ExternalResourceManager - Manages secure access to external resources with validation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalResourceManager = void 0;
const dockerode_1 = __importDefault(require("dockerode"));
class ExternalResourceManager {
    constructor(config, proxyConfig) {
        this.docker = new dockerode_1.default();
        this.config = config;
        this.proxyConfig = proxyConfig;
    }
    /**
     * Downloads and validates external dependencies safely
     */
    async downloadDependency(containerId, packageName, version, expectedChecksum) {
        try {
            const container = this.docker.getContainer(containerId);
            // Validate package registry is allowed
            if (!this.isRegistryAllowed(packageName)) {
                throw new Error(`Package registry not allowed for: ${packageName}`);
            }
            // Setup proxy if configured
            if (this.proxyConfig?.enabled) {
                await this.configureProxy(containerId);
            }
            // Download package with size limits
            const downloadPath = `/tmp/downloads/${packageName}-${version}`;
            await this.createDownloadDirectory(containerId, downloadPath);
            const downloadCommand = this.buildDownloadCommand(packageName, version, downloadPath);
            const exec = await container.exec({
                Cmd: downloadCommand,
                AttachStdout: true,
                AttachStderr: true,
            });
            const stream = await exec.start({ hijack: true, stdin: false });
            // Monitor download progress and enforce size limits
            let downloadSize = 0;
            const maxSize = this.parseSize(this.config.maxDownloadSize);
            stream.on('data', (chunk) => {
                downloadSize += chunk.length;
                if (downloadSize > maxSize) {
                    stream.destroy();
                    throw new Error(`Download size exceeded limit: ${this.config.maxDownloadSize}`);
                }
            });
            await new Promise((resolve, reject) => {
                stream.on('end', resolve);
                stream.on('error', reject);
                // Enforce timeout
                setTimeout(() => {
                    stream.destroy();
                    reject(new Error(`Download timeout exceeded: ${this.config.timeout}ms`));
                }, this.config.timeout);
            });
            // Validate integrity if checksum provided
            if (expectedChecksum && this.config.integrityValidation) {
                const isValid = await this.validateIntegrity(containerId, downloadPath, expectedChecksum);
                if (!isValid) {
                    await this.cleanupDownload(containerId, downloadPath);
                    throw new Error(`Integrity validation failed for ${packageName}@${version}`);
                }
            }
            console.log(`Successfully downloaded and validated ${packageName}@${version}`);
            return true;
        }
        catch (error) {
            console.error(`Failed to download dependency ${packageName}@${version}:`, error);
            throw error;
        }
    }
    /**
     * Installs npm packages with security validation
     */
    async installNpmPackages(containerId, packages) {
        try {
            const container = this.docker.getContainer(containerId);
            // Validate all packages are from allowed registries
            for (const pkg of packages) {
                if (!this.isRegistryAllowed(pkg)) {
                    throw new Error(`Package not from allowed registry: ${pkg}`);
                }
            }
            // Setup proxy for npm if configured
            if (this.proxyConfig?.enabled) {
                await this.configureNpmProxy(containerId);
            }
            // Create secure npm configuration
            await this.createSecureNpmConfig(containerId);
            // Install packages with security audit
            const installCommand = [
                'sh', '-c',
                `npm install --no-save --audit --audit-level=moderate ${packages.join(' ')} && npm audit --audit-level=moderate`
            ];
            const exec = await container.exec({
                Cmd: installCommand,
                AttachStdout: true,
                AttachStderr: true,
                WorkingDir: '/tmp/install'
            });
            const stream = await exec.start({ hijack: true, stdin: false });
            let output = '';
            stream.on('data', (chunk) => {
                output += chunk.toString();
            });
            await new Promise((resolve, reject) => {
                stream.on('end', () => {
                    // Check for security vulnerabilities in output
                    if (output.includes('vulnerabilities found') && output.includes('high') || output.includes('critical')) {
                        reject(new Error('Security vulnerabilities found in dependencies'));
                    }
                    else {
                        resolve(void 0);
                    }
                });
                stream.on('error', reject);
                setTimeout(() => {
                    stream.destroy();
                    reject(new Error('npm install timeout'));
                }, this.config.timeout);
            });
            console.log(`Successfully installed npm packages: ${packages.join(', ')}`);
        }
        catch (error) {
            console.error(`Failed to install npm packages:`, error);
            throw error;
        }
    }
    /**
     * Downloads and validates container images
     */
    async pullContainerImage(imageName, expectedDigest) {
        try {
            // Validate image registry is allowed
            if (!this.isImageRegistryAllowed(imageName)) {
                throw new Error(`Image registry not allowed: ${imageName}`);
            }
            // Pull image with timeout
            const pullStream = await this.docker.pull(imageName);
            await new Promise((resolve, reject) => {
                let timeoutId;
                this.docker.modem.followProgress(pullStream, (err, res) => {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(res);
                    }
                });
                timeoutId = setTimeout(() => {
                    reject(new Error('Image pull timeout'));
                }, this.config.timeout);
            });
            // Validate image digest if provided
            if (expectedDigest && this.config.integrityValidation) {
                const image = this.docker.getImage(imageName);
                const imageInfo = await image.inspect();
                if (imageInfo.RepoDigests && !imageInfo.RepoDigests.includes(expectedDigest)) {
                    await image.remove();
                    throw new Error(`Image digest validation failed for ${imageName}`);
                }
            }
            console.log(`Successfully pulled and validated image: ${imageName}`);
        }
        catch (error) {
            console.error(`Failed to pull container image ${imageName}:`, error);
            throw error;
        }
    }
    /**
     * Validates file integrity using checksums
     */
    async validateIntegrity(containerId, filePath, expectedChecksum) {
        try {
            const container = this.docker.getContainer(containerId);
            const algorithm = this.config.checksumAlgorithm;
            const checksumCommand = [
                'sh', '-c',
                `${algorithm}sum ${filePath} | cut -d' ' -f1`
            ];
            const exec = await container.exec({
                Cmd: checksumCommand,
                AttachStdout: true,
                AttachStderr: true,
            });
            const stream = await exec.start({ hijack: true, stdin: false });
            let actualChecksum = '';
            stream.on('data', (chunk) => {
                actualChecksum += chunk.toString().trim();
            });
            await new Promise((resolve, reject) => {
                stream.on('end', resolve);
                stream.on('error', reject);
            });
            const isValid = actualChecksum === expectedChecksum;
            if (!isValid) {
                console.warn(`Checksum mismatch for ${filePath}: expected ${expectedChecksum}, got ${actualChecksum}`);
            }
            return isValid;
        }
        catch (error) {
            console.error(`Failed to validate integrity for ${filePath}:`, error);
            return false;
        }
    }
    /**
     * Checks if a package registry is allowed
     */
    isRegistryAllowed(packageName) {
        // Extract registry from package name (e.g., @scope/package or package)
        const registry = this.extractRegistry(packageName);
        return this.config.allowedRegistries.some(allowed => registry.includes(allowed) || allowed === '*');
    }
    /**
     * Checks if an image registry is allowed
     */
    isImageRegistryAllowed(imageName) {
        const registry = imageName.includes('/') ? imageName.split('/')[0] : 'docker.io';
        return this.config.allowedRegistries.some(allowed => registry.includes(allowed) || allowed === '*');
    }
    /**
     * Extracts registry information from package name
     */
    extractRegistry(packageName) {
        // For scoped packages like @scope/package, assume npm registry
        if (packageName.startsWith('@')) {
            return 'registry.npmjs.org';
        }
        // For other packages, assume npm registry by default
        return 'registry.npmjs.org';
    }
    /**
     * Configures proxy settings in container
     */
    async configureProxy(containerId) {
        if (!this.proxyConfig?.enabled) {
            return;
        }
        const container = this.docker.getContainer(containerId);
        const proxyUrl = `http://${this.proxyConfig.host}:${this.proxyConfig.port}`;
        const proxyCommands = [
            `export http_proxy=${proxyUrl}`,
            `export https_proxy=${proxyUrl}`,
            `export HTTP_PROXY=${proxyUrl}`,
            `export HTTPS_PROXY=${proxyUrl}`,
            `export no_proxy=localhost,127.0.0.1,::1`
        ];
        const exec = await container.exec({
            Cmd: ['sh', '-c', proxyCommands.join(' && ')],
            AttachStdout: true,
            AttachStderr: true,
            Env: [
                `http_proxy=${proxyUrl}`,
                `https_proxy=${proxyUrl}`,
                `HTTP_PROXY=${proxyUrl}`,
                `HTTPS_PROXY=${proxyUrl}`,
                `no_proxy=localhost,127.0.0.1,::1`
            ]
        });
        await exec.start({ hijack: true, stdin: false });
    }
    /**
     * Configures npm proxy settings
     */
    async configureNpmProxy(containerId) {
        if (!this.proxyConfig?.enabled) {
            return;
        }
        const container = this.docker.getContainer(containerId);
        const proxyUrl = `http://${this.proxyConfig.host}:${this.proxyConfig.port}`;
        const npmProxyCommands = [
            `npm config set proxy ${proxyUrl}`,
            `npm config set https-proxy ${proxyUrl}`,
            `npm config set registry https://registry.npmjs.org/`,
            `npm config set strict-ssl false`
        ];
        const exec = await container.exec({
            Cmd: ['sh', '-c', npmProxyCommands.join(' && ')],
            AttachStdout: true,
            AttachStderr: true,
        });
        await exec.start({ hijack: true, stdin: false });
    }
    /**
     * Creates secure npm configuration
     */
    async createSecureNpmConfig(containerId) {
        const container = this.docker.getContainer(containerId);
        const npmConfigCommands = [
            'mkdir -p /tmp/install',
            'cd /tmp/install',
            'npm config set audit-level moderate',
            'npm config set fund false',
            'npm config set update-notifier false',
            'npm config set save false'
        ];
        const exec = await container.exec({
            Cmd: ['sh', '-c', npmConfigCommands.join(' && ')],
            AttachStdout: true,
            AttachStderr: true,
        });
        await exec.start({ hijack: true, stdin: false });
    }
    /**
     * Creates download directory in container
     */
    async createDownloadDirectory(containerId, path) {
        const container = this.docker.getContainer(containerId);
        const exec = await container.exec({
            Cmd: ['mkdir', '-p', path],
            AttachStdout: true,
            AttachStderr: true,
        });
        await exec.start({ hijack: true, stdin: false });
    }
    /**
     * Builds download command based on package type
     */
    buildDownloadCommand(packageName, version, downloadPath) {
        // For npm packages
        if (packageName.includes('@') || packageName.match(/^[a-z]/)) {
            return [
                'sh', '-c',
                `cd ${downloadPath} && npm pack ${packageName}@${version} --pack-destination .`
            ];
        }
        // For other types, use wget/curl
        return [
            'sh', '-c',
            `cd ${downloadPath} && (wget -O package.tar.gz ${packageName} || curl -L -o package.tar.gz ${packageName})`
        ];
    }
    /**
     * Cleans up downloaded files
     */
    async cleanupDownload(containerId, downloadPath) {
        const container = this.docker.getContainer(containerId);
        const exec = await container.exec({
            Cmd: ['rm', '-rf', downloadPath],
            AttachStdout: true,
            AttachStderr: true,
        });
        await exec.start({ hijack: true, stdin: false });
    }
    /**
     * Parses size string to bytes
     */
    parseSize(sizeStr) {
        const match = sizeStr.match(/^(\d+)([kmg]?)b?$/i);
        if (!match) {
            throw new Error(`Invalid size format: ${sizeStr}`);
        }
        const value = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        switch (unit) {
            case 'k':
                return value * 1024;
            case 'm':
                return value * 1024 * 1024;
            case 'g':
                return value * 1024 * 1024 * 1024;
            default:
                return value;
        }
    }
    /**
     * Creates default external resource configuration
     */
    static createDefaultConfig() {
        return {
            allowedRegistries: [
                'registry.npmjs.org',
                'docker.io',
                'ghcr.io',
                'quay.io'
            ],
            integrityValidation: true,
            checksumAlgorithm: 'sha256',
            maxDownloadSize: '100m',
            timeout: 300000 // 5 minutes
        };
    }
}
exports.ExternalResourceManager = ExternalResourceManager;
//# sourceMappingURL=ExternalResourceManager.js.map