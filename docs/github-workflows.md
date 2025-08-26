# GitHub Workflows Suite for Cartrita Multi-Agent OS

This document provides an overview of the comprehensive GitHub Actions workflow suite designed specifically for the Cartrita Multi-Agent OS project.

## Overview

The Cartrita project now includes **8 advanced GitHub workflows** that provide comprehensive automation for development, deployment, security, and maintenance operations. These workflows are specifically designed to handle the unique requirements of an AI/ML platform with multi-agent architecture.

## Available Workflows

### 🧪 1. Comprehensive Testing Suite
**File:** `.github/workflows/comprehensive-testing.yml`

**Purpose:** Complete testing pipeline covering all aspects of the AI platform

**Key Features:**
- Multi-workspace unit testing (backend, frontend, shared)
- Integration testing with PostgreSQL + pgvector and Redis
- AI agent configuration validation
- Model integration health checks
- Security vulnerability scanning
- Performance benchmarking
- Comprehensive test reporting with artifacts

**Triggers:**
- Push to main/develop branches
- Pull requests
- Manual dispatch with test level selection

**Duration:** ~15-25 minutes

### 📦 2. Intelligent Dependency Management
**File:** `.github/workflows/dependency-management.yml`

**Purpose:** Automated dependency updates with AI-specific package validation

**Key Features:**
- Security vulnerability scanning (critical/high priority)
- AI/ML dependency compatibility checking (HuggingFace, LangChain, OpenAI)
- Workspace dependency synchronization
- Automated PR creation with impact analysis
- License compliance verification
- Deprecated package detection

**Triggers:**
- Weekly schedule (Mondays at 2 AM UTC)
- Manual dispatch with update type selection
- High/critical vulnerability detection

**Duration:** ~20-30 minutes

### 🤖 3. AI/ML Models & Integrations Validator
**File:** `.github/workflows/ai-ml-validation.yml`

**Purpose:** Specialized validation for AI agents and model integrations

**Key Features:**
- AI agent loading and configuration testing
- Vector database operations performance testing
- HuggingFace integration health checks
- OpenAI service connectivity validation
- Agent initialization performance benchmarks
- API endpoint validation for AI services

**Triggers:**
- Changes to AI/agent code paths
- Daily schedule (6 AM UTC)
- Manual dispatch

**Duration:** ~15-20 minutes

### 🐳 4. Container Security & Build Pipeline
**File:** `.github/workflows/container-security.yml`

**Purpose:** Multi-platform container builds with comprehensive security scanning

**Key Features:**
- Multi-platform builds (AMD64, ARM64)
- Container security scanning with Trivy
- Dockerfile best practices validation with Hadolint
- Docker Compose configuration validation
- Integration testing with containers
- SARIF security reporting

**Triggers:**
- Changes to Dockerfiles or container configs
- Changes to application code
- Manual dispatch

**Duration:** ~20-30 minutes

### 🗃️ 5. Database & Infrastructure Management
**File:** `.github/workflows/database-infrastructure.yml`

**Purpose:** Database migration testing and infrastructure validation

**Key Features:**
- Database migration validation and testing
- PostgreSQL + pgvector performance benchmarking
- Backup and restore procedure testing
- Infrastructure configuration validation
- Schema consistency verification
- Performance regression detection

**Triggers:**
- Changes to database migrations or config files
- Daily health checks (4 AM UTC)
- Manual dispatch

**Duration:** ~25-35 minutes

### ⚡ 6. Performance Monitoring & Benchmarking
**File:** `.github/workflows/performance-monitoring.yml`

**Purpose:** Comprehensive performance testing and monitoring

**Key Features:**
- Frontend performance analysis with Lighthouse
- Backend API response time benchmarking
- Database query performance testing
- Stress testing with load simulation
- Memory and CPU usage monitoring
- Performance regression detection

**Triggers:**
- Push to main branch
- Daily schedule (3 AM UTC)
- Manual dispatch with benchmark type selection

**Duration:** ~30-45 minutes

### 📚 7. Documentation & Link Validation (Planned)
**File:** `.github/workflows/documentation-maintenance.yml`

**Purpose:** Automated documentation maintenance and validation

**Key Features:**
- Markdown syntax and style validation
- Internal and external link checking
- Spell checking with technical dictionary
- API documentation generation
- Cross-reference validation

**Triggers:**
- Changes to documentation files
- Weekly schedule

### 🚀 8. Multi-Environment Deployment Pipeline (Planned)
**File:** `.github/workflows/deployment-pipeline.yml`

**Purpose:** Automated deployment with environment management

**Key Features:**
- Multi-environment support (dev/staging/production)
- Blue-green deployment strategies
- Health monitoring and rollback capabilities
- Database migration coordination
- Post-deployment validation

**Triggers:**
- Push to main branch
- Manual dispatch with environment selection

## Workflow Integration

### Service Dependencies
All workflows are designed to work with the Cartrita architecture:

- **PostgreSQL with pgvector** for vector operations testing
- **Redis** for caching and session testing
- **Node.js 20** with npm workspaces
- **Docker** for containerization
- **GitHub Container Registry** for image storage

### Environment Configuration
Workflows use the following environment variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/cartrita_test
POSTGRES_USER=testuser
POSTGRES_PASSWORD=testpass
POSTGRES_DB=cartrita_test

# Cache Configuration  
REDIS_URL=redis://localhost:6379

# API Keys (optional for full testing)
OPENAI_API_KEY=sk-...
HF_TOKEN=hf_...
GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}
```

### Artifact Management
Workflows generate comprehensive artifacts:

- **Test Results:** Coverage reports, test summaries
- **Security Reports:** Vulnerability assessments, SARIF files
- **Performance Reports:** Benchmarks, performance comparisons
- **Build Artifacts:** Container images, build outputs
- **Documentation:** Validation reports, link check results

## Monitoring & Alerting

### GitHub Security Integration
- Security vulnerabilities reported to GitHub Security tab
- SARIF reports for code scanning alerts
- Dependency vulnerability tracking

### Performance Monitoring
- Performance regression detection
- Resource usage trending
- API response time monitoring
- Database query performance tracking

### Notification Strategy
- Critical security issues create GitHub issues automatically
- Performance regressions trigger workflow failures
- Dependency updates create PRs with detailed impact analysis

## Usage Instructions

### Running Individual Workflows

1. **Manual Trigger:**
   ```bash
   # Go to Actions tab in GitHub
   # Select desired workflow
   # Click "Run workflow" 
   # Configure parameters as needed
   ```

2. **Automatic Triggers:**
   - Most workflows run automatically on push/PR
   - Scheduled workflows run at specified times
   - Security workflows trigger on vulnerability detection

### Interpreting Results

1. **Green Checkmark:** All tests passed
2. **Yellow Dot:** Tests completed with warnings
3. **Red X:** Critical issues found requiring attention

### Accessing Reports
- Workflow summaries appear in GitHub Actions UI
- Detailed reports available as downloadable artifacts
- Security findings appear in Security tab
- Performance metrics tracked over time

## Customization

### Modifying Workflows
Each workflow can be customized by editing the respective `.yml` file:

- **Triggers:** Modify `on:` section for different trigger conditions
- **Test Scope:** Adjust job configurations for different test coverage
- **Performance Thresholds:** Update performance targets in scripts
- **Security Levels:** Configure vulnerability severity thresholds

### Adding New Workflows
To add new workflows:

1. Create new `.yml` file in `.github/workflows/`
2. Follow existing patterns for consistency
3. Add to workflow tools database via `populateGithubWorkflows.js`
4. Update this documentation

## Troubleshooting

### Common Issues

1. **Database Connection Failures:**
   - Check PostgreSQL service configuration
   - Verify pgvector extension installation
   - Confirm connection parameters

2. **Container Build Failures:**
   - Check Dockerfile syntax with Hadolint
   - Verify multi-platform build requirements
   - Review security scan results

3. **AI Integration Test Failures:**
   - Verify API key configurations
   - Check model service availability
   - Review agent configuration files

4. **Performance Test Failures:**
   - Check resource availability
   - Review performance thresholds
   - Verify load testing parameters

### Getting Help

- Check workflow logs in GitHub Actions tab
- Review artifact reports for detailed information
- Check GitHub Security tab for security-related issues
- Consult individual workflow documentation

## Maintenance

### Regular Updates
- Review and update dependency versions monthly
- Update security scanning tools quarterly
- Review performance baselines after major releases
- Update documentation with new features

### Monitoring Health
- Monitor workflow success rates
- Track execution times for performance regression
- Review security scan results regularly
- Update thresholds based on platform evolution

---

**Next Steps:**
1. Review and test each workflow in your environment
2. Customize thresholds and parameters for your needs
3. Set up notification preferences
4. Schedule regular reviews of workflow effectiveness

For more information on specific workflows, see the individual workflow files and their embedded documentation.