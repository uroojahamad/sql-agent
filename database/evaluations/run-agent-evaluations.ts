import nextEnv from "@next/env";
import { google } from "@ai-sdk/google";
import { generateText, isStepCount } from "ai";
import { sqlAgentEvaluationCases } from "./sql-agent-cases";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const [{ createSqlAgentTools }, { createSqlAgentSystemPrompt }] =
  await Promise.all([import("../ai-tools"), import("../sql-agent-prompt")]);

let failures = 0;
const delayMs = Number(process.env.SQL_AGENT_EVAL_DELAY_MS ?? "9000");

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

for (const [index, evaluation] of sqlAgentEvaluationCases.entries()) {
  try {
    const tools = createSqlAgentTools({ requestId: crypto.randomUUID() });
    const result = await generateText({
      model: google("gemini-3.5-flash-lite"),
      instructions: createSqlAgentSystemPrompt(),
      prompt: evaluation.prompt,
      tools,
      stopWhen: isStepCount(5),
      maxRetries: 0,
    });
    const calledTools = [
      ...new Set(
        result.steps.flatMap((step) =>
          step.toolCalls.map((call) => call.toolName),
        ),
      ),
    ];
    const toolsPassed =
      evaluation.expectedTools.length === calledTools.length &&
      evaluation.expectedTools.every((toolName) => calledTools.includes(toolName));
    const answerPassed = evaluation.expectedAnswerPatterns.every((pattern) =>
      pattern.test(result.text),
    );
    const passed = toolsPassed && answerPassed && result.text.trim().length > 0;

    console.log(
      `${passed ? "PASS" : "FAIL"} ${evaluation.name}: tools=[${calledTools.join(", ")}] answer=${JSON.stringify(result.text)}`,
    );

    if (!passed) {
      failures += 1;
    }
  } catch {
    failures += 1;
    console.error(`ERROR ${evaluation.name}: provider or database request failed.`);
  }

  if (index < sqlAgentEvaluationCases.length - 1 && delayMs > 0) {
    await wait(delayMs);
  }
}

if (failures > 0) {
  throw new Error(`${failures} SQL-agent evaluation case(s) failed.`);
}
