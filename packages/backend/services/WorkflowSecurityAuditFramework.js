// WorkflowSecurityAuditFramework.js
// Component 8: Security Auditing and Vulnerability Assessment
// Comprehensive security testing for enterprise workflow automation system

import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { OpenTelemetryTracing } from '../system/OpenTelemetryTracing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WorkflowSecurityAuditFramework {
    constructor(services, db) {
        this.services = services;
        this.db = db;
        this.auditResults = [];
        this.securityTests = new Map();
        this.vulnerabilityDatabase = new Map();
        this.tracer = OpenTelemetryTracing.getTracer('workflow-security-audit');
        
        this.initializeSecurityTests();
        this.loadVulnerabilityDatabase();
    }

    initializeSecurityTests() {
        // SQL Injection Tests
        this.securityTests.set('sql_injection', {
            name: 'SQL Injection Vulnerability Assessment',
            category: 'injection',
            severity: 'critical',
            description: 'Tests for SQL injection vulnerabilities in workflow data processing',
            payloads: [
                "'; DROP TABLE workflows; --",
                "' OR '1'='1",
                "' UNION SELECT * FROM users --",
                "'; EXEC xp_cmdshell('dir'); --",
                "' AND (SELECT COUNT(*) FROM users) > 0 --"
            ]
        });

        // XSS Tests
        this.securityTests.set('xss', {
            name: 'Cross-Site Scripting (XSS) Assessment',
            category: 'injection',
            severity: 'high',
            description: 'Tests for XSS vulnerabilities in workflow content handling',
            payloads: [
                '<script>alert("XSS")</script>',
                '<img src=x onerror=alert("XSS")>',
                'javascript:alert("XSS")',
                '<svg/onload=alert("XSS")>',
                '"><script>alert("XSS")</script>'
            ]
        });

        // Command Injection Tests
        this.securityTests.set('command_injection', {
            name: 'Command Injection Assessment',
            category: 'injection',
            severity: 'critical',
            description: 'Tests for command injection in workflow execution',
            payloads: [
                '; ls -la',
                '| cat /etc/passwd',
                '&& whoami',
                '`id`',
                '$(ls)'
            ]
        });

        // Authentication Tests
        this.securityTests.set('auth_bypass', {
            name: 'Authentication Bypass Assessment',
            category: 'authentication',
            severity: 'critical',
            description: 'Tests for authentication bypass vulnerabilities'
        });

        // Authorization Tests
        this.securityTests.set('authorization', {
            name: 'Authorization Control Assessment',
            category: 'authorization',
            severity: 'high',
            description: 'Tests for unauthorized access to workflow resources'
        });

        // Data Validation Tests
        this.securityTests.set('data_validation', {
            name: 'Data Validation Assessment',
            category: 'validation',
            severity: 'medium',
            description: 'Tests for insufficient data validation'
        });

        // Cryptographic Tests
        this.securityTests.set('cryptography', {
            name: 'Cryptographic Implementation Assessment',
            category: 'cryptography',
            severity: 'high',
            description: 'Tests for weak cryptographic implementations'
        });

        // Session Management Tests
        this.securityTests.set('session_management', {
            name: 'Session Management Assessment',
            category: 'session',
            severity: 'medium',
            description: 'Tests for session management vulnerabilities'
        });
    }

    loadVulnerabilityDatabase() {
        // Common Weakness Enumeration (CWE) mappings
        this.vulnerabilityDatabase.set('CWE-89', {
            name: 'SQL Injection',
            description: 'Improper neutralization of special elements used in SQL commands',
            impact: 'Data breach, data corruption, unauthorized access',
            remediation: 'Use parameterized queries, input validation, least privilege principle'
        });

        this.vulnerabilityDatabase.set('CWE-79', {
            name: 'Cross-Site Scripting',
            description: 'Improper neutralization of input during web page generation',
            impact: 'Session hijacking, malicious script execution, data theft',
            remediation: 'Output encoding, input validation, Content Security Policy'
        });

        this.vulnerabilityDatabase.set('CWE-78', {
            name: 'Command Injection',
            description: 'Improper neutralization of special elements used in OS commands',
            impact: 'System compromise, data breach, privilege escalation',
            remediation: 'Avoid system calls, input validation, sandboxing'
        });

        this.vulnerabilityDatabase.set('CWE-287', {
            name: 'Improper Authentication',
            description: 'Authentication bypass or weak authentication mechanisms',
            impact: 'Unauthorized access, identity spoofing, privilege escalation',
            remediation: 'Strong authentication, multi-factor authentication, secure protocols'
        });

        this.vulnerabilityDatabase.set('CWE-285', {
            name: 'Improper Authorization',
            description: 'Insufficient verification of access rights',
            impact: 'Unauthorized data access, privilege escalation, data manipulation',
            remediation: 'Role-based access control, principle of least privilege, access validation'
        });
    }

    async runSecurityAudit(auditScope = 'full') {
        const span = this.tracer.startSpan('security-audit');
        
        try {
            console.log('🔒 Starting Security Audit Framework');
            console.log(`   Scope: ${auditScope.toUpperCase()}`);

            const auditSession = {
                id: crypto.randomUUID(),
                startTime: Date.now(),
                scope: auditScope,
                tests: [],
                vulnerabilities: [],
                summary: {
                    critical: 0,
                    high: 0,
                    medium: 0,
                    low: 0,
                    info: 0
                }
            };

            // Run security tests based on scope
            const testsToRun = this.getTestsByScope(auditScope);
            
            for (const [testKey, testConfig] of testsToRun) {
                console.log(`🔍 Running: ${testConfig.name}`);
                
                const testResult = await this.runSecurityTest(testKey, testConfig, auditSession.id);
                auditSession.tests.push(testResult);

                // Aggregate vulnerabilities
                if (testResult.vulnerabilities) {
                    auditSession.vulnerabilities.push(...testResult.vulnerabilities);
                    
                    // Update summary counts
                    testResult.vulnerabilities.forEach(vuln => {
                        auditSession.summary[vuln.severity]++;
                    });
                }
            }

            // Additional security checks
            await this.runConfigurationSecurity(auditSession);
            await this.runDependencyVulnerabilityCheck(auditSession);
            await this.runAccessControlAudit(auditSession);

            auditSession.endTime = Date.now();
            auditSession.duration = auditSession.endTime - auditSession.startTime;
            auditSession.riskScore = this.calculateRiskScore(auditSession.vulnerabilities);
            
            // Generate recommendations
            auditSession.recommendations = this.generateSecurityRecommendations(auditSession);
            
            this.auditResults.push(auditSession);
            
            console.log('✅ Security audit completed');
            this.printSecuritySummary(auditSession);

            span.setAttributes({
                'audit.scope': auditScope,
                'audit.tests_run': auditSession.tests.length,
                'audit.vulnerabilities_found': auditSession.vulnerabilities.length,
                'audit.risk_score': auditSession.riskScore
            });

            return auditSession;

        } catch (error) {
            console.error('❌ Security audit failed:', error);
            span.recordException(error);
            throw error;
        } finally {
            span.end();
        }
    }

    getTestsByScope(scope) {
        switch (scope) {
            case 'injection':
                return new Map([
                    ['sql_injection', this.securityTests.get('sql_injection')],
                    ['xss', this.securityTests.get('xss')],
                    ['command_injection', this.securityTests.get('command_injection')]
                ]);
            case 'access_control':
                return new Map([
                    ['auth_bypass', this.securityTests.get('auth_bypass')],
                    ['authorization', this.securityTests.get('authorization')]
                ]);
            case 'data_security':
                return new Map([
                    ['data_validation', this.securityTests.get('data_validation')],
                    ['cryptography', this.securityTests.get('cryptography')]
                ]);
            case 'session':
                return new Map([
                    ['session_management', this.securityTests.get('session_management')]
                ]);
            default:
                return this.securityTests;
        }
    }

    async runSecurityTest(testKey, testConfig, auditId) {
        const testResult = {
            testKey,
            name: testConfig.name,
            category: testConfig.category,
            severity: testConfig.severity,
            startTime: Date.now(),
            vulnerabilities: []
        };

        try {
            switch (testKey) {
                case 'sql_injection':
                    await this.testSQLInjection(testResult, testConfig);
                    break;
                case 'xss':
                    await this.testXSS(testResult, testConfig);
                    break;
                case 'command_injection':
                    await this.testCommandInjection(testResult, testConfig);
                    break;
                case 'auth_bypass':
                    await this.testAuthenticationBypass(testResult);
                    break;
                case 'authorization':
                    await this.testAuthorizationControls(testResult);
                    break;
                case 'data_validation':
                    await this.testDataValidation(testResult);
                    break;
                case 'cryptography':
                    await this.testCryptographicImplementation(testResult);
                    break;
                case 'session_management':
                    await this.testSessionManagement(testResult);
                    break;
            }

            testResult.status = 'completed';

        } catch (error) {
            testResult.status = 'error';
            testResult.error = error.message;
            console.error(`❌ Security test failed: ${testConfig.name}`, error);
        }

        testResult.endTime = Date.now();
        testResult.duration = testResult.endTime - testResult.startTime;
        
        return testResult;
    }

    async testSQLInjection(testResult, testConfig) {
        console.log('   Testing SQL injection vulnerabilities...');
        
        for (const payload of testConfig.payloads) {
            try {
                // Test workflow creation with malicious payload
                const maliciousWorkflow = {
                    name: `Test ${payload}`,
                    description: `Description with ${payload}`,
                    workflow_data: {
                        nodes: [{
                            id: 'test',
                            data: { label: payload }
                        }]
                    }
                };

                // Create a test user for this audit
                const testUser = await this.createTestUser();
                
                try {
                    const result = await this.services.designerService.createWorkflow(testUser.id, maliciousWorkflow);
                    
                    // Check if the payload was properly sanitized
                    if (result && (result.name.includes(payload) || result.description.includes(payload))) {
                        testResult.vulnerabilities.push({
                            type: 'sql_injection',
                            severity: 'critical',
                            payload: payload,
                            location: 'workflow creation',
                            description: 'SQL injection payload not properly sanitized',
                            cwe: 'CWE-89',
                            recommendation: 'Implement parameterized queries and input validation'
                        });
                    }
                } finally {
                    await this.cleanupTestUser(testUser.id);
                }

            } catch (error) {
                // Errors are expected for SQL injection attempts
                if (error.message.includes('syntax error') || error.message.includes('invalid input')) {
                    // This indicates potential SQL injection vulnerability
                    testResult.vulnerabilities.push({
                        type: 'sql_injection',
                        severity: 'high',
                        payload: payload,
                        location: 'database query',
                        description: 'Database error suggests potential SQL injection vulnerability',
                        cwe: 'CWE-89',
                        error: error.message
                    });
                }
            }
        }
    }

    async testXSS(testResult, testConfig) {
        console.log('   Testing XSS vulnerabilities...');
        
        for (const payload of testConfig.payloads) {
            try {
                const testUser = await this.createTestUser();
                
                try {
                    // Test template creation with XSS payload
                    const maliciousTemplate = {
                        name: `Template ${payload}`,
                        description: payload,
                        category: 'test',
                        workflow_data: {
                            nodes: [{
                                id: 'xss-test',
                                data: { 
                                    label: payload,
                                    description: payload 
                                }
                            }]
                        }
                    };

                    const result = await this.services.templateService.createTemplate(testUser.id, maliciousTemplate);
                    
                    // Check if XSS payload is present without encoding
                    if (result && this.containsUnescapedXSS(result, payload)) {
                        testResult.vulnerabilities.push({
                            type: 'xss',
                            severity: 'high',
                            payload: payload,
                            location: 'template data',
                            description: 'XSS payload not properly encoded/sanitized',
                            cwe: 'CWE-79',
                            recommendation: 'Implement output encoding and input validation'
                        });
                    }
                } finally {
                    await this.cleanupTestUser(testUser.id);
                }

            } catch (error) {
                // Log unexpected errors
                if (!error.message.includes('validation')) {
                    console.warn(`Unexpected error in XSS test: ${error.message}`);
                }
            }
        }
    }

    async testCommandInjection(testResult, testConfig) {
        console.log('   Testing command injection vulnerabilities...');
        
        for (const payload of testConfig.payloads) {
            try {
                const testUser = await this.createTestUser();
                
                try {
                    // Test integration configuration with command injection payload
                    const maliciousIntegration = {
                        name: `Integration ${payload}`,
                        integration_type: 'rest_api',
                        configuration: {
                            base_url: `https://example.com${payload}`,
                            custom_command: payload
                        }
                    };

                    const result = await this.services.integrationHub.createIntegration(maliciousIntegration);
                    
                    // Check if command injection payload was processed
                    if (result && this.containsCommandInjection(result, payload)) {
                        testResult.vulnerabilities.push({
                            type: 'command_injection',
                            severity: 'critical',
                            payload: payload,
                            location: 'integration configuration',
                            description: 'Command injection payload not properly validated',
                            cwe: 'CWE-78',
                            recommendation: 'Avoid system calls, validate all inputs'
                        });
                    }
                } finally {
                    await this.cleanupTestUser(testUser.id);
                }

            } catch (error) {
                // Command injection might cause system errors
                if (error.message.includes('command') || error.message.includes('system')) {
                    testResult.vulnerabilities.push({
                        type: 'command_injection',
                        severity: 'medium',
                        payload: payload,
                        location: 'system execution',
                        description: 'System error suggests potential command injection',
                        cwe: 'CWE-78',
                        error: error.message
                    });
                }
            }
        }
    }

    async testAuthenticationBypass(testResult) {
        console.log('   Testing authentication bypass vulnerabilities...');
        
        // Test 1: Access without authentication token
        try {
            const workflows = await this.services.designerService.getWorkflows(null); // No user ID
            if (workflows && workflows.length > 0) {
                testResult.vulnerabilities.push({
                    type: 'auth_bypass',
                    severity: 'critical',
                    location: 'workflow access',
                    description: 'Workflows accessible without authentication',
                    cwe: 'CWE-287',
                    recommendation: 'Implement proper authentication checks'
                });
            }
        } catch (error) {
            // Expected to fail - good security
        }

        // Test 2: Invalid user ID bypass
        try {
            const invalidUserId = -1;
            const workflows = await this.services.designerService.getWorkflows(invalidUserId);
            if (workflows && workflows.length > 0) {
                testResult.vulnerabilities.push({
                    type: 'auth_bypass',
                    severity: 'high',
                    location: 'user validation',
                    description: 'Invalid user ID allows access to workflows',
                    cwe: 'CWE-287',
                    recommendation: 'Validate user existence and permissions'
                });
            }
        } catch (error) {
            // Expected to fail - good security
        }

        // Test 3: SQL injection in user authentication
        try {
            const maliciousUserId = "1' OR '1'='1";
            await this.services.designerService.getWorkflows(maliciousUserId);
        } catch (error) {
            if (error.message.includes('invalid input syntax')) {
                testResult.vulnerabilities.push({
                    type: 'auth_bypass',
                    severity: 'critical',
                    location: 'user authentication',
                    description: 'Authentication vulnerable to SQL injection',
                    cwe: 'CWE-287',
                    recommendation: 'Use parameterized queries for authentication'
                });
            }
        }
    }

    async testAuthorizationControls(testResult) {
        console.log('   Testing authorization control vulnerabilities...');
        
        const testUser1 = await this.createTestUser();
        const testUser2 = await this.createTestUser();
        
        try {
            // Create workflow as user1
            const workflow = await this.services.designerService.createWorkflow(testUser1.id, {
                name: 'Authorization Test Workflow',
                nodes: [{ id: 'start', type: 'start' }],
                edges: []
            });

            // Try to access workflow as user2
            try {
                const unauthorizedAccess = await this.services.designerService.getWorkflow(workflow.id, testUser2.id);
                if (unauthorizedAccess) {
                    testResult.vulnerabilities.push({
                        type: 'authorization',
                        severity: 'high',
                        location: 'workflow access',
                        description: 'User can access workflows belonging to other users',
                        cwe: 'CWE-285',
                        recommendation: 'Implement proper authorization checks'
                    });
                }
            } catch (error) {
                // Expected to fail - good security
            }

            // Try to modify workflow as user2
            try {
                const unauthorizedUpdate = await this.services.designerService.updateWorkflow(
                    workflow.id, 
                    { name: 'Unauthorized Update' }, 
                    testUser2.id
                );
                if (unauthorizedUpdate) {
                    testResult.vulnerabilities.push({
                        type: 'authorization',
                        severity: 'critical',
                        location: 'workflow modification',
                        description: 'User can modify workflows belonging to other users',
                        cwe: 'CWE-285',
                        recommendation: 'Implement ownership verification before modifications'
                    });
                }
            } catch (error) {
                // Expected to fail - good security
            }

        } finally {
            await this.cleanupTestUser(testUser1.id);
            await this.cleanupTestUser(testUser2.id);
        }
    }

    async testDataValidation(testResult) {
        console.log('   Testing data validation vulnerabilities...');
        
        const testUser = await this.createTestUser();
        
        try {
            // Test oversized input
            const oversizedData = 'A'.repeat(100000); // 100KB string
            try {
                await this.services.designerService.createWorkflow(testUser.id, {
                    name: oversizedData,
                    description: oversizedData,
                    workflow_data: { nodes: [], edges: [] }
                });
                
                testResult.vulnerabilities.push({
                    type: 'data_validation',
                    severity: 'medium',
                    location: 'input validation',
                    description: 'Application accepts oversized input without validation',
                    recommendation: 'Implement input size limits and validation'
                });
            } catch (error) {
                // Expected to fail - good validation
            }

            // Test invalid data types
            const invalidData = {
                name: { malicious: 'object' }, // Should be string
                description: ['array', 'instead', 'of', 'string'],
                workflow_data: 'string instead of object'
            };
            
            try {
                await this.services.designerService.createWorkflow(testUser.id, invalidData);
                
                testResult.vulnerabilities.push({
                    type: 'data_validation',
                    severity: 'medium',
                    location: 'type validation',
                    description: 'Application accepts invalid data types',
                    recommendation: 'Implement strict data type validation'
                });
            } catch (error) {
                // Expected to fail - good validation
            }

        } finally {
            await this.cleanupTestUser(testUser.id);
        }
    }

    async testCryptographicImplementation(testResult) {
        console.log('   Testing cryptographic implementation...');
        
        // Test password hashing
        if (this.services.authService && this.services.authService.hashPassword) {
            const password = 'testpassword';
            const hash1 = await this.services.authService.hashPassword(password);
            const hash2 = await this.services.authService.hashPassword(password);
            
            if (hash1 === hash2) {
                testResult.vulnerabilities.push({
                    type: 'cryptography',
                    severity: 'high',
                    location: 'password hashing',
                    description: 'Password hashing does not use salt (produces identical hashes)',
                    recommendation: 'Use salted hashing algorithms like bcrypt'
                });
            }
        }

        // Test random number generation
        const randoms = [];
        for (let i = 0; i < 100; i++) {
            randoms.push(Math.random());
        }
        
        const uniqueRandoms = new Set(randoms);
        if (uniqueRandoms.size < randoms.length * 0.95) {
            testResult.vulnerabilities.push({
                type: 'cryptography',
                severity: 'medium',
                location: 'random generation',
                description: 'Weak random number generation detected',
                recommendation: 'Use cryptographically secure random number generation'
            });
        }
    }

    async testSessionManagement(testResult) {
        console.log('   Testing session management...');
        
        // This is a simplified test - in a real implementation, you'd test:
        // - Session token entropy
        // - Session fixation
        // - Session hijacking
        // - Session timeout
        // - Secure cookie settings
        
        testResult.vulnerabilities.push({
            type: 'session_management',
            severity: 'info',
            location: 'session testing',
            description: 'Session management tests need implementation',
            recommendation: 'Implement comprehensive session security tests'
        });
    }

    async runConfigurationSecurity(auditSession) {
        console.log('🔧 Checking configuration security...');
        
        const configVulnerabilities = [];

        // Check environment variables
        const sensitiveEnvVars = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN'];
        for (const [key, value] of Object.entries(process.env)) {
            if (sensitiveEnvVars.some(sensitive => key.toUpperCase().includes(sensitive))) {
                if (value && value.length < 16) {
                    configVulnerabilities.push({
                        type: 'configuration',
                        severity: 'medium',
                        location: 'environment variables',
                        description: `Weak ${key}: too short`,
                        recommendation: 'Use strong, randomly generated secrets'
                    });
                }
            }
        }

        // Check database configuration
        if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')) {
            configVulnerabilities.push({
                type: 'configuration',
                severity: 'low',
                location: 'database configuration',
                description: 'Database appears to be running locally',
                recommendation: 'Ensure production databases are properly secured'
            });
        }

        auditSession.vulnerabilities.push(...configVulnerabilities);
    }

    async runDependencyVulnerabilityCheck(auditSession) {
        console.log('📦 Checking dependency vulnerabilities...');
        
        // This is a simplified check - in a real implementation, you'd:
        // - Parse package.json
        // - Check against vulnerability databases (npm audit, snyk, etc.)
        // - Check for outdated dependencies
        
        const dependencyVulnerabilities = [{
            type: 'dependency',
            severity: 'info',
            location: 'package dependencies',
            description: 'Dependency vulnerability scanning not fully implemented',
            recommendation: 'Implement automated dependency vulnerability scanning'
        }];

        auditSession.vulnerabilities.push(...dependencyVulnerabilities);
    }

    async runAccessControlAudit(auditSession) {
        console.log('🔐 Auditing access controls...');
        
        const accessVulnerabilities = [];

        try {
            // Check if admin endpoints are accessible
            if (this.services.adminService) {
                // This would test admin endpoint security
                accessVulnerabilities.push({
                    type: 'access_control',
                    severity: 'info',
                    location: 'admin endpoints',
                    description: 'Admin endpoint security needs verification',
                    recommendation: 'Implement proper admin access controls'
                });
            }

            // Check file system permissions
            // In a real implementation, you'd check file permissions
            accessVulnerabilities.push({
                type: 'access_control',
                severity: 'info',
                location: 'file system',
                description: 'File system permission audit needed',
                recommendation: 'Audit and secure file system permissions'
            });

        } catch (error) {
            console.error('Access control audit error:', error);
        }

        auditSession.vulnerabilities.push(...accessVulnerabilities);
    }

    // Helper methods
    async createTestUser() {
        const testEmail = `test-${crypto.randomUUID()}@security-audit.local`;
        const result = await this.db.query(`
            INSERT INTO users (email, password_hash, first_name, last_name) 
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [testEmail, 'test-hash', 'Test', 'User']);
        
        return { id: result.rows[0].id, email: testEmail };
    }

    async cleanupTestUser(userId) {
        try {
            await this.db.query('DELETE FROM users WHERE id = $1', [userId]);
        } catch (error) {
            console.warn('Failed to cleanup test user:', error.message);
        }
    }

    containsUnescapedXSS(data, payload) {
        const dataStr = JSON.stringify(data);
        return dataStr.includes(payload) && !dataStr.includes(this.escapeHtml(payload));
    }

    containsCommandInjection(data, payload) {
        const dataStr = JSON.stringify(data);
        return dataStr.includes(payload);
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    calculateRiskScore(vulnerabilities) {
        const weights = {
            critical: 10,
            high: 7,
            medium: 4,
            low: 2,
            info: 1
        };

        const score = vulnerabilities.reduce((total, vuln) => {
            return total + (weights[vuln.severity] || 1);
        }, 0);

        // Normalize to 0-100 scale
        return Math.min(100, score);
    }

    generateSecurityRecommendations(auditSession) {
        const recommendations = [];
        const criticalCount = auditSession.summary.critical;
        const highCount = auditSession.summary.high;
        const mediumCount = auditSession.summary.medium;

        if (criticalCount > 0) {
            recommendations.push({
                priority: 'critical',
                title: 'Address Critical Vulnerabilities Immediately',
                description: `Found ${criticalCount} critical security issues that require immediate attention`,
                actions: [
                    'Review all critical vulnerabilities',
                    'Implement fixes for SQL injection and command injection',
                    'Verify authentication and authorization controls',
                    'Conduct penetration testing'
                ]
            });
        }

        if (highCount > 0) {
            recommendations.push({
                priority: 'high',
                title: 'Fix High-Priority Security Issues',
                description: `Found ${highCount} high-priority security issues`,
                actions: [
                    'Implement input validation and output encoding',
                    'Review and strengthen access controls',
                    'Update security configurations',
                    'Enhance monitoring and logging'
                ]
            });
        }

        if (mediumCount > 0) {
            recommendations.push({
                priority: 'medium',
                title: 'Improve Security Posture',
                description: `Found ${mediumCount} medium-priority security improvements`,
                actions: [
                    'Enhance data validation',
                    'Review cryptographic implementations',
                    'Implement security headers',
                    'Conduct code review'
                ]
            });
        }

        // General recommendations
        recommendations.push({
            priority: 'general',
            title: 'Ongoing Security Practices',
            description: 'Implement continuous security practices',
            actions: [
                'Regular security audits and penetration testing',
                'Automated dependency vulnerability scanning',
                'Security training for development team',
                'Implement security monitoring and incident response',
                'Regular security configuration reviews'
            ]
        });

        return recommendations;
    }

    printSecuritySummary(auditSession) {
        console.log('\n📊 Security Audit Summary:');
        console.log(`   Duration: ${(auditSession.duration / 1000).toFixed(1)}s`);
        console.log(`   Tests Run: ${auditSession.tests.length}`);
        console.log(`   Vulnerabilities Found: ${auditSession.vulnerabilities.length}`);
        console.log(`   Risk Score: ${auditSession.riskScore}/100`);
        console.log('\n   Severity Breakdown:');
        console.log(`     🔴 Critical: ${auditSession.summary.critical}`);
        console.log(`     🟡 High: ${auditSession.summary.high}`);
        console.log(`     🟠 Medium: ${auditSession.summary.medium}`);
        console.log(`     🟢 Low: ${auditSession.summary.low}`);
        console.log(`     ℹ️  Info: ${auditSession.summary.info}`);

        if (auditSession.summary.critical > 0) {
            console.log('\n⚠️  CRITICAL VULNERABILITIES FOUND - IMMEDIATE ACTION REQUIRED');
        } else if (auditSession.summary.high > 0) {
            console.log('\n⚠️  High priority vulnerabilities found - action recommended');
        } else {
            console.log('\n✅ No critical or high priority vulnerabilities found');
        }
    }

    generateSecurityReport() {
        return {
            framework: {
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                nodeVersion: process.version
            },
            audits: this.auditResults,
            vulnerabilityDatabase: Object.fromEntries(this.vulnerabilityDatabase),
            securityTests: Object.fromEntries(this.securityTests)
        };
    }

    cleanup() {
        this.auditResults = [];
        this.securityTests.clear();
        this.vulnerabilityDatabase.clear();
    }
}

export default WorkflowSecurityAuditFramework;
