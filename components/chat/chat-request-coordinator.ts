export const createChatRequestCoordinator = <RollbackState,>() => {
  type ActiveRequest = {
    rollbackState: RollbackState;
    cancelling: boolean;
  };

  let activeRequest: ActiveRequest | undefined;

  const finish = (request: ActiveRequest) => {
    if (activeRequest === request && !request.cancelling) {
      activeRequest = undefined;
    }
  };

  const start = (
    rollbackState: RollbackState,
    execute: () => Promise<void>,
  ) => {
    if (activeRequest) return false;

    const request = { rollbackState, cancelling: false };
    activeRequest = request;

    try {
      void execute().then(
        () => finish(request),
        () => finish(request),
      );
    } catch (error) {
      activeRequest = undefined;
      throw error;
    }

    return true;
  };

  const cancel = async (
    stop: () => Promise<void>,
    restore: (rollbackState: RollbackState) => void,
  ) => {
    const request = activeRequest;

    if (!request) {
      await stop();
      return false;
    }

    request.cancelling = true;

    try {
      await stop();
    } finally {
      if (activeRequest === request) {
        try {
          restore(request.rollbackState);
        } finally {
          activeRequest = undefined;
        }
      }
    }

    return true;
  };

  return {
    hasActiveRequest: () => activeRequest !== undefined,
    start,
    cancel,
  };
};
