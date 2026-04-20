const SESSION_COOKIE = "healthpulse_session";
const USER_COOKIE = "healthpulse_user";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 32;
const PASSWORD_ITERATIONS = 100_000;

export interface AuthUser {
  username: string;
  username_key: string;
  password_hash: string;
  created_at: string;
}

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const index = part.indexOf("=");
    if (index === -1) {
      return acc;
    }

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {});
}

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function usernameKey(username: string): string {
  return normalizeUsername(username).toLowerCase();
}

export function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);
  if (url.protocol === "https:") {
    return true;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto === "https") {
    return true;
  }

  const cfVisitor = request.headers.get("cf-visitor");
  return typeof cfVisitor === "string" && cfVisitor.includes('"scheme":"https"');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const passwordBytes = new TextEncoder().encode(password) as unknown as BufferSource;
  const baseKey = await crypto.subtle.importKey("raw", passwordBytes, "PBKDF2", false, [
    "deriveBits"
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PASSWORD_ITERATIONS
    },
    baseKey,
    PASSWORD_KEY_BYTES * 8
  );

  return `pbkdf2$${PASSWORD_ITERATIONS}$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [scheme, iterationText, saltHex, expectedHex] = storedHash.split("$");
  if (scheme !== "pbkdf2" || !iterationText || !saltHex || !expectedHex) {
    return false;
  }

  const iterations = Number(iterationText);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const salt = fromHex(saltHex) as unknown as BufferSource;
  const passwordBytes = new TextEncoder().encode(password) as unknown as BufferSource;
  const baseKey = await crypto.subtle.importKey("raw", passwordBytes, "PBKDF2", false, [
    "deriveBits"
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations
    },
    baseKey,
    (expectedHex.length / 2) * 8
  );

  return timingSafeEqual(toHex(new Uint8Array(bits)), expectedHex);
}

export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export function buildUserCookie(username: string, secure: boolean, domain?: string): string {
  return buildCookie(USER_COOKIE, encodeURIComponent(username), secure, undefined, domain);
}

export async function buildSessionCookie(token: string, secure: boolean, domain?: string): Promise<string> {
  return buildCookie(SESSION_COOKIE, encodeURIComponent(token), secure, undefined, domain);
}

export function clearAuthCookies(secure: boolean, domain?: string): string[] {
  return [buildCookie(USER_COOKIE, "", secure, 0, domain), buildCookie(SESSION_COOKIE, "", secure, 0, domain)];
}

export function getCookieName(): string {
  return SESSION_COOKIE;
}

export function getUserCookieName(): string {
  return USER_COOKIE;
}

export function issueSessionToken(): string {
  return crypto.randomUUID();
}

export function sessionExpiryTimestamp(): number {
  return Date.now() + SESSION_TTL_MS;
}

function buildCookie(name: string, value: string, secure: boolean, maxAge?: number, domain?: string): string {
  const parts = [
    `${name}=${value}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax"
  ];

  if (secure) {
    parts.push("Secure");
  }

  if (typeof maxAge === "number") {
    parts.push(`Max-Age=${maxAge}`);
  }

  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  return parts.join("; ");
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}
