export interface SerializedTaskQueue {
  enqueue<T>(task: () => Promise<T>): Promise<T>;
  whenIdle(): Promise<void>;
}

/**
 * Runs asynchronous mutations one at a time while allowing each caller to await
 * its own result. A rejected task does not poison the queue for later work.
 */
export const createSerializedTaskQueue = (): SerializedTaskQueue => {
  let tail: Promise<unknown> = Promise.resolve();

  return {
    enqueue<T>(task: () => Promise<T>) {
      const result = tail.then(task, task);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    async whenIdle() {
      await tail;
    },
  };
};
