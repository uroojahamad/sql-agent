import nextEnv from "@next/env";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());   // Load environment variables from .env files

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

// Create a new Prisma Client instance with the Neon adapter for connecting to the database.
const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const catalog = [
  ["Electronics", "electronics", "Everyday electronic devices and accessories", "ELEC-001", "Wireless Charging Pad", "29.99", 140],
  ["Computers", "computers", "Computers, components, and peripherals", "COMP-001", "Mechanical Keyboard", "89.99", 75],
  ["Phones", "phones", "Mobile phones and related accessories", "PHONE-001", "USB-C Power Bank", "49.99", 110],
  ["Audio", "audio", "Headphones, speakers, and audio equipment", "AUDIO-001", "Noise-Cancelling Headphones", "199.99", 45],
  ["Cameras", "cameras", "Cameras and photography accessories", "CAM-001", "Compact Tripod", "39.99", 64],
  ["Home Appliances", "home-appliances", "Appliances for everyday home use", "HOME-001", "Air Purifier", "149.99", 32],
  ["Kitchen", "kitchen", "Kitchen tools and appliances", "KITCH-001", "Digital Kitchen Scale", "24.99", 95],
  ["Furniture", "furniture", "Furniture for home and workspaces", "FURN-001", "Ergonomic Office Chair", "279.99", 18],
  ["Lighting", "lighting", "Indoor and outdoor lighting", "LIGHT-001", "Smart LED Desk Lamp", "54.99", 53],
  ["Books", "books", "Printed and digital reading material", "BOOK-001", "PostgreSQL Field Guide", "44.99", 80],
  ["Stationery", "stationery", "Writing and office stationery", "STAT-001", "Premium Notebook Set", "18.99", 160],
  ["Toys", "toys", "Educational and recreational toys", "TOY-001", "Wooden Building Blocks", "34.99", 70],
  ["Games", "games", "Board games and gaming accessories", "GAME-001", "Strategy Board Game", "59.99", 48],
  ["Sports", "sports", "Equipment for sports and recreation", "SPORT-001", "Match Football", "39.99", 84],
  ["Fitness", "fitness", "Fitness equipment and accessories", "FIT-001", "Resistance Band Set", "27.99", 125],
  ["Outdoor", "outdoor", "Equipment for outdoor activities", "OUT-001", "Camping Lantern", "46.99", 59],
  ["Fashion", "fashion", "Clothing and fashion essentials", "FASH-001", "Classic Cotton Shirt", "64.99", 90],
  ["Footwear", "footwear", "Shoes and footwear accessories", "FOOT-001", "Everyday Running Shoes", "99.99", 68],
  ["Beauty", "beauty", "Beauty and personal care products", "BEAUTY-001", "Skincare Essentials Kit", "74.99", 57],
  ["Health", "health", "Health monitoring and wellness products", "HEALTH-001", "Digital Thermometer", "22.99", 130],
  ["Grocery", "grocery", "Packaged foods and pantry items", "GROC-001", "Organic Snack Box", "31.99", 105],
  ["Beverages", "beverages", "Coffee, tea, and other beverages", "BEV-001", "Specialty Coffee Beans", "26.99", 115],
  ["Pet Supplies", "pet-supplies", "Products for pets and pet owners", "PET-001", "Adjustable Pet Harness", "36.99", 62],
  ["Automotive", "automotive", "Automotive accessories and care", "AUTO-001", "Portable Tire Inflator", "79.99", 41],
  ["Tools", "tools", "Hand tools and power-tool accessories", "TOOL-001", "Precision Screwdriver Set", "42.99", 73],
  ["Garden", "garden", "Gardening equipment and supplies", "GARDEN-001", "Garden Hand Tool Kit", "38.99", 66],
  ["Office", "office", "Office equipment and organization", "OFFICE-001", "Adjustable Monitor Stand", "69.99", 52],
  ["Travel", "travel", "Travel bags and accessories", "TRAVEL-001", "Carry-On Travel Backpack", "84.99", 47],
  ["Jewelry", "jewelry", "Jewelry and personal accessories", "JEWEL-001", "Minimalist Silver Bracelet", "119.99", 28],
  ["Watches", "watches", "Watches and watch accessories", "WATCH-001", "Classic Analog Watch", "159.99", 35],
] as const;

const seedUuid = (namespace: number, index: number) => {
  return `${namespace.toString().padStart(8, "0")}-0000-4000-8000-${index
    .toString()
    .padStart(12, "0")}`;
}

const categories = catalog.map(([name, slug, description], index) => ({
  id: seedUuid(1, index + 1),
  name,
  slug,
  description,
}));

const products = catalog.map(
  ([, , , sku, name, unitPrice, stockQuantity], index) => ({
    id: seedUuid(2, index + 1),
    categoryId: seedUuid(1, index + 1),
    sku,
    name,
    description: `${name} from the ${catalog[index][0]} category`,
    unitPrice,
    currency: "USD",
    stockQuantity,
    isActive: true,
  }),
);

const augustSales = catalog.map(([, , , , , unitPrice], index) => ({
  id: seedUuid(3, index + 1),
  productId: seedUuid(2, index + 1),
  orderReference: `ORD-2026-${(index + 1).toString().padStart(4, "0")}`,
  quantity: (index % 5) + 1,
  unitPrice,
  currency: "USD",
  soldAt: new Date(Date.UTC(2026, 7, index + 1, 10, 0, 0)),
}));

const septemberSales = Array.from({ length: 70 }, (_, index) => {
  const productIndex = (index * 7) % catalog.length;
  const unitPrice = catalog[productIndex][5];
  const day = Math.floor((index * 13) / 70) + 1;
  const orderNumber = index + 31;

  return {
    id: seedUuid(3, orderNumber),
    productId: seedUuid(2, productIndex + 1),
    orderReference: `ORD-2026-${orderNumber.toString().padStart(4, "0")}`,
    quantity: (index % 5) + 1,
    unitPrice,
    currency: "USD",
    soldAt: new Date(
      Date.UTC(2026, 8, day, 9 + (index % 10), (index * 7) % 60, 0),
    ),
  };
});

const sales = [...augustSales, ...septemberSales];

/**
 * Seed deterministic category, product, and August/September 2026 sale data.
 * The transaction and stable IDs make repeated runs atomic and idempotent.
 */
const main = async () => {
  await prisma.$transaction([
    prisma.category.createMany({ data: categories, skipDuplicates: true }),
    prisma.product.createMany({ data: products, skipDuplicates: true }),
    prisma.sale.createMany({ data: sales, skipDuplicates: true }),
  ]);

  const [categoryCount, productCount, saleCount] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.sale.count(),
  ]);

  if (categoryCount !== 30 || productCount !== 30 || saleCount !== 100) {
    throw new Error(
      `Expected categories=30, products=30, sales=100; found categories=${categoryCount}, products=${productCount}, sales=${saleCount}`,
    );
  }

  console.log(
    `Seed complete: categories=${categoryCount}, products=${productCount}, sales=${saleCount}`,
  );
};

main()
  .catch((error: unknown) => {
    console.error("Database seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
