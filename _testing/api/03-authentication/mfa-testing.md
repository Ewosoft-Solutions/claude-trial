# MFA Testing

Multi-factor authentication is optional per user. When enabled, the login flow adds a verification step before school selection. With `SMS_PROVIDER=console` and `EMAIL_PROVIDER=console` in your `.env`, all verification codes are printed to the API server's stdout.

## Setting Up MFA for a User

You need to be authenticated first (see the [main auth guide](./README.md)).

### Step 1: Setup an MFA Method

Choose one of the available methods:

```bash
# SMS-based MFA
curl -X POST http://localhost:3000/auth/mfa/setup/sms \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{ "phoneNumber": "+1234567890" }'

# Email-based MFA
curl -X POST http://localhost:3000/auth/mfa/setup/email \
  -H "Authorization: Bearer <accessToken>"

# TOTP (authenticator app)
curl -X POST http://localhost:3000/auth/mfa/setup/totp \
  -H "Authorization: Bearer <accessToken>"
```

Each returns a pending method with a verification requirement.

### Step 2: Verify and Activate

After setup, you need to verify the method with a code. With console providers, check the API server stdout for the code.

```bash
curl -X POST http://localhost:3000/auth/mfa/verify-activate \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "methodId": "<method-id-from-setup>",
    "code": "<code-from-console>"
  }'
```

### Step 3: Generate Recovery Codes

Always generate recovery codes as a backup:

```bash
curl -X POST http://localhost:3000/auth/mfa/recovery/generate \
  -H "Authorization: Bearer <accessToken>"
```

Save the returned codes — they're single-use.

## Login with MFA

When MFA is active, `POST /auth/login` returns a different response:

```json
{
  "success": true,
  "mfaRequired": true,
  "challengeId": "<challenge-uuid>",
  "methods": [
    { "id": "<method-id>", "type": "sms", "isPrimary": true }
  ]
}
```

### Initiate and Complete the Challenge

```bash
# The challenge is auto-initiated on login, but you can re-initiate:
curl -X POST http://localhost:3000/auth/mfa/verify/initiate \
  -H "Content-Type: application/json" \
  -d '{ "challengeId": "<challenge-id>", "methodId": "<method-id>" }'

# Check the API stdout for the code, then verify:
curl -X POST http://localhost:3000/auth/verify-mfa-login \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "<challenge-id>",
    "code": "<code-from-console>"
  }'
```

After successful MFA verification, you get the `schools[]` list and continue with `POST /auth/select-school` as normal.

## Managing MFA Methods

```bash
# List active methods
curl http://localhost:3000/auth/mfa/methods \
  -H "Authorization: Bearer <accessToken>"

# Set a method as primary
curl -X PUT http://localhost:3000/auth/mfa/methods/<methodId>/primary \
  -H "Authorization: Bearer <accessToken>"

# Disable a method
curl -X PUT http://localhost:3000/auth/mfa/methods/<methodId>/disable \
  -H "Authorization: Bearer <accessToken>"

# Delete a method
curl -X DELETE http://localhost:3000/auth/mfa/methods/<methodId> \
  -H "Authorization: Bearer <accessToken>"
```

## Using Recovery Codes

If you can't access your MFA device:

```bash
curl -X POST http://localhost:3000/auth/verify-mfa-login \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "<challenge-id>",
    "recoveryCode": "<one-of-your-recovery-codes>"
  }'
```

Each recovery code can only be used once.
