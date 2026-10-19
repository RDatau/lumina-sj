/**
 * Helper service to interact with the backup Web Worker.
 */

let workerInstance: Worker | null = null;

const getWorker = (): Worker => {
  if (!workerInstance) {
    workerInstance = new Worker(new URL('../workers/backupWorker.ts', import.meta.url), { type: 'module' });
  }
  return workerInstance;
};

export const workerStringify = (data: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const worker = getWorker();
      const messageHandler = (e: MessageEvent) => {
        const { success, type, result, error } = e.data;
        if (type === 'STRINGIFY') {
          worker.removeEventListener('message', messageHandler);
          if (success) {
            resolve(result);
          } else {
            reject(new Error(error || 'Failed to stringify in worker'));
          }
        }
      };
      worker.addEventListener('message', messageHandler);
      worker.postMessage({ type: 'STRINGIFY', data });
    } catch (err) {
      // Fallback to main thread if worker fails to spawn
      try {
        resolve(JSON.stringify(data, null, 2));
      } catch (fallbackErr) {
        reject(fallbackErr);
      }
    }
  });
};

export const workerParse = (jsonString: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      const worker = getWorker();
      const messageHandler = (e: MessageEvent) => {
        const { success, type, result, error } = e.data;
        if (type === 'PARSE') {
          worker.removeEventListener('message', messageHandler);
          if (success) {
            resolve(result);
          } else {
            reject(new Error(error || 'Failed to parse JSON in worker'));
          }
        }
      };
      worker.addEventListener('message', messageHandler);
      worker.postMessage({ type: 'PARSE', data: jsonString });
    } catch (err) {
      // Fallback to main thread if worker fails to spawn
      try {
        resolve(JSON.parse(jsonString));
      } catch (fallbackErr) {
        reject(fallbackErr);
      }
    }
  });
};
