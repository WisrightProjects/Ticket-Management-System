# WiseWork staff single sign-on

## Stories

1. As an active employee, I can open Right Tracker from the WiseWork employee menu and land on my dashboard using my existing WiseWork session.
2. As a staff member who starts at Right Tracker, I can select **Continue with WiseWork**. If my WiseWork session has expired, I sign in and complete any required verification there before returning to Right Tracker.
3. As an administrator, I can link an existing Right Tracker staff account to a stable WiseWork identity. New identities never create staff accounts or receive privileges automatically.
4. As a project head or project member, I can access tickets according to the agreed project rules. Pilot acceptance requires verifying project boundaries and assigning reply permissions after the team confirms them.
5. As a customer, I can continue using my invitation and client sign-in credentials.

## Right Tracker integration contract

- WiseWork menu target is `<RIGHT_TRACKER_WEB_ORIGIN>/staff/wisework`.
- Set `WISEWORK_API_ORIGIN` to the bare WiseWork API origin, for example `http://localhost:3100` for a local pilot. Right Tracker appends `/api/v1/oauth/right-tracker`. Set `RIGHT_TRACKER_OAUTH_CLIENT_ID`, `RIGHT_TRACKER_OAUTH_CLIENT_SECRET`, and `RIGHT_TRACKER_OAUTH_CALLBACK_URL` on the Right Tracker server.
- Set `WISEWORK_SSO_TENANT_ID` to the approved pilot tenant UUID. The integration stays disabled until configuration is complete and the callback exactly matches `<BETTER_AUTH_URL>/api/auth/oauth2/callback/wisework`. Register that same callback in WiseWork. Use HTTPS outside localhost.
- The provider must support authorization code, PKCE S256 and scopes `openid profile`, with confidential client authentication using credentials in the token request body. Use the Bearer access token for UserInfo, which must return stable `sub`, authenticated `tenant_id`, and current boolean `active`. The subject must only be issued after WiseWork's normal sign-in and verification policies allow it.
- Before the pilot, provision one Better Auth Account row with `providerId = wisework`, `accountId = tenant_id:sub` and `userId` of the approved, existing Right Tracker staff account. Keep the mapping unique. Review the selected account's existing privileges before linking. The app rejects missing, duplicate, inactive, customer or wrong-tenant identities.
- Right Tracker opens its own staff session. Pilot deactivation and revocation checks must cover both new sign-ins and already issued sessions.
- Test employee, project head, deactivated employee, an unrelated tenant, expired WiseWork session, and a customer. Test WiseWork desktop separately because its session may not carry over to the browser.

## Delivery boundaries

Right Tracker has a configurable SSO consumer. A live pilot requires the WiseWork identity provider, menu entry, account links, and project permission acceptance checks. The WiseWork provider exists locally. Apply its `backend/prisma/deploy/117-right-tracker-oauth.sql` migration and configure both environments before attempting the pilot. A shared pilot requires a reachable staging or public WiseWork origin.


## Support role enforcement

WiseWork UserInfo must return `support_role`, `project_ids`, and `led_project_ids` in addition to identity and active status. The server refreshes these claims on protected requests. TSA has tenant-wide ticket access. Project leads use only `led_project_ids`, and members use only `project_ids`. Leads and members can add internal notes. Only TSA can send public replies. Members cannot assign tickets.

The existing account token field stores the provider access token encrypted. If WiseWork denies access, gives incomplete claims, or the token expires, Right Tracker revokes the session on the next protected API request. The local provider token lasts five minutes, at which point the employee can reopen Right Tracker via WiseWork. The pilot remains pinned to one tenant because tickets do not have tenant ownership columns.
