import "server-only";

import { z } from "zod";
import { listCategories } from "./repositories/categories";
import { findProducts } from "./repositories/products";
import {
  getCategoryPerformance,
  getSalesSummary,
  getTopProducts,
  listSales,
} from "./repositories/sales";

const MAX_RESULT_LIMIT = 50;
const MAX_DATE_RANGE_DAYS = 366;
const MAX_DATE_RANGE_MS = MAX_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000;

const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_RESULT_LIMIT)
  .describe(`Number of records to return, from 1 to ${MAX_RESULT_LIMIT}.`);

const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .describe("An ISO 8601 date-time with a UTC offset, such as 2026-08-01T00:00:00Z.");

export const listCategoriesInputSchema = z.strictObject({
  limit: limitSchema.default(30),
});

export const findProductsInputSchema = z.strictObject({
  query: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .optional()
    .describe("Optional product name, SKU, or description search text."),
  categorySlug: z
    .string()
    .trim()
    .min(1)
    .max(140)
    .optional()
    .describe("Optional exact category slug filter."),
  activeOnly: z
    .boolean()
    .default(true)
    .describe("When true, exclude inactive products."),
  limit: limitSchema.default(20),
});

export const listSalesInputSchema = z.strictObject({
  limit: limitSchema.default(10),
});

const validateDateRange = (
  { from, to }: { from: string; to: string },
  context: z.RefinementCtx,
) => {
  const fromTime = Date.parse(from);
  const toTime = Date.parse(to);

  if (fromTime >= toTime) {
    context.addIssue({
      code: "custom",
      path: ["to"],
      message: "The 'to' date must be later than the 'from' date.",
    });
    return;
  }

  if (toTime - fromTime > MAX_DATE_RANGE_MS) {
    context.addIssue({
      code: "custom",
      path: ["to"],
      message: `The date range cannot exceed ${MAX_DATE_RANGE_DAYS} days.`,
    });
  }
};

export const salesSummaryInputSchema = z
  .strictObject({
    from: isoDateTimeSchema.describe("Inclusive start of the reporting range."),
    to: isoDateTimeSchema.describe("Exclusive end of the reporting range."),
  })
  .superRefine(validateDateRange);

export const rankedSalesInputSchema = z
  .strictObject({
    from: isoDateTimeSchema.describe("Inclusive start of the reporting range."),
    to: isoDateTimeSchema.describe("Exclusive end of the reporting range."),
    limit: limitSchema.default(10),
  })
  .superRefine(validateDateRange);

const toDateRange = ({ from, to }: { from: string; to: string }) => ({
  from: new Date(from),
  to: new Date(to),
});

/**
 * Application-level read operations exposed to the AI tool layer.
 * Every function validates untrusted input and maps Prisma values to minimal,
 * JSON-serializable DTOs before data can cross the server boundary.
 */
export const listCategoriesTool = async (input: unknown) => {
  const { limit } = listCategoriesInputSchema.parse(input ?? {});
  const categories = await listCategories(limit);

  return categories.map((category) => ({
    name: category.name,
    slug: category.slug,
    description: category.description,
    productCount: category._count.products,
  }));
};

export const findProductsTool = async (input: unknown) => {
  const parsed = findProductsInputSchema.parse(input ?? {});
  const products = await findProducts(parsed);

  return products.map((product) => ({
    sku: product.sku,
    name: product.name,
    description: product.description,
    unitPrice: product.unitPrice.toFixed(2),
    currency: product.currency,
    stockQuantity: product.stockQuantity,
    isActive: product.isActive,
    category: {
      name: product.category.name,
      slug: product.category.slug,
    },
  }));
};

export const listSalesTool = async (input: unknown) => {
  const { limit } = listSalesInputSchema.parse(input ?? {});
  const sales = await listSales(limit);

  return sales.map((sale) => ({
    orderReference: sale.orderReference,
    product: {
      sku: sale.product.sku,
      name: sale.product.name,
      categoryName: sale.product.category.name,
    },
    quantity: sale.quantity,
    unitPrice: sale.unitPrice.toFixed(2),
    total: sale.unitPrice.mul(sale.quantity).toFixed(2),
    currency: sale.currency,
    soldAt: sale.soldAt.toISOString(),
  }));
};

export const getSalesSummaryTool = async (input: unknown) => {
  const parsed = salesSummaryInputSchema.parse(input);
  return getSalesSummary(toDateRange(parsed));
};

export const getTopProductsTool = async (input: unknown) => {
  const parsed = rankedSalesInputSchema.parse(input);
  return getTopProducts(toDateRange(parsed), parsed.limit);
};

export const getCategoryPerformanceTool = async (input: unknown) => {
  const parsed = rankedSalesInputSchema.parse(input);
  return getCategoryPerformance(toDateRange(parsed), parsed.limit);
};
