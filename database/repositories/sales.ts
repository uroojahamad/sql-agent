import "server-only";

import type { Prisma } from "../generated/prisma/client";
import { db } from "../client";

interface SalesSummaryRow {
  currency: string;
  units: bigint;
  revenue: Prisma.Decimal;
}

interface RankedSalesRow extends SalesSummaryRow {
  name: string;
}

export interface SalesDateRange {
  from: Date;
  to: Date;
}

const DEFAULT_LIST_LIMIT = 30;
const MAX_LIST_LIMIT = 100;

export const listSales = async (limit = DEFAULT_LIST_LIMIT) => {
  return db.sale.findMany({
    orderBy: { soldAt: "desc" },
    take: Math.min(Math.max(limit, 1), MAX_LIST_LIMIT),
    select: {
      id: true,
      productId: true,
      orderReference: true,
      quantity: true,
      unitPrice: true,
      currency: true,
      soldAt: true,
      createdAt: true,
      product: {
        select: {
          sku: true,
          name: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
};

export const getSalesSummary = async ({ from, to }: SalesDateRange) => {
  const rows = await db.$queryRaw<SalesSummaryRow[]>`
    SELECT
      currency,
      SUM(quantity)::bigint AS units,
      SUM(quantity * unit_price)::numeric AS revenue
    FROM sales
    WHERE sold_at >= ${from} AND sold_at < ${to}
    GROUP BY currency
    ORDER BY currency
  `;

  return rows.map((row) => ({
    currency: row.currency,
    units: Number(row.units),
    revenue: row.revenue.toFixed(2),
  }));
};

export const getTopProducts = async ( { from, to }: SalesDateRange, limit = 10 ) => {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const rows = await db.$queryRaw<RankedSalesRow[]>`
    SELECT
      p.name,
      s.currency,
      SUM(s.quantity)::bigint AS units,
      SUM(s.quantity * s.unit_price)::numeric AS revenue
    FROM sales AS s
    INNER JOIN products AS p ON p.id = s.product_id
    WHERE s.sold_at >= ${from} AND s.sold_at < ${to}
    GROUP BY p.id, p.name, s.currency
    ORDER BY revenue DESC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => ({
    productName: row.name,
    currency: row.currency,
    units: Number(row.units),
    revenue: row.revenue.toFixed(2),
  }));
};

export const getCategoryPerformance = async ( { from, to }: SalesDateRange, limit = 10 ) => {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const rows = await db.$queryRaw<RankedSalesRow[]>`
    SELECT
      c.name,
      s.currency,
      SUM(s.quantity)::bigint AS units,
      SUM(s.quantity * s.unit_price)::numeric AS revenue
    FROM sales AS s
    INNER JOIN products AS p ON p.id = s.product_id
    INNER JOIN categories AS c ON c.id = p.category_id
    WHERE s.sold_at >= ${from} AND s.sold_at < ${to}
    GROUP BY c.id, c.name, s.currency
    ORDER BY revenue DESC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => ({
    categoryName: row.name,
    currency: row.currency,
    units: Number(row.units),
    revenue: row.revenue.toFixed(2),
  }));
};
