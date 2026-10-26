import { NextRequest, NextResponse } from "next/server";
import { extractDriveFileId } from "@/lib/googleDriveService";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * Detect whether a PDF buffer has broken/severed structures (e.g. truncated mid-stream by older slicer)
 */
function isDamagedPdf(buffer: Uint8Array): boolean {
  if (!buffer || buffer.length < 16) return true;
  // If not PDF (%PDF-), don't flag as damaged PDF
  if (
    buffer[0] !== 0x25 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x44 ||
    buffer[3] !== 0x46
  ) {
    return false;
  }

  // A complete PDF must contain object/catalog indicators
  // Sample up to 64KB from start and end
  const startChunk = Buffer.from(buffer.slice(0, Math.min(buffer.length, 32768))).toString("latin1");
  const endChunk = Buffer.from(buffer.slice(Math.max(0, buffer.length - 32768))).toString("latin1");
  const combined = startChunk + endChunk;

  const hasCatalogOrRoot = combined.includes("/Catalog") || combined.includes("/Root") || combined.includes("/Pages");
  const hasTrailerOrXref = combined.includes("trailer") || combined.includes("startxref") || combined.includes("xref");

  // If both catalog and xref/trailer are completely absent, the file was truncated/severed
  if (!hasCatalogOrRoot && !hasTrailerOrXref) {
    return true;
  }

  return false;
}

/**
 * Search local public repository for intact cached resumes
 */
function getLocalResumeBuffer(
  fileName?: string | null,
  driveId?: string | null
): { buffer: Uint8Array; contentType: string } | null {
  try {
    const searchNames: string[] = [];
    if (fileName) {
      searchNames.push(fileName);
      searchNames.push(path.basename(fileName));
    }
    if (driveId === "1r6wywu0WL5R1fMHwdRcscWzpc4IPv1S5") {
      searchNames.push("Gaurion_Project.pdf");
    }

    const publicDir = path.join(process.cwd(), "public");
    const resumeDirs = [
      path.join(publicDir, "resumes"),
      publicDir,
    ];

    for (const name of searchNames) {
      for (const dir of resumeDirs) {
        const filePath = path.join(dir, name);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          if (stats.size > 0) {
            const buf = fs.readFileSync(filePath);
            const u8 = new Uint8Array(buf);
            const cType = detectMimeType(u8, null, name);
            return { buffer: u8, contentType: cType };
          }
        }
      }
    }
  } catch (err) {
    console.warn("[file-proxy] getLocalResumeBuffer error:", err);
  }
  return null;
}

/**
 * Detect MIME type using magic bytes and filename extension to guarantee accurate content rendering
 */
function detectMimeType(
  buffer: Uint8Array,
  headerType?: string | null,
  fileName?: string | null
): string {
  const ext = fileName ? fileName.toLowerCase().split(".").pop() : "";

  if (buffer && buffer.length >= 4) {
    // %PDF-
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return "application/pdf";
    }
    // PNG \x89PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return "image/png";
    }
    // JPEG \xFF\xD8\xFF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return "image/jpeg";
    }
    // GIF GIF8
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return "image/gif";
    }
    // WEBP RIFF...WEBP
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      return "image/webp";
    }
    // DOCX / XLSX / ZIP (PK\x03\x04)
    if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
      if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    // Legacy DOC (0xD0 0xCF 0x11 0xE0)
    if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
      return "application/msword";
    }
  }

  // Filename extensions
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "doc") return "application/msword";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "txt") return "text/plain";

  if (headerType && headerType !== "application/octet-stream" && !headerType.includes("text/html")) {
    return headerType;
  }

  return "application/octet-stream";
}

async function fetchGoogleDriveBuffer(
  driveId: string,
  clientToken?: string | null,
  fileName?: string | null
): Promise<{ buffer: Uint8Array; contentType: string } | null> {
  const browserHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "*/*",
  };

  const isDocxRequested = fileName?.toLowerCase().endsWith(".docx") || fileName?.toLowerCase().endsWith(".doc");

  // Strategy 1: OAuth token via Google Drive API
  if (clientToken) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveId)}?alt=media`,
        {
          headers: {
            Authorization: clientToken.startsWith("Bearer ")
              ? clientToken
              : `Bearer ${clientToken}`,
          },
        }
      );
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buf = new Uint8Array(arrayBuf);
        const cType = detectMimeType(buf, res.headers.get("content-type"), fileName);
        return { buffer: buf, contentType: cType };
      }
    } catch (err) {
      console.warn("[file-proxy] Drive API token fetch failed:", err);
    }
  }

  // Strategy 2: If file is a Google Doc or Word document, try docs.google.com/export
  if (isDocxRequested) {
    try {
      const exportUrl = `https://docs.google.com/document/d/${encodeURIComponent(driveId)}/export?format=docx`;
      const res = await fetch(exportUrl, { headers: browserHeaders, redirect: "follow" });
      const cType = res.headers.get("content-type") || "";
      if (res.ok && !cType.includes("text/html")) {
        const arrayBuf = await res.arrayBuffer();
        const buf = new Uint8Array(arrayBuf);
        return {
          buffer: buf,
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        };
      }
    } catch (err) {
      console.warn("[file-proxy] docx export attempt failed:", err);
    }
  }

  // Strategy 3: Direct usercontent download
  const userContentUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(
    driveId
  )}&export=download&confirm=t`;
  try {
    const res = await fetch(userContentUrl, {
      redirect: "follow",
      headers: browserHeaders,
    });
    const cType = res.headers.get("content-type") || "";
    if (res.ok && !cType.includes("text/html")) {
      const arrayBuf = await res.arrayBuffer();
      const buf = new Uint8Array(arrayBuf);
      const detected = detectMimeType(buf, cType, fileName);
      return { buffer: buf, contentType: detected };
    }
  } catch (err) {
    console.warn("[file-proxy] usercontent download attempt failed:", err);
  }

  // Strategy 4: Google Drive uc export with cookie and redirect tracking
  try {
    const ucUrl = `https://drive.google.com/uc?id=${encodeURIComponent(
      driveId
    )}&export=download&confirm=t`;
    const res1 = await fetch(ucUrl, {
      redirect: "manual",
      headers: browserHeaders,
    });

    const setCookies = res1.headers.getSetCookie
      ? res1.headers.getSetCookie()
      : [res1.headers.get("set-cookie")].filter(Boolean);
    const cookieHeader = setCookies.map((c) => (c ? c.split(";")[0] : "")).filter(Boolean).join("; ");

    if (res1.status >= 300 && res1.status < 400) {
      const location = res1.headers.get("location");
      if (location) {
        const res2 = await fetch(location, {
          headers: {
            ...browserHeaders,
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
        });
        const cType2 = res2.headers.get("content-type") || "";
        if (res2.ok && !cType2.includes("text/html")) {
          const arrayBuf = await res2.arrayBuffer();
          const buf = new Uint8Array(arrayBuf);
          const detected = detectMimeType(buf, cType2, fileName);
          return { buffer: buf, contentType: detected };
        }
      }
    } else if (res1.ok) {
      const cType1 = res1.headers.get("content-type") || "";
      if (!cType1.includes("text/html")) {
        const arrayBuf = await res1.arrayBuffer();
        const buf = new Uint8Array(arrayBuf);
        const detected = detectMimeType(buf, cType1, fileName);
        return { buffer: buf, contentType: detected };
      }
    }
  } catch (err) {
    console.warn("[file-proxy] uc download attempt failed:", err);
  }

  // Strategy 5: Try docs.google.com document export (docx or pdf fallback)
  try {
    const format = isDocxRequested ? "docx" : "pdf";
    const exportUrl = `https://docs.google.com/document/d/${encodeURIComponent(driveId)}/export?format=${format}`;
    const res = await fetch(exportUrl, { headers: browserHeaders, redirect: "follow" });
    const cType = res.headers.get("content-type") || "";
    if (res.ok && !cType.includes("text/html")) {
      const arrayBuf = await res.arrayBuffer();
      const buf = new Uint8Array(arrayBuf);
      const detected = detectMimeType(buf, cType, fileName);
      return { buffer: buf, contentType: detected };
    }
  } catch (err) {
    console.warn("[file-proxy] docs export attempt failed:", err);
  }

  // Strategy 6: docs.google.com uc export
  try {
    const docsUrl = `https://docs.google.com/uc?export=download&id=${encodeURIComponent(
      driveId
    )}&confirm=t`;
    const res = await fetch(docsUrl, {
      redirect: "follow",
      headers: browserHeaders,
    });
    const cType = res.headers.get("content-type") || "";
    if (res.ok && !cType.includes("text/html")) {
      const arrayBuf = await res.arrayBuffer();
      const buf = new Uint8Array(arrayBuf);
      return { buffer: buf, contentType: detectMimeType(buf, cType, fileName) };
    }
  } catch (err) {
    console.warn("[file-proxy] docs.google.com download attempt failed:", err);
  }

  // Strategy 7: API Key if available in server environment
  const apiKey =
    process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          driveId
        )}?alt=media&key=${apiKey}`
      );
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buf = new Uint8Array(arrayBuf);
        return {
          buffer: buf,
          contentType: detectMimeType(buf, res.headers.get("content-type"), fileName),
        };
      }
    } catch (err) {
      console.warn("[file-proxy] Drive API key fetch failed:", err);
    }
  }

  // Strategy 8: Check local repository fallback
  const localBackup = getLocalResumeBuffer(fileName, driveId);
  if (localBackup) {
    return localBackup;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get("url");
    const rawDriveId = searchParams.get("driveId");
    const fileName = searchParams.get("fileName") || "resume.pdf";
    const authHeader = request.headers.get("authorization");

    let driveId: string | undefined = rawDriveId || undefined;
    if (!driveId && rawUrl) {
      driveId = extractDriveFileId(rawUrl);
    }

    // Handle Google Drive target
    if (driveId) {
      let driveResult = await fetchGoogleDriveBuffer(driveId, authHeader, fileName);

      // If the buffer returned is corrupted (e.g. truncated mid-stream by older slicer), check local repository
      if (driveResult && isDamagedPdf(driveResult.buffer)) {
        console.warn(`[file-proxy] Drive file ${driveId} has damaged PDF structure, attempting local recovery...`);
        const localCandidate = getLocalResumeBuffer(fileName, driveId);
        if (localCandidate) {
          driveResult = localCandidate;
        }
      } else if (!driveResult) {
        const localCandidate = getLocalResumeBuffer(fileName, driveId);
        if (localCandidate) {
          driveResult = localCandidate;
        }
      }

      if (driveResult) {
        const responseHeaders = new Headers();
        responseHeaders.set("Content-Type", driveResult.contentType);
        responseHeaders.set(
          "Content-Disposition",
          `inline; filename="${encodeURIComponent(fileName)}"`
        );
        responseHeaders.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
        responseHeaders.set("Access-Control-Allow-Origin", "*");

        return new NextResponse(driveResult.buffer.buffer as ArrayBuffer, {
          status: 200,
          headers: responseHeaders,
        });
      }

      return NextResponse.json(
        {
          error:
            "Could not fetch Google Drive file. File may be private or deleted. Ensure it is shared as 'Anyone with the link can view'.",
        },
        { status: 404 }
      );
    }

    // Handle relative / local path in public folder
    if (rawUrl && !rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
      const cleanPath = rawUrl.startsWith("/") ? rawUrl.slice(1) : rawUrl;
      const localPath = path.join(process.cwd(), "public", cleanPath);
      if (fs.existsSync(localPath)) {
        const buf = fs.readFileSync(localPath);
        const u8 = new Uint8Array(buf);
        const cType = detectMimeType(u8, null, fileName || path.basename(localPath));

        const responseHeaders = new Headers();
        responseHeaders.set("Content-Type", cType);
        responseHeaders.set(
          "Content-Disposition",
          `inline; filename="${encodeURIComponent(fileName || path.basename(localPath))}"`
        );
        responseHeaders.set("Cache-Control", "public, max-age=3600");
        responseHeaders.set("Access-Control-Allow-Origin", "*");

        return new NextResponse(u8.buffer as ArrayBuffer, {
          status: 200,
          headers: responseHeaders,
        });
      }
    }

    // Handle external URL target
    if (rawUrl) {
      if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
        return NextResponse.json(
          { error: "Invalid URL protocol. Only HTTP and HTTPS are supported." },
          { status: 400 }
        );
      }

      const externalRes = await fetch(rawUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
      });

      if (!externalRes.ok) {
        return NextResponse.json(
          { error: `Remote server returned ${externalRes.status}` },
          { status: externalRes.status }
        );
      }

      const arrayBuf = await externalRes.arrayBuffer();
      const buf = new Uint8Array(arrayBuf);
      const cType = detectMimeType(buf, externalRes.headers.get("content-type"), fileName);

      const responseHeaders = new Headers();
      responseHeaders.set("Content-Type", cType);
      responseHeaders.set(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(fileName)}"`
      );
      responseHeaders.set("Cache-Control", "public, max-age=3600");
      responseHeaders.set("Access-Control-Allow-Origin", "*");

      return new NextResponse(buf.buffer as ArrayBuffer, {
        status: 200,
        headers: responseHeaders,
      });
    }

    return NextResponse.json(
      { error: "Missing required parameter: url or driveId" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[file-proxy] error handling request:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error fetching file" },
      { status: 500 }
    );
  }
}
