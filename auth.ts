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

        const user = await getUserByEmail(email);

        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        return { id: email, email, name: email.split("@")[0], isAdmin: user.isAdmin };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.isAdmin = Boolean((user as { isAdmin?: boolean }).isAdmin);
      }

      return token;
    },
    async session({ session, token }) {
      session.user.isAdmin = Boolean(token.isAdmin);

      return session;
    },
  },
});
