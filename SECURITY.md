# Security Policy

## Military-Grade Security Architecture

This project implements enterprise-grade security practices with military-level rigor:

### 🔐 Cryptographic Security & Traceability
- **GPG-signed commits**: All commits must be cryptographically signed
- **Protected branches**: `main` branch requires signed commits, PR reviews, and passing tests
- **Minimal privilege tokens**: CI uses least-privilege access (`contents: read`, `packages: write`, `security-events: write`)

### 🛡️ Multi-Layer Security Scanning

#### Static Application Security Testing (SAST)
- **CodeQL**: GitHub's semantic code analysis for vulnerability detection
- **Semgrep**: Rules for security-audit, secrets, TypeScript, and Node.js
- **Trivy**: Filesystem vulnerability scanning with SARIF output

#### Dependency Security
- **Dependency Review**: Automated security review of dependency changes
- **Vulnerability Scanning**: Trivy scans for known CVEs in dependencies
- **Supply Chain Security**: SBOM (Software Bill of Materials) generation in SPDX format

#### Pre-commit Security Enforcement
- **Secret Detection**: detect-secrets and gitleaks prevent credential leaks
- **Code Quality**: ESLint, TypeScript checks, security audits
- **Infrastructure Security**: Checkov for Dockerfile and GitHub Actions security
- **File Integrity**: Prevents large files, merge conflicts, and trailing whitespace

### 🧪 Comprehensive Testing Strategy
- **Unit Tests**: Backend service testing with database integration
- **End-to-End Tests**: Playwright-based frontend testing with full service integration
- **Integration Tests**: Database-backed API testing with health checks
- **Security Tests**: Automated vulnerability scanning in CI/CD

### 📦 Container Security & Deployment
- **Multi-stage Builds**: Optimized production containers
- **Image Signing**: Automated container signing and pushing to GHCR
- **Health Checks**: Database readiness validation before test execution
- **Platform Targeting**: Explicit `linux/amd64` for reproducible builds

### 🔍 Compliance & Auditing
- **SLSA Ready**: Structure supports Software Supply Chain Levels for Software Artifacts
- **SBOM Generation**: Complete software bill of materials for every build
- **Audit Logs**: Complete CI/CD pipeline logging with timestamps
- **Reproducible Builds**: Locked dependencies and deterministic builds

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| release/* | :white_check_mark: |

## Reporting a Vulnerability

### For Security Issues

1. **DO NOT** create a public GitHub issue
2. Email security concerns to: [security@company.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested mitigation (if any)

### Response Timeline
- **Initial Response**: Within 24 hours
- **Assessment**: Within 72 hours
- **Resolution**: Based on severity (Critical: 24-48h, High: 1 week, Medium: 2 weeks)

### Security Features in CI/CD

Our pipeline automatically:
- Scans for secrets in code changes
- Analyzes dependencies for known vulnerabilities
- Performs static code analysis for security issues
- Generates and uploads security reports (SARIF format)
- Creates software bill of materials (SBOM)
- Validates container security configurations

### Pre-commit Hooks

Install pre-commit hooks for local security enforcement:

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

### Security Tools Configuration

- **Secret Detection**: `.secrets.baseline` - Configured baseline for detect-secrets
- **Gitleaks**: `.gitleaks.toml` - Custom rules for credential detection
- **Pre-commit**: `.pre-commit-config.yaml` - Comprehensive security checks

### Security Best Practices

1. **Never commit secrets**: Use environment variables and secure secret management
2. **Sign your commits**: Enable GPG signing for all commits
3. **Keep dependencies updated**: Regularly update and audit dependencies
4. **Follow least privilege**: Grant minimal necessary permissions
5. **Review security reports**: Address all security findings promptly

For more information about our security architecture, see the main README.md documentation.