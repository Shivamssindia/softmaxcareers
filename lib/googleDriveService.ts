import { updateUserInFirestore } from "@/lib/firestore";

// ============================================================
// DEBUG CONFIG
// ============================================================
const DEBUG =
  typeof process !== "undefined" &&
  process.env?.NEXT_PUBLIC_GDRIVE_DEBUG === "true";

const T0 = () => {
  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  return now;
};
const baseTime = T0();

function log(...args: any[]) {
  if (!DEBUG) return;
  const ms = (T0() - baseTime).toFixed(0).padStart(6, " ");
  console.log(`%c[GDrive +${ms}ms]`, "color:#4f46e5;font-weight:bold", ...args);
}

function logWarn(...args: any[]) {
  if (!DEBUG) return;
  const ms = (T0() - baseTime).toFixed(0).padStart(6, " ");
  console.warn(
    `%c[GDrive +${ms}ms]`,
    "color:#f59e0b;font-weight:bold",
    ...args
  );
}

function logError(...args: any[]) {
  const ms = (T0() - baseTime).toFixed(0).padStart(6, " ");
  console.error(
    `%c[GDrive +${ms}ms]`,
    "color:#ef4444;font-weight:bold",
    ...args
  );
}

function logGroup(label: string) {
  if (!DEBUG || typeof console.groupCollapsed !== "function") return;
  console.groupCollapsed(`%c[GDrive] ${label}`, "color:#4f46e5");
}
function logGroupEnd() {
  if (!DEBUG || typeof console.groupEnd !== "function") return;
  console.groupEnd();
}

// ============================================================
// TYPES
// ============================================================
export interface ResumeUploadResult {
  fileId: string;
  fileName: string;
  resumeUrl: string;
  url: string;
  downloadUrl: string;
  fileSizeFormatted: string;
  source: "google_drive";
}

export interface ResumeDeleteResult {
  deleted: boolean;
  alreadyGone: boolean;
}

const DEFAULT_CLIENT_ID =
  "852556453308-mtlkkpjhikdtf2cpdg96ehulnc62bqe0.apps.googleusercontent.com";

export function getGoogleClientId(): string {
  if (typeof process !== "undefined" && process.env) {
    if (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)
      return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  }
  return DEFAULT_CLIENT_ID;
}

// ============================================================
// TOKEN CACHE
// ============================================================
let tokenCache: { accessToken: string; expiresAt: number } | null = null;

export async function waitForGoogleOAuth(timeoutMs = 8000): Promise<any> {
  if (typeof window === "undefined") return null;

  if ((window as any).google?.accounts?.oauth2) {
    log("✓ GIS already loaded");
    return (window as any).google.accounts.oauth2;
  }

  log("GIS not loaded — injecting <script>");
  let script = document.getElementById(
    "google-identity-services"
  ) as HTMLScriptElement | null;

  if (!script) {
    script = document.createElement("script");
    script.id = "google-identity-services";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => log("✓ GIS script onload");
    script.onerror = (e) => logError("✗ GIS script failed to load", e);
    document.head.appendChild(script);
  } else {
    log("GIS script tag already present");
  }

  const start = Date.now();
  let pollCount = 0;
  while (Date.now() - start < timeoutMs) {
    if ((window as any).google?.accounts?.oauth2) {
      log(`✓ GIS ready after ${pollCount} polls`);
      return (window as any).google.accounts.oauth2;
    }
    pollCount++;
    if (pollCount % 10 === 0) log(`polling for GIS… (${pollCount})`);
    await new Promise((r) => setTimeout(r, 80));
  }

  logError("✗ GIS timed out after", timeoutMs, "ms");
  return (window as any).google?.accounts?.oauth2 || null;
}

export async function getGoogleDriveAccessToken(): Promise<string> {
  logGroup("getGoogleDriveAccessToken");
  try {
    // 1. Memory cache
    if (tokenCache && Date.now() < tokenCache.expiresAt) {
      log("✓ using in-memory cached token");
      return tokenCache.accessToken;
    }
    log("memory cache miss / expired");

    // 2. sessionStorage cache
    if (typeof window !== "undefined") {
      try {
        const t = sessionStorage.getItem("gdrive_access_token");
        const exp = sessionStorage.getItem("gdrive_token_expires_at");
        if (t && exp && Date.now() < Number(exp)) {
          log(
            "✓ using sessionStorage cached token (expires in",
            Math.round((Number(exp) - Date.now()) / 1000),
            "s)"
          );
          tokenCache = { accessToken: t, expiresAt: Number(exp) };
          return t;
        }
        log("sessionStorage cache miss");
      } catch (e) {
        logWarn("sessionStorage access blocked:", e);
      }
    }

    if (typeof window === "undefined") {
      throw new Error(
        "Google Drive token can only be obtained in the browser."
      );
    }

    // 3. Load GIS
    const oauth2 = await waitForGoogleOAuth(8000);
    if (!oauth2) {
      throw new Error(
        "Google authorization service failed to load. Check internet connection and refresh."
      );
    }

    const clientId = getGoogleClientId();
    log("OAuth client_id:", clientId);
    log("origin:", window.location.origin);

    // 4. Init token client
    return await new Promise<string>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        logError("✗ token request timed out after 120s (popup never resolved)");
        reject(
          new Error(
            "Google sign-in timed out. A popup may have been blocked or closed. " +
              "Check browser popup blocker and try again."
          )
        );
      }, 120000);

      const finish = (fn: () => void) => {
        if (settled) {
          logWarn("callback fired again — ignored");
          return;
        }
        settled = true;
        clearTimeout(timeout);
        fn();
      };

      try {
        log("initializing token client…");
        const client = oauth2.initTokenClient({
          client_id: clientId,
          scope: "https://www.googleapis.com/auth/drive.file",
          callback: (response: any) => {
            log("callback fired:", {
              hasToken: !!response?.access_token,
              error: response?.error,
              error_desc: response?.error_description,
              expires_in: response?.expires_in,
              scope: response?.scope,
              tokenPreview: response?.access_token?.slice(0, 20),
            });
            finish(() => {
              if (response.error) {
                reject(
                  new Error(
                    `Google auth error: ${response.error} — ${
                      response.error_description || "(no description)"
                    }`
                  )
                );
                return;
              }
              if (!response.access_token) {
                reject(new Error("Google auth returned no access_token."));
                return;
              }
              const expiresIn = Number(response.expires_in) || 3600;
              const expiresAt = Date.now() + (expiresIn - 60) * 1000;
              tokenCache = {
                accessToken: response.access_token,
                expiresAt,
              };
              try {
                sessionStorage.setItem(
                  "gdrive_access_token",
                  response.access_token
                );
                sessionStorage.setItem(
                  "gdrive_token_expires_at",
                  String(expiresAt)
                );
              } catch (e) {
                logWarn("could not save token to sessionStorage:", e);
              }
              log(`✓ token received (expires in ${expiresIn}s)`);
              resolve(response.access_token);
            });
          },
          error_callback: (err: any) => {
            logError("error_callback fired:", err);
            finish(() => {
              reject(
                new Error(
                  err?.message ||
                    `Google auth popup failed (${err?.type || "unknown"}). ` +
                      "Check popup blocker, COOP header, and OAuth origin config."
                )
              );
            });
          },
        });

        log("calling requestAccessToken()…");
        client.requestAccessToken();
        log("requestAccessToken() returned (popup may be open)");
      } catch (err: any) {
        logError("exception while initializing token client:", err);
        finish(() =>
          reject(new Error(err?.message || "Failed to init Google auth."))
        );
      }
    });
  } finally {
    logGroupEnd();
  }
}

function clearTokenCache() {
  tokenCache = null;
  try {
    sessionStorage.removeItem("gdrive_access_token");
    sessionStorage.removeItem("gdrive_token_expires_at");
  } catch {}
}

// ============================================================
// UPLOAD
// ============================================================
export async function uploadResumeToGoogleDrive(
  fileOrParams:
    | File
    | Blob
    | {
        file?: File | Blob;
        buffer?: any;
        fileName?: string;
        mimeType?: string;
        uid?: string;
      },
  optionalUid?: string
): Promise<ResumeUploadResult> {
  logGroup("uploadResumeToGoogleDrive");
  try {
    // 1. Normalize input
    log(
      "input type:",
      fileOrParams?.constructor?.name,
      "| optionalUid:",
      optionalUid
    );
    let fileBlob: Blob;
    let fileName = "resume.pdf";
    let mimeType = "application/pdf";
    let uid = optionalUid;
    let sizeBytes = 0;

    if (typeof Blob !== "undefined" && fileOrParams instanceof Blob) {
      fileBlob = fileOrParams;
      sizeBytes = fileOrParams.size;
      if (
        "name" in fileOrParams &&
        typeof (fileOrParams as any).name === "string"
      )
        fileName = (fileOrParams as any).name;
      if (fileOrParams.type) mimeType = fileOrParams.type;
    } else if (typeof fileOrParams === "object" && fileOrParams !== null) {
      const p = fileOrParams as any;
      if (p.file instanceof Blob) {
        fileBlob = p.file;
        sizeBytes = p.file.size;
        fileName =
          p.fileName ||
          (p.file as any).name ||
          "resume.pdf";
        mimeType =
          p.mimeType || p.file.type || "application/pdf";
      } else if (p.buffer) {
        fileBlob = new Blob([p.buffer], {
          type: p.mimeType || "application/pdf",
        });
        sizeBytes = fileBlob.size;
        fileName = p.fileName || "resume.pdf";
        mimeType = p.mimeType || "application/pdf";
      } else {
        throw new Error("Invalid file passed to Google Drive upload.");
      }
      if (p.uid) uid = p.uid;
    } else {
      throw new Error("No file provided.");
    }

    log("normalized:", { fileName, mimeType, sizeBytes, uid });
    const safeFileBlob = new Blob([fileBlob], { type: mimeType });
    log("safeFileBlob size:", safeFileBlob.size);

    // Safety guard: after utilization, this should be well under 1MB
    if (safeFileBlob.size > 5 * 1024 * 1024) {
      throw new Error(
        `Upload payload too large (${(safeFileBlob.size / 1024 / 1024).toFixed(
          1
        )}MB). Resume should have been compressed before upload.`
      );
    }

    // 2. Token
    const accessToken = await getGoogleDriveAccessToken();
    log("✓ token:", accessToken.slice(0, 20) + "...");

    // 3. Build multipart
    const boundary = "-------softmaxDriveBoundary" + Date.now();
    const metadata = { name: fileName, mimeType };
    log("boundary:", boundary);
    log("metadata:", metadata);

    const part1 =
      "--" +
      boundary +
      "\r\n" +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      "\r\n";
    const part2Header =
      "--" + boundary + "\r\n" + "Content-Type: " + mimeType + "\r\n\r\n";
    const closing = "\r\n--" + boundary + "--";

    const multipartBody = new Blob(
      [part1, part2Header, safeFileBlob, closing],
      { type: "multipart/related; boundary=" + boundary }
    );
    log("multipartBody size:", multipartBody.size);

    // 4. Upload
    const uploadUrl =
      "https://www.googleapis.com/upload/drive/v3/files" +
      "?uploadType=multipart&fields=id,name,webViewLink,webContentLink,size";
    log("POST", uploadUrl);

    const tUpload = T0();
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "multipart/related; boundary=" + boundary,
      },
      body: multipartBody,
    });
    log(
      `upload fetch returned in ${(T0() - tUpload).toFixed(0)}ms — status`,
      uploadRes.status,
      uploadRes.statusText
    );

    const rawText = await uploadRes.text();
    log("raw response body:", rawText);

    if (!uploadRes.ok) {
      logError("✗ upload failed", uploadRes.status);
      if (uploadRes.status === 401) {
        clearTokenCache();
        throw new Error(
          "Google authorization expired. Re-upload to re-authorize."
        );
      }
      if (uploadRes.status === 403) {
        let parsed: any = {};
        try {
          parsed = JSON.parse(rawText);
        } catch {}
        const reason =
          parsed?.error?.errors?.[0]?.reason ||
          parsed?.error?.status ||
          "unknown";
        throw new Error(
          `Google Drive returned 403 (${reason}). ` +
            `Most common causes: (1) Drive API not enabled in Google Cloud Console, ` +
            `(2) OAuth app not verified for this origin, ` +
            `(3) drive.file scope not granted. ` +
            `Full response: ${rawText}`
        );
      }
      if (uploadRes.status === 400) {
        throw new Error(
          `Google Drive returned 400 — multipart body malformed or missing fields. ` +
            `Full response: ${rawText}`
        );
      }
      throw new Error(
        `Google Drive upload failed (${uploadRes.status}): ${rawText}`
      );
    }

    let fileData: any;
    try {
      fileData = JSON.parse(rawText);
    } catch (e) {
      logError("response is not JSON:", e);
      throw new Error("Google Drive returned non-JSON: " + rawText);
    }

    log("parsed fileData:", fileData);
    const fileId = fileData.id;
    if (!fileId) {
      throw new Error("Google Drive returned no file ID: " + rawText);
    }
    log("✓ uploaded fileId:", fileId);

    // 5. Make public
    log("POST permission request…");
    try {
      const tPerm = T0();
      const permRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "reader", type: "anyone" }),
        }
      );
      const permText = await permRes.text();
      log(
        `permission returned in ${(T0() - tPerm).toFixed(0)}ms — status`,
        permRes.status,
        permText
      );
      if (!permRes.ok) {
        logWarn("✗ could not set public permission");
      } else {
        log("✓ file is now publicly readable");
      }
    } catch (e: any) {
      logWarn("permission request threw:", e?.message);
    }

    // 6. URLs
    const resumeUrl =
      fileData.webViewLink ||
      `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
    const downloadUrl =
      fileData.webContentLink ||
      `https://drive.google.com/uc?id=${fileId}&export=download`;
    log("resumeUrl:", resumeUrl);
    log("downloadUrl:", downloadUrl);

    // 7. Firestore
    if (uid) {
      log("updating Firestore user", uid);
      try {
        await updateUserInFirestore(uid, {
          resumeUrl,
          resumeFileId: fileId,
          resumeFileName: fileName,
        } as any);
        log("✓ Firestore updated");
      } catch (e: any) {
        logWarn("✗ Firestore sync failed:", e?.message);
      }
    }

    const result: ResumeUploadResult = {
      fileId,
      fileName,
      resumeUrl,
      url: resumeUrl,
      downloadUrl,
      fileSizeFormatted: `${(sizeBytes / 1024).toFixed(1)} KB`,
      source: "google_drive",
    };
    log("✓ done:", result);
    return result;
  } catch (err: any) {
    logError("✗ uploadResumeToGoogleDrive threw:", err?.message || err);
    throw err;
  } finally {
    logGroupEnd();
  }
}

// ============================================================
// DELETE
// ============================================================
export async function deleteResumeFromGoogleDrive(
  fileId: string
): Promise<ResumeDeleteResult> {
  logGroup("deleteResumeFromGoogleDrive");
  try {
    if (!fileId) {
      logWarn("no fileId provided — skipping Drive deletion");
      return { deleted: false, alreadyGone: true };
    }

    const accessToken = await getGoogleDriveAccessToken();
    log("✓ token:", accessToken.slice(0, 20) + "...");

    const deleteUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}`;
    log("DELETE", deleteUrl);

    const res = await fetch(deleteUrl, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + accessToken },
    });

    log("delete response status:", res.status);

    // 204 = success, 404 = already gone (idempotent — treat as success)
    if (res.status === 204 || res.ok) {
      log("✓ file deleted from Drive");
      return { deleted: true, alreadyGone: false };
    }

    if (res.status === 404) {
      log("file already gone from Drive (404) — treating as success");
      return { deleted: false, alreadyGone: true };
    }

    if (res.status === 401) {
      clearTokenCache();
      throw new Error(
        "Google authorization expired. Re-authenticate to delete the file."
      );
    }

    const rawText = await res.text();
    logError("✗ delete failed:", res.status, rawText);
    throw new Error(
      `Google Drive delete failed (${res.status}): ${rawText}`
    );
  } finally {
    logGroupEnd();
  }
}

// ============================================================
// HELPERS
// ============================================================
/**
 * Extract the Google Drive file ID from a Drive sharing URL.
 * Handles: /file/d/{ID}/view, /file/d/{ID}/edit, open?id={ID}, uc?id={ID}
 */
export function extractDriveFileId(url?: string | null): string | undefined {
  if (!url) return undefined;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return undefined;
}

// ============================================================
// PREFLIGHT DEBUG
// ============================================================
export async function debugGDriveSetup(): Promise<{
  ok: boolean;
  clientId: string;
  origin: string;
  gisLoaded: boolean;
  tokenObtained: boolean;
  driveReachable: boolean;
  errors: string[];
}> {
  logGroup("debugGDriveSetup");
  const errors: string[] = [];
  let gisLoaded = false;
  let tokenObtained = false;
  let driveReachable = false;
  const clientId = getGoogleClientId();
  const origin =
    typeof window !== "undefined" ? window.location.origin : "n/a";

  log("origin:", origin);
  log("client_id:", clientId);

  try {
    const oauth2 = await waitForGoogleOAuth(6000);
    gisLoaded = !!oauth2;
    log("GIS loaded:", gisLoaded);
    if (!gisLoaded) errors.push("GIS script not loaded");
  } catch (e: any) {
    errors.push("waitForGoogleOAuth: " + e?.message);
  }

  try {
    const tok = await getGoogleDriveAccessToken();
    tokenObtained = !!tok;
    log("token obtained:", tokenObtained, "length:", tok.length);

    const aboutRes = await fetch(
      "https://www.googleapis.com/drive/v3/about?fields=user,storageQuota",
      { headers: { Authorization: "Bearer " + tok } }
    );
    const aboutText = await aboutRes.text();
    log("about status:", aboutRes.status);
    log("about body:", aboutText.slice(0, 500));
    driveReachable = aboutRes.ok;
    if (!driveReachable)
      errors.push(
        `Drive API returned ${aboutRes.status}: ${aboutText.slice(0, 200)}`
      );
  } catch (e: any) {
    errors.push("token/drive: " + e?.message);
  }

  const ok = gisLoaded && tokenObtained && driveReachable;
  logGroupEnd();
  return {
    ok,
    clientId,
    origin,
    gisLoaded,
    tokenObtained,
    driveReachable,
    errors,
  };
}