import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  // Auto-detected on Vercel only; without it any other host 500s on /api/auth/*.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
};
