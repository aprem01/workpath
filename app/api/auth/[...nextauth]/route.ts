import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const handler = NextAuth({
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/onboarding",
  },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as Record<string, unknown>).id = token.sub;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
