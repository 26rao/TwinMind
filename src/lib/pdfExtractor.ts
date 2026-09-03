/**
 * Client-side PDF and Document text extractor.
 * Loads pdf.js dynamically from CDN when available, with a resilient fallback parser.
 */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfjsLib?: any;
  }
}

let pdfJsPromise: Promise<unknown> | null = null;

function getPdfJs(): Promise<unknown> {
  if (pdfJsPromise) return pdfJsPromise;
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);

  pdfJsPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      const lib = window.pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(lib);
      } else {
        resolve(null);
      }
    };
    script.onerror = () => {
      console.warn('Could not load PDF.js from CDN, fallback extractor will be used.');
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return pdfJsPromise;
}

/**
 * Fallback parser for extracting plain text from PDF streams if offline.
 */
function fallbackPdfTextExtract(buffer: ArrayBuffer): string {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buffer));
  const matches: string[] = [];
  const regex = /\(([^)\\]*(?:\\.[^)\\]*)*\)\s*Tj|\[([^\]]*)\]\s*TJ/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      matches.push(match[1]);
    } else if (match[2]) {
      const innerMatches = match[2].match(/\(([^)\\]*(?:\\.[^)\\]*)*\)/g);
      if (innerMatches) {
        matches.push(innerMatches.map((m) => m.slice(1, -1)).join(' '));
      }
    }
  }

  const cleaned = matches
    .join(' ')
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\r|\\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
}

/**
 * Extracts plain text from a PDF file.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjs: any = await getPdfJs();
    if (pdfjs && pdfjs.getDocument) {
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
      const doc = await loadingTask.promise;
      const pagesText: string[] = [];

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const pageStr = textContent.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => (item.str ? item.str : ''))
          .join(' ');
        if (pageStr.trim()) {
          pagesText.push(pageStr.trim());
        }
      }

      if (pagesText.length > 0) {
        return pagesText.join('\n\n');
      }
    }
  } catch (err) {
    console.warn('PDF.js execution error, falling back to stream decoder:', err);
  }

  const fallback = fallbackPdfTextExtract(arrayBuffer);
  if (fallback) return fallback;

  throw new Error('Unable to extract text from the PDF. The file may be image-only or encrypted.');
}
