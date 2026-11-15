import NextAuth from "next-auth";
import { authConfig } from "@/server/authConfig";

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_SECRET &&
    process.env.AUTH_GOOGLE_ID &&
    process.env.AUTH_GOOGLE_SECRET,
  );
}

export const { handlers, auth } = NextAuth(authConfig);
