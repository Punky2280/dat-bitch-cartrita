/**
 * OpenTelemetry Integration Service for Cartrita
 * 
 * This service integrates the upstream OpenTelemetry JS components directly
 * into the Cartrita backend, providing seamless access to all OpenTelemetry
 * functionality without external dependencies.
 */

// Import upstream OpenTelemetry components from integrated directories
import { trace, metrics, context, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import pkg from '@opentelemetry/resources';
const { Resource } = pkg;
import semanticPkg from '@opentelemetry/semantic-conventions';
const { SemanticResourceAttributes } = semanticPkg;

// Import our enhanced services
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import TelemetryAgent from '../agi/system/TelemetryAgent.js';

class OpenTelemetryIntegrationService {
    constructor() {
        this.sdk = null;
        this.tracer = null;
        this.meter = null;
        this.telemetryAgent = null;
        this.initialized = false;
        
        // Integration status
        this.integration = {
            upstream_components: false,
            enhanced_tracing: false,
            telemetry_agent: false,
            contrib_instrumentations: false
        };
    }

    /**
     * Initialize the complete OpenTelemetry integration
     */
    async initialize() {
        if (this.initialized) {
            console.log('[OpenTelemetryIntegration] Already initialized');
            return true;
        }

        try {
            console.log('[OpenTelemetryIntegration] 🚀 Initializing complete OpenTelemetry integration...');

            // Step 1: Initialize upstream OpenTelemetry components
            await this.initializeUpstreamComponents();
            
            // Step 2: Initialize enhanced tracing service
            await this.initializeEnhancedTracing();
            
            // Step 3: Initialize telemetry agent
            await this.initializeTelemetryAgent();
            
            // Step 4: Initialize contrib instrumentations
            await this.initializeContribInstrumentations();

            this.initialized = true;
            
            console.log('[OpenTelemetryIntegration] ✅ Complete OpenTelemetry integration initialized');
            this.logIntegrationStatus();
            
            return true;
        } catch (error) {
            console.error('[OpenTelemetryIntegration] ❌ Initialization failed:', error);
            return false;
        }
    }

    /**
     * Initialize upstream OpenTelemetry components
     */
    async initializeUpstreamComponents() {
        try {
            console.log('[OpenTelemetryIntegration] 📦 Initializing upstream OpenTelemetry components...');
            
            // Create enhanced resource with Cartrita metadata
            const resource = new Resource({
                [SemanticResourceAttributes.SERVICE_NAME]: 'cartrita-integrated-telemetry',
                [SemanticResourceAttributes.SERVICE_VERSION]: '2025.1.0',
                [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'cartrita',
                [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
                // Cartrita-specific attributes
                'cartrita.integration.type': 'upstream-merged',
                'cartrita.telemetry.agent': 'enabled',
                'cartrita.system.type': 'advanced-agi-orchestrator'
            });

            // Initialize NodeSDK with auto-instrumentations
            this.sdk = new NodeSDK({
                resource: resource,
                instrumentations: [getNodeAutoInstrumentations({
                    '@opentelemetry/instrumentation-fs': { enabled: false },
                    '@opentelemetry/instrumentation-express': { enabled: true },
                    '@opentelemetry/instrumentation-http': { enabled: true },
                    '@opentelemetry/instrumentation-pg': { enabled: true },
                    '@opentelemetry/instrumentation-redis': { enabled: true }
                })]
            });

            await this.sdk.start();

            // Get tracer and meter instances
            this.tracer = trace.getTracer('cartrita-integrated', '2025.1.0');
            this.meter = metrics.getMeter('cartrita-integrated', '2025.1.0');

            this.integration.upstream_components = true;
            console.log('[OpenTelemetryIntegration] ✅ Upstream components initialized');
        } catch (error) {
            console.error('[OpenTelemetryIntegration] ❌ Upstream initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize enhanced tracing service
     */
    async initializeEnhancedTracing() {
        try {
            console.log('[OpenTelemetryIntegration] 🔍 Initializing enhanced tracing...');
            
            await OpenTelemetryTracing.initialize();
            this.integration.enhanced_tracing = true;
            
            console.log('[OpenTelemetryIntegration] ✅ Enhanced tracing initialized');
        } catch (error) {
            console.error('[OpenTelemetryIntegration] ❌ Enhanced tracing initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize telemetry agent
     */
    async initializeTelemetryAgent() {
        try {
            console.log('[OpenTelemetryIntegration] 🤖 Initializing telemetry agent...');
            
            this.telemetryAgent = new TelemetryAgent();
            await this.telemetryAgent.initialize();
            this.integration.telemetry_agent = true;
            
            console.log('[OpenTelemetryIntegration] ✅ Telemetry agent initialized');
        } catch (error) {
            console.error('[OpenTelemetryIntegration] ❌ Telemetry agent initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize contrib instrumentations
     */
    async initializeContribInstrumentations() {
        try {
            console.log('[OpenTelemetryIntegration] 🔌 Initializing contrib instrumentations...');
            
            // Contrib instrumentations are automatically loaded through auto-instrumentations
            // Additional manual instrumentations can be added here if needed
            
            this.integration.contrib_instrumentations = true;
            console.log('[OpenTelemetryIntegration] ✅ Contrib instrumentations initialized');
        } catch (error) {
            console.error('[OpenTelemetryIntegration] ❌ Contrib instrumentations initialization failed:', error);
            throw error;
        }
    }

    /**
     * Log integration status
     */
    logIntegrationStatus() {
        console.log('\n📊 OpenTelemetry Integration Status:');
        console.log('═══════════════════════════════════════');
        console.log(`🚀 Upstream Components: ${this.integration.upstream_components ? '✅ Active' : '❌ Inactive'}`);
        console.log(`🔍 Enhanced Tracing: ${this.integration.enhanced_tracing ? '✅ Active' : '❌ Inactive'}`);
        console.log(`🤖 Telemetry Agent: ${this.integration.telemetry_agent ? '✅ Active' : '❌ Inactive'}`);
        console.log(`🔌 Contrib Instrumentations: ${this.integration.contrib_instrumentations ? '✅ Active' : '❌ Inactive'}`);
        console.log('═══════════════════════════════════════');
        
        const activeComponents = Object.values(this.integration).filter(Boolean).length;
        const totalComponents = Object.keys(this.integration).length;
        console.log(`📈 Integration Completeness: ${activeComponents}/${totalComponents} (${Math.round(activeComponents/totalComponents*100)}%)`);
        console.log('');
    }

    /**
     * Get comprehensive status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            integration_status: this.integration,
            sdk_status: !!this.sdk,
            tracer_available: !!this.tracer,
            meter_available: !!this.meter,
            agent_available: !!this.telemetryAgent,
            enhanced_tracing_status: OpenTelemetryTracing.getStatus(),
            agent_capabilities: this.telemetryAgent?.capabilities || {},
            service_info: {
                name: 'cartrita-integrated-telemetry',
                version: '2025.1.0',
                integration_type: 'upstream-merged',
                components_merged: [
                    'opentelemetry-js (upstream)',
                    'opentelemetry-js-contrib',
                    'enhanced-tracing-service',
                    'telemetry-agent'
                ]
            }
        };
    }

    /**
     * Create a custom trace with full integration
     */
    async createIntegratedTrace(name, attributes = {}, handler) {
        if (!this.initialized) {
            throw new Error('OpenTelemetry integration not initialized');
        }

        return await this.tracer.startActiveSpan(name, {
            kind: SpanKind.INTERNAL,
            attributes: {
                'cartrita.integration.type': 'merged-upstream',
                'cartrita.trace.enhanced': true,
                ...attributes
            }
        }, async (span) => {
            try {
                const result = await handler(span);
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                span.recordException(error);
                span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
                throw error;
            } finally {
                span.end();
            }
        });
    }

    /**
     * Process telemetry agent command
     */
    async processTelemetryCommand(command, context = {}) {
        if (!this.telemetryAgent) {
            throw new Error('Telemetry agent not available');
        }

        return await this.telemetryAgent.processMessage(command, context);
    }

    /**
     * Get telemetry manual
     */
    async getTelemetryManual() {
        if (!this.telemetryAgent) {
            return { error: 'Telemetry agent not available' };
        }

        return await this.telemetryAgent.getTelemetryManual();
    }

    /**
     * Shutdown the integrated service
     */
    async shutdown() {
        try {
            console.log('[OpenTelemetryIntegration] 🔽 Shutting down integrated service...');

            if (this.telemetryAgent) {
                // Telemetry agents don't typically need explicit shutdown
                console.log('[OpenTelemetryIntegration] ✅ Telemetry agent shutdown');
            }

            if (OpenTelemetryTracing.initialized) {
                await OpenTelemetryTracing.shutdown();
                console.log('[OpenTelemetryIntegration] ✅ Enhanced tracing shutdown');
            }

            if (this.sdk) {
                await this.sdk.shutdown();
                console.log('[OpenTelemetryIntegration] ✅ SDK shutdown');
            }

            this.initialized = false;
            this.integration = {
                upstream_components: false,
                enhanced_tracing: false,
                telemetry_agent: false,
                contrib_instrumentations: false
            };

            console.log('[OpenTelemetryIntegration] ✅ Complete shutdown successful');
        } catch (error) {
            console.error('[OpenTelemetryIntegration] ❌ Shutdown error:', error);
        }
    }
}

// Create singleton instance
const openTelemetryIntegration = new OpenTelemetryIntegrationService();

// Export both the instance and the class
export { openTelemetryIntegration as default, OpenTelemetryIntegrationService };