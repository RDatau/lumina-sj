/**
 * Web Worker for heavy JSON processing (stringify & parse) to prevent main thread blocking and UI freezing.
 */

self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data;
  try {
    if (type === 'STRINGIFY') {
      const jsonString = JSON.stringify(data, null, 2);
      self.postMessage({ success: true, type, result: jsonString });
    } else if (type === 'PARSE') {
      const json = JSON.parse(data);
      self.postMessage({ success: true, type, result: json });
    } else {
      self.postMessage({ success: false, type, error: 'Unknown worker action type' });
    }
  } catch (err: any) {
    self.postMessage({ success: false, type, error: err?.message || String(err) });
  }
};
