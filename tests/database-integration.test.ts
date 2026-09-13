import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

before(() => {
  loadEnvConfig(process.cwd());
});

describe("database query-tool integration", () => {
  test("returns bounded, JSON-serializable category, product, and sale DTOs", async () => {
    const {
      findProductsTool,
      listCategoriesTool,
      listSalesTool,
    } = await import("../database/query-tools");

    const [categories, products, sales] = await Promise.all([
      listCategoriesTool({ limit: 3 }),
      findProductsTool({ query: "audio", activeOnly: true, limit: 5 }),
      listSalesTool({ limit: 3 }),
    ]);

    assert.equal(categories.length, 3);
    assert.ok(products.length > 0);
    assert.equal(sales.length, 3);
    assert.doesNotThrow(() => JSON.stringify({ categories, products, sales }));
    assert.equal("id" in categories[0], false);
    assert.equal("id" in products[0], false);
    assert.equal("id" in sales[0], false);
  });

  test("uses inclusive/exclusive dates and exact revenue arithmetic", async () => {
    const { getSalesSummaryTool } = await import("../database/query-tools");

    const firstDay = await getSalesSummaryTool({
      from: "2026-08-01T00:00:00Z",
      to: "2026-08-02T00:00:00Z",
    });
    const emptyRange = await getSalesSummaryTool({
      from: "2026-08-01T00:00:00Z",
      to: "2026-08-01T10:00:00Z",
    });

    assert.deepEqual(firstDay, [
      { currency: "USD", units: 1, revenue: "29.99" },
    ]);
    assert.deepEqual(emptyRange, []);
  });

  test("searches products by name, SKU, and category", async () => {
    const { findProductsTool } = await import("../database/query-tools");

    const [byName, bySku, byCategory] = await Promise.all([
      findProductsTool({ query: "Charging Pad", activeOnly: true, limit: 5 }),
      findProductsTool({ query: "ELEC-001", activeOnly: true, limit: 5 }),
      findProductsTool({ categorySlug: "fitness", activeOnly: true, limit: 5 }),
    ]);

    assert.equal(byName[0]?.name, "Wireless Charging Pad");
    assert.equal(bySku[0]?.sku, "ELEC-001");
    assert.equal(byCategory[0]?.category.slug, "fitness");
  });

  test("returns the expected full-month totals and rankings", async () => {
    const {
      getCategoryPerformanceTool,
      getSalesSummaryTool,
      getTopProductsTool,
    } = await import("../database/query-tools");
    const range = {
      from: "2026-08-01T00:00:00Z",
      to: "2026-09-01T00:00:00Z",
    };

    const [summary, products, categories] = await Promise.all([
      getSalesSummaryTool(range),
      getTopProductsTool({ ...range, limit: 1 }),
      getCategoryPerformanceTool({ ...range, limit: 1 }),
    ]);

    assert.deepEqual(summary, [
      { currency: "USD", units: 90, revenue: "6751.10" },
    ]);
    assert.deepEqual(products, [
      {
        productName: "Ergonomic Office Chair",
        currency: "USD",
        units: 3,
        revenue: "839.97",
      },
    ]);
    assert.deepEqual(categories, [
      {
        categoryName: "Furniture",
        currency: "USD",
        units: 3,
        revenue: "839.97",
      },
    ]);
  });

  test("returns the expected September seed totals and top product", async () => {
    const { getSalesSummaryTool, getTopProductsTool } = await import(
      "../database/query-tools"
    );
    const range = {
      from: "2026-09-01T00:00:00Z",
      to: "2026-09-14T00:00:00Z",
    };

    const [summary, products] = await Promise.all([
      getSalesSummaryTool(range),
      getTopProductsTool({ ...range, limit: 1 }),
    ]);

    assert.deepEqual(summary, [
      { currency: "USD", units: 210, revenue: "16310.90" },
    ]);
    assert.deepEqual(products, [
      {
        productName: "Noise-Cancelling Headphones",
        currency: "USD",
        units: 15,
        revenue: "2999.85",
      },
    ]);
  });
});
