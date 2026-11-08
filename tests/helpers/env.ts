import { NextRequest } from "next/server";

/** Request-scoped context the mocked next/headers reads from. */
export const ctx = { host: "jprimecheats.store", cookie: "" as string };

/** Factory for vi.mock("next/headers") — vi.mock itself must be called at the top level of the test file. */
export function nextHeadersMock() {
  return {
    headers: async () => new Headers({ host: ctx.host }),
    cookies: async () => ({
      get: (name: string) => (name === "jp_session" && ctx.cookie ? { name, value: ctx.cookie } : undefined),
    }),
  };
}

export function req(path: string, init: { method?: string; body?: unknown; host?: string } = {}) {
  const host = init.host ?? ctx.host;
  // In a real server, headers() reflects the request being served; mirror that here.
  ctx.host = host;
  const method = init.method ?? "GET";
  return new NextRequest(`https://${host}${path}`, {
    method,
    headers: { host, origin: `https://${host}`, "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
