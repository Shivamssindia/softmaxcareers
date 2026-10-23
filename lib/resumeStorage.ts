import {
  uploadResumeToGoogleDrive,
  deleteResumeFromGoogleDrive,
  extractDriveFileId,
  ResumeUploadResult,
  ResumeDeleteResult,
} from "@/lib/googleDriveService";
import {
  utilizeDocument,
  UtilizationResult,
} from "@/lib/documentUtilization";

export type { ResumeUploadResult, ResumeDeleteResult };

export interface ResumeUploadWithUtilization extends ResumeUploadResult {
  utilization: UtilizationResult;
}

export interface ResumeDeleteOutcome {
  driveDeleted: boolean;
  driveAlreadyGone: boolean;
  firestoreCleared: boolean;
}

/**
 * Upload a candidate resume to Google Drive.
 *
 * Flow:
 *   1. utilizeDocument(file)       → compress 5MB → ~260KB target
 *   2. uploadResumeToGoogleDrive()  → OAuth + multipart POST + public permission
 *   3. Firestore { resumeUrl, resumeFileId, resumeFileName } updated internally
 *
 * Returns the upload result plus the utilization metrics so callers
 * can display "5.0MB → 260KB (94.8% saved)" to the user.
 */
export async function uploadResume(
  uid: string,
  file: File
): Promise<ResumeUploadWithUtilization> {
  if (!file) throw new Error("No resume file provided for upload.");
  if (!uid) throw new Error("User ID is required to upload a resume.");

  // 1. Compress / utilize the document
  let utilization: UtilizationResult;
  try {
    utilization = await utilizeDocument(file);
    console.log(
      `[resumeStorage] Utilized "${file.name}": ` +
        `${utilization.originalSizeFormatted} → ${utilization.utilizedSizeFormatted} ` +
        `(${utilization.savingsPercent}% saved, ${utilization.processingTimeMs}ms)`
    );
  } catch (err) {
    console.warn(
      "[resumeStorage] Utilization failed, uploading original:",
      err
    );
    const uploadResult = await uploadResumeToGoogleDrive(file, uid);
    return {
      ...uploadResult,
      utilization: {
        originalFile: file,
        utilizedFile: file,
        originalSizeBytes: file.size,
        originalSizeFormatted: `${(file.size / 1024).toFixed(1)} KB`,
        utilizedSizeBytes: file.size,
        utilizedSizeFormatted: `${(file.size / 1024).toFixed(1)} KB`,
        savingsPercent: 0,
        dataUrl: "",
        status: "already_optimal",
        processingTimeMs: 0,
      },
    };
  }

  // 2. Upload the utilized (compressed) file
  const uploadResult = await uploadResumeToGoogleDrive(
    utilization.utilizedFile,
    uid
  );

  return {
    ...uploadResult,
    utilization,
  };
}

/**
 * Delete a candidate's resume.
 *
 * Flow:
 *   1. Best-effort DELETE on Google Drive (via fileId, or extracted from resumeUrl)
 *   2. Clear { resumeUrl, resumeFileId, resumeFileName } from the user's Firestore doc
 *
 * Drive deletion failures are logged but do NOT abort Firestore cleanup —
 * the profile link must always be cleared so the UI stays consistent.
 */
export async function deleteResume(
  uid: string,
  fileId?: string | null,
  resumeUrl?: string | null
): Promise<ResumeDeleteOutcome> {
  if (!uid) throw new Error("User ID is required to delete a resume.");

  // Determine the file ID — explicit first, then fall back to URL parsing
  // (covers accounts uploaded before resumeFileId was stored).
  const effectiveFileId = fileId || extractDriveFileId(resumeUrl);

  let driveDeleted = false;
  let driveAlreadyGone = false;

  if (effectiveFileId) {
    try {
      const result = await deleteResumeFromGoogleDrive(effectiveFileId);
      driveDeleted = result.deleted;
      driveAlreadyGone = result.alreadyGone;
    } catch (err) {
      // Do not throw — proceed to Firestore cleanup regardless.
      console.warn(
        "[resumeStorage] Drive deletion failed, continuing with Firestore cleanup:",
        err
      );
    }
  } else {
    // No file ID anywhere — treat as already gone (nothing to delete)
    driveAlreadyGone = true;
  }

  // Clear Firestore fields — this is the source of truth for the UI
  const { updateUserInFirestore } = await import("@/lib/firestore");
  await updateUserInFirestore(uid, {
    resumeUrl: undefined,
    resumeFileId: undefined,
    resumeFileName: undefined,
  } as any);

  return {
    driveDeleted,
    driveAlreadyGone,
    firestoreCleared: true,
  };
}