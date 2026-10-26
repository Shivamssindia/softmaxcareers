"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useJobs } from "@/context/JobContext";
import { useAuth } from "@/context/AuthContext";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  ArrowRight,
  User,
  Mail,
  Phone,
  Globe,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  DollarSign,
  Sparkles,
  Lock,
  UploadCloud,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { getJobSlug, findJobBySlugOrId } from "@/lib/slug";
import { uploadResume } from "@/lib/resumeStorage";
import { isProfileComplete, getMissingProfileFields } from "@/types";
import { CompleteProfileForm } from "@/components/CompleteProfileForm";

interface DynamicApplyFormProps {
  initialJobIdentifier?: string;
  initialJobId?: string;
}

export const DynamicApplyForm: React.FC<DynamicApplyFormProps> = ({
  initialJobIdentifier,
  initialJobId,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryJob =
    searchParams.get("jobName") || searchParams.get("jobId") || "";
  const effectiveIdentifier = initialJobIdentifier || initialJobId || queryJob;

  const { jobs, applyForJob, getJobById, getCandidateApplications } = useJobs();
  const { user, loading: authLoading, updateUserProfile } = useAuth();

  // One-Role Rule:
  // Candidate can apply for only one role. If rejected, they can apply for a new role.
  // If their application is Pending or Approved, they cannot apply for a new role.
  const candidateApps = user ? getCandidateApplications(user.uid) : [];
  const blockingApp = candidateApps.find((app) => {
    const s = String(app.status || "").toLowerCase();
    return s === "pending" || s === "approved" || s === "offer extended";
  });
  const blockingJob = blockingApp ? getJobById(blockingApp.jobId) : undefined;
  const blockingJobTitle =
    (blockingApp as any)?.jobTitle || blockingJob?.title || "an existing role";

  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [experienceYears, setExperienceYears] = useState<string>("3 - 5 Years");
  const [description, setDescription] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAppId, setSubmittedAppId] = useState<string | null>(null);
  const [showRoleDetails, setShowRoleDetails] = useState(true);

  // Resume Upload State (Saved strictly to user's profile document)
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeUploadSuccess, setResumeUploadSuccess] = useState<string | null>(
    null
  );
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(
    null
  );

  const handleFormResumeUpload = async (file: File) => {
    if (!user) {
      setResumeUploadError("Please sign in to upload your resume.");
      return;
    }

    // Validate file type
    const isAcceptable = /\.(pdf|docx?)$/i.test(file.name);
    if (!isAcceptable) {
      setResumeUploadError("Please upload a PDF, DOC, or DOCX file.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setResumeUploadError("Resume exceeds 20MB limit.");
      return;
    }

    setResumeUploading(true);
    setResumeUploadError(null);
    setResumeUploadSuccess(null);

    try {
      // uploadResume internally:
      //   1. utilizeDocument(file)   → compress 5MB → ~300KB
      //   2. uploadResumeToGoogleDrive(utilizedFile, uid)
      //   3. updateUserInFirestore(uid, { resumeUrl })
      const result = await uploadResume(user.uid, file);

      // Sync auth context state so the UI updates immediately
      await updateUserProfile({
        resumeUrl: result.url,
      });

      // Build a message that surfaces compression savings
      const { utilization } = result;
      const savingsText =
        utilization.status === "utilized"
          ? ` (optimized ${utilization.originalSizeFormatted} → ${utilization.utilizedSizeFormatted}, ${utilization.savingsPercent}% saved)`
          : "";

      setResumeUploadSuccess(
        `"${file.name}" saved to your profile & attached to this application${savingsText}.`
      );
      setTimeout(() => setResumeUploadSuccess(null), 6000);
    } catch (err: any) {
      console.error("handleFormResumeUpload error:", err);
      setResumeUploadError(err?.message || "Failed to upload resume to profile.");
    } finally {
      setResumeUploading(false);
    }
  };

  // Sync selected job with URL identifier (slug, title, or id)
  useEffect(() => {
    if (jobs.length > 0) {
      if (effectiveIdentifier) {
        const matched = findJobBySlugOrId(effectiveIdentifier, jobs);
        if (matched) {
          setSelectedJobId(matched.id);
          return;
        }
      }
      if (!selectedJobId) {
        const firstActive = jobs.find((j) => j.status === "active") || jobs[0];
        if (firstActive) setSelectedJobId(firstActive.id);
      }
    }
  }, [effectiveIdentifier, jobs, selectedJobId]);

  // Retrieve dynamically selected job
  const selectedJob =
    getJobById(selectedJobId) ||
    jobs.find((j) => j.id === selectedJobId) ||
    (effectiveIdentifier ? findJobBySlugOrId(effectiveIdentifier, jobs) : undefined) ||
    jobs[0];

  // Authentication Guard: Redirect to /auth if unauthenticated
  useEffect(() => {
    if (!authLoading && !user) {
      const slug = selectedJob
        ? getJobSlug(selectedJob)
        : effectiveIdentifier
        ? getJobSlug(effectiveIdentifier)
        : "";
      const targetPath = slug ? `/apply/${slug}` : "/apply";
      router.replace(`/auth?redirect=${encodeURIComponent(targetPath)}`);
    }
  }, [user, authLoading, selectedJob, effectiveIdentifier, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError("Please sign in to submit your application.");
      router.push("/auth");
      return;
    }

    if (selectedJob && selectedJob.status === "closed") {
      setError("This job opening is closed and is no longer accepting new applications.");
      return;
    }

    if (blockingApp) {
      const isApproved =
        blockingApp.status === "Approved" ||
        String(blockingApp.status).toLowerCase() === "approved";
      setError(
        `You cannot apply for a new role while your application for "${blockingJobTitle}" is ${
          isApproved ? "Approved" : "Pending"
        }. Candidates may only apply for a new role if their previous application was Rejected.`
      );
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      setError(
        "Please provide a brief background or note (at least 10 characters)."
      );
      return;
    }

    // Block submission while resume is still uploading
    if (resumeUploading) {
      setError(
        "Your resume is still uploading. Please wait a moment before submitting."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const appId = await applyForJob({
        jobId: selectedJob ? selectedJob.id : selectedJobId || "general-pool",
        uid: user.uid,
        experienceYears,
        description: description.trim(),
        resumeUrl: user.resumeUrl,
        resumeFileName: user.resumeUrl ? "Candidate Resume" : undefined,
      } as any);

      setSubmittedAppId(appId);
    } catch (err: any) {
      setError(err?.message || "Failed to submit application. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auth Loading State
  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <img
          src="/logo.jpg"
          alt="SoftMax Logo"
          className="w-12 h-12 rounded-xl object-contain bg-white shadow-sm border border-slate-200 dark:border-slate-800 p-0.5 animate-pulse"
        />
        <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500">Checking authorization...</p>
      </div>
    );
  }

  // If unauthenticated, redirecting
  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          Sign In Required to Apply
        </p>
        <p className="text-xs text-slate-500">Redirecting to sign in...</p>
      </div>
    );
  }

  // Profile Completion Guard on Apply Portal:
  // If candidate has any data missing in user data, show complete profile form with redirect to application!
  if (user.role !== "admin" && !isProfileComplete(user)) {
    const slug = selectedJob
      ? getJobSlug(selectedJob)
      : effectiveIdentifier
      ? getJobSlug(effectiveIdentifier)
      : "";
    const redirectUrl = slug ? `/apply/${slug}` : "/apply";
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
              Complete Profile Required to Apply
            </h2>
            <p className="text-amber-800 dark:text-amber-300">
              Your candidate profile is currently missing some required details. Please complete the form below to proceed directly with your job application for{" "}
              <strong>{selectedJob?.title || "this position"}</strong>.
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
          redirectUrl={redirectUrl}
          onCompleted={() => {
            // Re-render once complete
            router.refresh();
          }}
        />
      </div>
    );
  }

  // SUCCESS CONFIRMATION STATE
  if (submittedAppId) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-xl mx-auto py-12 px-4 sm:px-6"
      >
        <div className="p-8 sm:p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-6">
          <img
            src="/logo.jpg"
            alt="SoftMax Logo"
            className="w-16 h-16 mx-auto rounded-2xl object-contain shadow-md bg-white p-1 border border-slate-200 dark:border-slate-800"
          />

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 20,
              delay: 0.15,
            }}
            className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto"
          >
            <CheckCircle2 className="w-8 h-8" />
          </motion.div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Application Submitted Successfully!
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Your application for{" "}
              <strong className="text-slate-900 dark:text-white">
                {selectedJob?.title || "SoftMax"}
              </strong>{" "}
              has been recorded in your candidate profile and sent to our hiring
              team.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div className="text-slate-500">Application Reference ID:</div>
            <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
              {submittedAppId}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href="/candidate"
              className="ui-btn-primary flex-1 py-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <Briefcase className="w-4 h-4" />
              <span>Track in Candidate Console</span>
            </Link>

            <Link
              href="/openings"
              className="ui-btn-secondary flex-1 py-3 text-xs font-semibold rounded-xl flex items-center justify-center hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <span>Browse More Jobs</span>
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  // ACTIVE APPLICATION RESTRICTION SCREEN
  if (blockingApp && !submittedAppId) {
    const isApproved =
      blockingApp.status === "Approved" ||
      String(blockingApp.status).toLowerCase() === "approved";

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-xl mx-auto py-12 px-4 sm:px-6"
      >
        <div className="p-8 sm:p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-6">
          <img
            src="/logo.jpg"
            alt="SoftMax Logo"
            className="w-16 h-16 mx-auto rounded-2xl object-contain shadow-md bg-white p-1 border border-slate-200 dark:border-slate-800"
          />

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 20,
              delay: 0.15,
            }}
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
              isApproved
                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
            }`}
          >
            {isApproved ? (
              <CheckCircle2 className="w-8 h-8" />
            ) : (
              <Clock className="w-8 h-8" />
            )}
          </motion.div>

          <div className="space-y-2">
            <span
              className={`inline-block text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${
                isApproved
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40"
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40"
              }`}
            >
              Application {isApproved ? "Approved" : "Under Review"}
            </span>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isApproved
                ? "Application Already Approved"
                : "Active Application in Progress"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {isApproved ? (
                <>
                  Your application for{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {blockingJobTitle}
                  </strong>{" "}
                  has been approved. Candidates with an approved application
                  cannot apply for additional roles.
                </>
              ) : (
                <>
                  You have an application currently{" "}
                  <strong className="text-amber-600 dark:text-amber-400">
                    Pending
                  </strong>{" "}
                  review for{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {blockingJobTitle}
                  </strong>
                  . Candidates may only apply for one role at a time. If this
                  application is rejected, you will be eligible to apply for a
                  new role.
                </>
              )}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div className="text-slate-500">Active Application Reference:</div>
            <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
              {blockingApp.id}
            </div>
            {blockingApp.appliedAt && (
              <div className="text-[11px] text-slate-400 pt-0.5">
                Applied on{" "}
                {new Date(blockingApp.appliedAt).toLocaleDateString(undefined, {
                  dateStyle: "medium",
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href="/candidate"
              className="ui-btn-primary flex-1 py-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <Briefcase className="w-4 h-4" />
              <span>View in Candidate Console</span>
            </Link>

            <Link
              href="/openings"
              className="ui-btn-secondary flex-1 py-3 text-xs font-semibold rounded-xl flex items-center justify-center hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <span>Explore Roles</span>
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="max-w-4xl mx-auto py-10 sm:py-14 px-4 sm:px-6 space-y-8"
    >
      {/* Top Banner with Company Logo */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <img
            src="/logo.jpg"
            alt="SoftMax Logo"
            className="w-14 h-14 rounded-2xl object-contain bg-white shadow-md border border-slate-200 dark:border-slate-800 p-1 flex-shrink-0"
          />
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold border border-indigo-100 dark:border-indigo-900/50 mb-1">
              <Sparkles className="w-3 h-3" />
              <span>Official SoftMax Job Application</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              {selectedJob ? selectedJob.title : "Apply for Job"}
            </h1>
            <p className="text-xs text-slate-500">
              Applying as{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {user.name || (user as any).displayName}
              </strong>{" "}
              ({user.email})
            </p>
          </div>
        </div>

        <Link
          href="/openings"
          className="ui-btn-secondary px-4 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 flex-shrink-0 hover:scale-[1.02] transition-transform"
        >
          <span>All Openings</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Dynamic Job Specifications Card */}
      {selectedJob && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-950/70 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  selectedJob.category === "Non-Tech"
                    ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300"
                }`}
              >
                {selectedJob.category} Role
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {selectedJob.department}
              </span>
              {selectedJob.status === "closed" && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                  Closed
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowRoleDetails(!showRoleDetails)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>
                {showRoleDetails
                  ? "Hide Role Overview"
                  : "View Role Overview & Requirements"}
              </span>
              {showRoleDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 block mb-0.5">Location</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                {selectedJob.location}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 block mb-0.5">Experience</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                {selectedJob.experience}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 block mb-0.5">Compensation</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                {selectedJob.salaryRange}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 block mb-0.5">Employment</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                {selectedJob.type}
              </span>
            </div>
          </div>

          {/* Collapsible Overview */}
          <AnimatePresence>
            {showRoleDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden pt-2 space-y-4 text-xs text-slate-600 dark:text-slate-300"
              >
                <p className="leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  {selectedJob.description}
                </p>

                {selectedJob.responsibilities &&
                  selectedJob.responsibilities.length > 0 && (
                    <div>
                      <h4 className="font-bold uppercase tracking-wider text-slate-400 mb-1.5 text-[11px]">
                        Key Responsibilities
                      </h4>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {selectedJob.responsibilities.map((resp, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                            <span>{resp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {selectedJob.tags && selectedJob.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedJob.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Application Form */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dynamic Role Switcher */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Applying for Role *
            </label>
            <select
              value={selectedJobId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedJobId(newId);
                const targetJob = jobs.find((j) => j.id === newId);
                if (targetJob) {
                  const slug = getJobSlug(targetJob);
                  window.history.replaceState(null, "", `/apply/${slug}`);
                } else {
                  window.history.replaceState(null, "", `/apply`);
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              {jobs
                .filter((j) => j.status === "active")
                .map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} — {job.department} ({job.type})
                  </option>
                ))}
              <option value="general-pool">
                General Open Application (All Roles)
              </option>
            </select>
          </div>

          {/* Authenticated Candidate Profile Info */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Applicant Information
              </div>
              <Link
                href="/profile"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Edit Profile
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {user.name || (user as any).displayName || "Candidate"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-slate-600 dark:text-slate-300 truncate">
                  {user.email}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-slate-600 dark:text-slate-300 truncate">
                  {user.phone || "No phone linked"}
                </span>
              </div>
              {user.portfolioUrl && (
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <a
                    href={user.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                  >
                    {user.portfolioUrl}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Years of Experience */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Years of Experience *
            </label>
            <select
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Fresher (0 - 1 Year)">
                Fresher / Entry Level (0 - 1 Year)
              </option>
              <option value="1 - 3 Years">1 - 3 Years</option>
              <option value="3 - 5 Years">3 - 5 Years (Mid Level)</option>
              <option value="5 - 8 Years">5 - 8 Years (Senior)</option>
              <option value="8+ Years">8+ Years (Lead / Architect)</option>
            </select>
          </div>

          {/* Cover note */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Why Are You a Good Fit for SoftMax? *
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about your background, relevant projects, tech stack, and what excites you about this role..."
              className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
            />
          </div>

          {/* Resume Upload (Saved Strictly to User's Profile Document) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Resume / Curriculum Vitae
              </label>
              <span className="text-[11px] text-slate-400">
                Attached to your candidate account
              </span>
            </div>

            <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 transition hover:border-indigo-400 dark:hover:border-indigo-500">
              <input
                id="apply-resume-input"
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                disabled={resumeUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFormResumeUpload(file);
                  e.target.value = "";
                }}
              />

              {user?.resumeUrl || (user as any)?.resumeData ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                        <span>Resume on Profile</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Your latest uploaded resume is active and linked to this
                        application.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={user?.resumeUrl || (user as any)?.resumeData}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition flex items-center gap-1"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      disabled={resumeUploading}
                      onClick={() =>
                        document.getElementById("apply-resume-input")?.click()
                      }
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {resumeUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Replace Resume</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-2">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    No resume uploaded to your profile yet
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    PDF, DOC, or DOCX (stored directly in your candidate account)
                  </p>
                  <button
                    type="button"
                    disabled={resumeUploading}
                    onClick={() =>
                      document.getElementById("apply-resume-input")?.click()
                    }
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
                  >
                    {resumeUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading to Profile...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4" />
                        <span>Upload Resume</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Upload Feedback */}
              {resumeUploadSuccess && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>{resumeUploadSuccess}</span>
                </div>
              )}
              {resumeUploadError && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>{resumeUploadError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || resumeUploading || selectedJob?.status === "closed"}
            className="ui-btn-primary w-full py-3.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] transition-transform"
          >
            {selectedJob?.status === "closed" ? (
              <span>Position Closed (Applications Disabled)</span>
            ) : isSubmitting ? (
              <span>Submitting Application...</span>
            ) : resumeUploading ? (
              <span>Waiting for resume upload...</span>
            ) : (
              <>
                <span>Submit Application to SoftMax</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </motion.div>
  );
};