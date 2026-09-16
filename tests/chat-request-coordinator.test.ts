import assert from "node:assert/strict";
import test from "node:test";
import { createChatRequestCoordinator } from "../components/chat/chat-request-coordinator";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });

  return { promise, resolve };
};

test("prevents overlapping chat requests", () => {
  const coordinator = createChatRequestCoordinator<string[]>();
  const firstRequest = deferred();

  assert.equal(
    coordinator.start(["completed turn"], () => firstRequest.promise),
    true,
  );
  assert.equal(coordinator.start([], async () => undefined), false);
  assert.equal(coordinator.hasActiveRequest(), true);
});

test("cancelling restores the pre-request conversation", async () => {
  const coordinator = createChatRequestCoordinator<string[]>();
  const request = deferred();
  const completedConversation = ["completed turn"];
  let restoredConversation: string[] | undefined;
  let stopCalls = 0;

  coordinator.start(completedConversation, () => request.promise);
  const cancelled = await coordinator.cancel(
    async () => {
      stopCalls += 1;
    },
    (rollbackState) => {
      restoredConversation = rollbackState;
    },
  );

  assert.equal(cancelled, true);
  assert.equal(stopCalls, 1);
  assert.deepEqual(restoredConversation, completedConversation);
  assert.equal(coordinator.hasActiveRequest(), false);
});

test("late completion from a cancelled request cannot clear a newer request", async () => {
  const coordinator = createChatRequestCoordinator<string[]>();
  const cancelledRequest = deferred();
  const currentRequest = deferred();

  coordinator.start(["before cancelled turn"], () => cancelledRequest.promise);
  await coordinator.cancel(async () => undefined, () => undefined);

  assert.equal(
    coordinator.start(["before current turn"], () => currentRequest.promise),
    true,
  );

  cancelledRequest.resolve();
  await Promise.resolve();

  assert.equal(coordinator.hasActiveRequest(), true);
  assert.equal(coordinator.start([], async () => undefined), false);

  currentRequest.resolve();
  await Promise.resolve();
  assert.equal(coordinator.hasActiveRequest(), false);
});
