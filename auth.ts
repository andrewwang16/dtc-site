import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail } from "@/lib/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.toLowerCase().trim()
            : null;
        const password =
          typeof credentials?.password === "string" ? credentials.password : null;

        if (!email || !password) {
          return null;
        }

        try {
          const user = await getUserByEmail(email);

          if (!user) {
            return null;
          }

          const isValid = await bcrypt.compare(password, user.passwordHash);

          if (!isValid) {
            return null;
          }

          return {
            id: email,
            email,
            name: user.displayName?.trim() || email.split("@")[0],
            isAdmin: user.isAdmin,
            isSubscriber: user.isSubscriber,
          };
        } catch (error) {
          console.error("Sign-in lookup failed", error);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const typedUser = user as { isAdmin?: boolean; isSubscriber?: boolean };
        token.isAdmin = Boolean(typedUser.isAdmin);
        token.isSubscriber = Boolean(typedUser.isSubscriber);
      }

      // Lets the account settings page refresh the session's display name
      // immediately (via useSession().update()) instead of requiring the
      // user to sign out and back in to see the change reflected.
      if (trigger === "update" && typeof session?.name === "string") {
        token.name = session.name;
      }

      return token;
    },
    async session({ session, token }) {
      session.user.isAdmin = Boolean(token.isAdmin);
      session.user.isSubscriber = Boolean(token.isSubscriber);

      return session;
    },
  },
});
