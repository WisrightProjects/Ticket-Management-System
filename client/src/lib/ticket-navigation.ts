export function ticketReturnPath(search: string) {
  const requested = new URLSearchParams(search).get("returnTo") ?? "";
  return /^\/(?:work|tickets)(?:\?[^#]*)?$/.test(requested) ? requested : "/tickets";
}

export function ticketDetailPath(ticketId: string, returnTo?: string) {
  return `/tickets/${ticketId}${returnTo ? `?${new URLSearchParams({ returnTo })}` : ""}`;
}
