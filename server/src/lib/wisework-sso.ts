import { genericOAuth } from "better-auth/plugins";
import { ROLES, z } from "@tms/core";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { supportProfile } from "./support-access.js";
import prisma from "./prisma.js";

const providerId = "wisework";
const {
  WISEWORK_API_ORIGIN: wiseWorkOrigin,
  RIGHT_TRACKER_OAUTH_CLIENT_ID: clientId,
  RIGHT_TRACKER_OAUTH_CLIENT_SECRET: clientSecret,
  RIGHT_TRACKER_OAUTH_CALLBACK_URL: callbackUrl,
  WISEWORK_SSO_TENANT_ID: pilotTenantId,
  BETTER_AUTH_URL: authOrigin,
  BETTER_AUTH_SECRET: storageKey,
} = process.env;

function validEndpoint(value: string) {
  try {
    const url = new URL(value);
    return !url.username && !url.password && !url.hash && (
      url.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" && url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    );
  } catch {
    return false;
  }
}

function readOrigin(value: string | undefined) {
  if (!value || !validEndpoint(value)) return null;
  const url = new URL(value);
  return url.pathname === "/" && !url.search ? url.origin : null;
}

const providerOrigin = readOrigin(wiseWorkOrigin);
const rightTrackerOrigin = readOrigin(authOrigin);
const providerBase = `${providerOrigin}/api/v1/oauth/right-tracker`;
const expectedCallback = `${rightTrackerOrigin}/api/auth/oauth2/callback/wisework`;

// Ticket data is shared within this installation. Keep SSO limited to one pilot tenant.
export const wiseWorkSso = providerOrigin && rightTrackerOrigin && callbackUrl === expectedCallback &&
  clientId && clientSecret && storageKey && pilotTenantId && z.guid().safeParse(pilotTenantId).success
  ? genericOAuth({
    config: [{
      providerId,
      clientId,
      clientSecret,
      authorizationUrl: `${providerBase}/authorize`,
      tokenUrl: `${providerBase}/token`,
      authentication: "post",
      scopes: ["openid", "profile"],
      pkce: true,
      disableSignUp: true,
      async getUserInfo({ accessToken }) {
        if (!accessToken) return null;
        try {
          const profile = await readSupportProfile(accessToken);
          if (!profile) return null;
          const accountId = `${profile.tenant_id}:${profile.sub}`;
          const accounts = await prisma.account.findMany({
            where: { providerId, accountId },
            select: { id: true, user: { select: { email: true, name: true, isActive: true, role: true } } },
            take: 2,
          });
          const user = accounts[0]?.user;
          if (accounts.length !== 1 || !user?.isActive ||
            (user.role !== ROLES.ADMIN && user.role !== ROLES.AGENT)) return null;
          await prisma.account.update({
            where: { id: accounts[0].id },
            data: { accessToken: await symmetricEncrypt({ key: storageKey, data: accessToken }) },
          });
          return { id: accountId, email: user.email, name: user.name, emailVerified: false };
        } catch {
          return null;
        }
      },
    }],
  })
  : null;

async function readSupportProfile(token: string) {
  const response = await fetch(`${providerBase}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: "error",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return null;
  const profile = supportProfile.safeParse(await response.json());
  return profile.success && profile.data.tenant_id === pilotTenantId ? profile.data : null;
}

export async function loadSupportAccess(userId: string) {
  const accounts = await prisma.account.findMany({
    where: { providerId, userId },
    select: { accountId: true, accessToken: true },
    take: 2,
  });
  if (!accounts.length) return undefined;
  if (!wiseWorkSso || !storageKey || accounts.length !== 1 || !accounts[0].accessToken) return null;
  try {
    const token = await symmetricDecrypt({ key: storageKey, data: accounts[0].accessToken });
    const profile = await readSupportProfile(token);
    return profile && `${profile.tenant_id}:${profile.sub}` === accounts[0].accountId ? profile : null;
  } catch {
    return null;
  }
}
