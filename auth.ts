import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// Single source of truth: email -> bcrypt hash of that admin's password,
// set as env vars. Anyone whose email isn't a key here can never sign in,
// regardless of what password they submit — there's no public signup.
const ADMIN_ACCOUNTS: Record<string, string | undefined> = {
  "aw.andrewwang16@gmail.com": process.env.ADMIN_PASSWORD_HASH_AW,
  "joshua.p.jacobs98@gmail.com": process.env.ADMIN_PASSWORD_HASH_JOSHUA,
};

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

        const hash = ADMIN_ACCOUNTS[email];

        if (!hash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, hash);

        if (!isValid) {
          return null;
        }

        return { id: email, email, name: email.split("@")[0] };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  callbacks: {
    async jwt({ token }) {
      if (token.email) {
        token.isAdmin = Boolean(ADMIN_ACCOUNTS[token.email.toLowerCase()]);
      }

      return token;
    },
    async session({ session, token }) {
      session.user.isAdmin = Boolean(token.isAdmin);

      return session;
    },
  },
});
