// Minimal semantic attribute constants for runtime JS usage
// Derived from semantic-conventions package (TS sources) without direct TS import.
export const SEMRESATTRS = {
  SERVICE_NAME: 'service.name',
  SERVICE_NAMESPACE: 'service.namespace',
  SERVICE_VERSION: 'service.version',
  SERVICE_INSTANCE_ID: 'service.instance.id',
  DEPLOYMENT_ENVIRONMENT: 'deployment.environment',
};

export function buildBaseResourceAttributes(env = process.env) {
  return {
    [SEMRESATTRS.SERVICE_NAME]: env.OTEL_SERVICE_NAME || 'cartrita-backend',
    [SEMRESATTRS.SERVICE_NAMESPACE]: env.SERVICE_NAMESPACE || 'cartrita',
    [SEMRESATTRS.SERVICE_VERSION]: env.SERVICE_VERSION || 'dev',
    [SEMRESATTRS.SERVICE_INSTANCE_ID]: env.HOSTNAME || `${process.pid}`,
    [SEMRESATTRS.DEPLOYMENT_ENVIRONMENT]: env.DEPLOYMENT_ENV || env.NODE_ENV || 'development',
  };
}

export function withSemanticResource(attrs, extra) {
  return { ...attrs, ...extra };
}
