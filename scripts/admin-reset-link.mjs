/**
 * Mint a password-reset link by hand, for a user who asked for one.
 *
 * The login page tells a stuck user to email hello@payranker.io and
 * promises a reset link back. This is the thing that keeps that promise.
 * It exists because outbound email is not configured in production:
 * /api/auth/request-reset creates the token correctly but cannot deliver
 * it. Nothing here is a workaround for the token logic — it writes the
 * exact same row that route writes, so the link lands in the same
 * /reset-password page and is consumed by the same /api/auth/reset.
 *
 * Delete this once POSTMARK_SERVER_TOKEN and EMAIL_FROM are set and the
 * self-serve flow delivers on its own.
 *
 * It is deliberately operator-only: it runs on a laptop with the
 * production DATABASE_URL in the environment and is not reachable over
 * HTTP. There is no admin endpoint doing this, and there should not be —
 * an HTTP route that mints reset tokens is an account-takeover primitive
 * one auth bug away from being exploitable.
 *
 * Usage:
 *   node scripts/admin-reset-link.mjs someone@example.com
 *   node scripts/admin-reset-link.mjs someone@example.com --hours=24
 *
 * Only send the printed link to the address it was minted for, and only
 * after that person asked for it from that address. Anyone holding the
 * link can set the password.
 */
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import process from "node:process";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const email = (args.find((a) => !a.startsWith("--")) || "").toLowerCase().trim();
const hours =
  Number((args.find((a) => a.startsWith("--hours=")) || "").split("=")[1]) || 1;

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://payranker.io").replace(
  /\/+$/,
  ""
);

if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/admin-reset-link.mjs <email> [--hours=N]");
  process.exit(1);
}
if (!Number.isFinite(hours) || hours <= 0 || hours > 72) {
  console.error("--hours must be between 1 and 72.");
  process.exit(1);
}

// Unlike the HTTP route, this one DOES say whether the account exists.
// That route has to stay non-enumerable because anyone can call it; here
// the only caller is an operator who already has the whole user table in
// front of them, and silently printing a link for an address that has no
// account would just produce a link that fails at the end.
const user = await prisma.user.findUnique({
  where: { email },
  select: { id: true, email: true, createdAt: true },
});

if (!user) {
  console.error(`No account for ${email}. Nothing minted.`);
  const near = await prisma.user.findMany({
    where: { email: { contains: email.split("@")[0].slice(0, 4) } },
    select: { email: true },
    take: 5,
  });
  if (near.length) {
    console.error("Closest addresses on file:");
    for (const n of near) console.error(`  ${n.email}`);
  }
  await prisma.$disconnect();
  process.exit(1);
}

// Invalidate any outstanding links for this address first. Two live
// tokens means a link mailed last week still works after this one is
// used, which is exactly the loose end a reset is supposed to close.
const { count: revoked } = await prisma.verificationToken.deleteMany({
  where: { identifier: `reset:${email}` },
});

const token = crypto.randomBytes(32).toString("hex");
const expires = new Date(Date.now() + hours * 3600_000);
await prisma.verificationToken.create({
  data: { identifier: `reset:${email}`, token, expires },
});

const link = `${BASE}/reset-password?token=${encodeURIComponent(token)}`;

console.log("");
console.log(`Account   : ${user.email}  (joined ${user.createdAt.toISOString().slice(0, 10)})`);
if (revoked) console.log(`Revoked   : ${revoked} earlier reset link${revoked === 1 ? "" : "s"}`);
console.log(`Expires   : ${expires.toISOString()}  (${hours}h)`);
console.log("");
console.log(link);
console.log("");
console.log("Send this only to the address above. It sets the password for whoever opens it.");
console.log("");

await prisma.$disconnect();
