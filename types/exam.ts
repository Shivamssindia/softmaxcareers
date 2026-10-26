// src/types/exam.ts

export interface ExamEnrollment {
  uid: string;
  enrolledAt: string;
  enrolledBy?: string;
}

export type ExamStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "completed"
  | "archived"
  | "cancelled";

export interface Exam {
  id: string;
  examName: string;
  examDateTime: string;      // ISO start
  durationMinutes: number;   // end = start + duration
  examResourceLink: string;  // iframe src (Google Form / Quiz)
  maxViolations: number;
  description?: string;
  instructions?: string;
  status: ExamStatus;
  enrolledCandidates: ExamEnrollment[];
  isCompleted?: boolean;     // manual completion flag
  submittedAt?: string;      // submission timestamp
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

export type ExamPhase =
  | "not_enrolled"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "locked"
  | "not_started_yet"
  | "cancelled";

export interface ExamLockRecord {
  locked: boolean;
  violations: number;
  reason: string;
  lockedAt: string;
}

export type UserExamLocks = Record<string, ExamLockRecord>;
