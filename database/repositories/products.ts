import "server-only";

import { db } from "../client";

export interface FindProductsInput {
  query?: string;
  categorySlug?: string;
  activeOnly?: boolean;
  limit?: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const findProducts = async ({
  query,
  categorySlug,
  activeOnly = true,
  limit = DEFAULT_LIMIT,
}: FindProductsInput) => {
  const normalizedQuery = query?.trim();

  return db.product.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      ...(normalizedQuery
        ? {
            OR: [
              { name: { contains: normalizedQuery, mode: "insensitive" } },
              { sku: { contains: normalizedQuery, mode: "insensitive" } },
              {
                description: {
                  contains: normalizedQuery,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: Math.min(Math.max(limit, 1), MAX_LIMIT),
    select: {
      id: true,
      categoryId: true,
      sku: true,
      name: true,
      description: true,
      unitPrice: true,
      currency: true,
      stockQuantity: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      category: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });
}
