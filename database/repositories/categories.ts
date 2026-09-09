import "server-only";

import { db } from "../client";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export const listCategories = async (limit = DEFAULT_LIMIT) => {
  return db.category.findMany({
    orderBy: { name: "asc" },
    take: Math.min(Math.max(limit, 1), MAX_LIMIT),
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { products: true },
      },
    },
  });
}
