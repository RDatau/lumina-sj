/**
 * Universal file export/download utility.
 * Fully compatible with:
 * - Median.co / GoNative Android & iOS APK / IPA
 * - Mobile Chrome PWA / Safari PWA
 * - Desktop Browsers (Chrome, Edge, Firefox, Safari)
 * - Android WebView Scoped Storage & DownloadManager
 */

export const downloadTextFile = async (
  content: string, 
  fileName: string, 
  mimeType: string = 'text/plain;charset=utf-8'
): Promise<void> => {
  // 1. Build UTF-8 safe Base64 Data URL (supports emojis, multi-byte text, and large payloads)
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB chunking prevents call stack limits
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + chunkSize, len))));
  }
  const base64Data = btoa(binary);
  const dataUrl = `data:${mimeType};base64,${base64Data}`;

  const win = window as any;

  // 2. Check for Median.co / GoNative JavaScript Bridge (Native DownloadManager integration)
  if (win.median?.downloads?.downloadFile) {
    try {
      win.median.downloads.downloadFile({
        url: dataUrl,
        filename: fileName
      });
      return;
    } catch (e) {
      console.warn("Median native downloadFile call failed, falling back to standard download:", e);
    }
  } else if (win.gonative?.downloads?.downloadFile) {
    try {
      win.gonative.downloads.downloadFile({
        url: dataUrl,
        filename: fileName
      });
      return;
    } catch (e) {
      console.warn("GoNative native downloadFile call failed, falling back to standard download:", e);
    }
  }

  // 3. Detect Android environment
  const userAgent = navigator.userAgent || '';
  const isAndroid = /Android/i.test(userAgent);

  // In Android WebViews, blob: URLs fail with DownloadManager (Unsupported scheme blob).
  // Using Data URI allows Android's DownloadListener to decode and write directly to Downloads.
  if (isAndroid) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
    }, 500);
    return;
  }

  // 4. For Desktop & other modern browsers:
  // Blob URL is efficient and has no size restrictions, but keep object URL alive for 60s
  try {
    const blob = new Blob([bytes], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Keep blob URL in memory for 60 seconds so browser download manager has ample time to write to disk
    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {}
    }, 60000);
  } catch {
    // Fallback to data URL
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
    }, 500);
  }
};

export const downloadJsonFile = async (data: any, fileName: string): Promise<void> => {
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return downloadTextFile(jsonString, fileName, 'application/json;charset=utf-8');
};
