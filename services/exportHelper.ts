/**
 * Universal file & media export/download utility.
 * Fully compatible with:
 * - Median.co / GoNative Android & iOS APK / IPA (Preserves custom filenames)
 * - Mobile Chrome PWA / Safari PWA
 * - Desktop Browsers (Chrome, Edge, Firefox, Safari)
 * - Android WebView Scoped Storage & DownloadManager
 */

// Helper to convert binary/Uint8Array or string to Data URL safely
export const toDataUrl = (data: Uint8Array | string, mimeType: string): string => {
  if (typeof data === 'string') {
    if (data.startsWith('data:')) return data;
    if (data.startsWith('http://') || data.startsWith('https://')) return data;
    return `data:${mimeType};base64,${data}`;
  }

  let binary = '';
  const len = data.byteLength;
  const chunkSize = 0x8000; // 32KB chunks prevent call stack overflow
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(data.subarray(i, Math.min(i + chunkSize, len))));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
};

/**
 * Universal media & file downloader.
 * Ensures custom filenames are preserved in Median.co APK / GoNative
 * as well as standard Chrome PWA and Desktop browsers.
 */
export const downloadMediaFile = async (
  urlOrData: string | Uint8Array | Blob,
  fileName: string,
  mimeType: string = 'application/octet-stream'
): Promise<void> => {
  const win = window as any;
  const userAgent = navigator.userAgent || '';
  const isMedianUserAgent = /Median|GoNative/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);

  // Prepare URL or Data URL
  let targetUrl: string = '';
  let blobToRevoke: string | null = null;

  if (typeof urlOrData === 'string') {
    if (urlOrData.startsWith('http://') || urlOrData.startsWith('https://')) {
      targetUrl = urlOrData;
    } else if (urlOrData.startsWith('data:')) {
      targetUrl = urlOrData;
    } else {
      targetUrl = `data:${mimeType};base64,${urlOrData}`;
    }
  } else if (urlOrData instanceof Uint8Array) {
    targetUrl = toDataUrl(urlOrData, mimeType);
  } else if (urlOrData instanceof Blob) {
    // If running in Median, convert blob to Data URL so native bridge can write it with custom filename
    if (win.median?.downloads?.downloadFile || win.gonative?.downloads?.downloadFile || isMedianUserAgent) {
      targetUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(urlOrData);
      });
    } else {
      targetUrl = URL.createObjectURL(urlOrData);
      blobToRevoke = targetUrl;
    }
  }

  // 1. Try Median JavaScript Bridge (Primary for Median.co APK)
  if (win.median?.downloads?.downloadFile) {
    try {
      win.median.downloads.downloadFile({
        url: targetUrl,
        filename: fileName
      });
      return;
    } catch (e) {
      console.warn('[Median Bridge] downloadFile error, falling back:', e);
    }
  }

  // 2. Try GoNative JavaScript Bridge (Legacy Median)
  if (win.gonative?.downloads?.downloadFile) {
    try {
      win.gonative.downloads.downloadFile({
        url: targetUrl,
        filename: fileName
      });
      return;
    } catch (e) {
      console.warn('[GoNative Bridge] downloadFile error, falling back:', e);
    }
  }

  // 3. Try Median custom URL scheme if running inside Median app shell
  if (isMedianUserAgent) {
    try {
      const payload = encodeURIComponent(JSON.stringify({ url: targetUrl, filename: fileName }));
      const schemeUrl = `median://downloads/downloadFile?data=${payload}`;
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = schemeUrl;
      document.body.appendChild(iframe);
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch {}
      }, 1000);
      return;
    } catch (e) {
      console.warn('[Median Scheme] dispatch failed:', e);
    }
  }

  // 4. Standard Browser / PWA Download via <a> tag
  try {
    // If it's a remote http/https URL and we are on desktop/PWA, fetch as blob to enforce custom filename
    if (targetUrl.startsWith('http') && !isAndroid) {
      try {
        const res = await fetch(targetUrl);
        const blob = await res.blob();
        targetUrl = URL.createObjectURL(blob);
        blobToRevoke = targetUrl;
      } catch {
        // Fallback to original URL
      }
    }

    const link = document.createElement('a');
    link.href = targetUrl;
    link.download = fileName;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        document.body.removeChild(link);
      } catch {}
      if (blobToRevoke) {
        setTimeout(() => {
          try {
            URL.revokeObjectURL(blobToRevoke!);
          } catch {}
        }, 60000); // 60s retention avoids premature revocation
      }
    }, 500);
  } catch (err) {
    console.error('Download failed:', err);
  }
};

export const downloadTextFile = async (
  content: string, 
  fileName: string, 
  mimeType: string = 'text/plain;charset=utf-8'
): Promise<void> => {
  const bytes = new TextEncoder().encode(content);
  const dataUrl = toDataUrl(bytes, mimeType);
  return downloadMediaFile(dataUrl, fileName, mimeType);
};

export const downloadJsonFile = async (data: any, fileName: string): Promise<void> => {
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return downloadTextFile(jsonString, fileName, 'application/json;charset=utf-8');
};
