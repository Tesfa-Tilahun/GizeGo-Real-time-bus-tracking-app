/** Enable with ROUTE_DEBUG=1 in API environment. */
export function routeDebug(tag, payload) {
  if (process.env.ROUTE_DEBUG !== "1") return;
  const line = `[route-debug:${tag}] ${JSON.stringify(payload)}`;
  console.log(line);
}
