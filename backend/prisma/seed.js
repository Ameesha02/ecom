require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const catalog = {
  Electronics: [
    ['Wireless Headphones', 'Over-ear Bluetooth headphones with 30h battery.', '89.99', 50],
    ['Mechanical Keyboard', 'Hot-swappable 75% keyboard with tactile switches.', '129.00', 30],
    ['USB-C Hub', '7-in-1 hub with HDMI and card reader.', '39.50', 120],
  ],
  Books: [
    ['Clean Code', 'A handbook of agile software craftsmanship.', '34.90', 80],
    ['Designing Data-Intensive Applications', 'The big ideas behind reliable, scalable systems.', '49.99', 60],
  ],
  Home: [
    ['Ceramic Mug', 'Hand-glazed 350ml mug.', '12.00', 200],
    ['Desk Lamp', 'Dimmable LED lamp with USB charging.', '27.75', 75],
  ],
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, name: 'Admin', role: 'ADMIN', passwordHash: await bcrypt.hash(adminPassword, 12) },
  });

  for (const [name, products] of Object.entries(catalog)) {
    const category = await prisma.category.upsert({
      where: { slug: slug(name) },
      update: {},
      create: { name, slug: slug(name) },
    });
    for (const [pname, description, price, stock] of products) {
      await prisma.product.upsert({
        where: { slug: slug(pname) },
        update: {},
        create: { name: pname, slug: slug(pname), description, price, stock, categoryId: category.id },
      });
    }
  }
  console.log(`Seeded. Admin login: ${adminEmail} / ${adminPassword}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
