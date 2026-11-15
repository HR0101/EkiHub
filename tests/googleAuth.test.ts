import { Auth } from "@auth/core";
import Google from "next-auth/providers/google";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { afterEach, expect, it, vi } from "vitest";
import { authConfig } from "@/server/authConfig";

const base = "http://localhost:3001/api/auth";
afterEach(() => vi.unstubAllGlobals());
it.each(["valid", "bad-nonce", "bad-state"])(
  "validates the configured OIDC flow (%s) before issuing a session",
  async (scenario) => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = {
      ...(await exportJWK(publicKey)),
      kid: "google-test-key",
      alg: "RS256",
      use: "sig",
    };
    let nonce = "";
    let tokenRequests = 0;
    const config = {
      ...authConfig,
      logger: { error: vi.fn() },
      trustHost: true,
      basePath: "/api/auth",
      secret: "test-secret-that-is-at-least-32-bytes-long",
      providers: [
        Google({
          ...authConfig.providers[0]!.options,
          clientId: "test-client",
          clientSecret: "test-secret",
        }),
      ],
    };
    const jar = new Map<string, string>();
    function cookies(response: Response) {
      for (const value of response.headers.getSetCookie()) {
        const [name, ...rest] = value.split(";")[0]!.split("=");
        if (rest.join("=")) jar.set(name!, rest.join("="));
        else jar.delete(name!);
      }
    }
    function cookieHeader() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, options?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.includes(".well-known/openid-configuration"))
          return Response.json({
            issuer: "https://accounts.google.com",
            authorization_endpoint:
              "https://accounts.google.com/o/oauth2/v2/auth",
            userinfo_endpoint:
              "https://openidconnect.googleapis.com/v1/userinfo",
            token_endpoint: "https://oauth2.googleapis.com/token",
            jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
            response_types_supported: ["code"],
            subject_types_supported: ["public"],
            id_token_signing_alg_values_supported: ["RS256"],
            code_challenge_methods_supported: ["S256"],
          });
        if (url === "https://oauth2.googleapis.com/token") {
          tokenRequests++;
          const form = new URLSearchParams(String(options?.body));
          expect(form.get("code_verifier")).toBeTruthy();
          expect(form.get("redirect_uri")).toBe(`${base}/callback/google`);
          const idToken = await new SignJWT({
            nonce: scenario === "bad-nonce" ? "wrong-nonce" : nonce,
            name: "Alice",
            email: "alice@example.test",
            email_verified: true,
          })
            .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
            .setIssuer("https://accounts.google.com")
            .setSubject("stable-google-subject")
            .setAudience("test-client")
            .setIssuedAt()
            .setExpirationTime("5m")
            .sign(privateKey);
          return Response.json({
            access_token: "test-access-token",
            token_type: "Bearer",
            expires_in: 300,
            id_token: idToken,
          });
        }
        if (url === "https://openidconnect.googleapis.com/v1/userinfo")
          return Response.json({
            sub: "stable-google-subject",
            name: "Alice",
            email: "alice@example.test",
          });
        if (url === "https://www.googleapis.com/oauth2/v3/certs")
          return Response.json({ keys: [jwk] });
        throw new Error(`Unexpected request: ${url}`);
      }),
    );
    const csrf = await Auth(new Request(`${base}/csrf`), config);
    cookies(csrf);
    const csrfToken = (await csrf.json()).csrfToken;
    const signin = await Auth(
      new Request(`${base}/signin/google`, {
        method: "POST",
        headers: {
          cookie: cookieHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          csrfToken,
          callbackUrl: "http://localhost:3001/account",
        }),
      }),
      config,
    );
    cookies(signin);
    const authorization = new URL(signin.headers.get("location")!);
    expect(authorization.origin).toBe("https://accounts.google.com");
    expect(authorization.searchParams.get("code_challenge")).toBeTruthy();
    const state = authorization.searchParams.get("state")!;
    nonce = authorization.searchParams.get("nonce")!;
    expect(state).toBeTruthy();
    expect(nonce).toBeTruthy();
    const callback = await Auth(
      new Request(
        `${base}/callback/google?code=sample-code&state=${encodeURIComponent(state + (scenario === "bad-state" ? "-tampered" : ""))}`,
        { headers: { cookie: cookieHeader() } },
      ),
      config,
    );
    cookies(callback);
    if (scenario !== "valid") {
      expect(
        new URL(callback.headers.get("location")!).searchParams.has("error"),
      ).toBe(true);
      const rejected = await Auth(
        new Request(`${base}/session`, { headers: { cookie: cookieHeader() } }),
        config,
      );
      expect(await rejected.json()).toBeNull();
      expect(tokenRequests).toBe(scenario === "bad-state" ? 0 : 1);
      return;
    }
    expect(callback.headers.get("location")).toBe(
      "http://localhost:3001/account",
    );
    expect(tokenRequests).toBe(1);
    const session = await Auth(
      new Request(`${base}/session`, { headers: { cookie: cookieHeader() } }),
      config,
    );
    const data = await session.json();
    expect(data.user.id).toBe("google:stable-google-subject");
    expect(data.user.name).toBe("Alice");
    expect(data.user.email).toBeUndefined();
    expect(data.access_token).toBeUndefined();
  },
);
