import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ADMIN_EMAILS = new Set([
  "aw.andrewwang16@gmail.com",
  "joshua.p.jacobs98@gmail.com",
]);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token }) {
      if (token.email) {
        token.isAdmin = ADMIN_EMAILS.has(token.email.toLowerCase());
      }

      return token;
    },
    async session({ session, token }) {
      session.user.isAdmin = Boolean(token.isAdmin);

      return session;
    },
  },
});
