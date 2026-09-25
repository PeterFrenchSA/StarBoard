/* One-time, non-destructive production bootstrap. Read credentials from stdin. */
/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync } = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const db = new PrismaClient();
async function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 16 || Buffer.byteLength(password) > 72) {
    throw new Error('Supply an email and a password of at least 16 characters and at most 72 bytes.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1937001)`;
    if (await tx.user.count() || await tx.family.count()) {
      throw new Error('Bootstrap requires an empty installation; no existing data was changed.');
    }
    const family = await tx.family.create({ data: { name: 'StarBoard Administration', billingEmail: email } });
    await tx.user.create({ data: { familyId: family.id, email, passwordHash,
      displayName: String(input.displayName || 'Administrator'), role: 'SUPER_ADMIN', isSupportAgent: true } });
  });
  console.log('Provider administrator created. No demonstration data was added.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
