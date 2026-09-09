import "server-only";

import { tool } from "ai";
import {
  findProductsInputSchema,
  findProductsTool,
  getCategoryPerformanceTool,
  getSalesSummaryTool,
  getTopProductsTool,
  listCategoriesInputSchema,
  listCategoriesTool,
  listSalesInputSchema,
  listSalesTool,
  rankedSalesInputSchema,
  salesSummaryInputSchema,
} from "./query-tools";

const SAFE_DATABASE_ERROR = "I couldn't retrieve the database results right now. Please try again.";

type QueryHandler = (input: unknown) => Promise<unknown>;

export interface SqlAgentQueryHandlers {
  listCategories: QueryHandler;
  findProducts: QueryHandler;
  listSales: QueryHandler;
  getSalesSummary: QueryHandler;
  getTopProducts: QueryHandler;
  getCategoryPerformance: QueryHandler;
}

interface CreateSqlAgentToolsOptions {
  requestId: string;
  handlers?: SqlAgentQueryHandlers;
}

const defaultHandlers: SqlAgentQueryHandlers = {
  listCategories: listCategoriesTool,
  findProducts: findProductsTool,
  listSales: listSalesTool,
  getSalesSummary: getSalesSummaryTool,
  getTopProducts: getTopProductsTool,
  getCategoryPerformance: getCategoryPerformanceTool,
};

const getRowCount = (data: unknown) => (Array.isArray(data) ? data.length : 1);

const getSafeErrorCategory = (error: unknown) => {
  if (error instanceof Error && error.name === "ZodError") {
    return "invalid_tool_input";
  }

  return "database_query_failed";
};

const executeTool = async (
  requestId: string,
  toolName: keyof SqlAgentQueryHandlers,
  input: unknown,
  handler: QueryHandler,
) => {
  const startedAt = performance.now();

  try {
    const data = await handler(input);
    const durationMs = Math.round(performance.now() - startedAt);
    const rowCount = getRowCount(data);

    console.info("[sql-agent:tool]", {
      requestId,
      toolName,
      status: "success",
      durationMs,
      rowCount,
    });

    return {
      ok: true as const,
      data,
      meta: { rowCount },
    };
  } 
  catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    const errorCategory = getSafeErrorCategory(error);

    console.error("[sql-agent:tool]", {
      requestId,
      toolName,
      status: "error",
      durationMs,
      rowCount: 0,
      errorCategory,
    });

    return {
      ok: false as const,
      error: {
        code: errorCategory,
        message: SAFE_DATABASE_ERROR,
      },
    };
  }
};

export const createSqlAgentTools = ({
  requestId,
  handlers = defaultHandlers,
}: CreateSqlAgentToolsOptions) => ({
  listCategories: tool({
    description:
      "List product categories and the number of products in each category. Use for questions about which categories exist.",
    inputSchema: listCategoriesInputSchema,
    execute: (input) =>
      executeTool(requestId, "listCategories", input, handlers.listCategories),
  }),
  findProducts: tool({
    description:
      "Search products by name, SKU, or description, optionally filter by an exact category slug, and optionally include inactive products. Use for catalog, price, stock, and product availability questions.",
    inputSchema: findProductsInputSchema,
    execute: (input) =>
      executeTool(requestId, "findProducts", input, handlers.findProducts),
  }),
  listSales: tool({
    description:
      "List the most recent individual sale records with product, category, quantity, price, total, currency, and sale time. Use only for recent sale-detail questions, not aggregates.",
    inputSchema: listSalesInputSchema,
    execute: (input) =>
      executeTool(requestId, "listSales", input, handlers.listSales),
  }),
  getSalesSummary: tool({
    description:
      "Calculate units sold and revenue for a date-time range, grouped by currency. When the user gives no period, use the default month-to-date range from the system instructions. The from boundary is inclusive and the to boundary is exclusive.",
    inputSchema: salesSummaryInputSchema,
    execute: (input) =>
      executeTool(requestId, "getSalesSummary", input, handlers.getSalesSummary),
  }),
  getTopProducts: tool({
    description:
      "Rank products by revenue for a date-time range, keeping currencies separate. When the user gives no period, use the default month-to-date range from the system instructions. The from boundary is inclusive and the to boundary is exclusive.",
    inputSchema: rankedSalesInputSchema,
    execute: (input) =>
      executeTool(requestId, "getTopProducts", input, handlers.getTopProducts),
  }),
  getCategoryPerformance: tool({
    description:
      "Rank categories by revenue for a date-time range, keeping currencies separate. When the user gives no period, use the default month-to-date range from the system instructions. The from boundary is inclusive and the to boundary is exclusive.",
    inputSchema: rankedSalesInputSchema,
    execute: (input) =>
      executeTool(
        requestId,
        "getCategoryPerformance",
        input,
        handlers.getCategoryPerformance,
      ),
  }),
});

export type SqlAgentTools = ReturnType<typeof createSqlAgentTools>;
