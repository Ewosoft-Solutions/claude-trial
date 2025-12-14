# Environment Configuration Guide

This document describes all environment variables required for the School With Ease API.

## Quick Start

1. Copy the appropriate template file to `.env`:

   ```bash
   cp env.template .env
   ```

2. Update the values in `.env` with your actual configuration

3. For staging/production, use the respective template files:
   ```bash
   cp env.staging.template .env.staging
   cp env.production.template .env.production
   ```

## Environment Variables

### Required Variables

#### Database Configuration

- `DATABASE_URL` (required): PostgreSQL connection string
  - Format: `postgresql://[user]:[password]@[host]:[port]/[database]`
  - Example: `postgresql://postgres:password@localhost:5432/schoolsys`
  - Production: Include SSL mode: `?sslmode=require`

### Application Configuration

- `NODE_ENV`: Environment mode (`development`, `staging`, `production`)
- `PORT`: Server port (default: `3000`)

### Security Configuration

- `JWT_SECRET`: Fallback JWT secret (school-specific secrets are auto-generated)
  - Generate: `openssl rand -base64 32`
  - **Important**: Must be unique per environment
  - **Note**: This is a fallback; school-specific secrets are stored in the database
  - **Format**: Quote the value if it contains `=` (padding): `JWT_SECRET="your-secret-with-padding="`

- `ENCRYPTION_KEY`: Master encryption key for sensitive data
  - Generate: `openssl rand -base64 32`
  - **Important**: Must be unique per environment and kept secure
  - **Format**: Quote the value if it contains `=` (padding): `ENCRYPTION_KEY="your-key-with-padding="`

### WebAuthn Configuration

- `WEBAUTHN_RP_NAME`: Relying Party name (default: `School With Ease`)
- `WEBAUTHN_RP_ID`: Relying Party ID (default: `localhost`)
- `WEBAUTHN_ORIGIN`: Origin URL (default: `http://localhost:3000`)

### Database Connection Pool

- `DB_POOL_MIN`: Minimum pool connections (default: `2`)
- `DB_POOL_MAX`: Maximum pool connections (default: `10`)
- `DB_CONNECTION_TIMEOUT`: Connection timeout in ms (default: `5000`)
- `DB_QUERY_TIMEOUT`: Query timeout in ms (default: `30000`)

### Database Logging

- `DB_LOG_QUERIES`: Enable query logging (default: `false`)
- `DB_LOG_ERRORS`: Enable error logging (default: `true`)
- `DB_LOG_WARNINGS`: Enable warning logging (default: `true`)

## MFA Service Integrations

### SMS Configuration

- `SMS_PROVIDER`: Provider type (`twilio`, `aws-sns`, `console`)
  - `console`: Development only - logs codes to console
  - `twilio`: Twilio SMS service
  - `aws-sns`: AWS Simple Notification Service

#### Twilio Configuration (if `SMS_PROVIDER=twilio`)

- `TWILIO_ACCOUNT_SID`: Twilio account SID
- `TWILIO_AUTH_TOKEN`: Twilio auth token
- `TWILIO_PHONE_NUMBER`: Twilio phone number (E.164 format)

#### AWS SNS Configuration (if `SMS_PROVIDER=aws-sns`)

- `AWS_SNS_REGION`: AWS region (e.g., `us-east-1`)
- `AWS_ACCESS_KEY_ID`: AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key

### Email Configuration

- `EMAIL_PROVIDER`: Provider type (`smtp`, `sendgrid`, `ses`, `console`)
  - `console`: Development only - logs codes to console
  - `smtp`: Standard SMTP server
  - `sendgrid`: SendGrid email service
  - `ses`: AWS Simple Email Service

#### SMTP Configuration (if `EMAIL_PROVIDER=smtp`)

- `SMTP_HOST`: SMTP server hostname
- `SMTP_PORT`: SMTP server port (default: `587`)
- `SMTP_USER`: SMTP username
- `SMTP_PASSWORD`: SMTP password
- `SMTP_SECURE`: Use TLS/SSL (default: `false`)
- `SMTP_FROM_EMAIL`: From email address
- `SMTP_FROM_NAME`: From name

#### SendGrid Configuration (if `EMAIL_PROVIDER=sendgrid`)

- `SENDGRID_API_KEY`: SendGrid API key

#### AWS SES Configuration (if `EMAIL_PROVIDER=ses`)

- `AWS_SES_REGION`: AWS region (e.g., `us-east-1`)
- `AWS_ACCESS_KEY_ID`: AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key

## Audit Logging Configuration

- `AUDIT_LOG_DESTINATION`: Log destinations (`database`, `file`, `external`, `all`)
  - `database`: Store in database (default)
  - `file`: Write to file
  - `external`: Send to external service
  - `all`: Use all destinations

- `AUDIT_LOG_ENABLED`: Enable audit logging (default: `true`)

#### File-based Audit Logs (if destination includes `file`)

- `AUDIT_LOG_FILE_PATH`: Path to audit log file (e.g., `./logs/audit.log`)

#### External Audit Service (if destination includes `external`)

- `AUDIT_LOG_EXTERNAL_URL`: External audit service API URL
- `AUDIT_LOG_EXTERNAL_API_KEY`: API key for external audit service

## Monitoring & Alerting Configuration

- `MONITORING_PROVIDER`: Monitoring provider (`datadog`, `newrelic`, `sentry`, `none`)
- `MONITORING_ENABLED`: Enable monitoring (default: `true`)

#### DataDog Configuration (if `MONITORING_PROVIDER=datadog`)

- `DATADOG_API_KEY`: DataDog API key
- `DATADOG_APP_KEY`: DataDog application key

#### New Relic Configuration (if `MONITORING_PROVIDER=newrelic`)

- `NEW_RELIC_LICENSE_KEY`: New Relic license key

#### Sentry Configuration (if `MONITORING_PROVIDER=sentry`)

- `SENTRY_DSN`: Sentry DSN
- `SENTRY_ENVIRONMENT`: Sentry environment name

#### Alerting

- `ALERT_EMAIL`: Email address for critical alerts
- `ALERT_WEBHOOK_URL`: Webhook URL for alerts (Slack, PagerDuty, etc.)

## Environment-Specific Configurations

### Development

```env
NODE_ENV=development
SMS_PROVIDER=console
EMAIL_PROVIDER=console
MONITORING_PROVIDER=none
AUDIT_LOG_DESTINATION=database
```

### Staging

```env
NODE_ENV=staging
SMS_PROVIDER=twilio
EMAIL_PROVIDER=smtp
MONITORING_PROVIDER=sentry
AUDIT_LOG_DESTINATION=all
```

### Production

```env
NODE_ENV=production
SMS_PROVIDER=twilio
EMAIL_PROVIDER=sendgrid
MONITORING_PROVIDER=datadog
AUDIT_LOG_DESTINATION=all
```

## JWT Secret Management

### Overview

The system uses **school-specific JWT secrets** stored in the database. The `JWT_SECRET` environment variable is only used as a fallback and should not be relied upon for production.

### School-Specific Secrets

- Each school (tenant) has its own JWT secret stored in the `tenant_jwt_secrets` table
- Secrets are auto-generated when a school is created (platform admin only)
- Secrets are encrypted at rest using the `ENCRYPTION_KEY`
- Secrets can be rotated on a schedule (90-180 days) or in emergency situations

### Secret Rotation

- **Scheduled Rotation**: Automatic rotation every 90-180 days (configurable per school)
- **Emergency Rotation**: Manual rotation by platform admin in case of security breach
- **Grace Period**: Old secrets remain valid for 24 hours after rotation to allow token refresh

### Environment-Specific Considerations

#### Development

- Use a simple fallback secret for testing
- School-specific secrets are still generated but can be simpler

#### Staging

- Use a unique fallback secret (different from dev/prod)
- Test secret rotation procedures
- Verify encryption is working correctly

#### Production

- **Never** rely on the fallback `JWT_SECRET`
- Ensure `ENCRYPTION_KEY` is strong and securely stored
- Monitor secret rotation schedules
- Have emergency rotation procedures documented

### Security Best Practices

1. **Never commit secrets to version control**
2. **Use environment-specific secrets** (different for dev/staging/prod)
3. **Rotate secrets regularly** (90-180 days)
4. **Use strong encryption keys** (64+ characters, random)
5. **Store secrets securely** (use secret management services in production)
6. **Monitor secret access** (audit log all secret operations)

## Generating Secure Secrets

### JWT Secret

```bash
openssl rand -base64 32
```

### Encryption Key

```bash
openssl rand -base64 32
```

### Production Secrets (64+ characters)

```bash
openssl rand -base64 64
```

### Important: Quoting Base64 Secrets

When generating secrets with `openssl rand -base64`, the output may contain special characters like `/` and `=` (padding).

**Best Practice**: Always quote secret values in `.env` files to ensure proper parsing:

```env
# ✅ Correct - quoted (recommended)
JWT_SECRET="MRaLjNUXTvvhpxFJWNi4QAb4yCHGO23Drqkp/5uIEPQ="
ENCRYPTION_KEY="MRaLjNUXTvvhpxFJWNi4QAb4yCHGO23Drqkp/5uIEPQ="

# ⚠️ Works but less safe - unquoted
JWT_SECRET=MRaLjNUXTvvhpxFJWNi4QAb4yCHGO23Drqkp/5uIEPQ=
```

**Why quote?**

- The `=` character is the delimiter in `.env` files
- Quoting ensures the entire value (including padding `=`) is captured correctly
- Prevents issues with different `.env` parsers
- Handles values with spaces or other special characters
- More portable across different systems and tools

**Note**: The `/` character works fine unquoted, but quoting is still recommended for consistency and safety.

## Validation

The environment configuration is validated on application startup using `class-validator`. If any required variables are missing or invalid, the application will fail to start with a clear error message.

## Troubleshooting

### Common Issues

1. **Missing DATABASE_URL**: Application will fail to start
   - Solution: Set `DATABASE_URL` in `.env` file

2. **Invalid JWT_SECRET**: May cause authentication issues
   - Solution: Generate a new secret using `openssl rand -base64 32`

3. **MFA not working**: Check provider configuration
   - Development: Use `console` provider to see codes in logs
   - Production: Verify API keys and credentials are correct

4. **Audit logs not appearing**: Check destination configuration
   - Verify `AUDIT_LOG_ENABLED=true`
   - Check `AUDIT_LOG_DESTINATION` is set correctly
   - Verify file permissions if using file destination

## References

- [Database Deployment Guide](../../packages/database/docs/DEPLOYMENT_GUIDE.md)
- [Security Strategy](../../../_actions/multi-tenancy-security-strategy.md)
- [Monitoring Requirements](../../../_requirements/monitoring-auditing.md)
