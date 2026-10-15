import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { organizationIdOf, verifyPassword } from "@/lib/users";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "אימייל", type: "email" },
        password: { label: "סיסמה", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        try {
          const user = await verifyPassword(email, password);
          if (!user) return null;

          return {
            id: String(user._id),
            name: user.name,
            email: user.email,
            // Accounts created before roles existed have none stored; they
            // were always tenant owners, so they default to partner.
            role: user.role ?? "partner",
            organizationId: organizationIdOf(user),
          };
        } catch (err) {
          // An unhandled throw here surfaces as a 500 on the callback route
          // instead of a failed sign-in.
          console.error("Sign-in failed:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name;
        token.email = user.email;
        token.role = user.role ?? "partner";
        // token.sub (the individual account) stays the identity; this is the
        // shared tenant everything else is scoped by.
        token.organizationId = user.organizationId ?? user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // token.sub carries the user's Mongo _id; every record is scoped to it.
        session.user.id = token.sub as string;
        session.user.name = token.name;
        session.user.email = token.email as string;
        session.user.role = token.role ?? "partner";
        session.user.organizationId = token.organizationId ?? (token.sub as string);
      }
      return session;
    },
  },
});
