// src/app/candidate/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useJobs } from "@/context/JobContext";
import { useModal } from "@/context/ModalContext";
import {
  ApplicationStatus,
  JobApplication,
  User,
  isProfileComplete,
  getMissingProfileFields,
} from "@/types";
import { CompleteProfileForm } from "@/components/CompleteProfileForm";
import {
  Briefcase,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  Search,
  Eye,
  X,
  Ban,
  PartyPopper,
  Sparkles,
  Info,
  Download,
  GraduationCap,
  Lock,
  Timer,
  Calendar,
  PlayCircle,
  XCircle,
} from "lucide-react";
import { CandidateCelebrationModal } from "@/components/CandidateCelebrationModal";
import {
  ResumeViewerModal,
  downloadResumeFile,
} from "@/components/ResumeViewerModal";
import {
  subscribeToExams,
  computeExamPhase,
  isUserEnrolledInExam,
} from "@/lib/firestore/exams";
import { getUserFromFirestore } from "@/lib/firestore";
import { Exam, ExamPhase, ExamLockRecord } from "@/types/exam";

/* ========================================================================== */
/* Exam types / helpers                                                       */
/* ========================================================================== */

interface UserLockMap {
  [examId: string]: ExamLockRecord;
}

type CandidateExamRow = {
  exam: Exam;
  phase: ExamPhase;
  lock: ExamLockRecord | null;
};

function phaseBadge(phase: ExamPhase) {
  switch (phase) {
    case "in_progress":
      return {
        label: "Live Now",
        cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40",
        icon: <PlayCircle className="w-3.5 h-3.5" />,
      };
    case "scheduled":
      return {
        label: "Scheduled",
        cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/40",
        icon: <Calendar className="w-3.5 h-3.5" />,
      };
    case "completed":
      return {
        label: "Completed",
        cls: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      };
    case "locked":
      return {
        label: "Locked",
        cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40",
        icon: <Lock className="w-3.5 h-3.5" />,
      };
    case "cancelled":
      return {
        label: "Cancelled",
        cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40",
        icon: <XCircle className="w-3.5 h-3.5" />,
      };
    case "not_enrolled":
    default:
      return {
        label: "Not Enrolled",
        cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40",
        icon: <AlertCircle className="w-3.5 h-3.5" />,
      };
  }
}

function formatCountdown(targetIso: string): string {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return "Starting now…";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${d > 0 ? `${d}d ` : ""}${String(h).padStart(2, "0")}h ${String(
    m
  ).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

/* ========================================================================== */
/* Page                                                                       */
/* ========================================================================== */

export default function CandidateConsolePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { jobs, applications, updateApplicationStatus } = useJobs();
  const { showAlert, showConfirm } = useModal();
  const [cancellingAppId, setCancellingAppId] = useState<string | null>(null);
  const [showCelebrationModal, setShowCelebrationModal] = useState<boolean>(false);

  /* ---- Resume viewer ---- */
  const [resumeModalData, setResumeModalData] = useState<{
    isOpen: boolean;
    resumeUrl?: string | null;
    fileName?: string | null;
    candidateName?: string | null;
    jobTitle?: string | null;
    candidateEmail?: string | null;
  }>({ isOpen: false });

  const openResumeViewer = (data: {
    resumeUrl?: string | null;
    fileName?: string | null;
    candidateName?: string | null;
    jobTitle?: string | null;
    candidateEmail?: string | null;
  }) => {
    setResumeModalData({ isOpen: true, ...data });
  };

  /* ====================================================================== */
  /* EXAMS — state                                                          */
  /* ====================================================================== */

  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [userLocks, setUserLocks] = useState<UserLockMap>({});
  const [examsLoading, setExamsLoading] = useState<boolean>(true);
  const [examsTick, setExamsTick] = useState<number>(0); // 1s tick for countdown

  /* ====================================================================== */
  /* Route protection                                                       */
  /* ====================================================================== */

  useEffect(() => {
    if (
      !loading &&
      (!user || (user.role !== "candidate" && user.role !== "admin"))
    ) {
      router.replace("/");
    }
  }, [user, loading, router]);

  /* ====================================================================== */
  /* Live exams subscription                                                */
  /* ====================================================================== */

  useEffect(() => {
    if (!user) return;
    setExamsLoading(true);
    const unsub = subscribeToExams((list) => {
      setAllExams(list);
      setExamsLoading(false);
    });
    return () => unsub();
  }, [user]);

  /* ====================================================================== */
  /* Load user's exam locks from Firestore                                  */
  /* ====================================================================== */

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const profile = await getUserFromFirestore(user.uid);
        const map: UserLockMap = (profile as any)?.lockedExams || {};
        setUserLocks(map);
      } catch (e) {
        console.warn("Could not load exam locks:", e);
      }
    })();
  }, [user]);

  /* ====================================================================== */
  /* 1s tick — keeps countdowns + phases in sync with the wall clock        */
  /* ====================================================================== */

  useEffect(() => {
    const t = setInterval(() => setExamsTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  /* ====================================================================== */
  /* Derived candidate exams (enrolled only)                                */
  /* ====================================================================== */

  const myExams: CandidateExamRow[] = useMemo(() => {
    if (!user || !allExams.length) return [];
    const rows: CandidateExamRow[] = [];

    for (const exam of allExams) {
      if (!isUserEnrolledInExam(exam, user.uid)) continue;

      const lock = userLocks[exam.id] || null;
      let phase: ExamPhase;
      if (lock && lock.locked) {
        phase = "locked";
      } else {
        phase = computeExamPhase(exam, user.uid);
      }
      rows.push({ exam, phase, lock });
    }

    // Sort: in_progress → scheduled (nearest first) → locked → completed
    const order: Record<ExamPhase, number> = {
      in_progress: 0,
      scheduled: 1,
      locked: 2,
      completed: 3,
      not_enrolled: 4,
      not_started_yet: 5,
      cancelled: 6,
    };

    rows.sort((a, b) => {
      if (order[a.phase] !== order[b.phase]) {
        return order[a.phase] - order[b.phase];
      }
      return (
        new Date(a.exam.examDateTime).getTime() -
        new Date(b.exam.examDateTime).getTime()
      );
    });

    return rows;
    // examsTick keeps this memo recomputing every second
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allExams, user, userLocks, examsTick]);

  const examStats = useMemo(() => {
    return {
      total: myExams.length,
      live: myExams.filter((r) => r.phase === "in_progress").length,
      upcoming: myExams.filter((r) => r.phase === "scheduled").length,
      completed: myExams.filter((r) => r.phase === "completed").length,
    };
  }, [myExams]);

  /* ====================================================================== */
  /* Applications                                                           */
  /* ====================================================================== */

  const candidateEmail = user?.email || "";
  const displayApplications = applications.filter(
    (app) =>
      Boolean(user?.uid && app.uid === user.uid) ||
      Boolean(
        candidateEmail &&
          (app as any).candidateEmail?.toLowerCase() ===
            candidateEmail.toLowerCase()
      ) ||
      Boolean(
        user?.name &&
          (app as any).candidateName?.toLowerCase() === user.name.toLowerCase()
      )
  );

  const [selectedApp, setSelectedApp] = useState<
    (JobApplication & Record<string, any>) | null
  >(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const normalizeStatus = (status?: string): ApplicationStatus => {
    if (status === "Approved" || status === "Offer Extended") return "Approved";
    if (status === "Rejected") return "Rejected";
    if (status === "Cancelled" || status === "Canceled") return "Cancelled";
    return "Pending";
  };

  const getStatusBadge = (status: ApplicationStatus | string) => {
    const st = normalizeStatus(status);
    switch (st) {
      case "Pending":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40";
      case "Approved":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40";
      case "Rejected":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40";
      case "Cancelled":
        return "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
      default:
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40";
    }
  };

  const handleCancelApplication = async (
    app: JobApplication & Record<string, any>
  ) => {
    const roleTitle =
      (app as any).jobTitle ||
      jobs.find((j) => j.id === app.jobId)?.title ||
      "this role";

    const confirmed = await showConfirm(
      `Are you sure you want to cancel your application for "${roleTitle}"?\n\nOnce cancelled, this application will be marked as Cancelled and you will be eligible to apply for another opening.`,
      "Cancel Application?",
      {
        type: "danger",
        confirmText: "Yes, Cancel Application",
        cancelText: "Keep Application",
      }
    );

    if (!confirmed) return;

    setCancellingAppId(app.id);
    try {
      await updateApplicationStatus(
        app.id,
        "Cancelled",
        "Cancelled by candidate"
      );
      if (selectedApp && selectedApp.id === app.id) {
        setSelectedApp({ ...selectedApp, status: "Cancelled" });
      }
      await showAlert(
        `Your application for "${roleTitle}" has been cancelled successfully. You are now free to submit an application for another position.`,
        "Application Cancelled",
        "success"
      );
    } catch (err: any) {
      await showAlert(
        err?.message || "Failed to cancel application. Please try again.",
        "Error",
        "error"
      );
    } finally {
      setCancellingAppId(null);
    }
  };

  const filteredApps = displayApplications.filter((app) =>
    statusFilter === "all" ? true : normalizeStatus(app.status) === statusFilter
  );

  const pendingCount = displayApplications.filter(
    (a) => normalizeStatus(a.status) === "Pending"
  ).length;
  const approvedCount = displayApplications.filter(
    (a) => normalizeStatus(a.status) === "Approved"
  ).length;
  const cancelledCount = displayApplications.filter(
    (a) => normalizeStatus(a.status) === "Cancelled"
  ).length;

  const approvedApp = displayApplications.find(
    (a) => normalizeStatus(a.status) === "Approved"
  );

  useEffect(() => {
    if (approvedApp && typeof window !== "undefined") {
      const storageKey = `softmax_celebrated_${
        user?.uid || candidateEmail || "candidate"
      }_${approvedApp.id}`;
      const alreadyShown = localStorage.getItem(storageKey);
      if (!alreadyShown) {
        setShowCelebrationModal(true);
        try {
          localStorage.setItem(storageKey, "true");
        } catch (e) {
          console.warn("Could not write celebration state to localStorage", e);
        }
      }
    }
  }, [approvedApp, user?.uid, candidateEmail]);

  const handleCloseCelebrationModal = () => {
    if (approvedApp && typeof window !== "undefined") {
      const storageKey = `softmax_celebrated_${
        user?.uid || candidateEmail || "candidate"
      }_${approvedApp.id}`;
      try {
        localStorage.setItem(storageKey, "true");
      } catch (e) {}
    }
    setShowCelebrationModal(false);
  };

  /* ====================================================================== */
  /* Loading guard                                                          */
  /* ====================================================================== */

  if (loading || !user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500">Verifying authorization...</p>
      </div>
    );
  }

  /* ====================================================================== */
  /* Profile completion guard                                               */
  /* ====================================================================== */

  if (user.role !== "admin" && !isProfileComplete(user)) {
    const missingFields = getMissingProfileFields(user);
    return (
      <div className="max-w-3xl mx-auto py-10 sm:py-16 px-4 sm:px-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start gap-3.5 shadow-sm"
        >
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="font-bold text-sm sm:text-base text-amber-900 dark:text-amber-100">
              Profile Details Missing
            </h2>
            <p className="text-amber-800 dark:text-amber-300">
              Your profile is currently missing some required information. Please
              complete the profile form below to access your candidate console
              and manage your job applications.
            </p>
            {missingFields.length > 0 && (
              <div className="pt-1.5 flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  Missing information:
                </span>
                {missingFields.map((field) => (
                  <span
                    key={field}
                    className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60"
                  >
                    {field}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        <CompleteProfileForm
          user={user}
          onCompleted={() => {
            router.refresh();
          }}
        />
      </div>
    );
  }

  /* ====================================================================== */
  /* Main render                                                            */
  /* ====================================================================== */

  return (
    <div className="max-w-6xl mx-auto py-10 sm:py-14 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Candidate Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track applications and take your scheduled exams.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start">
          {(user?.resumeUrl || (user as any)?.resumeData) && (
            <button
              type="button"
              onClick={() =>
                openResumeViewer({
                  resumeUrl: user.resumeUrl || (user as any).resumeData,
                  fileName:
                    user.resumeFileName ||
                    `${user.name || "Candidate"} - Resume.pdf`,
                  candidateName: user.name || (user as any)?.displayName || "Candidate",
                  jobTitle: user.title || "Profile Resume",
                  candidateEmail: user.email,
                })
              }
              className="px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-xs"
              title="Open your profile resume in window"
            >
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>My Resume</span>
            </button>
          )}

          <Link
            href="/openings"
            className="ui-btn-primary text-xs font-semibold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            <Briefcase className="w-4 h-4" />
            <span>Browse More Roles</span>
          </Link>
        </div>
      </motion.div>

      {/* ---------------------------------------------------------------- */}
      {/* Quick Stats Grid (applications + exams combined)                 */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
        >
          <div className="text-xs font-semibold text-slate-500 uppercase">
            Total Applications
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {displayApplications.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Submitted in portal</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="p-5 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20 shadow-sm"
        >
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase">
            Under Review
          </div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-300 mt-1">
            {pendingCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Pending recruiter decision
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="p-5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm"
        >
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
            Approved
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-300 mt-1">
            {approvedCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Shortlisted / Offers</div>
        </motion.div>

        {/* NEW: Exams card replaces the previous Cancelled card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="p-5 rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-sm"
        >
          <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase inline-flex items-center gap-1">
            <GraduationCap className="w-3 h-3" />
            My Exams
          </div>
          <div className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-1">
            {examStats.total}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {examStats.live} live · {examStats.upcoming} upcoming
          </div>
        </motion.div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* MY EXAMS SECTION                                                 */}
      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            My Exams
          </h2>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800/60">
            {myExams.length}
          </span>
        </div>

        {examsLoading ? (
          <div className="p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading exams…</p>
          </div>
        ) : myExams.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <GraduationCap className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No exams assigned yet
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You'll see your scheduled exams here once a recruiter enrolls you.
            </p>
          </div>
        ) : (
          <motion.div layout className="space-y-3">
            <AnimatePresence mode="popLayout">
              {myExams.map(({ exam, phase, lock }) => {
                const badge = phaseBadge(phase);
                const start = new Date(exam.examDateTime);
                const end = new Date(
                  start.getTime() + exam.durationMinutes * 60000
                );
                const isClickable = phase !== "not_enrolled" && phase !== "cancelled";
                const countdown =
                  phase === "scheduled" ? formatCountdown(exam.examDateTime) : null;

                return (
                  <motion.div
                    key={exam.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.25 }}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                            {exam.examName}
                          </h3>
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${badge.cls}`}
                          >
                            {badge.icon}
                            {badge.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1.5 leading-relaxed mb-4 line-clamp-1 class-leadaxed md-4">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {start.toLocaleString()}
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            {exam.durationMinutes} min
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Max {exam.maxViolations} violations
                          </span>
                        </div>

                        {phase === "scheduled" && countdown && (
                          <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-700 dark:text-indigo-300 font-semibold">
                            <Clock className="w-3.5 h-3.5" />
                            Starts in {countdown}
                          </div>
                        )}

                        {phase === "locked" && lock && (
                          <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 font-semibold">
                            <Lock className="w-3.5 h-3.5" />
                            Locked — {lock.reason || "Policy violation"}
                          </div>
                        )}

                        {phase === "cancelled" && (
                          <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 font-semibold">
                            <XCircle className="w-3.5 h-3.5" />
                            Cancelled by Administrator
                          </div>
                        )}

                        {phase === "completed" && (
                          <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Ended {end.toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isClickable ? (
                          <Link
                            href={`/exam/${exam.id}`}
                            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition hover:scale-[1.02] active:scale-[0.98] ${
                              phase === "in_progress"
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                : phase === "locked"
                                ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/50"
                                : "ui-btn-secondary"
                            }`}
                          >
                            {phase === "in_progress" ? (
                              <>
                                <PlayCircle className="w-3.5 h-3.5" />
                                <span>Enter Exam</span>
                              </>
                            ) : phase === "locked" ? (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>View Details</span>
                              </>
                            ) : phase === "scheduled" ? (
                              <>
                                <Clock className="w-3.5 h-3.5" />
                                <span>View Schedule</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Overview</span>
                              </>
                            )}
                            <ChevronRight className="w-3 h-3 opacity-60" />
                          </Link>
                        ) : phase === "cancelled" ? (
                          <span className="text-xs text-rose-600 dark:text-rose-400 font-medium px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40">
                            Exam Cancelled
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Not enrolled
                          </span>
                        )}
                      </div>
                    </div>

                    {exam.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                        {exam.description}
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* EXISTING: Applications section                                   */}
      {/* ---------------------------------------------------------------- */}

      {/* Pending under review banner */}
      {pendingCount > 0 && (
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-200">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <span className="font-bold">Application Under Review:</span> You
            currently have a role application pending recruiter evaluation.
            Candidates may only apply for one role at a time. If this application
            is cancelled or rejected, you will be eligible to apply for a new
            role.
          </div>
        </div>
      )}

      {displayApplications.length > 0 &&
        pendingCount === 0 &&
        approvedCount === 0 && (
          <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-900 dark:text-indigo-200">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              <div>
                <span className="font-bold">Eligible for New Roles:</span> Your
                previous application was closed, rejected, or cancelled. You are
                now eligible to apply for a new position at SoftMax.
              </div>
            </div>
            <Link
              href="/openings"
              className="ui-btn-primary px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto flex-shrink-0"
            >
              <span>Browse Openings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit overflow-x-auto">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            statusFilter === "all"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          All ({displayApplications.length})
        </button>
        <button
          onClick={() => setStatusFilter("Pending")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            statusFilter === "Pending"
              ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setStatusFilter("Approved")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            statusFilter === "Approved"
              ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Approved ({approvedCount})
        </button>
        <button
          onClick={() => setStatusFilter("Cancelled")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            statusFilter === "Cancelled"
              ? "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 shadow-sm font-bold"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Cancelled ({cancelledCount})
        </button>
      </div>

      {/* Application cards */}
      {filteredApps.length > 0 ? (
        <motion.div layout className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredApps.map((app) => {
              const appResume =
                (app as any).resumeUrl ||
                (app as any).resumeDataUrl ||
                user?.resumeUrl ||
                (user as any)?.resumeData ||
                null;
              const appResumeName =
                (app as any).resumeFileName ||
                user?.resumeFileName ||
                "Candidate Resume.pdf";

              return (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {(app as any).jobTitle ||
                            jobs.find((j) => j.id === app.jobId)?.title ||
                            "Job Application"}
                        </h3>
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                            app.status
                          )}`}
                        >
                          {normalizeStatus(app.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 leading-relaxed mb-4 line-clamp-1 class-leadaxed md-4">
                        <span>Ref: #{app.id}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Applied:{" "}
                          {app.appliedAt
                            ? new Date(app.appliedAt).toLocaleDateString()
                            : "Recent"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedApp(app)}
                        className="ui-btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 hover:scale-105 active:scale-95 transition-transform"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Submission</span>
                      </button>

                      {appResume && (
                        <button
                          type="button"
                          onClick={() =>
                            openResumeViewer({
                              resumeUrl: appResume,
                              fileName: appResumeName,
                              candidateName:
                                (app as any).candidateName ||
                                user?.name ||
                                (user as any)?.displayName ||
                                "Candidate",
                              jobTitle:
                                (app as any).jobTitle ||
                                jobs.find((j) => j.id === app.jobId)?.title ||
                                "Role Application",
                              candidateEmail: user?.email,
                            })
                          }
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform shadow-xs"
                          title="Open resume window"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Resume</span>
                        </button>
                      )}

                      {normalizeStatus(app.status) === "Pending" && (
                        <button
                          type="button"
                          disabled={cancellingAppId === app.id}
                          onClick={() => handleCancelApplication(app)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/40 inline-flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                          title="Cancel this application"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>
                            {cancellingAppId === app.id
                              ? "Cancelling..."
                              : "Cancel"}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {app.feedback && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-white block mb-0.5">
                        Hiring Team Notes:
                      </strong>
                      {app.feedback}
                    </div>
                  )}

                  {normalizeStatus(app.status) === "Approved" && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-indigo-50/30 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-indigo-950/30 border-2 border-emerald-300 dark:border-emerald-700/60 shadow-sm space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/70 text-emerald-600 dark:text-emerald-300 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                              <span>Application Approved by Hiring Team!</span>
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                                Active
                              </span>
                            </div>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                              Your profile has been accepted. Continue to the
                              SoftMax Nexus platform for onboarding.
                            </p>
                          </div>
                        </div>
                        <a
                          href="https://nexus.softmax.in"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition hover:scale-[1.02] active:scale-[0.98] self-start sm:self-auto flex-shrink-0"
                        >
                          <span>Open nexus.softmax.in</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-100/70 dark:bg-emerald-900/40 border border-emerald-300/80 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2.5">
                        <Info className="w-4 h-4 text-emerald-700 dark:text-emerald-300 flex-shrink-0" />
                        <div>
                          <span className="font-bold">Login Instruction:</span>{" "}
                          Please log in to{" "}
                          <a
                            href="https://nexus.softmax.in"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold underline hover:text-emerald-950 dark:hover:text-white"
                          >
                            nexus.softmax.in
                          </a>{" "}
                          using your same ID:{" "}
                          <strong className="underline decoration-emerald-500 font-bold">
                            {user?.email ||
                              (app as any).candidateEmail ||
                              candidateEmail}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
        >
          <Briefcase className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No applications found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You haven&apos;t submitted any applications under this filter yet.
            Explore current openings to apply!
          </p>
          <Link
            href="/openings"
            className="ui-btn-primary px-4 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform"
          >
            <span>Explore Open Roles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Application Details Modal (unchanged)                            */}
      {/* ---------------------------------------------------------------- */}
      <AnimatePresence>
        {selectedApp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 text-slate-900 dark:text-white space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setSelectedApp(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                    selectedApp.status
                  )}`}
                >
                  {normalizeStatus(selectedApp.status)}
                </span>
                <span className="text-xs text-slate-400">
                  Ref: #{selectedApp.id}
                </span>
              </div>

              <h2 className="text-xl font-bold">
                {selectedApp.jobTitle ||
                  jobs.find((j) => j.id === selectedApp.jobId)?.title ||
                  "Role Application"}
              </h2>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                  <div>
                    <span className="text-slate-400 block">Candidate:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {selectedApp.candidateName || user?.name || "Candidate"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Email:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {selectedApp.candidateEmail || user?.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Phone:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {selectedApp.candidatePhone || user?.phone || "Not specified"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Experience:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {selectedApp.experienceYears}
                    </span>
                  </div>
                </div>

                {(user?.portfolioUrl || (selectedApp as any).portfolioUrl) && (
                  <div>
                    <span className="text-slate-400 block mb-0.5">Portfolio:</span>
                    <a
                      href={
                        user?.portfolioUrl || (selectedApp as any).portfolioUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>
                        {user?.portfolioUrl || (selectedApp as any).portfolioUrl}
                      </span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                <div>
                  <span className="text-slate-400 block mb-0.5">
                    Cover Note:
                  </span>
                  <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 leading-relaxed">
                    {selectedApp.description}
                  </p>
                </div>

                {(() => {
                  const modalResumeUrl =
                    (selectedApp as any).resumeUrl ||
                    (selectedApp as any).resumeDataUrl ||
                    user?.resumeUrl ||
                    (user as any)?.resumeData;
                  const modalResumeName =
                    (selectedApp as any).resumeFileName ||
                    user?.resumeFileName ||
                    "Candidate Resume.pdf";

                  if (!modalResumeUrl) return null;

                  return (
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <span className="font-semibold text-slate-900 dark:text-white truncate block text-xs">
                            {modalResumeName}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {(selectedApp as any).resumeFileName
                              ? "Attached directly to this application"
                              : "Linked via Candidate Profile"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            openResumeViewer({
                              resumeUrl: modalResumeUrl,
                              fileName: modalResumeName,
                              candidateName:
                                selectedApp.candidateName ||
                                user?.name ||
                                "Candidate",
                              jobTitle:
                                selectedApp.jobTitle ||
                                jobs.find((j) => j.id === selectedApp.jobId)
                                  ?.title,
                              candidateEmail: user?.email,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition shadow-sm hover:scale-105 active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Resume</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            downloadResumeFile(modalResumeUrl, modalResumeName)
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold inline-flex items-center gap-1 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {normalizeStatus(selectedApp.status) === "Approved" && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-indigo-50/30 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-indigo-950/30 border border-emerald-300 dark:border-emerald-700/60 shadow-sm space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                          Application Approved!
                        </div>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          Welcome to SoftMax. Continue to nexus.softmax.in for
                          onboarding resources.
                        </p>
                      </div>
                    </div>
                    <a
                      href="https://nexus.softmax.in"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition hover:scale-105 active:scale-95 flex-shrink-0"
                    >
                      <span>Open nexus.softmax.in</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-100/70 dark:bg-emerald-900/40 text-[11px] text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300 flex-shrink-0" />
                    <span>
                      <strong className="font-bold">Login Instruction:</strong>{" "}
                      Please log in to <strong>nexus.softmax.in</strong> with
                      your same ID:{" "}
                      <span className="font-bold underline">
                        {user?.email ||
                          selectedApp.candidateEmail ||
                          candidateEmail}
                      </span>
                      .
                    </span>
                  </div>
                </div>
              )}

              {normalizeStatus(selectedApp.status) === "Cancelled" && (
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-3 shadow-sm">
                  <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
                    <Ban className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Application Cancelled
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      This application was cancelled. You are eligible to explore
                      and apply for other open roles at SoftMax.
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                {normalizeStatus(selectedApp.status) === "Pending" ? (
                  <button
                    type="button"
                    disabled={cancellingAppId === selectedApp.id}
                    onClick={() => handleCancelApplication(selectedApp)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/40 inline-flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>
                      {cancellingAppId === selectedApp.id
                        ? "Cancelling..."
                        : "Cancel Application"}
                    </span>
                  </button>
                ) : (
                  <div />
                )}

                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="ui-btn-secondary px-4 py-2 text-xs font-semibold rounded-lg hover:scale-105 active:scale-95 transition-transform"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Celebration modal */}
      <CandidateCelebrationModal
        isOpen={showCelebrationModal}
        onClose={handleCloseCelebrationModal}
        candidateName={
          user?.name || (approvedApp as any)?.candidateName || "Candidate"
        }
        candidateEmail={
          user?.email || (approvedApp as any)?.candidateEmail || candidateEmail
        }
        jobTitle={
          (approvedApp as any)?.jobTitle ||
          jobs.find((j) => j.id === approvedApp?.jobId)?.title ||
          "SoftMax Role"
        }
        applicationId={approvedApp?.id}
      />

      {/* Resume viewer */}
      <ResumeViewerModal
        isOpen={resumeModalData.isOpen}
        onClose={() =>
          setResumeModalData((prev) => ({ ...prev, isOpen: false }))
        }
        resumeUrl={resumeModalData.resumeUrl}
        fileName={resumeModalData.fileName}
        candidateName={resumeModalData.candidateName}
        jobTitle={resumeModalData.jobTitle}
        candidateEmail={resumeModalData.candidateEmail}
      />
    </div>
  );
}