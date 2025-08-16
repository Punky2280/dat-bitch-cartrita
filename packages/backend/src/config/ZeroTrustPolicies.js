/**
 * Zero-Trust Network Security Policies Configuration
 * Defines network access policies, segmentation rules, and security controls
 * @author Robbie Allen - Lead Architect
 * @date August 16, 2025
 */

export const NetworkSecurityPolicies = {
    // Network Zones Configuration
    networkZones: {
        public: {
            name: 'public',
            description: 'Public-facing zone with minimal trust',
            trustLevel: 0.1,
            accessLevel: 'minimal',
            allowedServices: ['auth', 'public-api', 'health', 'docs'],
            monitoring: 'maximum',
            encryption: 'required',
            maxSessionTime: 3600000, // 1 hour
            requiresMFA: false,
            riskThreshold: 0.3
        },
        dmz: {
            name: 'dmz',
            description: 'Demilitarized zone for web services',
            trustLevel: 0.3,
            accessLevel: 'limited',
            allowedServices: ['web', 'auth', 'cdn', 'api', 'static'],
            monitoring: 'high',
            encryption: 'required',
            maxSessionTime: 7200000, // 2 hours
            requiresMFA: false,
            riskThreshold: 0.5
        },
        internal: {
            name: 'internal',
            description: 'Internal services zone',
            trustLevel: 0.6,
            accessLevel: 'standard',
            allowedServices: ['api', 'database', 'cache', 'workflows', 'knowledge', 'monitoring'],
            monitoring: 'medium',
            encryption: 'preferred',
            maxSessionTime: 14400000, // 4 hours
            requiresMFA: true,
            riskThreshold: 0.7
        },
        restricted: {
            name: 'restricted',
            description: 'Highly restricted zone for sensitive operations',
            trustLevel: 0.8,
            accessLevel: 'privileged',
            allowedServices: ['admin', 'vault', 'security', 'sensitive-data', 'api-keys'],
            monitoring: 'maximum',
            encryption: 'mandatory',
            maxSessionTime: 1800000, // 30 minutes
            requiresMFA: true,
            riskThreshold: 0.9
        }
    },

    // Access Control Policies
    accessPolicies: [
        {
            id: 'default-deny-all',
            name: 'Default Deny All',
            description: 'Deny all access by default (zero-trust principle)',
            priority: 1000,
            action: 'deny',
            enabled: true,
            conditions: {
                source: '*',
                destination: '*',
                service: '*'
            },
            metadata: {
                category: 'default',
                severity: 'critical'
            }
        },
        {
            id: 'allow-public-services',
            name: 'Allow Public Services',
            description: 'Allow access to public services for any authenticated user',
            priority: 200,
            action: 'allow',
            enabled: true,
            conditions: {
                authenticated: true,
                services: ['health', 'docs', 'auth', 'public-api'],
                riskScore: { max: 0.8 }
            },
            metadata: {
                category: 'public',
                severity: 'low'
            }
        },
        {
            id: 'allow-authenticated-dmz',
            name: 'Allow Authenticated DMZ Access',
            description: 'Allow authenticated users with trusted devices to access DMZ services',
            priority: 150,
            action: 'allow',
            enabled: true,
            conditions: {
                authenticated: true,
                deviceTrusted: true,
                riskScore: { max: 0.5 },
                services: ['api', 'web', 'static', 'cdn']
            },
            metadata: {
                category: 'dmz',
                severity: 'low'
            }
        },
        {
            id: 'allow-internal-services',
            name: 'Allow Internal Services',
            description: 'Allow access to internal services for verified users',
            priority: 100,
            action: 'allow',
            enabled: true,
            conditions: {
                authenticated: true,
                deviceTrusted: true,
                mfaVerified: true,
                riskScore: { max: 0.3 },
                services: ['workflows', 'knowledge', 'monitoring', 'database', 'cache'],
                timeWindow: {
                    businessHours: true
                }
            },
            metadata: {
                category: 'internal',
                severity: 'medium'
            }
        },
        {
            id: 'allow-admin-restricted',
            name: 'Allow Admin Restricted Access',
            description: 'Allow admin access to restricted services with strict controls',
            priority: 50,
            action: 'allow',
            enabled: true,
            conditions: {
                authenticated: true,
                deviceTrusted: true,
                mfaVerified: true,
                userRole: 'admin',
                riskScore: { max: 0.1 },
                services: ['admin', 'vault', 'security', 'api-keys'],
                timeWindow: {
                    businessHours: true
                },
                ipWhitelist: true
            },
            metadata: {
                category: 'restricted',
                severity: 'critical'
            }
        },
        {
            id: 'block-high-risk',
            name: 'Block High Risk Access',
            description: 'Block any access with high risk score',
            priority: 10,
            action: 'deny',
            enabled: true,
            conditions: {
                riskScore: { min: 0.8 }
            },
            metadata: {
                category: 'security',
                severity: 'critical'
            }
        },
        {
            id: 'block-suspicious-behavior',
            name: 'Block Suspicious Behavior',
            description: 'Block access patterns indicating suspicious behavior',
            priority: 20,
            action: 'deny',
            enabled: true,
            conditions: {
                anomalyScore: { min: 0.7 },
                patterns: ['rapid_requests', 'unusual_hours', 'geo_anomaly']
            },
            metadata: {
                category: 'anomaly',
                severity: 'high'
            }
        },
        {
            id: 'quarantine-untrusted',
            name: 'Quarantine Untrusted Devices',
            description: 'Quarantine access from untrusted or compromised devices',
            priority: 30,
            action: 'quarantine',
            enabled: true,
            conditions: {
                deviceTrusted: false,
                riskFactors: ['unknown_device', 'suspicious_activity']
            },
            metadata: {
                category: 'device_security',
                severity: 'high'
            }
        }
    ],

    // Service Classifications
    serviceClassifications: {
        'health': { type: 'public', sensitivity: 'none', encryption: 'optional' },
        'docs': { type: 'public', sensitivity: 'none', encryption: 'optional' },
        'auth': { type: 'security', sensitivity: 'medium', encryption: 'required' },
        'api': { type: 'standard', sensitivity: 'low', encryption: 'preferred' },
        'web': { type: 'standard', sensitivity: 'low', encryption: 'preferred' },
        'static': { type: 'public', sensitivity: 'none', encryption: 'optional' },
        'cdn': { type: 'public', sensitivity: 'none', encryption: 'optional' },
        'workflows': { type: 'internal', sensitivity: 'medium', encryption: 'required' },
        'knowledge': { type: 'internal', sensitivity: 'medium', encryption: 'required' },
        'monitoring': { type: 'internal', sensitivity: 'high', encryption: 'required' },
        'database': { type: 'internal', sensitivity: 'high', encryption: 'required' },
        'cache': { type: 'internal', sensitivity: 'medium', encryption: 'preferred' },
        'admin': { type: 'sensitive', sensitivity: 'critical', encryption: 'mandatory' },
        'vault': { type: 'sensitive', sensitivity: 'critical', encryption: 'mandatory' },
        'security': { type: 'sensitive', sensitivity: 'critical', encryption: 'mandatory' },
        'api-keys': { type: 'sensitive', sensitivity: 'critical', encryption: 'mandatory' },
        'sensitive-data': { type: 'sensitive', sensitivity: 'critical', encryption: 'mandatory' }
    },

    // Risk Assessment Configuration
    riskFactors: {
        identity: {
            weight: 0.3,
            factors: {
                new_user: 0.5,
                recent_password_change: 0.3,
                failed_logins: 0.7,
                account_locked: 0.9,
                suspicious_activity: 0.8
            }
        },
        device: {
            weight: 0.25,
            factors: {
                unknown_device: 0.6,
                new_device: 0.4,
                untrusted_device: 0.8,
                jailbroken_rooted: 0.9,
                outdated_os: 0.3,
                suspicious_software: 0.7
            }
        },
        network: {
            weight: 0.2,
            factors: {
                public_wifi: 0.4,
                vpn_usage: 0.2,
                tor_usage: 0.8,
                geo_anomaly: 0.6,
                suspicious_ip: 0.9,
                known_bad_ip: 1.0
            }
        },
        behavioral: {
            weight: 0.15,
            factors: {
                unusual_hours: 0.3,
                rapid_requests: 0.5,
                unusual_patterns: 0.6,
                data_exfiltration: 0.9,
                privilege_escalation: 0.8
            }
        },
        temporal: {
            weight: 0.1,
            factors: {
                outside_business_hours: 0.2,
                weekend_access: 0.1,
                holiday_access: 0.3,
                multiple_concurrent_sessions: 0.4
            }
        }
    },

    // Continuous Monitoring Configuration
    monitoring: {
        verificationInterval: 300000, // 5 minutes
        anomalyThreshold: 0.7,
        riskEscalationThreshold: 0.8,
        autoIsolationThreshold: 0.9,
        sessionTimeouts: {
            public: 3600000,    // 1 hour
            dmz: 7200000,       // 2 hours  
            internal: 14400000, // 4 hours
            restricted: 1800000 // 30 minutes
        },
        alertThresholds: {
            low: 0.3,
            medium: 0.5,
            high: 0.7,
            critical: 0.9
        }
    },

    // Threat Detection Patterns
    threatPatterns: {
        sqlInjection: [
            /('|(\\')|(;)|(\\;))/gi,
            /(union|select|insert|update|delete|drop|create|alter)/gi,
            /(\|\||&&)/gi
        ],
        xss: [
            /<script[^>]*>.*?<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi
        ],
        pathTraversal: [
            /\.\.\//gi,
            /\.\.\\/gi,
            /%2e%2e%2f/gi
        ],
        commandInjection: [
            /[;&|`]/gi,
            /\$\(/gi,
            /`[^`]*`/gi
        ]
    },

    // Response Actions
    responseActions: {
        allow: {
            action: 'allow',
            logging: 'standard',
            monitoring: 'continuous'
        },
        deny: {
            action: 'deny',
            logging: 'detailed',
            monitoring: 'enhanced',
            notification: true
        },
        quarantine: {
            action: 'quarantine',
            logging: 'comprehensive',
            monitoring: 'maximum',
            notification: true,
            isolation: true,
            duration: 3600000 // 1 hour
        },
        challenge: {
            action: 'challenge',
            logging: 'detailed',
            monitoring: 'enhanced',
            requiresMFA: true,
            additionalVerification: true
        }
    }
};

export default NetworkSecurityPolicies;
