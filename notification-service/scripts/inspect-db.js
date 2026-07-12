const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const settings = JSON.parse(fs.readFileSync('local.settings.json', 'utf8'));
const prisma = new PrismaClient({
  datasources: { db: { url: settings.Values.DATABASE_URL } },
});

async function main() {
  const tables = await prisma.$queryRawUnsafe("SHOW TABLES LIKE 'notificationdelivery'");
  console.log('notificationdelivery table:', tables);

  const cols = await prisma.$queryRawUnsafe('DESCRIBE notificationlog');
  console.log('notificationlog columns:', JSON.stringify(cols, null, 2));

  const deviceCols = await prisma.$queryRawUnsafe('DESCRIBE userdevicetoken');
  console.log('userdevicetoken columns:', JSON.stringify(deviceCols, null, 2));

  const scheduleCols = await prisma.$queryRawUnsafe('DESCRIBE childremindernotificationschedule');
  console.log('childremindernotificationschedule columns:', JSON.stringify(scheduleCols, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
