// src/lib/firestore/exams.ts
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { Exam, ExamEnrollment, ExamPhase, ExamStatus } from "@/types/exam";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
  DocumentData,
  QuerySnapshot,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

/* ========================================================================== */
/* Mappers                                                                    */
/* ========================================================================== */

function mapExamDoc(id: string, data: DocumentData): Exam {
  return {
    id,
    examName: data.examName || "",
    examDateTime: data.examDateTime || new Date().toISOString(),
    durationMinutes: Number(data.durationMinutes) || 60,
    examResourceLink: data.examResourceLink || "",
    maxViolations: Number(data.maxViolations) || 3,
    description: data.description || undefined,
    instructions: data.instructions || undefined,
    status: (data.status as ExamStatus) || "scheduled",
    enrolledCandidates: Array.isArray(data.enrolledCandidates)
      ? data.enrolledCandidates
      : [],
    isCompleted: Boolean(data.isCompleted),
    submittedAt: data.submittedAt || undefined,
    createdAt: data.createdAt || new Date().toISOString(),
    createdBy: data.createdBy || "",
    updatedAt: data.updatedAt || undefined,
  };
}

function sanitize<T extends Record<string, any>>(obj: T): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/* ========================================================================== */
/* Centralized Real-Time Exam Status & Phase Computations                     */
/* ========================================================================== */

/**
 * Computes the real-time exam status:
 * - "cancelled": if the exam was explicitly cancelled by admin
 * - "archived": if explicitly archived
 * - "draft": if still in draft state
 * - "completed": if manually submitted/completed OR current time > end time
 * - "active": if current time is within [start, end]
 * - "scheduled": if current time < start
 */
export function computeExamStatus(
  exam: {
    examDateTime: string;
    durationMinutes: number;
    status?: ExamStatus | string;
    isCompleted?: boolean;
    submittedAt?: string;
  },
  now: Date = new Date()
): ExamStatus {
  const rawStatus = String(exam.status || "").toLowerCase().trim();

  // Explicit cancellation must always be preserved
  if (rawStatus === "cancelled" || rawStatus === "canceled") {
    return "cancelled";
  }

  // Explicit archive or draft
  if (rawStatus === "archived") return "archived";
  if (rawStatus === "draft") return "draft";

  // Manual completion or submission flag
  if (exam.isCompleted || exam.submittedAt) {
    return "completed";
  }

  const startTime = new Date(exam.examDateTime).getTime();
  if (isNaN(startTime)) {
    return "scheduled";
  }

  const durationMs = (Number(exam.durationMinutes) || 60) * 60 * 1000;
  const endTime = startTime + durationMs;
  const currentTime = now.getTime();

  if (currentTime < startTime) {
    return "scheduled";
  }
  if (currentTime >= startTime && currentTime <= endTime) {
    return "active";
  }
  return "completed";
}

/**
 * Metadata & UI styling for display of exam status badges
 */
export function getExamStatusMeta(status: ExamStatus): {
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (status) {
    case "active":
      return {
        label: "Active",
        badgeClass:
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
        dotClass: "bg-emerald-500 animate-pulse",
      };
    case "scheduled":
      return {
        label: "Scheduled",
        badgeClass:
          "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
        dotClass: "bg-indigo-500",
      };
    case "completed":
      return {
        label: "Completed",
        badgeClass:
          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
        dotClass: "bg-slate-400",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        badgeClass:
          "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
        dotClass: "bg-rose-500",
      };
    case "archived":
      return {
        label: "Archived",
        badgeClass:
          "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500 border border-slate-200 dark:border-slate-700",
        dotClass: "bg-slate-400",
      };
    default:
      return {
        label: "Scheduled",
        badgeClass:
          "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
        dotClass: "bg-indigo-500",
      };
  }
}

/**
 * Validates whether the candidate is currently allowed to start or access the exam test interface.
 */
export function isExamPermittedTime(
  exam: Exam,
  now: Date = new Date()
): {
  permitted: boolean;
  reason?: "cancelled" | "not_started" | "ended";
  message?: string;
} {
  const currentStatus = computeExamStatus(exam, now);
  if (currentStatus === "cancelled") {
    return {
      permitted: false,
      reason: "cancelled",
      message: "This exam has been cancelled by the administrator.",
    };
  }

  const startTime = new Date(exam.examDateTime).getTime();
  const durationMs = (Number(exam.durationMinutes) || 60) * 60 * 1000;
  const endTime = startTime + durationMs;
  const currentTime = now.getTime();

  if (currentTime < startTime) {
    return {
      permitted: false,
      reason: "not_started",
      message: "The exam has not reached its scheduled start time yet.",
    };
  }

  if (currentTime > endTime) {
    return {
      permitted: false,
      reason: "ended",
      message: "The permitted time window for this exam has already closed.",
    };
  }

  return { permitted: true };
}

/* ========================================================================== */
/* CRUD                                                                       */
/* ========================================================================== */

export async function createExamInFirestore(
  examData: Omit<Exam, "id" | "createdAt" | "enrolledCandidates"> & {
    id?: string;
    createdAt?: string;
    enrolledCandidates?: ExamEnrollment[];
  }
): Promise<Exam> {
  const id = examData.id || "exam-" + Date.now();
  const createdAt = examData.createdAt || new Date().toISOString();

  const newExam: Exam = {
    id,
    examName: examData.examName,
    examDateTime: examData.examDateTime,
    durationMinutes: examData.durationMinutes,
    examResourceLink: examData.examResourceLink,
    maxViolations: examData.maxViolations,
    description: examData.description,
    instructions: examData.instructions,
    status: examData.status || "scheduled",
    enrolledCandidates: examData.enrolledCandidates || [],
    isCompleted: false,
    submittedAt: undefined,
    createdAt,
    createdBy: examData.createdBy,
    updatedAt: undefined,
  };

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "exams", id), sanitize(newExam));
    } catch (err) {
      console.error("createExamInFirestore failed:", err);
      throw err;
    }
  }
  return newExam;
}

export async function getExamByIdFromFirestore(
  id: string
): Promise<Exam | null> {
  if (!isFirebaseConfigured || !db) return null;
  try {
    const snap = await getDoc(doc(db, "exams", id));
    if (!snap.exists()) return null;
    return mapExamDoc(snap.id, snap.data());
  } catch (err) {
    console.warn(`getExamByIdFromFirestore(${id}) failed:`, err);
    return null;
  }
}

export async function getAllExamsFromFirestore(): Promise<Exam[]> {
  if (!isFirebaseConfigured || !db) return [];
  try {
    const ref = collection(db, "exams");
    let snap: QuerySnapshot<DocumentData>;
    try {
      snap = await getDocs(query(ref, orderBy("examDateTime", "desc")));
    } catch {
      snap = await getDocs(ref);
    }
    return snap.docs.map((d) => mapExamDoc(d.id, d.data()));
  } catch (err) {
    console.warn("getAllExamsFromFirestore failed:", err);
    return [];
  }
}

export async function updateExamInFirestore(
  id: string,
  updates: Partial<Exam>
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    const clean = sanitize({ ...updates, updatedAt: new Date().toISOString() });
    delete clean.id;
    await updateDoc(doc(db, "exams", id), clean);
  } catch (err) {
    console.error(`updateExamInFirestore(${id}) failed:`, err);
    throw err;
  }
}

export async function deleteExamInFirestore(id: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    await deleteDoc(doc(db, "exams", id));
  } catch (err) {
    console.error(`deleteExamInFirestore(${id}) failed:`, err);
    throw err;
  }
}

/* ========================================================================== */
/* Enrollment                                                                 */
/* ========================================================================== */

export async function enrollCandidatesInExam(
  examId: string,
  uids: string[],
  enrolledBy?: string
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  if (!uids.length) return;
  const now = new Date().toISOString();
  const records: ExamEnrollment[] = uids.map((uid) => ({
    uid,
    enrolledAt: now,
    enrolledBy,
  }));
  try {
    await updateDoc(doc(db, "exams", examId), {
      enrolledCandidates: arrayUnion(...records),
    });
  } catch (err) {
    console.error("enrollCandidatesInExam failed:", err);
    throw err;
  }
}

export async function removeCandidateFromExam(
  examId: string,
  enrollment: ExamEnrollment
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    await updateDoc(doc(db, "exams", examId), {
      enrolledCandidates: arrayRemove(enrollment),
    });
  } catch (err) {
    console.error("removeCandidateFromExam failed:", err);
    throw err;
  }
}

export function isUserEnrolledInExam(exam: Exam, uid: string): boolean {
  return exam.enrolledCandidates.some((e) => e.uid === uid);
}

/* ========================================================================== */
/* Phase Computation for Candidates                                            */
/* ========================================================================== */

export function computeExamPhase(
  exam: Exam,
  uid: string | null | undefined,
  now: Date = new Date()
): ExamPhase {
  if (!uid || !isUserEnrolledInExam(exam, uid)) return "not_enrolled";

  const rawStatus = String(exam.status || "").toLowerCase().trim();
  if (rawStatus === "cancelled" || rawStatus === "canceled") return "cancelled";
  if (rawStatus === "archived") return "completed";
  if (exam.isCompleted || exam.submittedAt) return "completed";

  const start = new Date(exam.examDateTime).getTime();
  if (isNaN(start)) return "scheduled";
  const end = start + (Number(exam.durationMinutes) || 60) * 60 * 1000;
  const t = now.getTime();

  if (t < start) return "scheduled";
  if (t >= start && t <= end) return "in_progress";
  return "completed";
}

/* ========================================================================== */
/* Live subscription                                                          */
/* ========================================================================== */

export function subscribeToExams(callback: (exams: Exam[]) => void): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    callback([]);
    return () => {};
  }
  const ref = collection(db, "exams");
  let unsub: Unsubscribe = () => {};

  const handle = (snap: QuerySnapshot<DocumentData>) => {
    callback(snap.docs.map((d) => mapExamDoc(d.id, d.data())));
  };

  try {
    unsub = onSnapshot(
      query(ref, orderBy("examDateTime", "desc")),
      handle,
      () => {
        unsub = onSnapshot(ref, handle, () => callback([]));
      }
    );
  } catch {
    unsub = onSnapshot(ref, handle, () => callback([]));
  }
  return () => unsub();
}

export function subscribeToExam(
  id: string,
  callback: (exam: Exam | null) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    callback(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, "exams", id),
    (snap) => {
      callback(snap.exists() ? mapExamDoc(snap.id, snap.data()) : null);
    },
    (err) => {
      console.warn(`subscribeToExam(${id}) error:`, err);
      callback(null);
    }
  );
}
