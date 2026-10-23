import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig = {
  providers: [
    Google({
      checks: ["pkce", "state", "nonce"],
      // Keep only a display name and stable identifier in our session, not email/avatar.
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: null,
          image: null,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    jwt({ token, account }) {
      // Google subject is stable even if an account changes its email address.
      if (account?.provider === "google")
        token.sub = `google:${account.providerAccountId}`;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
  pages: { signIn: "/account", error: "/account" },
} satisfies NextAuthConfig;
