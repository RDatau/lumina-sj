/**
 * Universal file & media export/download utility.
 * Fully compatible with:
 * - Median.co / GoNative Android & iOS APK / IPA
 * - Mobile Chrome PWA / Safari PWA
 * - Desktop Browsers (Chrome, Edge, Firefox, Safari)
 * - Android WebView Scoped Storage
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
          // If CORS prevents fetch, use direct <a> download fallback
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

    // Determine platform environment
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isMedianOrWebView = 
      typeof navigator !== 'undefined' && (
        /gonative|median/i.test(navigator.userAgent) || 
        /Android.*(wv|\.0\.0\.0|Version\/4\.0)/i.test(navigator.userAgent) || 
        typeof (window as any).median !== 'undefined' || 
        typeof (window as any).gonative !== 'undefined'
      );

    // CRITICAL FIX FOR MEDIAN.CO APK:
    // Android WebView's DownloadListener ignores HTML5 download attribute.
    // We proxy the file request through our own server to set the Content-Disposition header.
    if (isMedianOrWebView) {
      try {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          
          // Send to our new API proxy
          const response = await fetch('/api/download-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: dataUrl, fileName, mimeType: mimeType || blob.type })
          });
          
          if (response.ok) {
            const blobResp = await response.blob();
            const blobUrl = URL.createObjectURL(blobResp);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(blobUrl);
            return;
          }
        };
        return;
      } catch (e) {
        console.warn('[exportHelper] Download proxy failed, falling back:', e);
      }
    }

    // Fallback: Use Web Share API if available
    if ((isMobile) && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        let shareMime = mimeType || blob.type || 'application/octet-stream';
        let file = new File([blob], fileName, {
          type: shareMime,
          lastModified: Date.now()
        });

        let canShare = false;
        if (typeof navigator.canShare === 'function') {
          canShare = navigator.canShare({ files: [file] });
        } else {
          canShare = true;
        }

        if (canShare) {
          await navigator.share({
            files: [file],
            title: fileName,
            text: fileName
          });
          return; 
        }
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') {
          return;
        }
        console.warn('[downloadMediaFile] Web Share API failed, falling back to direct anchor download:', shareErr);
      }
    }

    // Desktop browsers & Web Share fallback: Direct link download
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.setAttribute('download', fileName);
    link.setAttribute('data-filename', fileName);
    link.style.display = 'none';
    document.body.appendChild(link);

    // Trigger download
    link.click();

    // Clean up DOM node
    setTimeout(() => {
      try {
        if (link.parentNode) {
          document.body.removeChild(link);
        }
      } catch {}
    }, 1500);

    // Keep Blob URL alive for 60 seconds
    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {}
    }, 60000);

  } catch (err) {
    console.error('[downloadMediaFile] Failed to download:', err);
    // Ultimate fallback: if string url was provided, try direct link
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
