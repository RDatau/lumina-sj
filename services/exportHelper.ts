/**
 * Universal file & media export/download utility.
 * Fully compatible with:
 * - Median.co / GoNative Android & iOS APK / IPA
 * - Mobile Chrome PWA / Safari PWA
 * - Desktop Browsers (Chrome, Edge, Firefox, Safari)
 */

export const downloadMediaFile = async (
  urlOrData: string | Uint8Array | Blob,
  fileName: string,
  mimeType: string = 'application/octet-stream'
): Promise<void> => {
  try {
    let blob: Blob;

    if (urlOrData instanceof Blob) {
      blob = urlOrData;
    } else if (urlOrData instanceof Uint8Array) {
      blob = new Blob([urlOrData], { type: mimeType });
    } else if (typeof urlOrData === 'string') {
      if (urlOrData.startsWith('data:')) {
        // Fast native conversion of data URI to Blob
        try {
          const res = await fetch(urlOrData);
          blob = await res.blob();
        } catch {
          const parts = urlOrData.split(',');
          const byteString = atob(parts[1] || parts[0]);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          blob = new Blob([ab], { type: mimeType });
        }
      } else if (urlOrData.startsWith('http://') || urlOrData.startsWith('https://')) {
        // For public HTTP/HTTPS URLs: fetch as blob to enforce custom filename
        try {
          const res = await fetch(urlOrData);
          blob = await res.blob();
        } catch {
          // If CORS prevents fetch, use direct <a> download
          const link = document.createElement('a');
          link.href = urlOrData;
          link.download = fileName;
          link.setAttribute('download', fileName);
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            try {
              if (link.parentNode) document.body.removeChild(link);
            } catch {}
          }, 1500);
          return;
        }
      } else {
        // Raw base64 string
        const byteString = atob(urlOrData);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        blob = new Blob([ab], { type: mimeType });
      }
    } else {
      blob = new Blob([urlOrData as any], { type: mimeType });
    }

    // Create object URL from blob
    const blobUrl = URL.createObjectURL(blob);

    // Create anchor element with explicit download attributes
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.setAttribute('download', fileName);
    link.setAttribute('data-filename', fileName);
    link.style.display = 'none';
    document.body.appendChild(link);

    // Trigger download immediately
    link.click();

    // Clean up DOM node after 1.5s (gives Android WebView enough time to inspect the clicked element)
    setTimeout(() => {
      try {
        if (link.parentNode) {
          document.body.removeChild(link);
        }
      } catch {}
    }, 1500);

    // Keep Blob URL alive for 60 seconds!
    // CRITICAL: Median.co Android BlobDownloader reads the blob asynchronously via JS bridge.
    // If revoked too early (e.g. 100ms), the download fails or defaults to download.ext.
    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {}
    }, 60000);

  } catch (err) {
    console.error('[downloadMediaFile] Failed to download:', err);
    // Fallback: if string url was provided, try direct link
    if (typeof urlOrData === 'string') {
      const link = document.createElement('a');
      link.href = urlOrData;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          if (link.parentNode) document.body.removeChild(link);
        } catch {}
      }, 1500);
    }
  }
};

export const downloadTextFile = async (
  content: string, 
  fileName: string, 
  mimeType: string = 'text/plain;charset=utf-8'
): Promise<void> => {
  const blob = new Blob([content], { type: mimeType });
  return downloadMediaFile(blob, fileName, mimeType);
};

export const downloadJsonFile = async (data: any, fileName: string): Promise<void> => {
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return downloadTextFile(jsonString, fileName, 'application/json;charset=utf-8');
};
