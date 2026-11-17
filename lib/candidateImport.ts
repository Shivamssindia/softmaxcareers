// src/lib/candidateImport.ts
import * as XLSX from "xlsx";
import { User, UserRole } from "@/types";
import {
  saveUserToFirestore,
  createApplicationInFirestore,
  getUserByEmailFromFirestore,
  isEmailTakenInFirestore,
  claimEmailAndCandidateIdInFirestore,
} from "@/lib/firestore";
import { uploadResume } from "@/lib/resumeStorage";

export interface ImportRow {
  name: string;
  email: string;
  phone?: string;
  role?: UserRole;
  title?: string;
  location?: string;
  department?: string;
  bio?: string;
  skills?: string[];
  portfolioUrl?: string;
  resumeUrl?: string;      // ← NEW: resume link (Google Drive, etc.)
  jobId?: string;
  experienceYears?: string;
  description?: string;
}

export interface ImportResult {
  rowIndex: number;
  email: string;
  status: "created" | "updated" | "skipped" | "error";
  message: string;
  uid?: string;
  candidateId?: string;
  applicationId?: string;
  resumeUploaded?: boolean;
}

export interface BulkImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  results: ImportResult[];
}

export interface RowValidationError {
  field: string;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Security Sanitizers & File Validators                                      */
/* -------------------------------------------------------------------------- */

const DANGEROUS_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "sh", "php", "phtml", "js", "vbs", "py", "dll",
  "jar", "msi", "html", "htm", "svg", "xml", "xhtml", "scr", "com",
  "vbe", "wsf", "hta", "cpl", "reg", "apk", "bin", "wasm", "action",
]);

const ALLOWED_RESUME_EXTENSIONS = new Set(["pdf", "doc", "docx", "png", "jpg", "jpeg"]);
const ALLOWED_SPREADSHEET_EXTENSIONS = new Set(["xlsx", "xls", "csv"]);

const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_SPREADSHEET_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_RESUME_URL_SIZE_BYTES = 20 * 1024 * 1024; // URL downloads capped at 20 MB
const MAX_IMPORT_ROWS = 500;

export function sanitizeFormulaInjection(val: string): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return "'" + trimmed;
  }
  return trimmed;
}

export function sanitizeFileName(name: string): string {
  if (!name) return "unnamed_file";
  return name
    .replace(/[\/\\]/g, "_")
    .replace(/\0/g, "")
    .replace(/[^\w.\- ]/gi, "_")
    .slice(0, 120);
}

export function validateResumeFile(file: File): { valid: boolean; error?: string } {
  if (!file) return { valid: false, error: "No file selected." };
  if (file.size <= 0) return { valid: false, error: "The selected file is empty (0 bytes)." };
  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }
  const parts = file.name.split(".");
  const ext = (parts.length > 1 ? parts.pop() : "")?.toLowerCase() || "";
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Security Policy Violation: Executable or script files (.${ext}) are strictly blocked.`,
    };
  }
  if (!ALLOWED_RESUME_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Unsupported file type (.${ext}). Accepted formats: PDF, DOC, DOCX, PNG, JPG.`,
    };
  }
  return { valid: true };
}

export function validateSpreadsheetFile(file: File): { valid: boolean; error?: string } {
  if (!file) return { valid: false, error: "No file selected." };
  if (file.size <= 0) return { valid: false, error: "Spreadsheet file is empty." };
  if (file.size > MAX_SPREADSHEET_SIZE_BYTES) {
    return {
      valid: false,
      error: `Spreadsheet exceeds 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }
  const parts = file.name.split(".");
  const ext = (parts.length > 1 ? parts.pop() : "")?.toLowerCase() || "";
  if (!ALLOWED_SPREADSHEET_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Invalid spreadsheet format (.${ext}). Only .xlsx, .xls, and .csv files are permitted.`,
    };
  }
  return { valid: true };
}

/**
 * Validate that a resume URL is a safe http/https link.
 * Returns the parsed URL or null.
 */
export function validateResumeUrl(rawUrl: string): URL | null {
  if (!rawUrl || !rawUrl.trim()) return null;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Given a resume link (e.g. Google Drive share link), try to download it as a File.
 * Google Drive `?id=...` and `/d/<id>/` links are converted to direct download URLs.
 * Returns null if the download fails or the file is too large.
 */
export async function fetchResumeFromUrl(
  rawUrl: string,
  suggestedFileName?: string
): Promise<File | null> {
  const parsed = validateResumeUrl(rawUrl);
  if (!parsed) return null;

  let downloadUrl = parsed.toString();

  // Normalize Google Drive share links → direct download
  const driveIdMatch =
    downloadUrl.match(/\/d\/([a-zA-Z0-9_-]{10,})/) ||
    downloadUrl.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (driveIdMatch && /drive\.google\.com/.test(downloadUrl)) {
    downloadUrl = `https://drive.google.com/uc?export=download&id=${driveIdMatch[1]}`;
  }

  try {
    const res = await fetch(downloadUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      // Probably a Drive "confirm download" page or login wall
      return null;
    }

    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength && contentLength > MAX_RESUME_URL_SIZE_BYTES) {
      return null;
    }

    const blob = await res.blob();
    if (blob.size <= 0 || blob.size > MAX_RESUME_URL_SIZE_BYTES) return null;

    // Derive a safe filename
    let fileName = suggestedFileName;
    if (!fileName) {
      const urlPath = parsed.pathname.split("/").filter(Boolean).pop() || "resume";
      fileName = urlPath.includes(".") ? urlPath : `${urlPath}.pdf`;
    }
    fileName = sanitizeFileName(fileName);

    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const mime =
      blob.type ||
      (ext === "pdf"
        ? "application/pdf"
        : ext === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : ext === "doc"
        ? "application/msword"
        : "application/octet-stream");

    return new File([blob], fileName, { type: mime });
  } catch (err) {
    console.warn("[resume-url] download failed:", err);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* 1. Parse Excel / CSV                                                       */
/* -------------------------------------------------------------------------- */

const HEADER_MAP: Record<string, keyof ImportRow> = {
  name: "name",
  fullname: "name",
  "full name": "name",
  candidate: "name",
  "candidate name": "name",
  email: "email",
  "email address": "email",
  mail: "email",
  phone: "phone",
  mobile: "phone",
  "phone number": "phone",
  contact: "phone",
  role: "role",
  "user role": "role",
  title: "title",
  designation: "title",
  position: "title",
  "job title": "title",
  location: "location",
  city: "location",
  department: "department",
  dept: "department",
  bio: "bio",
  summary: "bio",
  about: "bio",
  skills: "skills",
  "key skills": "skills",
  portfolio: "portfolioUrl",
  "portfolio url": "portfolioUrl",
  website: "portfolioUrl",
  // Resume URL aliases
  resume: "resumeUrl",
  "resume url": "resumeUrl",
  "resume link": "resumeUrl",
  "resume drive url": "resumeUrl",
  "drive url": "resumeUrl",
  cv: "resumeUrl",
  "cv url": "resumeUrl",
  "cv link": "resumeUrl",
  // Job mapping
  jobid: "jobId",
  "job id": "jobId",
  job: "jobId",
  // Experience
  experience: "experienceYears",
  "experience years": "experienceYears",
  years: "experienceYears",
  // Description
  description: "description",
  "cover letter": "description",
  notes: "description",
};

function normalizeHeader(h: string): keyof ImportRow | null {
  const key = h.trim().toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ");
  return HEADER_MAP[key] || null;
}

export async function parseCandidateExcel(file: File): Promise<ImportRow[]> {
  const valResult = validateSpreadsheetFile(file);
  if (!valResult.valid) throw new Error(valResult.error || "Invalid spreadsheet file.");

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "xlsx") {
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      throw new Error(
        "Corrupt or invalid .xlsx file structure. Please ensure the file was saved as an authentic Excel document."
      );
    }
  }

  const workbook = XLSX.read(buf, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excel file has no readable sheets.");

  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: "",
    raw: false,
  });

  if (raw.length === 0) throw new Error("Excel sheet contains no candidate data rows.");
  if (raw.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `File contains ${raw.length} rows. Maximum allowed batch size is ${MAX_IMPORT_ROWS} candidates per upload.`
    );
  }

  const firstRow = raw[0];
  const headerMapping: Record<string, keyof ImportRow | null> = {};
  for (const key of Object.keys(firstRow)) {
    headerMapping[key] = normalizeHeader(key);
  }

  const rows: ImportRow[] = [];

  for (const rawRow of raw) {
    const row: Partial<ImportRow> = {};
    for (const [rawKey, canonical] of Object.entries(headerMapping)) {
      if (!canonical) continue;
      let value = rawRow[rawKey];
      if (value === null || value === undefined) continue;
      value = String(value).trim();
      if (value === "") continue;
      value = sanitizeFormulaInjection(value);
      if (canonical === "skills") {
        row.skills = value
          .split(/[,;|]/)
          .map((s: string) => sanitizeFormulaInjection(s.trim()))
          .filter(Boolean);
      } else {
        (row as any)[canonical] = value;
      }
    }
    row.role = "candidate";
    if (row.name && row.email) {
      rows.push({
        name: row.name,
        email: row.email,
        phone: row.phone,
        role: "candidate",
        title: row.title,
        location: row.location,
        department: row.department,
        bio: row.bio,
        skills: row.skills || [],
        portfolioUrl: row.portfolioUrl,
        resumeUrl: row.resumeUrl,
        jobId: row.jobId,
        experienceYears: row.experienceYears,
        description: row.description,
      });
    }
  }
  return rows;
}

/* -------------------------------------------------------------------------- */
/* 2. Validate a single row                                                   */
/* -------------------------------------------------------------------------- */

export function validateImportRow(row: ImportRow): RowValidationError[] {
  const errors: RowValidationError[] = [];

  if (!row.name?.trim()) {
    errors.push({ field: "name", message: "Name is required." });
  } else if (row.name.trim().length > 120) {
    errors.push({ field: "name", message: "Name must not exceed 120 characters." });
  }

  if (!row.email?.trim()) {
    errors.push({ field: "email", message: "Email is required." });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
    errors.push({ field: "email", message: "Email is invalid." });
  } else if (row.email.trim().length > 120) {
    errors.push({ field: "email", message: "Email must not exceed 120 characters." });
  }

  if (row.portfolioUrl) {
    try {
      const parsed = new URL(row.portfolioUrl.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        errors.push({
          field: "portfolioUrl",
          message:
            "Portfolio URL must use http:// or https:// protocol (scripts and other protocols are blocked).",
        });
      }
    } catch {
      errors.push({ field: "portfolioUrl", message: "Portfolio URL is not a valid web URL." });
    }
  }

  // Validate resume URL if present
  if (row.resumeUrl) {
    const parsed = validateResumeUrl(row.resumeUrl);
    if (!parsed) {
      errors.push({
        field: "resumeUrl",
        message:
          "Resume URL must be a valid http:// or https:// link (e.g. a Google Drive share link).",
      });
    }
  }

  return errors;
}

/* -------------------------------------------------------------------------- */
/* 3. Import a single candidate                                               */
/* -------------------------------------------------------------------------- */

export interface SingleCandidateInput extends ImportRow {
  resumeFile?: File | null;
  jobId?: string;
  experienceYears?: string;
  description?: string;
}

export async function createCandidateFromInput(
  input: SingleCandidateInput
): Promise<ImportResult> {
  const errors = validateImportRow(input);
  if (errors.length > 0) {
    return {
      rowIndex: 0,
      email: input.email || "(no email)",
      status: "error",
      message: errors.map((e) => `${e.field}: ${e.message}`).join(" | "),
    };
  }

  if (input.resumeFile) {
    const resumeCheck = validateResumeFile(input.resumeFile);
    if (!resumeCheck.valid) {
      return {
        rowIndex: 0,
        email: input.email,
        status: "error",
        message: `Resume security check failed: ${resumeCheck.error}`,
      };
    }
  }

  const email = input.email.trim().toLowerCase();
  const name = sanitizeFormulaInjection(input.name.trim());
  const role: UserRole = "candidate";

  // Placeholder uid for recruiter-uploaded users (not a Firebase uid).
  const uid = `uploaded_${await hashEmail(email)}`;

  try {
    const existing = await getUserByEmailFromFirestore(email);

    // Block admin modification
    if (existing && existing.role === "admin") {
      return {
        rowIndex: 0,
        email,
        status: "skipped",
        message:
          "Security Policy: Existing Administrator accounts cannot be modified via Recruiter Candidate Upload.",
      };
    }

    // Block duplicate email if it belongs to a different UID
    if (existing && existing.uid && existing.uid !== uid) {
      const taken = await isEmailTakenInFirestore(email, existing.uid);
      if (taken) {
        return {
          rowIndex: 0,
          email,
          status: "skipped",
          message:
            "Security Policy: This email is already registered to a different account.",
        };
      }
    }

    // Claim candidateId (business key) atomically
    let candidateId: string;
    try {
      const claim = await claimEmailAndCandidateIdInFirestore(
        existing?.uid || uid,
        email,
        existing?.candidateId
      );
      candidateId = claim.candidateId;
    } catch (claimErr: any) {
      if (String(claimErr?.message || "").toLowerCase().includes("already registered")) {
        return {
          rowIndex: 0,
          email,
          status: "skipped",
          message: "Security Policy: This email is already registered to a different account.",
        };
      }
      candidateId = existing?.candidateId || "";
    }

    // ── Resume acquisition ──────────────────────────────────────────
    // Priority: (1) uploaded File from manual form, (2) URL from row.
    // Whatever we obtain, we upload to Drive via uploadResume() and
    // save the resulting URL on the user document.
    let finalResumeFile: File | null = null;
    let resumeSourceNote = "";

    if (input.resumeFile) {
      finalResumeFile = input.resumeFile;
    } else if (input.resumeUrl) {
      const fetched = await fetchResumeFromUrl(
        input.resumeUrl,
        `${name.replace(/\s+/g, "_")}_Resume.pdf`
      );
      if (fetched) {
        const check = validateResumeFile(fetched);
        if (check.valid) {
          finalResumeFile = fetched;
          resumeSourceNote = " (downloaded from provided URL)";
        } else {
          resumeSourceNote = ` Resume URL skipped: ${check.error}`;
        }
      } else {
        resumeSourceNote =
          " Resume URL could not be downloaded (link may be private or invalid).";
      }
    }

    const userRecord: User = {
      uid: existing?.uid || uid,
      candidateId,
      email,
      name,
      role: "candidate",
      phone: input.phone ? sanitizeFormulaInjection(input.phone.trim()) : undefined,
      title: input.title ? sanitizeFormulaInjection(input.title.trim()) : "Software Engineer",
      location: input.location ? sanitizeFormulaInjection(input.location.trim()) : "Bengaluru, India",
      department: input.department ? sanitizeFormulaInjection(input.department.trim()) : "Web Development",
      bio: input.bio ? sanitizeFormulaInjection(input.bio.trim()) : undefined,
      skills:
        input.skills && input.skills.length
          ? input.skills.map((s) => sanitizeFormulaInjection(s.trim()))
          : [],
      portfolioUrl: input.portfolioUrl?.trim(),
      // Preserve any existing resume URL if no new one is uploaded
      resumeUrl: existing?.resumeUrl || undefined,
      emailVerified: false,
      providerId: "recruiter_import",
      createdAt: existing?.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    // Save user doc first so uploadResume can target a real uid
    await saveUserToFirestore(userRecord);

    // Upload resume if we obtained a File (either direct file or from URL)
    let resumeMessage = resumeSourceNote;
    let resumeUploaded = false;
    if (finalResumeFile) {
      try {
        const upload = await uploadResume(userRecord.uid, finalResumeFile);
        const uploadedUrl = upload.url;

        // Persist the uploaded URL on the user document
        await saveUserToFirestore({
          ...userRecord,
          resumeUrl: uploadedUrl,
        });

        resumeUploaded = true;
        resumeMessage += ` Resume uploaded: ${upload.utilization.originalSizeFormatted} → ${upload.utilization.utilizedSizeFormatted}.`;
      } catch (e: any) {
        resumeMessage += ` Resume upload note: ${e?.message || "Failed to sync to Drive"}.`;
      }
    } else if (input.resumeUrl && !finalResumeFile) {
      // Fallback: if we couldn't download the URL, still store the link itself
      // so the recruiter can see where it pointed (does not break the profile).
      try {
        await saveUserToFirestore({
          ...userRecord,
          resumeUrl: input.resumeUrl.trim(),
        });
        resumeMessage += ` Resume link saved as-is (could not be downloaded to Drive).`;
      } catch {
        /* silent */
      }
    }

    // ── Application creation (NO candidateId written to applications) ──
    let applicationId: string | undefined;
    if (input.jobId) {
      const app = await createApplicationInFirestore({
        jobId: input.jobId,
        uid: userRecord.uid,
        experienceYears: input.experienceYears || "0",
        description: input.description ? sanitizeFormulaInjection(input.description) : "",
        status: "Pending",
      });
      applicationId = app.id;
    }

    return {
      rowIndex: 0,
      email,
      status: existing ? "updated" : "created",
      message:
        (existing ? "Existing candidate record updated." : "New candidate created.") +
        (input.jobId ? ` Assigned to Job Application #${applicationId?.slice(0, 8)}.` : "") +
        resumeMessage,
      uid: userRecord.uid,
      candidateId: userRecord.candidateId,
      applicationId,
      resumeUploaded,
    };
  } catch (err: any) {
    return {
      rowIndex: 0,
      email,
      status: "error",
      message: err?.message || "Unknown error creating candidate.",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* 4. Bulk import                                                             */
/* -------------------------------------------------------------------------- */

export async function bulkImportCandidates(
  rows: ImportRow[],
  options?: {
    defaultJobId?: string;
    onProgress?: (done: number, total: number) => void;
  }
): Promise<BulkImportSummary> {
  const results: ImportResult[] = [];
  let created = 0, updated = 0, skipped = 0, failed = 0;

  const total = rows.length;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const result = await createCandidateFromInput({
        ...row,
        role: "candidate",
        jobId: row.jobId || options?.defaultJobId,
      });

      if (result.status === "created") created++;
      else if (result.status === "updated") updated++;
      else if (result.status === "skipped") skipped++;
      else failed++;

      results.push({ ...result, rowIndex: i + 1 });
    } catch (err: any) {
      failed++;
      results.push({
        rowIndex: i + 1,
        email: row.email || "(unknown)",
        status: "error",
        message: err?.message || "Unknown error processing row",
      });
    }

    options?.onProgress?.(i + 1, total);
  }

  return { total, created, updated, skipped, failed, results };
}

/* -------------------------------------------------------------------------- */
/* 5. Template Generator                                                      */
/* -------------------------------------------------------------------------- */

export function generateCandidateImportTemplate(): Uint8Array {
  const headers = [
    "Full Name",
    "Email Address",
    "Phone Number",
    "Designation",
    "Department",
    "Location",
    "Key Skills",
    "Years of Experience",
    "Portfolio URL",
    "Resume URL",
    "Recruiter Notes / Bio",
  ];

  const sampleRows = [
    [
      "Aarav Patel",
      "aarav.patel@example.com",
      "+91 98765 43210",
      "Senior Full Stack Engineer",
      "Web Development",
      "Bengaluru, India",
      "React, TypeScript, Next.js, Node.js",
      "4 - 6 Years",
      "https://github.com/aaravpatel",
      "https://drive.google.com/file/d/1abcDEFghiJKLmnopQRS/view?usp=sharing",
      "Experienced with high-scale React architectures and cloud-native backends.",
    ],
    [
      "Priya Sharma",
      "priya.sharma@example.com",
      "+91 98123 45678",
      "DevOps / Cloud Specialist",
      "Cloud & DevOps",
      "Hyderabad, India",
      "AWS, Kubernetes, Terraform, Docker, CI/CD",
      "3 - 5 Years",
      "https://linkedin.com/in/priyasharma",
      "https://drive.google.com/file/d/1xyzABCdefGHIjklMNO/view",
      "Specializes in container orchestration and automated infrastructure pipelines.",
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws["!cols"] = [
    { wch: 20 },
    { wch: 28 },
    { wch: 18 },
    { wch: 28 },
    { wch: 22 },
    { wch: 20 },
    { wch: 38 },
    { wch: 20 },
    { wch: 32 },
    { wch: 45 },
    { wch: 45 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Candidate Template");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Uint8Array(wbout);
}

export function generateCandidateImportTemplateBlob(): Blob {
  const data = generateCandidateImportTemplate();
  return new Blob([data.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/* -------------------------------------------------------------------------- */
/* 6. Helpers                                                                 */
/* -------------------------------------------------------------------------- */

async function hashEmail(email: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(email);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hex.slice(0, 24);
  }
  let h = 0;
  for (let i = 0; i < email.length; i++) {
    h = (h << 5) - h + email.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16);
}













// // src/lib/candidateImport.ts
// import * as XLSX from "xlsx";
// import { User, UserRole } from "@/types";
// import {
//   saveUserToFirestore,
//   createApplicationInFirestore,
//   getUserByEmailFromFirestore,
// } from "@/lib/firestore";
// import { uploadResume } from "@/lib/resumeStorage";

// export interface ImportRow {
//   name: string;
//   email: string;
//   phone?: string;
//   role?: UserRole; // Always "candidate" for recruiter imports
//   title?: string;
//   location?: string;
//   department?: string;
//   bio?: string;
//   skills?: string[]; // from comma-separated string
//   portfolioUrl?: string;
//   jobId?: string; // optional: auto-create an application
//   experienceYears?: string;
//   description?: string;
// }

// export interface ImportResult {
//   rowIndex: number;
//   email: string;
//   status: "created" | "updated" | "skipped" | "error";
//   message: string;
//   uid?: string;
//   applicationId?: string;
// }

// export interface BulkImportSummary {
//   total: number;
//   created: number;
//   updated: number;
//   skipped: number;
//   failed: number;
//   results: ImportResult[];
// }

// export interface RowValidationError {
//   field: string;
//   message: string;
// }

// /* -------------------------------------------------------------------------- */
// /* Security Sanitizers & File Validators                                     */
// /* -------------------------------------------------------------------------- */

// const DANGEROUS_EXTENSIONS = new Set([
//   "exe", "bat", "cmd", "sh", "php", "phtml", "js", "vbs", "py", "dll",
//   "jar", "msi", "html", "htm", "svg", "xml", "xhtml", "scr", "com",
//   "vbe", "wsf", "hta", "cpl", "reg", "apk", "bin", "wasm", "action"
// ]);

// const ALLOWED_RESUME_EXTENSIONS = new Set([
//   "pdf", "doc", "docx", "png", "jpg", "jpeg"
// ]);

// const ALLOWED_SPREADSHEET_EXTENSIONS = new Set(["xlsx", "xls", "csv"]);

// const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
// const MAX_SPREADSHEET_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
// const MAX_IMPORT_ROWS = 500; // Cap at 500 candidates per batch to prevent DoS & quota abuse

// /**
//  * Sanitize strings to mitigate CSV / Spreadsheet formula injection (DDE attacks)
//  * when spreadsheets are re-exported or viewed in Microsoft Excel / LibreOffice.
//  */
// export function sanitizeFormulaInjection(val: string): string {
//   if (!val) return "";
//   const trimmed = val.trim();
//   // If the cell begins with formula prefixes: =, +, -, @, tab, or carriage return
//   if (/^[=+\-@\t\r]/.test(trimmed)) {
//     return "'" + trimmed;
//   }
//   return trimmed;
// }

// /**
//  * Strip path traversal and null characters from file names
//  */
// export function sanitizeFileName(name: string): string {
//   if (!name) return "unnamed_file";
//   return name
//     .replace(/[\/\\]/g, "_")
//     .replace(/\0/g, "")
//     .replace(/[^\w.\- ]/gi, "_")
//     .slice(0, 120);
// }

// /**
//  * Strict file validation for resumes
//  */
// export function validateResumeFile(file: File): { valid: boolean; error?: string } {
//   if (!file) {
//     return { valid: false, error: "No file selected." };
//   }

//   if (file.size <= 0) {
//     return { valid: false, error: "The selected file is empty (0 bytes)." };
//   }

//   if (file.size > MAX_RESUME_SIZE_BYTES) {
//     return {
//       valid: false,
//       error: `File size exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
//     };
//   }

//   const parts = file.name.split(".");
//   const ext = (parts.length > 1 ? parts.pop() : "")?.toLowerCase() || "";

//   if (DANGEROUS_EXTENSIONS.has(ext)) {
//     return {
//       valid: false,
//       error: `Security Policy Violation: Executable or script files (.${ext}) are strictly blocked.`,
//     };
//   }

//   if (!ALLOWED_RESUME_EXTENSIONS.has(ext)) {
//     return {
//       valid: false,
//       error: `Unsupported file type (.${ext}). Accepted formats: PDF, DOC, DOCX, PNG, JPG.`,
//     };
//   }

//   return { valid: true };
// }

// /**
//  * Strict file validation for spreadsheets (.xlsx, .xls, .csv)
//  */
// export function validateSpreadsheetFile(file: File): { valid: boolean; error?: string } {
//   if (!file) {
//     return { valid: false, error: "No file selected." };
//   }

//   if (file.size <= 0) {
//     return { valid: false, error: "Spreadsheet file is empty." };
//   }

//   if (file.size > MAX_SPREADSHEET_SIZE_BYTES) {
//     return {
//       valid: false,
//       error: `Spreadsheet exceeds 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
//     };
//   }

//   const parts = file.name.split(".");
//   const ext = (parts.length > 1 ? parts.pop() : "")?.toLowerCase() || "";

//   if (!ALLOWED_SPREADSHEET_EXTENSIONS.has(ext)) {
//     return {
//       valid: false,
//       error: `Invalid spreadsheet format (.${ext}). Only .xlsx, .xls, and .csv files are permitted.`,
//     };
//   }

//   return { valid: true };
// }

// /* -------------------------------------------------------------------------- */
// /* 1. Parse Excel / CSV file → normalized rows                                */
// /* -------------------------------------------------------------------------- */

// const HEADER_MAP: Record<string, keyof ImportRow> = {
//   // name variants
//   name: "name",
//   fullname: "name",
//   "full name": "name",
//   candidate: "name",
//   "candidate name": "name",
//   // email
//   email: "email",
//   "email address": "email",
//   mail: "email",
//   // phone
//   phone: "phone",
//   mobile: "phone",
//   "phone number": "phone",
//   contact: "phone",
//   // role (recruiter upload will enforce candidate regardless)
//   role: "role",
//   "user role": "role",
//   // title / designation
//   title: "title",
//   designation: "title",
//   position: "title",
//   "job title": "title",
//   // location
//   location: "location",
//   city: "location",
//   // department
//   department: "department",
//   dept: "department",
//   // bio
//   bio: "bio",
//   summary: "bio",
//   about: "bio",
//   // skills
//   skills: "skills",
//   "key skills": "skills",
//   // portfolio
//   portfolio: "portfolioUrl",
//   "portfolio url": "portfolioUrl",
//   website: "portfolioUrl",
//   // job mapping
//   jobid: "jobId",
//   "job id": "jobId",
//   job: "jobId",
//   // experience
//   experience: "experienceYears",
//   "experience years": "experienceYears",
//   years: "experienceYears",
//   // description / cover letter
//   description: "description",
//   "cover letter": "description",
//   notes: "description",
// };

// function normalizeHeader(h: string): keyof ImportRow | null {
//   const key = h.trim().toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ");
//   return HEADER_MAP[key] || null;
// }

// export async function parseCandidateExcel(file: File): Promise<ImportRow[]> {
//   // 1. Validate file format & size
//   const valResult = validateSpreadsheetFile(file);
//   if (!valResult.valid) {
//     throw new Error(valResult.error || "Invalid spreadsheet file.");
//   }

//   const buf = await file.arrayBuffer();
//   const bytes = new Uint8Array(buf);

//   // 2. Binary signature verification for XLSX
//   const ext = file.name.split(".").pop()?.toLowerCase();
//   if (ext === "xlsx") {
//     // Zip header signature PK (0x50, 0x4B)
//     if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
//       throw new Error("Corrupt or invalid .xlsx file structure. Please ensure the file was saved as an authentic Excel document.");
//     }
//   }

//   const workbook = XLSX.read(buf, { type: "array" });
//   const sheetName = workbook.SheetNames[0];
//   if (!sheetName) throw new Error("Excel file has no readable sheets.");

//   const sheet = workbook.Sheets[sheetName];
//   const raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
//     defval: "",
//     raw: false,
//   });

//   if (raw.length === 0) throw new Error("Excel sheet contains no candidate data rows.");

//   if (raw.length > MAX_IMPORT_ROWS) {
//     throw new Error(
//       `File contains ${raw.length} rows. Maximum allowed batch size is ${MAX_IMPORT_ROWS} candidates per upload.`
//     );
//   }

//   // Map headers → canonical keys (once, from first row's keys)
//   const firstRow = raw[0];
//   const headerMapping: Record<string, keyof ImportRow | null> = {};
//   for (const key of Object.keys(firstRow)) {
//     headerMapping[key] = normalizeHeader(key);
//   }

//   const rows: ImportRow[] = [];

//   for (const rawRow of raw) {
//     const row: Partial<ImportRow> = {};
//     for (const [rawKey, canonical] of Object.entries(headerMapping)) {
//       if (!canonical) continue;
//       let value = rawRow[rawKey];
//       if (value === null || value === undefined) continue;
//       value = String(value).trim();
//       if (value === "") continue;

//       // Sanitize formula injection
//       value = sanitizeFormulaInjection(value);

//       if (canonical === "skills") {
//         row.skills = value
//           .split(/[,;|]/)
//           .map((s: string) => sanitizeFormulaInjection(s.trim()))
//           .filter(Boolean);
//       } else {
//         (row as any)[canonical] = value;
//       }
//     }

//     // Recruiter imports strictly enforce the candidate role
//     row.role = "candidate";

//     // Only push rows that have at least name + email
//     if (row.name && row.email) {
//       rows.push({
//         name: row.name,
//         email: row.email,
//         phone: row.phone,
//         role: "candidate",
//         title: row.title,
//         location: row.location,
//         department: row.department,
//         bio: row.bio,
//         skills: row.skills || [],
//         portfolioUrl: row.portfolioUrl,
//         jobId: row.jobId,
//         experienceYears: row.experienceYears,
//         description: row.description,
//       });
//     }
//   }

//   return rows;
// }

// /* -------------------------------------------------------------------------- */
// /* 2. Validate a single row                                                   */
// /* -------------------------------------------------------------------------- */

// export function validateImportRow(row: ImportRow): RowValidationError[] {
//   const errors: RowValidationError[] = [];

//   if (!row.name?.trim()) {
//     errors.push({ field: "name", message: "Name is required." });
//   } else if (row.name.trim().length > 120) {
//     errors.push({ field: "name", message: "Name must not exceed 120 characters." });
//   }

//   if (!row.email?.trim()) {
//     errors.push({ field: "email", message: "Email is required." });
//   } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
//     errors.push({ field: "email", message: "Email is invalid." });
//   } else if (row.email.trim().length > 120) {
//     errors.push({ field: "email", message: "Email must not exceed 120 characters." });
//   }

//   if (row.portfolioUrl) {
//     try {
//       const parsed = new URL(row.portfolioUrl.trim());
//       if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
//         errors.push({
//           field: "portfolioUrl",
//           message: "Portfolio URL must use http:// or https:// protocol (scripts and other protocols are blocked).",
//         });
//       }
//     } catch {
//       errors.push({
//         field: "portfolioUrl",
//         message: "Portfolio URL is not a valid web URL.",
//       });
//     }
//   }

//   return errors;
// }

// /* -------------------------------------------------------------------------- */
// /* 3. Import a single candidate (manual entry or from a row)                  */
// /* -------------------------------------------------------------------------- */

// export interface SingleCandidateInput extends ImportRow {
//   resumeFile?: File | null; // optional resume
//   jobId?: string; // optional: link to a job
//   experienceYears?: string;
//   description?: string;
// }

// export async function createCandidateFromInput(
//   input: SingleCandidateInput
// ): Promise<ImportResult> {
//   const errors = validateImportRow(input);
//   if (errors.length > 0) {
//     return {
//       rowIndex: 0,
//       email: input.email || "(no email)",
//       status: "error",
//       message: errors.map((e) => `${e.field}: ${e.message}`).join(" | "),
//     };
//   }

//   // Pre-validate resume if supplied
//   if (input.resumeFile) {
//     const resumeCheck = validateResumeFile(input.resumeFile);
//     if (!resumeCheck.valid) {
//       return {
//         rowIndex: 0,
//         email: input.email,
//         status: "error",
//         message: `Resume security check failed: ${resumeCheck.error}`,
//       };
//     }
//   }

//   const email = input.email.trim().toLowerCase();
//   const name = sanitizeFormulaInjection(input.name.trim());
//   // SECURITY: Recruiter candidate uploads strictly assign role "candidate"
//   const role: UserRole = "candidate";

//   // Build a stable UID derived from the email (safe for Firestore)
//   const uid = `cand_${await hashEmail(email)}`;

//   try {
//     // 1. Security check: Check if user already exists
//     const existing = await getUserByEmailFromFirestore(email);

//     // SECURITY: Prevent overwriting or tampering with administrator accounts!
//     if (existing && existing.role === "admin") {
//       return {
//         rowIndex: 0,
//         email,
//         status: "skipped",
//         message: "Security Policy: Existing Administrator accounts cannot be modified via Recruiter Candidate Upload.",
//       };
//     }

//     const userRecord: User = {
//       uid: existing?.uid || uid,
//       email,
//       name,
//       role: "candidate", // Always candidate
//       phone: input.phone ? sanitizeFormulaInjection(input.phone.trim()) : undefined,
//       title: input.title ? sanitizeFormulaInjection(input.title.trim()) : "Software Engineer",
//       location: input.location ? sanitizeFormulaInjection(input.location.trim()) : "Bengaluru, India",
//       department: input.department ? sanitizeFormulaInjection(input.department.trim()) : "Web Development",
//       bio: input.bio ? sanitizeFormulaInjection(input.bio.trim()) : undefined,
//       skills: input.skills && input.skills.length ? input.skills.map((s) => sanitizeFormulaInjection(s.trim())) : [],
//       portfolioUrl: input.portfolioUrl?.trim(),
//       emailVerified: false,
//       providerId: "recruiter_import",
//       createdAt: existing?.createdAt || new Date().toISOString(),
//       lastLoginAt: new Date().toISOString(),
//     };

//     // 2. Save user doc
//     await saveUserToFirestore(userRecord);

//     // 3. Optional resume upload (reuses utilization + Drive pipeline)
//     let resumeMessage = "";
//     if (input.resumeFile) {
//       try {
//         const upload = await uploadResume(userRecord.uid, input.resumeFile);
//         resumeMessage = ` Resume uploaded: ${upload.utilization.originalSizeFormatted} → ${upload.utilization.utilizedSizeFormatted}.`;
//       } catch (e: any) {
//         resumeMessage = ` Resume upload note: ${e?.message || "Failed to sync to Drive"}.`;
//       }
//     }

//     // 4. Optional application creation
//     let applicationId: string | undefined;
//     if (input.jobId) {
//       const app = await createApplicationInFirestore({
//         jobId: input.jobId,
//         uid: userRecord.uid,
//         experienceYears: input.experienceYears || "0",
//         description: input.description ? sanitizeFormulaInjection(input.description) : "",
//         status: "Pending",
//       });
//       applicationId = app.id;
//     }

//     return {
//       rowIndex: 0,
//       email,
//       status: existing ? "updated" : "created",
//       message:
//         (existing ? "Existing candidate record updated." : "New candidate created.") +
//         (input.jobId ? ` Assigned to Job Application #${applicationId?.slice(0, 8)}.` : "") +
//         resumeMessage,
//       uid: userRecord.uid,
//       applicationId,
//     };
//   } catch (err: any) {
//     return {
//       rowIndex: 0,
//       email,
//       status: "error",
//       message: err?.message || "Unknown error creating candidate.",
//     };
//   }
// }

// /* -------------------------------------------------------------------------- */
// /* 4. Bulk import (Excel rows)                                               */
// /* -------------------------------------------------------------------------- */

// export async function bulkImportCandidates(
//   rows: ImportRow[],
//   options?: { defaultJobId?: string; onProgress?: (done: number, total: number) => void }
// ): Promise<BulkImportSummary> {
//   const results: ImportResult[] = [];
//   let created = 0,
//     updated = 0,
//     skipped = 0,
//     failed = 0;

//   const total = rows.length;

//   for (let i = 0; i < rows.length; i++) {
//     const row = rows[i];
//     try {
//       const result = await createCandidateFromInput({
//         ...row,
//         role: "candidate", // Strictly enforce candidate role
//         jobId: row.jobId || options?.defaultJobId,
//       });

//       if (result.status === "created") created++;
//       else if (result.status === "updated") updated++;
//       else if (result.status === "skipped") skipped++;
//       else failed++;

//       results.push({ ...result, rowIndex: i + 1 });
//     } catch (err: any) {
//       failed++;
//       results.push({
//         rowIndex: i + 1,
//         email: row.email || "(unknown)",
//         status: "error",
//         message: err?.message || "Unknown error processing row",
//       });
//     }

//     options?.onProgress?.(i + 1, total);
//   }

//   return {
//     total,
//     created,
//     updated,
//     skipped,
//     failed,
//     results,
//   };
// }

// /* -------------------------------------------------------------------------- */
// /* 5. Sample Template Generator for Recruiters                                */
// /* -------------------------------------------------------------------------- */

// export function generateCandidateImportTemplate(): Uint8Array {
//   const headers = [
//     "Full Name",
//     "Email Address",
//     "Phone Number",
//     "Designation",
//     "Department",
//     "Location",
//     "Key Skills",
//     "Years of Experience",
//     "Portfolio URL",
//     "Recruiter Notes / Bio",
//   ];

//   const sampleRows = [
//     [
//       "Aarav Patel",
//       "aarav.patel@example.com",
//       "+91 98765 43210",
//       "Senior Full Stack Engineer",
//       "Web Development",
//       "Bengaluru, India",
//       "React, TypeScript, Next.js, Node.js",
//       "4 - 6 Years",
//       "https://github.com/aaravpatel",
//       "Experienced with high-scale React architectures and cloud-native backends.",
//     ],
//     [
//       "Priya Sharma",
//       "priya.sharma@example.com",
//       "+91 98123 45678",
//       "DevOps / Cloud Specialist",
//       "Cloud & DevOps",
//       "Hyderabad, India",
//       "AWS, Kubernetes, Terraform, Docker, CI/CD",
//       "3 - 5 Years",
//       "https://linkedin.com/in/priyasharma",
//       "Specializes in container orchestration and automated infrastructure pipelines.",
//     ],
//   ];

//   const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

//   // Set column widths for readability
//   ws["!cols"] = [
//     { wch: 20 },
//     { wch: 28 },
//     { wch: 18 },
//     { wch: 28 },
//     { wch: 22 },
//     { wch: 20 },
//     { wch: 38 },
//     { wch: 20 },
//     { wch: 32 },
//     { wch: 45 },
//   ];

//   const wb = XLSX.utils.book_new();
//   XLSX.utils.book_append_sheet(wb, ws, "Candidate Template");

//   const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
//   return new Uint8Array(wbout);
// }

// export function generateCandidateImportTemplateBlob(): Blob {
//   const data = generateCandidateImportTemplate();
//   return new Blob([data.buffer as ArrayBuffer], {
//     type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//   });
// }

// /* -------------------------------------------------------------------------- */
// /* 6. Helpers                                                                */
// /* -------------------------------------------------------------------------- */

// async function hashEmail(email: string): Promise<string> {
//   if (typeof crypto !== "undefined" && crypto.subtle) {
//     const data = new TextEncoder().encode(email);
//     const digest = await crypto.subtle.digest("SHA-256", data);
//     const hex = Array.from(new Uint8Array(digest))
//       .map((b) => b.toString(16).padStart(2, "0"))
//       .join("");
//     return hex.slice(0, 24);
//   }
//   let h = 0;
//   for (let i = 0; i < email.length; i++) {
//     h = (h << 5) - h + email.charCodeAt(i);
//     h |= 0;
//   }
//   return Math.abs(h).toString(16);
// }