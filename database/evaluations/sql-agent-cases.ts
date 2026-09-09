export interface SqlAgentEvaluationCase {
  name: string;
  prompt: string;
  expectedTools: string[];
  expectedAnswerPatterns: RegExp[];
}

export const sqlAgentEvaluationCases: SqlAgentEvaluationCase[] = [
  {
    name: "category listing",
    prompt: "What categories do we have?",
    expectedTools: ["listCategories"],
    expectedAnswerPatterns: [/30/, /Audio/i],
  },
  {
    name: "product search",
    prompt: "Find products related to audio.",
    expectedTools: ["findProducts"],
    expectedAnswerPatterns: [/Noise-Cancelling Headphones/i, /199\.99/],
  },
  {
    name: "exact product lookup",
    prompt: "Do we have a wireless charging pad?",
    expectedTools: ["findProducts"],
    expectedAnswerPatterns: [/Wireless Charging Pad/i, /29\.99/],
  },
  {
    name: "recent sales",
    prompt: "Show the 10 most recent sales.",
    expectedTools: ["listSales"],
    expectedAnswerPatterns: [/Classic Analog Watch/i, /799\.95/],
  },
  {
    name: "monthly units",
    prompt: "How many units were sold in August 2026?",
    expectedTools: ["getSalesSummary"],
    expectedAnswerPatterns: [/90\s+units/i],
  },
  {
    name: "monthly revenue",
    prompt: "How much revenue did we make in August 2026?",
    expectedTools: ["getSalesSummary"],
    expectedAnswerPatterns: [/(6,751\.10|6751\.10)/, /USD|\$/],
  },
  {
    name: "top product",
    prompt: "Which product generated the most revenue in August 2026?",
    expectedTools: ["getTopProducts"],
    expectedAnswerPatterns: [/Ergonomic Office Chair/i, /839\.97/],
  },
  {
    name: "top product defaults to month to date",
    prompt: "What is our top-selling product?",
    expectedTools: ["getTopProducts"],
    expectedAnswerPatterns: [/September|Sep|month-to-date/i],
  },
  {
    name: "category performance",
    prompt: "Which category performed best in August 2026?",
    expectedTools: ["getCategoryPerformance"],
    expectedAnswerPatterns: [/Furniture/i, /839\.97/],
  },
  {
    name: "partial date range",
    prompt: "Show sales between August 10 and August 20, 2026.",
    expectedTools: ["getSalesSummary"],
    expectedAnswerPatterns: [/35\s+units/i, /(1,685\.65|1685\.65)/],
  },
  {
    name: "no matching product",
    prompt: "Find a product named Quantum Banana Teleporter.",
    expectedTools: ["findProducts"],
    expectedAnswerPatterns: [/no matching|couldn't find|not find/i],
  },
  {
    name: "ambiguous month asks for clarification",
    prompt: "Show sales in August.",
    expectedTools: [],
    expectedAnswerPatterns: [/which year|what year/i],
  },
  {
    name: "out-of-scope question uses no database tool",
    prompt: "What is the weather today?",
    expectedTools: [],
    expectedAnswerPatterns: [/product|categor|inventory|sales/i],
  },
];
