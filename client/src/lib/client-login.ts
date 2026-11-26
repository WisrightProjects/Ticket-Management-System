export const CLIENT_LOGIN_PATH = "/portal/login";

export function clientPortalDestination(returnTo: string | null) {
  return returnTo && /^\/portal\/(dashboard|tickets(?:\/TKT-\d+)?|new|profile)(?:\?[^#]*)?$/.test(returnTo)
    ? returnTo
    : "/portal/dashboard";
}
