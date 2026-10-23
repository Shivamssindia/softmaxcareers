"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useJobs } from "@/context/JobContext";
import { ApplicationStatus, JobApplication } from "@/types";
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
} from "lucide-react";

export default function CandidateConsolePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { jobs, applications } = useJobs();

  // Route protection
  useEffect(() => {
    if (!loading && (!user || (user.role !== "candidate" && user.role !== "admin"))) {
      router.replace("/");
    }
  }, [user, loading, router]);

  const candidateEmail = user?.email || "";
  const displayApplications = applications.filter(
    (app) =>
      Boolean(user?.uid && app.uid === user.uid) ||
      Boolean(candidateEmail && (app as any).candidateEmail?.toLowerCase() === candidateEmail.toLowerCase()) ||
      Boolean(user?.name && (app as any).candidateName?.toLowerCase() === user.name.toLowerCase())
  );

  const [selectedApp, setSelectedApp] = useState<(JobApplication & Record<string, any>) | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const normalizeStatus = (status?: string): ApplicationStatus => {
    if (status === "Approved" || status === "Offer Extended") return "Approved";
    if (status === "Rejected") return "Rejected";
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
      default:
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40";
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

  if (loading || !user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500">Verifying authorization...</p>
      </div>
    );
  }

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
            Track and manage your submitted applications for SoftMax careers.
          </p>
        </div>

        <Link
          href="/openings"
          className="ui-btn-primary text-xs font-semibold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 self-start hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          <Briefcase className="w-4 h-4" />
          <span>Browse More Roles</span>
        </Link>
      </motion.div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
        >
          <div className="text-xs font-semibold text-slate-500 uppercase">Total Applications</div>
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
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase">Under Review</div>
          <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-300 mt-1">
            {pendingCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Pending recruiter decision</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="p-5 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm"
        >
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Approved</div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-300 mt-1">
            {approvedCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Shortlisted / Offers</div>
        </motion.div>
      </div>

      {/* Role Application Eligibility Notice */}
      {pendingCount > 0 && (
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-200">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <span className="font-bold">Application Under Review:</span> You currently have a role application pending recruiter evaluation. Candidates may only apply for one role at a time. If this application is rejected, you will be eligible to apply for a new role.
          </div>
        </div>
      )}

      {approvedCount > 0 && pendingCount === 0 && (
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30 flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <span className="font-bold">Application Approved:</span> Congratulations! Your application has been approved. Candidates with an approved application cannot apply for additional roles.
          </div>
        </div>
      )}

      {displayApplications.length > 0 && pendingCount === 0 && approvedCount === 0 && (
        <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-900 dark:text-indigo-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <div>
              <span className="font-bold">Eligible for New Roles:</span> Your previous application was closed/rejected. You are now eligible to apply for a new position at SoftMax.
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

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
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
      </div>

      {/* Applications List */}
      {filteredApps.length > 0 ? (
        <motion.div layout className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredApps.map((app) => (
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
                        {(app as any).jobTitle || jobs.find((j) => j.id === app.jobId)?.title || "Job Application"}
                      </h3>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                          app.status
                        )}`}
                      >
                        {normalizeStatus(app.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>Ref: #{app.id}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Applied: {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : "Recent"}
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
                  </div>
                </div>

                {/* Feedback if any */}
                {app.feedback && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white block mb-0.5">Hiring Team Notes:</strong>
                    {app.feedback}
                  </div>
                )}

                {/* Approved Application Main Portal Call-to-Action */}
                {normalizeStatus(app.status) === "Approved" && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                          <span>Application Approved by Hiring Team!</span>
                        </div>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                          Your profile has been accepted. Visit softmax.in to access company resources & next steps.
                        </p>
                      </div>
                    </div>
                    <a
                      href="https://softmax.in"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition hover:scale-[1.02] active:scale-[0.98] flex-shrink-0"
                    >
                      <span>Visit softmax.in</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </motion.div>
            ))}
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
            You haven&apos;t submitted any applications under this filter yet. Explore current openings to apply!
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

      {/* Application Details Modal */}
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
                <span className="text-xs text-slate-400">Ref: #{selectedApp.id}</span>
              </div>

              <h2 className="text-xl font-bold">
                {selectedApp.jobTitle || jobs.find((j) => j.id === selectedApp.jobId)?.title || "Role Application"}
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
                    <span className="font-semibold text-slate-900 dark:text-white">{selectedApp.experienceYears}</span>
                  </div>
                </div>

                {(user?.portfolioUrl || (selectedApp as any).portfolioUrl) && (
                  <div>
                    <span className="text-slate-400 block mb-0.5">Portfolio:</span>
                    <a
                      href={user?.portfolioUrl || (selectedApp as any).portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>{user?.portfolioUrl || (selectedApp as any).portfolioUrl}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                <div>
                  <span className="text-slate-400 block mb-0.5">Cover Note:</span>
                  <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 leading-relaxed">
                    {selectedApp.description}
                  </p>
                </div>

                {selectedApp.resumeFileName && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <span className="font-medium truncate">{selectedApp.resumeFileName}</span>
                    </div>
                    {selectedApp.resumeDataUrl && (
                      <a
                        href={selectedApp.resumeDataUrl}
                        download={selectedApp.resumeFileName || "resume.pdf"}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                      >
                        Download
                      </a>
                    )}
                  </div>
                )}

                {/* User Profile Resume Link if not directly on application */}
                {!selectedApp.resumeFileName && (user?.resumeUrl || (user as any)?.resumeData) && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <span className="font-medium truncate text-xs">Resume attached via Candidate Profile</span>
                    </div>
                    <a
                      href={user?.resumeUrl || (user as any)?.resumeData}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* If Approved, show Main Portal link in Modal too */}
              {normalizeStatus(selectedApp.status) === "Approved" && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        Application Approved!
                      </div>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        Welcome to SoftMax. Continue to softmax.in for onboarding resources.
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://softmax.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition flex-shrink-0"
                  >
                    <span>Visit softmax.in</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <div className="pt-2 text-right">
                <button
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
    </div>
  );
}
