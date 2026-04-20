import { buildSessionCookie, buildUserCookie, clearAuthCookies, isSecureRequest, normalizeUsername, parseCookieHeader, usernameKey } from "./auth.js";
import { UserStore } from "./user-store.js";
import type { Env as UserStoreEnv } from "./user-store.js";

export { UserStore };

export interface Env extends UserStoreEnv {
  ASSETS: Fetcher;
}

const IMPORT_RPC_CHUNK_SIZE = 1024 * 1024;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, ctx);
    }

    return serveApp(request, env);
  }
};

async function handleApi(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    return handleMe(request, env);
  }

  if (url.pathname === "/api/auth/signup" && request.method === "POST") {
    return handleSignup(request, env);
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    return handleLogin(request, env);
  }

  if (url.pathname === "/api/auth/reset-password" && request.method === "POST") {
    return handleResetPassword(request, env);
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    return handleLogout(request, env);
  }

  const auth = readAuthCookies(request);
  if (!auth) {
    return json({ error: "Unauthorized" }, 401);
  }

  const stub = env.USER_STORE.getByName(usernameKey(auth.username));
  const api = stub as unknown as {
    dashboard: (input: { range: ReturnType<typeof parseRange>; token: string }) => Promise<unknown>;
    workbench: (input: { token: string }) => Promise<unknown>;
    sleep: (input: { range: ReturnType<typeof parseRange>; token: string }) => Promise<unknown>;
    workouts: (input: { range: ReturnType<typeof parseRange>; token: string }) => Promise<unknown>;
    heart: (input: { range: ReturnType<typeof parseRange>; token: string }) => Promise<unknown>;
    weeklyReview: (input: { week?: string; token: string }) => Promise<unknown>;
    syncStatus: (input: { token: string }) => Promise<unknown>;
    listAnnotations: (input: { token: string }) => Promise<unknown>;
    createAnnotation: (input: { token: string; date: string; kind: string; label: string }) => Promise<unknown>;
    updateAnnotation: (input: { token: string; id: number; date?: string; kind?: string; label?: string }) => Promise<unknown>;
    deleteAnnotation: (input: { token: string; id: number }) => Promise<unknown>;
    startImport: (input: { fileName: string; token: string }) => Promise<{ jobId: string; fileName: string; status: "queued" }>;
    stageImportChunk: (input: { jobId: string; index: number; chunkCount: number; bytes: Uint8Array; token: string }) => Promise<{ ok: true }>;
    queueImport: (input: { jobId: string; fileName: string; chunkCount: number; token: string }) => Promise<{ ok: true }>;
    failImport: (input: { jobId: string; chunkCount: number; token: string; errorMessage: string }) => Promise<{ ok: true }>;
    getImportJob: (input: { jobId: string; token: string }) => Promise<unknown>;
  };

  if (url.pathname === "/api/dashboard" && request.method === "GET") {
    return routeResult(() => api.dashboard({ range: parseRange(url.searchParams.get("range")), token: auth.token }));
  }

  if (url.pathname === "/api/workbench" && request.method === "GET") {
    return routeResult(() => api.workbench({ token: auth.token }));
  }

  if (url.pathname === "/api/sleep" && request.method === "GET") {
    return routeResult(() => api.sleep({ range: parseRange(url.searchParams.get("range")), token: auth.token }));
  }

  if (url.pathname === "/api/workouts" && request.method === "GET") {
    return routeResult(() => api.workouts({ range: parseRange(url.searchParams.get("range")), token: auth.token }));
  }

  if (url.pathname === "/api/heart" && request.method === "GET") {
    return routeResult(() => api.heart({ range: parseRange(url.searchParams.get("range")), token: auth.token }));
  }

  if (url.pathname === "/api/weekly-review" && request.method === "GET") {
    return routeResult(() => api.weeklyReview({ week: url.searchParams.get("week") ?? undefined, token: auth.token }));
  }

  if (url.pathname === "/api/sync-status" && request.method === "GET") {
    return routeResult(() => api.syncStatus({ token: auth.token }));
  }

  if (url.pathname === "/api/annotations" && request.method === "GET") {
    return routeResult(() => api.listAnnotations({ token: auth.token }));
  }

  if (url.pathname === "/api/annotations" && request.method === "POST") {
    const body = await readJson(request);
    return routeResult(() => api.createAnnotation({ token: auth.token, date: String(body.date ?? ""), kind: String(body.kind ?? ""), label: String(body.label ?? "") }));
  }

  if (url.pathname.startsWith("/api/annotations/") && request.method === "PATCH") {
    const id = Number(url.pathname.split("/").pop() ?? "");
    const body = await readJson(request);
    return routeResult(() => api.updateAnnotation({ id, token: auth.token, date: typeof body.date === "string" ? body.date : undefined, kind: typeof body.kind === "string" ? body.kind : undefined, label: typeof body.label === "string" ? body.label : undefined }));
  }

  if (url.pathname.startsWith("/api/annotations/") && request.method === "DELETE") {
    const id = Number(url.pathname.split("/").pop() ?? "");
    return routeResult(() => api.deleteAnnotation({ id, token: auth.token }));
  }

  if (url.pathname === "/api/import/apple-health" && request.method === "POST") {
    return handleAppleImport(request, env, ctx, stub, auth);
  }

  if (url.pathname.startsWith("/api/import/apple-health/jobs/") && request.method === "GET") {
    const jobId = url.pathname.split("/").pop() ?? "";
    return routeResult(() => stub.getImportJob({ jobId, token: auth.token }));
  }

  return json({ error: "Not found" }, 404);
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  const auth = readAuthCookies(request);
  if (!auth) {
    return json({ user: null });
  }

  const stub = env.USER_STORE.getByName(usernameKey(auth.username));
  try {
    const result = await stub.me({ token: auth.token });
    return json(result);
  } catch {
    return json({ user: null });
  }
}

async function handleSignup(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return json({ error: "Username and password are required" }, 400);
  }

  const stub = env.USER_STORE.getByName(usernameKey(username));
  try {
    const result = await stub.signup({ username, password });
    const headers = new Headers();
    headers.append("Set-Cookie", buildUserCookie(result.user.username, isSecureRequest(request)));
    headers.append("Set-Cookie", await buildSessionCookie(result.sessionToken, isSecureRequest(request)));
    return json({ user: result.user }, 200, headers);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Signup failed" }, 400);
  }
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return json({ error: "Username and password are required" }, 400);
  }

  const stub = env.USER_STORE.getByName(usernameKey(username));
  try {
    const result = await stub.login({ username, password });
    const headers = new Headers();
    headers.append("Set-Cookie", buildUserCookie(result.user.username, isSecureRequest(request)));
    headers.append("Set-Cookie", await buildSessionCookie(result.sessionToken, isSecureRequest(request)));
    return json({ user: result.user }, 200, headers);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Login failed" }, 401);
  }
}

async function handleResetPassword(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return json({ error: "Username and new password are required" }, 400);
  }

  const stub = env.USER_STORE.getByName(usernameKey(username));
  try {
    const result = await stub.resetPassword({ username, password });
    const headers = new Headers();
    headers.append("Set-Cookie", buildUserCookie(result.user.username, isSecureRequest(request)));
    headers.append("Set-Cookie", await buildSessionCookie(result.sessionToken, isSecureRequest(request)));
    return json({ user: result.user }, 200, headers);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Password reset failed" }, 400);
  }
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const auth = readAuthCookies(request);
  if (auth) {
    const stub = env.USER_STORE.getByName(usernameKey(auth.username));
    try {
      await stub.logout({ token: auth.token });
    } catch {
      // Ignore logout errors; the cookies will be cleared either way.
    }
  }

  const headers = new Headers();
  for (const cookie of clearAuthCookies(isSecureRequest(request))) {
    headers.append("Set-Cookie", cookie);
  }
  return json({ ok: true }, 200, headers);
}

async function handleAppleImport(
  request: Request,
  _env: Env,
  ctx: ExecutionContext,
  stub: DurableObjectStub<UserStore>,
  auth: { username: string; token: string }
): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return json({ error: "Missing file upload" }, 400);
  }

  const fileName = file.name || "apple-health-export.zip";
    const api = stub as unknown as {
      startImport: (input: { fileName: string; token: string }) => Promise<{ jobId: string; fileName: string; status: "queued" }>;
      stageImportChunk: (input: { jobId: string; index: number; chunkCount: number; bytes: Uint8Array; token: string }) => Promise<{ ok: true }>;
      queueImport: (input: { jobId: string; fileName: string; chunkCount: number; token: string }) => Promise<{ ok: true }>;
      failImport: (input: { jobId: string; chunkCount: number; token: string; errorMessage: string }) => Promise<{ ok: true }>;
    };
    const job = await api.startImport({ fileName, token: auth.token });
  let chunkCount = 0;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    chunkCount = Math.max(1, Math.ceil(bytes.byteLength / IMPORT_RPC_CHUNK_SIZE));

    for (let index = 0; index < chunkCount; index += 1) {
      const start = index * IMPORT_RPC_CHUNK_SIZE;
      const end = Math.min(start + IMPORT_RPC_CHUNK_SIZE, bytes.byteLength);
      await api.stageImportChunk({
        jobId: job.jobId,
        index,
        chunkCount,
        bytes: bytes.slice(start, end),
        token: auth.token
      });
    }

    await api.queueImport({ jobId: job.jobId, fileName, chunkCount, token: auth.token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import upload staging failed";
    try {
      await api.failImport({ jobId: job.jobId, chunkCount, token: auth.token, errorMessage: message });
    } catch (markError) {
      console.error("Failed to mark staged import as failed", markError);
    }
    return json({ error: message }, 500);
  }

  return json(job, 202);
}

async function serveApp(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  return env.ASSETS.fetch(withAssetHost(request, url.pathname, url.search));
}

function withAssetHost(request: Request, pathname: string, search = ""): Request {
  const assetUrl = new URL(request.url);
  assetUrl.protocol = "https:";
  assetUrl.hostname = "assets.local";
  assetUrl.pathname = pathname;
  assetUrl.search = search;
  return new Request(assetUrl.toString(), request);
}

function readAuthCookies(request: Request): { username: string; token: string } | null {
  const cookies = parseCookieHeader(request.headers.get("cookie") ?? undefined);
  const username = cookies.healthpulse_user;
  const token = cookies.healthpulse_session;
  if (!username || !token) {
    return null;
  }

  return { username, token };
}

function parseRange(value: string | null) {
  return value === "1d" ||
    value === "7d" ||
    value === "14d" ||
    value === "30d" ||
    value === "90d" ||
    value === "180d" ||
    value === "1y"
    ? value
    : "30d";
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function routeResult<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    return json(await fn());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status = message === "Unauthorized" ? 401 : message === "Import job not found" ? 404 : 400;
    return json({ error: message }, status);
  }
}

function json(data: unknown, status = 200, headers?: Headers): Response {
  const responseHeaders = headers ?? new Headers();
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}
