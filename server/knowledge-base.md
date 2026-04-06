# Knowledge Base

## Password Reset
Users can reset their password by clicking "Forgot Password" on the login page and entering their email address. A reset link will be sent within a few minutes. The link expires after 24 hours. If no email arrives, check the spam folder or contact support.

## How to Change Email Address
To update your email address, go to Settings → Profile → Edit Email. A verification link will be sent to the new address before the change takes effect.

## PostgreSQL Connection Pooling
For PostgreSQL connection pooling, use PgBouncer in transaction mode or configure your application's pool to a maximum of 10–20 connections per instance. In your config, set `pool_mode = transaction` and `max_client_conn` appropriately. Avoid session mode for high-traffic apps. For Prisma, set `connection_limit` in the datasource URL.

## Slow PostgreSQL Queries / Performance
To diagnose slow queries, run `EXPLAIN ANALYZE <your query>` in psql. Look for Sequential Scans on large tables — add indexes on columns used in WHERE, JOIN, and ORDER BY clauses. Use `pg_stat_statements` to find the top slow queries. Also ensure `autovacuum` is running and statistics are up to date via `ANALYZE`.

## Database Indexes
Create indexes with `CREATE INDEX idx_name ON table(column)`. For multi-column queries use composite indexes. Use `CREATE INDEX CONCURRENTLY` to avoid locking on production. Drop unused indexes with `DROP INDEX` — they slow down writes.

## Billing and Subscription
Subscriptions can be cancelled from Settings → Billing → Cancel Plan. Refunds for unused time are processed within 5–7 business days back to the original payment method. For invoice copies, go to Settings → Billing → Download Invoice.

## Cannot Log In / Account Locked
If you cannot log in, first try resetting your password. If your account is locked after multiple failed attempts, it will automatically unlock after 15 minutes. Contact support if the issue persists.

## Two-Factor Authentication (2FA)
Enable 2FA from Settings → Security → Two-Factor Authentication. Use an authenticator app such as Google Authenticator or Authy. If you lose access to your 2FA device, use one of the backup codes provided during setup.

## API Rate Limits
The API allows 100 requests per 15 minutes per user. If you receive a 429 Too Many Requests response, wait before retrying. Use exponential back-off in your client code. Contact support to request a rate limit increase for high-volume integrations.

## Webhook Setup
To configure a webhook, go to Settings → Integrations → Webhooks and enter your endpoint URL. We send a POST request with a JSON body signed with your webhook secret in the `x-webhook-secret` header. Verify this signature on your server before processing the payload.

## Export Data to CSV
Data can be exported from the Reports section. Select the date range and click Export → CSV. Large exports may take a few minutes; you will receive an email with the download link when ready.

## GDPR / Data Deletion Request
To request deletion of your personal data, email privacy@company.com with the subject "Data Deletion Request". We will process requests within 30 days in accordance with GDPR Article 17.
