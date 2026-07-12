const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const settings = JSON.parse(fs.readFileSync('local.settings.json', 'utf8'));
const prisma = new PrismaClient({
  datasources: { db: { url: settings.Values.DATABASE_URL } },
});

async function main() {
  const result = await prisma.notificationLog.findUnique({
    where: { MessageId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
  });
  console.log('findByMessageId ok:', result === null ? 'no row (expected)' : `found id ${result.Id}`);
}

main()
  .catch((e) => {
    console.error('FAILED:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
