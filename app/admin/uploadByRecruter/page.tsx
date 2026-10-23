"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { subscribeToJobs } from "@/lib/firestore";
import { Job } from "@/types";
import CandidateManualForm from "@/components/admin/CandidateManualForm";
import CandidateBulkUpload from "@/components/admin/CandidateBulkUpload";
import {
  ArrowLeft,
  UserPlus,
  FileSpreadsheet,
  ShieldCheck,
  Briefcase,
  UploadCloud,
  FileText,
  FileCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

export default function AdminCandidatesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<"manual" | "bulk" | "security">("manual");

  // Route security: Only verified administrators can access
  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const unsub = subscribeToJobs(setJobs);
    return () => unsub?.();
  }, []);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500">Checking admin privileges...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-10 sm:py-14 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Breadcrumb & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Admin Portal</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
              Recruiter Upload Engine
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Recruiter Candidate Onboarding
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Register individual candidate profiles with resumes or import batch spreadsheets (.xlsx / .csv) into the talent pool.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Link
            href="/admin"
            className="ui-btn-secondary text-xs font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-sm"
          >
            <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
            <span>Manage Job Postings ({jobs.length})</span>
          </Link>
        </div>
      </div>

      {/* Information & Security Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Available Openings
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {jobs.filter((j) => j.status === "active").length} Active
            </div>
            <div className="text-[11px] text-slate-500">
              {jobs.length} total openings available for candidate mapping
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Document Utilization
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              Automated
            </div>
            <div className="text-[11px] text-slate-500">
              5MB resumes compressed to ~260KB before Google Drive storage
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Upload Security
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              Enforced
            </div>
            <div className="text-[11px] text-slate-500">
              MIME validation, formula sanitization & role isolation active
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Switcher Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("manual")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition inline-flex items-center gap-2 ${
            activeTab === "manual"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <UserPlus className="w-3.5 h-3.5 text-indigo-500" />
          <span>Single Candidate Entry</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("bulk")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition inline-flex items-center gap-2 ${
            activeTab === "bulk"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500" />
          <span>Bulk Spreadsheet Upload</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition inline-flex items-center gap-2 ${
            activeTab === "security"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Upload Security Policies</span>
        </button>
      </div>

      {/* TAB CONTENT 1: MANUAL CANDIDATE FORM */}
      {activeTab === "manual" && (
        <section>
          <CandidateManualForm jobs={jobs} />
        </section>
      )}

      {/* TAB CONTENT 2: BULK SPREADSHEET UPLOAD */}
      {activeTab === "bulk" && (
        <section>
          <CandidateBulkUpload jobs={jobs} />
        </section>
      )}

      {/* TAB CONTENT 3: SECURITY POLICIES & GUIDELINES */}
      {activeTab === "security" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Platform Upload Security Guardrails
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
                <Lock className="w-4 h-4" />
                <span>1. Role Escalation Protection</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Recruiter candidate imports strictly enforce the <b>candidate</b> role. Arbitrary admin role assignment through forms or spreadsheets is strictly blocked. Furthermore, existing Administrator accounts in the database cannot be overwritten or downgraded by recruiter imports.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
                <FileCheck className="w-4 h-4" />
                <span>2. Executable & Script File Blocking</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Files with dangerous extensions (including <code>.exe</code>, <code>.sh</code>, <code>.php</code>, <code>.js</code>, <code>.vbs</code>, <code>.html</code>, <code>.svg</code>) are rejected immediately. File names are sanitized to prevent directory traversal attacks (<code>../</code>) and null-byte injection.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                <span>3. Spreadsheet Formula Injection (CSV / DDE) Defense</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Candidate spreadsheet cells beginning with formula prefixes (<code>=</code>, <code>+</code>, <code>-</code>, <code>@</code>, <code>\t</code>, <code>\r</code>) are automatically escaped with a leading quote to neutralize command execution when spreadsheets are exported or viewed in Excel.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>4. Document Utilization & Size Safeguards</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Maximum file upload size is capped at 10 MB per file, and spreadsheets are capped at 500 rows per batch to prevent denial-of-service (DoS) and quota exhaustion. Resumes are processed by SoftMax Document Utilization before sync to Google Drive.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
