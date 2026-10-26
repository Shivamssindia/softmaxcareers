"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  X,
  ExternalLink,
  Download,
  Maximize2,
  Minimize2,
  Eye,
  AlertCircle,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  FileCheck,
  Layers,
  Monitor,
  Cloud,
  FileCode,
  FileType,
  Sun,
  Moon,
} from "lucide-react";
import { extractDriveFileId } from "@/lib/googleDriveService";
import { useTheme } from "@/context/ThemeContext";

export interface ResumeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  resumeUrl?: string | null;
  fileName?: string | null;
  candidateName?: string | null;
  jobTitle?: string | null;
  candidateEmail?: string | null;
}

interface FetchedDocument {
  blob: Blob;
  blobUrl: string;
  arrayBuffer: ArrayBuffer;
  contentType: string;
  isPdf: boolean;
  isDocx: boolean;
  isDoc: boolean;
  isImage: boolean;
  fileName: string;
  driveId?: string;
  cloudPreviewUrl?: string;
  isFallbackOnly?: boolean;
}

function isPdfBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46    // F
  );
}

function isDocxBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return (
    bytes[0] === 0x50 && // P
    bytes[1] === 0x4B && // K
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

function isDocBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return (
    bytes[0] === 0xD0 &&
    bytes[1] === 0xCF &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xE0
  );
}

export function getCloudPreviewUrl(
  url?: string | null,
  driveId?: string | null,
  isDocxHint?: boolean,
  isDocHint?: boolean
): string | null {
  if (!url && !driveId) return null;
  const effectiveId = driveId || extractDriveFileId(url);

  if (effectiveId) {
    if (
      isDocxHint ||
      isDocHint ||
      url?.includes("/document/") ||
      url?.includes("docs.google.com")
    ) {
      return `https://docs.google.com/document/d/${effectiveId}/preview`;
    }
    return `https://drive.google.com/file/d/${effectiveId}/preview`;
  }

  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  }

  return null;
}

function determineEffectiveFileName(
  rawFileName?: string | null,
  url?: string | null,
  isDocx?: boolean,
  isDoc?: boolean
): string {
  if (rawFileName && rawFileName.trim()) {
    return rawFileName.trim();
  }
  const isDriveDoc =
    url?.includes("/document/") ||
    url?.includes(".docx") ||
    isDocx;
  if (isDriveDoc) {
    return "Candidate Document.docx";
  }
  if (isDoc || url?.includes(".doc")) {
    return "Candidate Document.doc";
  }
  return "Candidate Resume.pdf";
}

/**
 * Fetch the file bytes directly, either from Data URI, Google Drive, or remote URL.
 * Also computes cloud preview URLs for fallback and alternative view modes.
 */
async function fetchDocumentFile(
  url: string,
  fileName?: string | null
): Promise<FetchedDocument> {
  const driveId = extractDriveFileId(url);
  const lowerUrl = url.toLowerCase();
  const lowerName = (fileName || "").toLowerCase();

  const isDocxHint =
    lowerUrl.includes(".docx") ||
    lowerUrl.includes("docs.google.com/document") ||
    lowerName.endsWith(".docx");
  const isDocHint = lowerUrl.includes(".doc") || lowerName.endsWith(".doc");

  const cleanFileName = determineEffectiveFileName(
    fileName,
    url,
    isDocxHint,
    isDocHint
  );

  const cloudPreviewUrl = getCloudPreviewUrl(url, driveId, isDocxHint, isDocHint) || undefined;

  // 1. Data URL
  if (url.startsWith("data:")) {
    const parts = url.split(";base64,");
    const mime = parts[0].replace("data:", "") || "application/pdf";
    const base64Data = parts[1] || "";
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([byteNumbers.buffer as ArrayBuffer], { type: mime });
    const isImg = mime.startsWith("image/");
    const isDocx = !isImg && (isDocxBytes(byteNumbers) || isDocxHint);
    const isDoc = !isImg && !isDocx && (isDocBytes(byteNumbers) || isDocHint);
    const isPdf = !isImg && !isDocx && !isDoc && (mime.includes("pdf") || isPdfBytes(byteNumbers));

    return {
      blob,
      blobUrl: URL.createObjectURL(blob),
      arrayBuffer: byteNumbers.buffer as ArrayBuffer,
      contentType: mime,
      isPdf,
      isDocx,
      isDoc,
      isImage: isImg,
      fileName: cleanFileName,
      driveId,
      cloudPreviewUrl,
    };
  }

  // 2. Blob URL
  if (url.startsWith("blob:")) {
    const res = await fetch(url);
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const isImg = blob.type.startsWith("image/");
    const isDocx = !isImg && (isDocxBytes(bytes) || isDocxHint);
    const isDoc = !isImg && !isDocx && (isDocBytes(bytes) || isDocHint);
    const isPdf = !isImg && !isDocx && !isDoc && (blob.type.includes("pdf") || isPdfBytes(bytes));

    return {
      blob,
      blobUrl: url,
      arrayBuffer,
      contentType: blob.type || (isPdf ? "application/pdf" : isDocx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/octet-stream"),
      isPdf,
      isDocx,
      isDoc,
      isImage: isImg,
      fileName: cleanFileName,
      driveId,
      cloudPreviewUrl,
    };
  }

  // 2b. Relative or local URL
  if (url.startsWith("/") && !url.startsWith("//")) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const cType = res.headers.get("content-type") || blob.type || "";
        const isImg = cType.startsWith("image/");
        const isDocx = !isImg && (isDocxBytes(bytes) || isDocxHint || cType.includes("wordprocessingml"));
        const isDoc = !isImg && !isDocx && (isDocBytes(bytes) || isDocHint || cType.includes("msword"));
        const isPdf = !isImg && !isDocx && !isDoc && (cType.includes("pdf") || isPdfBytes(bytes));

        return {
          blob,
          blobUrl: URL.createObjectURL(blob),
          arrayBuffer,
          contentType: cType || (isPdf ? "application/pdf" : isDocx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/octet-stream"),
          isPdf,
          isDocx,
          isDoc,
          isImage: isImg,
          fileName: cleanFileName,
          cloudPreviewUrl,
        };
      }
    } catch (localErr) {
      console.warn("[ResumeViewer] Local relative fetch error:", localErr);
    }
  }

  // 3. Google Drive file or Drive ID
  if (driveId) {
    const clientToken =
      typeof window !== "undefined"
        ? sessionStorage.getItem("gdrive_access_token")
        : null;

    // Attempt direct OAuth fetch if token is present
    if (clientToken) {
      try {
        const directRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveId)}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${clientToken}`,
            },
          }
        );
        if (directRes.ok) {
          const blob = await directRes.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const isImg = blob.type.startsWith("image/");
          const isDocx = !isImg && (isDocxBytes(bytes) || isDocxHint);
          const isDoc = !isImg && !isDocx && (isDocBytes(bytes) || isDocHint);
          const isPdf = !isImg && !isDocx && !isDoc && (blob.type.includes("pdf") || isPdfBytes(bytes));

          return {
            blob,
            blobUrl: URL.createObjectURL(blob),
            arrayBuffer,
            contentType: blob.type || (isPdf ? "application/pdf" : isDocx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/octet-stream"),
            isPdf,
            isDocx,
            isDoc,
            isImage: isImg,
            fileName: cleanFileName,
            driveId,
            cloudPreviewUrl,
          };
        }
      } catch (e) {
        console.warn("[ResumeViewer] Direct Drive API fetch failed, falling back to proxy:", e);
      }
    }

    // Server-side proxy fetch
    try {
      const proxyHeaders: HeadersInit = {};
      if (clientToken) {
        proxyHeaders["Authorization"] = `Bearer ${clientToken}`;
      }

      const proxyRes = await fetch(
        `/api/file-proxy?driveId=${encodeURIComponent(driveId)}&fileName=${encodeURIComponent(cleanFileName)}`,
        { headers: proxyHeaders }
      );

      if (proxyRes.ok) {
        const blob = await proxyRes.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const cType = proxyRes.headers.get("content-type") || blob.type || "";
        const isImg = cType.startsWith("image/");
        const isDocx = !isImg && (isDocxBytes(bytes) || isDocxHint || cType.includes("wordprocessingml"));
        const isDoc = !isImg && !isDocx && (isDocBytes(bytes) || isDocHint || cType.includes("msword"));
        const isPdf = !isImg && !isDocx && !isDoc && (cType.includes("pdf") || isPdfBytes(bytes));

        return {
          blob,
          blobUrl: URL.createObjectURL(blob),
          arrayBuffer,
          contentType: cType || (isPdf ? "application/pdf" : isDocx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/octet-stream"),
          isPdf,
          isDocx,
          isDoc,
          isImage: isImg,
          fileName: cleanFileName,
          driveId,
          cloudPreviewUrl,
        };
      }
    } catch (proxyErr) {
      console.warn("[ResumeViewer] Proxy fetch error, proceeding to cloud viewer fallback:", proxyErr);
    }

    // Fallback document with cloud preview enabled (so document always opens!)
    const dummyBlob = new Blob([], { type: isDocxHint ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf" });
    return {
      blob: dummyBlob,
      blobUrl: "",
      arrayBuffer: new ArrayBuffer(0),
      contentType: isDocxHint ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf",
      isPdf: !isDocxHint && !isDocHint,
      isDocx: isDocxHint,
      isDoc: isDocHint,
      isImage: false,
      fileName: cleanFileName,
      driveId,
      cloudPreviewUrl,
      isFallbackOnly: true,
    };
  }

  // 4. Remote HTTP/HTTPS URL
  try {
    const directRes = await fetch(url);
    if (directRes.ok) {
      const blob = await directRes.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const cType = blob.type || "";
      const isImg = cType.startsWith("image/");
      const isDocx = !isImg && (isDocxBytes(bytes) || isDocxHint || cType.includes("wordprocessingml"));
      const isDoc = !isImg && !isDocx && (isDocBytes(bytes) || isDocHint || cType.includes("msword"));
      const isPdf = !isImg && !isDocx && !isDoc && (cType.includes("pdf") || isPdfBytes(bytes));

      return {
        blob,
        blobUrl: URL.createObjectURL(blob),
        arrayBuffer,
        contentType: cType,
        isPdf,
        isDocx,
        isDoc,
        isImage: isImg,
        fileName: cleanFileName,
        cloudPreviewUrl,
      };
    }
  } catch (corsErr) {
    console.warn("[ResumeViewer] Direct fetch blocked by CORS, trying proxy:", corsErr);
  }

  // Fallback to proxy
  try {
    const proxyRes = await fetch(
      `/api/file-proxy?url=${encodeURIComponent(url)}&fileName=${encodeURIComponent(cleanFileName)}`
    );

    if (proxyRes.ok) {
      const blob = await proxyRes.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const cType = proxyRes.headers.get("content-type") || blob.type || "";
      const isImg = cType.startsWith("image/");
      const isDocx = !isImg && (isDocxBytes(bytes) || isDocxHint || cType.includes("wordprocessingml"));
      const isDoc = !isImg && !isDocx && (isDocBytes(bytes) || isDocHint || cType.includes("msword"));
      const isPdf = !isImg && !isDocx && !isDoc && (cType.includes("pdf") || isPdfBytes(bytes));

      return {
        blob,
        blobUrl: URL.createObjectURL(blob),
        arrayBuffer,
        contentType: cType,
        isPdf,
        isDocx,
        isDoc,
        isImage: isImg,
        fileName: cleanFileName,
        cloudPreviewUrl,
      };
    }
  } catch (proxyErr) {
    console.warn("[ResumeViewer] Proxy fetch error:", proxyErr);
  }

  // Graceful fallback to Cloud Viewer
  const dummyBlob = new Blob([], { type: isDocxHint ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf" });
  return {
    blob: dummyBlob,
    blobUrl: "",
    arrayBuffer: new ArrayBuffer(0),
    contentType: isDocxHint ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf",
    isPdf: !isDocxHint && !isDocHint,
    isDocx: isDocxHint,
    isDoc: isDocHint,
    isImage: false,
    fileName: cleanFileName,
    cloudPreviewUrl,
    isFallbackOnly: true,
  };
}

/**
 * Safely open resume in a new tab/window
 */
export async function openResumeInNewWindow(url?: string | null, fileName?: string | null) {
  if (!url) return;

  const driveId = extractDriveFileId(url);
  const isDocx = fileName?.toLowerCase().endsWith(".docx") || url.includes("/document/");

  if (driveId) {
    if (isDocx) {
      window.open(`https://docs.google.com/document/d/${driveId}/view`, "_blank", "noopener,noreferrer");
      return;
    }
    window.open(`https://drive.google.com/file/d/${driveId}/view`, "_blank", "noopener,noreferrer");
    return;
  }

  try {
    const doc = await fetchDocumentFile(url, fileName);
    if (doc.blobUrl) {
      window.open(doc.blobUrl, "_blank");
      return;
    }
    if (doc.cloudPreviewUrl) {
      window.open(doc.cloudPreviewUrl, "_blank", "noopener,noreferrer");
      return;
    }
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Download resume file cleanly by fetching binary blob directly
 */
export async function downloadResumeFile(url?: string | null, fileName?: string | null) {
  if (!url) return;

  const driveId = extractDriveFileId(url);
  const isDocxHint = fileName?.toLowerCase().endsWith(".docx") || url.includes("/document/");
  const effectiveName = determineEffectiveFileName(fileName, url, isDocxHint);

  try {
    const doc = await fetchDocumentFile(url, effectiveName);
    if (doc.blob && doc.blob.size > 0 && doc.blobUrl) {
      const a = document.createElement("a");
      a.href = doc.blobUrl;
      a.download = doc.fileName || effectiveName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
  } catch (e) {
    console.warn("Direct blob download failed, trying download link fallback:", e);
  }

  if (driveId) {
    if (isDocxHint) {
      window.open(`https://docs.google.com/document/d/${driveId}/export?format=docx`, "_blank");
      return;
    }
    window.open(`https://drive.google.com/uc?id=${driveId}&export=download`, "_blank");
    return;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = effectiveName;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// -------------------------------------------------------------
// PDF.js Canvas Rendering Engine
// -------------------------------------------------------------
let pdfjsPromise: Promise<any> | null = null;

function loadPdfJs(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  const origin = window.location.origin;
  const workerPath = `${origin}/pdf.worker.min.js`;

  const configureWorker = (lib: any) => {
    if (lib && lib.GlobalWorkerOptions) {
      lib.GlobalWorkerOptions.workerSrc = workerPath;
    }
  };

  if ((window as any).pdfjsLib) {
    const lib = (window as any).pdfjsLib;
    configureWorker(lib);
    return Promise.resolve(lib);
  }
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("pdfjs-script");
    if (existing) {
      if ((window as any).pdfjsLib) {
        const lib = (window as any).pdfjsLib;
        configureWorker(lib);
        resolve(lib);
      } else {
        existing.addEventListener("load", () => {
          const lib = (window as any).pdfjsLib;
          if (lib) {
            configureWorker(lib);
            resolve(lib);
          } else {
            reject(new Error("pdfjsLib not defined"));
          }
        });
        existing.addEventListener("error", reject);
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "pdfjs-script";
    script.src = "/pdf.min.js";
    script.async = true;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (lib) {
        configureWorker(lib);
        resolve(lib);
      } else {
        reject(new Error("pdfjsLib undefined after load"));
      }
    };
    script.onerror = () => {
      // CDN Fallback with inline blob worker to circumvent cross-origin restrictions
      console.warn("Local /pdf.min.js failed to load, falling back to CDN...");
      const cdnScript = document.createElement("script");
      cdnScript.id = "pdfjs-script-cdn";
      cdnScript.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      cdnScript.async = true;
      cdnScript.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          try {
            const workerCode = `importScripts("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js");`;
            const workerBlob = new Blob([workerCode], { type: "application/javascript" });
            lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);
          } catch {
            lib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          }
          resolve(lib);
        } else {
          reject(new Error("CDN pdfjsLib undefined"));
        }
      };
      cdnScript.onerror = (err) => reject(err);
      document.head.appendChild(cdnScript);
    };
    document.head.appendChild(script);
  }).catch((err) => {
    pdfjsPromise = null;
    throw err;
  });

  return pdfjsPromise;
}

const SinglePageCanvas: React.FC<{
  pdfDoc: any;
  pageNum: number;
  scale: number;
  rotation: number;
}> = ({ pdfDoc, pageNum, scale, rotation }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageRendering, setPageRendering] = useState(true);
  const currentRenderTask = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      if (!pdfDoc || !canvasRef.current) return;
      setPageRendering(true);

      if (currentRenderTask.current) {
        try {
          currentRenderTask.current.cancel();
        } catch {}
      }

      try {
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled || !canvasRef.current) return;

        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const viewport = page.getViewport({ scale: scale * dpr, rotation });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const task = page.render(renderContext);
        currentRenderTask.current = task;
        await task.promise;
        if (!cancelled) {
          setPageRendering(false);
        }
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.warn(`[ResumeViewer] Page ${pageNum} render error:`, err);
        }
        if (!cancelled) {
          setPageRendering(false);
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      if (currentRenderTask.current) {
        try {
          currentRenderTask.current.cancel();
        } catch {}
      }
    };
  }, [pdfDoc, pageNum, scale, rotation]);

  return (
    <div className="relative flex flex-col items-center mb-6 last:mb-2">
      <div className="relative shadow-xl rounded-lg overflow-hidden bg-white border border-slate-200 dark:border-slate-800 transition-shadow">
        <canvas ref={canvasRef} className="block max-w-full" />
        {pageRendering && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
        )}
      </div>
      <div className="mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        Page {pageNum} of {pdfDoc.numPages}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// DOCX Client-Side Canvas/DOM Renderer
// -------------------------------------------------------------
const DocxViewer: React.FC<{
  arrayBuffer: ArrayBuffer;
  scale: number;
  onError?: (err: any) => void;
}> = ({ arrayBuffer, scale, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current || !arrayBuffer || arrayBuffer.byteLength === 0) return;

    setLoading(true);
    containerRef.current.innerHTML = "";

    import("docx-preview")
      .then(({ renderAsync }) => {
        if (cancelled || !containerRef.current) return;
        return renderAsync(arrayBuffer, containerRef.current, undefined, {
          className: "docx-doc-render",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          experimental: true,
          useBase64URL: true,
        });
      })
      .then(() => {
        if (!cancelled) {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn("[ResumeViewer] docx-preview rendering error:", err);
        if (!cancelled) {
          setLoading(false);
          if (onError) onError(err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [arrayBuffer, onError]);

  return (
    <div className="relative flex-1 w-full h-full overflow-y-auto overflow-x-hidden p-4 sm:p-6 bg-slate-200/70 dark:bg-slate-950 flex flex-col items-center">
      {loading && (
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-2">
          <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Rendering Word Document...
          </span>
        </div>
      )}
      <div
        className="w-full flex justify-center transition-transform duration-150 origin-top"
        style={{ transform: `scale(${scale})` }}
      >
        <div
          ref={containerRef}
          className="docx-preview-container max-w-4xl w-full shadow-2xl rounded-xl bg-white text-slate-900 overflow-hidden border border-slate-200 dark:border-slate-800"
        />
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Main Modal Component
// -------------------------------------------------------------
export const ResumeViewerModal: React.FC<ResumeViewerModalProps> = ({
  isOpen,
  onClose,
  resumeUrl,
  fileName,
  candidateName,
  jobTitle,
  candidateEmail,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [doc, setDoc] = useState<FetchedDocument | null>(null);

  // Viewer modes: "canvas" (PDF.js) | "native" (Browser PDF) | "docx" (Word document) | "cloud" (Google Drive / Docs iframe)
  const [viewMode, setViewMode] = useState<"canvas" | "native" | "docx" | "cloud">("canvas");
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [scale, setScale] = useState(1.15);
  const [rotation, setRotation] = useState(0);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch document whenever resumeUrl changes and modal is open
  const loadDocument = useCallback(async () => {
    if (!isOpen || !resumeUrl) {
      setDoc(null);
      setPdfDoc(null);
      setFetchError(null);
      return;
    }

    setIsFetching(true);
    setFetchError(null);
    setPdfDoc(null);

    try {
      const fetched = await fetchDocumentFile(resumeUrl, fileName);
      setDoc(fetched);

      // Handle PDF format
      if (fetched.isPdf && fetched.arrayBuffer.byteLength > 0 && !fetched.isFallbackOnly) {
        try {
          const pdfjs = await loadPdfJs();
          const bufferCopy = fetched.arrayBuffer.slice(0);
          const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(bufferCopy),
            cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
            cMapPacked: true,
            stopAtErrors: false,
          });
          const loadedPdf = await loadingTask.promise;
          setPdfDoc(loadedPdf);
          setViewMode("canvas");
        } catch (pdfErr: any) {
          console.warn("[ResumeViewer] PDF.js parsing failed, switching to resilient cloud/native mode:", pdfErr);
          // If Google Drive link is available, seamlessly fall back to Google Drive embedded viewer
          if (fetched.cloudPreviewUrl) {
            setViewMode("cloud");
          } else {
            setViewMode("native");
          }
        }
      } else if (fetched.isDocx) {
        // Handle DOCX Word Document
        if (fetched.arrayBuffer.byteLength > 0 && !fetched.isFallbackOnly) {
          setViewMode("docx");
        } else if (fetched.cloudPreviewUrl) {
          setViewMode("cloud");
        }
      } else if (fetched.isDoc || fetched.isFallbackOnly) {
        // Legacy DOC or fallback mode: Google Docs / Drive cloud viewer
        setViewMode("cloud");
      }
    } catch (err: any) {
      console.error("[ResumeViewer] Document fetch encountered error:", err);
      // Even if fetch threw, fallback to cloud preview if available
      const driveId = extractDriveFileId(resumeUrl);
      const cloudUrl = getCloudPreviewUrl(resumeUrl, driveId);
      if (cloudUrl) {
        setViewMode("cloud");
      } else {
        setFetchError(err?.message || "Could not fetch document file.");
      }
    } finally {
      setIsFetching(false);
    }
  }, [isOpen, resumeUrl, fileName]);

  useEffect(() => {
    loadDocument();
    return () => {
      if (doc?.blobUrl && doc.blobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(doc.blobUrl);
      }
    };
  }, [loadDocument]);

  const displayFileName =
    fileName ||
    doc?.fileName ||
    determineEffectiveFileName(undefined, resumeUrl, doc?.isDocx, doc?.isDoc);

  const driveId = extractDriveFileId(resumeUrl);
  const isDrive = Boolean(driveId);
  const cloudViewerUrl =
    doc?.cloudPreviewUrl ||
    getCloudPreviewUrl(resumeUrl, driveId, doc?.isDocx, doc?.isDoc);

  // Zoom Handlers
  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.2, 2.5));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.6));
  const handleZoomReset = () => setScale(1.15);
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const isDocType = doc?.isDocx || doc?.isDoc || displayFileName.toLowerCase().endsWith(".docx") || displayFileName.toLowerCase().endsWith(".doc");

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className={`flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-all duration-300 ${
              isMaximized
                ? "w-full h-full rounded-none"
                : "w-full max-w-5xl h-[90vh] rounded-2xl"
            }`}
          >
            {/* Window Titlebar Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm select-none flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 shadow-sm ${
                    isDocType
                      ? "bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800/60 text-blue-600 dark:text-blue-400"
                      : "bg-indigo-50 dark:bg-indigo-950/80 border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400"
                  }`}
                >
                  {isDocType ? (
                    <FileType className="w-5 h-5" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                      {candidateName ? `${candidateName}'s Resume` : "Candidate Document Window"}
                    </h2>
                    {isDocType ? (
                      <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
                        Word Document (.docx)
                      </span>
                    ) : (
                      <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 rounded border border-rose-200 dark:border-rose-800">
                        PDF Document
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
                    <span className="truncate font-medium">{displayFileName}</span>
                    {jobTitle && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span className="truncate text-indigo-600 dark:text-indigo-400 font-medium">
                          {jobTitle}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Window Controls & Actions */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                {/* View Mode Switcher for PDF */}
                {doc?.isPdf && (
                  <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setViewMode("canvas")}
                      className={`px-2 py-1 text-xs font-semibold rounded-md transition ${
                        viewMode === "canvas"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                      title="Render high-fidelity canvas view"
                    >
                      Canvas
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("native")}
                      className={`px-2 py-1 text-xs font-semibold rounded-md transition ${
                        viewMode === "native"
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                      title="Native browser PDF viewer"
                    >
                      Browser
                    </button>
                    {cloudViewerUrl && (
                      <button
                        type="button"
                        onClick={() => setViewMode("cloud")}
                        className={`px-2 py-1 text-xs font-semibold rounded-md transition ${
                          viewMode === "cloud"
                            ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                        title="Google Drive / Cloud Viewer"
                      >
                        Cloud
                      </button>
                    )}
                  </div>
                )}

                {/* View Mode Switcher for DOCX */}
                {isDocType && (
                  <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setViewMode("docx")}
                      className={`px-2 py-1 text-xs font-semibold rounded-md transition ${
                        viewMode === "docx"
                          ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                      title="Render Word document pages directly"
                    >
                      Document View
                    </button>
                    {cloudViewerUrl && (
                      <button
                        type="button"
                        onClick={() => setViewMode("cloud")}
                        className={`px-2 py-1 text-xs font-semibold rounded-md transition ${
                          viewMode === "cloud"
                            ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                        title="View with Google Docs Cloud Viewer"
                      >
                        Google Docs View
                      </button>
                    )}
                  </div>
                )}

                {/* Open in New Window */}
                <button
                  type="button"
                  onClick={() => openResumeInNewWindow(doc?.blobUrl || resumeUrl, displayFileName)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 text-xs font-semibold inline-flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                  title="Open document in a new browser window/tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Open in Tab</span>
                </button>

                {/* Download */}
                <button
                  type="button"
                  onClick={() => downloadResumeFile(doc?.blobUrl || resumeUrl, displayFileName)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700 text-xs font-semibold inline-flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                  title="Download document file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Download</span>
                </button>

                {/* Theme Toggle Button */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 transition active:scale-95 shadow-sm"
                  title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? (
                    <Sun className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-slate-600" />
                  )}
                </button>

                {/* Maximize / Restore */}
                <button
                  type="button"
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-750 transition"
                  title={isMaximized ? "Restore window size" : "Maximize window"}
                >
                  {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                {/* Close */}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  title="Close resume window (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Controls Sub-Bar (Zoom, Rotate, Status) */}
            {((doc?.isPdf && viewMode === "canvas") || (isDocType && viewMode === "docx")) && (
              <div className="flex items-center justify-between px-4 sm:px-6 py-2 bg-slate-100 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 select-none flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomReset}
                    className="px-2 py-1 text-[11px] rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium transition"
                  >
                    Reset
                  </button>

                  {doc?.isPdf && (
                    <>
                      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
                      <button
                        type="button"
                        onClick={handleRotate}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                        title="Rotate 90 degrees"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {pdfDoc && (
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {pdfDoc.numPages} {pdfDoc.numPages === 1 ? "Page" : "Pages"}
                  </div>
                )}
                {isDocType && (
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Word (.docx) Document
                  </div>
                )}
              </div>
            )}

            {/* Window Body: Preview Area */}
            <div className="relative flex-1 w-full bg-slate-100 dark:bg-slate-950 overflow-hidden flex flex-col">
              {!resumeUrl ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    No Document Available
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                    No resume document was linked or uploaded with this profile or application.
                  </p>
                </div>
              ) : isFetching ? (
                /* Document Fetching / Loading Screen */
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center border border-indigo-100 dark:border-indigo-900 shadow-inner">
                      <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Loading Document...
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                      Preparing document preview for {displayFileName}...
                    </p>
                  </div>
                </div>
              ) : fetchError && !cloudViewerUrl ? (
                /* Error Screen with Retry and Fallback */
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center shadow-sm">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      Could Not Preview Document
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {fetchError}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={loadDocument}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition shadow-sm active:scale-95"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Fetch</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openResumeInNewWindow(resumeUrl, displayFileName)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-indigo-600 text-xs font-semibold inline-flex items-center gap-1.5 transition active:scale-95"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Link Directly</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Active View Modes */
                <>
                  {/* Mode 1: Cloud / Google Docs & Drive Viewer */}
                  {viewMode === "cloud" && cloudViewerUrl ? (
                    <div className="flex-1 w-full h-full bg-white relative">
                      <iframe
                        src={cloudViewerUrl}
                        title="Document Cloud Preview"
                        className="w-full h-full border-0 bg-white"
                        allow="autoplay"
                      />
                    </div>
                  ) : viewMode === "docx" && doc?.arrayBuffer && doc.arrayBuffer.byteLength > 0 ? (
                    /* Mode 2: Client-Side DOCX Word Document Viewer */
                    <DocxViewer
                      arrayBuffer={doc.arrayBuffer}
                      scale={scale}
                      onError={() => {
                        if (cloudViewerUrl) {
                          setViewMode("cloud");
                        }
                      }}
                    />
                  ) : doc?.isImage && doc.blobUrl ? (
                    /* Mode 3: Image Render */
                    <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-900/5 dark:bg-slate-950">
                      <img
                        src={doc.blobUrl}
                        alt="Resume Document"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-xl border border-slate-200 dark:border-slate-800"
                      />
                    </div>
                  ) : doc?.isPdf ? (
                    /* Mode 4: PDF Render */
                    viewMode === "canvas" && pdfDoc ? (
                      /* Mode 4A: PDF.js Canvas Mode */
                      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 flex flex-col items-center bg-slate-200/60 dark:bg-slate-950">
                        {Array.from({ length: pdfDoc.numPages }, (_, i) => (
                          <SinglePageCanvas
                            key={i + 1}
                            pdfDoc={pdfDoc}
                            pageNum={i + 1}
                            scale={scale}
                            rotation={rotation}
                          />
                        ))}
                      </div>
                    ) : (viewMode === "native" || !pdfDoc) && doc.blobUrl ? (
                      /* Mode 4B: Native Browser PDF Viewer with Object / Embed */
                      <div className="flex-1 w-full h-full bg-white relative">
                        <object
                          data={doc.blobUrl}
                          type="application/pdf"
                          className="w-full h-full border-0 bg-white"
                        >
                          <embed
                            src={doc.blobUrl}
                            type="application/pdf"
                            className="w-full h-full border-0 bg-white"
                          />
                          <iframe
                            src={doc.blobUrl}
                            title="Resume PDF Document"
                            className="w-full h-full border-0 bg-white"
                          />
                        </object>
                      </div>
                    ) : cloudViewerUrl ? (
                      /* Mode 4C: Cloud Viewer Fallback */
                      <div className="flex-1 w-full h-full bg-white">
                        <iframe
                          src={cloudViewerUrl}
                          title="Cloud PDF Document"
                          className="w-full h-full border-0 bg-white"
                          allow="autoplay"
                        />
                      </div>
                    ) : doc.blobUrl ? (
                      <div className="flex-1 w-full h-full bg-white relative">
                        <object
                          data={doc.blobUrl}
                          type="application/pdf"
                          className="w-full h-full border-0 bg-white"
                        >
                          <embed
                            src={doc.blobUrl}
                            type="application/pdf"
                            className="w-full h-full border-0 bg-white"
                          />
                        </object>
                      </div>
                    ) : null
                  ) : cloudViewerUrl ? (
                    /* General Fallback: Cloud Viewer */
                    <div className="flex-1 w-full h-full bg-white">
                      <iframe
                        src={cloudViewerUrl}
                        title="Document Cloud Preview"
                        className="w-full h-full border-0 bg-white"
                        allow="autoplay"
                      />
                    </div>
                  ) : (
                    /* Final Fallback: Download prompt */
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                      <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                          Document Ready
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                          {displayFileName} ({doc?.contentType || "Binary Document"}) is available for viewing and download.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadResumeFile(doc?.blobUrl || resumeUrl, displayFileName)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs inline-flex items-center gap-2 transition shadow-md active:scale-95"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download {displayFileName}</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Window Footer Bar */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 text-[11px] text-slate-600 dark:text-slate-300 flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 font-medium">
                  <Eye className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Resume Document Window</span>
                </span>
                {candidateEmail && (
                  <span className="hidden sm:inline text-slate-400">
                    Contact: {candidateEmail}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openResumeInNewWindow(doc?.blobUrl || resumeUrl, displayFileName)}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium inline-flex items-center gap-1 transition"
                >
                  <span>Open in external tab</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
