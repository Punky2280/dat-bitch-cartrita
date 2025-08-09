# Expanded API Key Vault Specification

Version: 0.1.0-phase1

## Executive Summary

Introduces typed, validated, rotation‑aware secret storage for 50 providers with encryption, masking, rotation scheduling, validation, and runtime ephemeral materialization.

## Provider Catalog

Categories: ai, infrastructure, analytics, communication, payments, productivity, search-index, vector-db, datastores, weather, monitoring, misc.

| Provider | Category | Key Fields |
|----------|----------|-----------|
| openai | ai | apiKey |
| huggingface | ai | token |
| anthropic | ai | apiKey |
| replicate | ai | apiToken |
| stability | ai | apiKey |
| assemblyai | ai | apiKey |
| deepgram | ai | apiKey |
| elevenlabs | ai | apiKey |
| google | infrastructure | serviceAccountJson OR apiKey |
| aws | infrastructure | accessKeyId, secretAccessKey, region |
| azure | infrastructure | tenantId, clientId, clientSecret, subscriptionId |
| stripe | payments | secretKey |
| paypal | payments | clientId, clientSecret |
| plaid | payments | clientId, secret, env |
| twilio | communication | accountSid, authToken |
| slack | communication | botToken |
| discord | communication | botToken |
| github | misc | token |
| gitlab | misc | token |
| notion | productivity | integrationToken |
| jira | productivity | email, apiToken, siteDomain |
| linear | productivity | apiKey |
| confluence | productivity | email, apiToken, siteDomain |
| airtable | productivity | apiKey |
| clickup | productivity | apiKey |
| asana | productivity | personalAccessToken |
| trello | productivity | apiKey, apiToken |
| algolia | search-index | appId, apiKey |
| meilisearch | search-index | host, masterKey |
| pinecone | vector-db | apiKey, environment |
| weaviate | vector-db | apiKey, host |
| redis | datastores | host, port, password |
| postgres | datastores | host, port, database, user, password |
| supabase | datastores | url, anonKey, serviceRoleKey |
| firebase | datastores | serviceAccountJson |
| neon | datastores | connectionString |
| upstash | datastores | restUrl, restToken |
| elastic | datastores | cloudId, apiKey |
| s3 | datastores | accessKeyId, secretAccessKey, bucket, region |
| openweather | weather | apiKey |
| sendgrid | communication | apiKey |
| mailgun | communication | domain, apiKey |
| postmark | communication | serverToken |
| segment | analytics | writeKey |
| mixpanel | analytics | projectToken, apiSecret |
| datadog | monitoring | apiKey, appKey |
| sentry | monitoring | dsn, authToken |
| pagerduty | monitoring | apiToken |
| cloudflare | infrastructure | apiToken, accountId |
| vercel | infrastructure | apiToken |
| netlify | infrastructure | accessToken |

## Validation Patterns (Regex Examples)

```ts
export const providerValidators: Record<string, Record<string, RegExp>> = {
  openai: { apiKey: /^sk-[A-Za-z0-9]{32,}$/ },
  huggingface: { token: /^hf_[A-Za-z0-9]{30,}$/ },
  aws: { accessKeyId: /^AKIA[0-9A-Z]{16}$/, secretAccessKey: /^[A-Za-z0-9/+=]{40}$/, region: /^[a-z]{2}-[a-z]+-\d$/ },
  stripe: { secretKey: /^sk_(live|test)_[A-Za-z0-9]{24,}$/ },
  slack: { botToken: /^xox[baprs]-[A-Za-z0-9-]{10,}/ },
  twilio: { accountSid: /^AC[0-9a-fA-F]{32}$/, authToken: /^[0-9a-fA-F]{32}$/ },
  github: { token: /^gh[pousr]_[A-Za-z0-9]{36,}$/ },
  pinecone: { apiKey: /^[a-f0-9-]{32,}$/ },
  postgres: { host: /^[A-Za-z0-9_.-]+$/, port: /^\d{2,5}$/ },
  redis: { port: /^\d{2,5}$/ }
};
```

## Database Extensions (Phase 1 Migration 11)

```sql
ALTER TABLE user_api_keys ADD COLUMN category TEXT;
ALTER TABLE user_api_keys ADD COLUMN rotation_policy JSONB DEFAULT '{"intervalDays":90,"autoRotate":false}'::jsonb;
ALTER TABLE user_api_keys ADD COLUMN visibility TEXT DEFAULT 'MASKED';
ALTER TABLE user_api_keys ADD COLUMN checksum TEXT;
ALTER TABLE user_api_keys ADD COLUMN metadata JSONB;
```

## Credential Create Flow

1. Client fetches /api/vault/providers (catalog + fields + regex hints)
2. User submits provider + fields
3. Backend validates presence + regex
4. Serialize payload JSON, compute sha256 checksum, encrypt (AES-256-GCM)
5. Store encryptedKey (existing), plus rotation_policy, visibility, checksum
6. Return record (maskedValue only)

## Masking

```text
maskedValue = raw.slice(0,3) + '…' + raw.slice(-4)
```

Large multi-field providers: show `<n> fields stored` instead of partial substring.

## Rotation

- Auto: if rotation_policy.autoRotate true and NOW() > lastRotatedAt + intervalDays.
- Manual: POST /api/vault/credentials/:id/rotate
- Outcome: new encrypted payload & version increment (future version table optional Phase 2+)

## Validation Endpoint

- POST /api/vault/credentials/:id/validate
- Decrypt, perform minimal provider ping (HEAD /models, simple auth call) with 5s timeout.
- Update status + metadata.lastValidatedAt + rateLimitRemaining if header present.

## Runtime Secret Materialization

- Internal service call (not exposed publicly in Phase 1) emits ephemeral token mapping → decrypted secret in memory Map with TTL (<=120s)
- Workflow engine (Phase 3+) exchanges token for real value exactly once.

## Security Controls

- Encryption key not stored in DB; rotate master key ID recorded separately.
- Access policy: user_id + role (future: RBAC table binding teams to credentials).
- Audit log entries: create, update (rotation), validate, delete.
- Redaction middleware strips values matching union of regex patterns from logs.

## Metrics (Phase 1)

- vault_credentials_total{provider,status}
- vault_validation_attempts_total{provider,result}
- vault_rotation_attempts_total{provider,result}

## Error Model

| Code | Scenario | Response |
|------|----------|----------|
| VAULT_VALIDATION_FAILED | Provider ping failed | 422 w/ details |
| VAULT_REGEX_MISMATCH | Field invalid | 400 w/ fieldErrors |
| VAULT_ENCRYPTION_ERROR | Crypto failure | 500 masked message |

## Roadmap Links

- Phase 2: add version table + secret sharing groups.
- Phase 5: provider auto-rotation APIs (where supported) & usage quota ingest.
