"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  UserCheck,
  X,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

export type ApprovalSyncStatus = "processing" | "success" | "warning";

interface ApprovalSyncModalProps {
  isOpen: boolean;
  status: ApprovalSyncStatus;
  candidateName: string;
  candidateEmail?: string;
  jobTitle: string;
  errorDetails?: string;
  onClose: () => void;
  onRetry?: () => void;
}

export const ApprovalSyncModal: React.FC<ApprovalSyncModalProps> = ({
  isOpen,
  status,
  candidateName,
  candidateEmail,
  jobTitle,
  errorDetails,
  onClose,
  onRetry,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop with modern blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
          onClick={status !== "processing" ? onClose : undefined}
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={
            status === "warning"
              ? { opacity: 1, scale: 1, y: 0, x: [0, -6, 6, -4, 4, -2, 2, 0] }
              : status === "success"
              ? { opacity: 1, scale: 1, y: 0, x: 0 }
              : { opacity: 1, scale: 1, y: 0, x: 0 }
          }
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          transition={{
            scale: { type: "spring", stiffness: 350, damping: 25 },
            y: { type: "spring", stiffness: 350, damping: 25 },
            x: { duration: 0.5, ease: "easeInOut" },
          }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-2xl z-10 p-6 sm:p-8 text-slate-900 dark:text-slate-100"
        >
          {/* Top Decorative Gradient Line */}
          <div
            className={`absolute top-0 left-0 right-0 h-1.5 ${
              status === "processing"
                ? "bg-gradient-to-r from-indigo-500 via-sky-400 to-indigo-600 animate-pulse"
                : status === "success"
                ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600"
                : "bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600"
            }`}
          />

          {/* Close button (allowed when not in processing) */}
          {status !== "processing" && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* ========================================================= */}
          {/* STATE 1: PROCESSING */}
          {/* ========================================================= */}
          {status === "processing" && (
            <div className="flex flex-col items-center text-center space-y-5 py-2">
              {/* Animated Radar / Multi-Ring Spinner Effect */}
              <div className="relative w-24 h-24 flex items-center justify-center my-2">
                {/* Glow ring */}
                <motion.div
                  animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.7, 0.35] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500/30 to-sky-400/30 blur-xl"
                />

                {/* Outer spinning dash ring */}
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-400/50 dark:border-indigo-400/40 animate-[spin_8s_linear_infinite]" />

                {/* Middle counter-rotating ring */}
                <div className="absolute inset-2 rounded-full border-2 border-sky-400 border-t-transparent border-r-transparent animate-[spin_2s_linear_infinite_reverse]" />

                {/* Inner spinner */}
                <div className="absolute inset-4 rounded-full border-3 border-indigo-600 dark:border-indigo-400 border-b-transparent animate-[spin_1.2s_linear_infinite]" />

                {/* Center Pulse Icon */}
                <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shadow-inner">
                  <RefreshCw className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                </div>
              </div>

              {/* Status Header */}
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 uppercase tracking-wider">
                  <Server className="w-3.5 h-3.5 animate-pulse" />
                  Synchronizing Candidate Profile
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Approving Application
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Communicating with external consultant system. Please wait while records are updated.
                </p>
              </div>

              {/* Candidate Info Card */}
              <div className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-left text-xs space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-400 font-medium">Candidate:</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                    {candidateName}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-400 font-medium">Role:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                    {jobTitle}
                  </span>
                </div>
                {candidateEmail && (
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200/60 dark:border-slate-800">
                    <span className="text-slate-400 font-medium">Email / ID:</span>
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                      {candidateEmail}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-slate-400 font-medium">External Endpoint:</span>
                  <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 truncate max-w-[200px]">
                    system.softmax.in/api/v1/external/consultant
                  </span>
                </div>
              </div>

              {/* Active Step Progress */}
              <div className="w-full space-y-2 text-left">
                <div className="flex items-center gap-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>1. Application marked Approved in database</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
                  <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin flex-shrink-0" />
                  <span>2. Transmitting candidate payload to external consultant API...</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-400 font-normal">
                  <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 flex-shrink-0" />
                  <span>3. Verifying external authentication and sync confirmation</span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STATE 2: SUCCESS WITH CELEBRATORY EFFECT */}
          {/* ========================================================= */}
          {status === "success" && (
            <div className="flex flex-col items-center text-center space-y-5 py-2">
              {/* Animated Success Ring & Checkmark with Glow Effect */}
              <div className="relative w-24 h-24 flex items-center justify-center my-2">
                {/* Background glowing emerald wave */}
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: [1, 1.4, 1.2], opacity: [0.4, 0.8, 0.5] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-emerald-500/30 blur-xl"
                />

                {/* Ring expanding pulse */}
                <motion.div
                  initial={{ scale: 0, opacity: 0.8 }}
                  animate={{ scale: [1, 1.3], opacity: [0.8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full border-2 border-emerald-400"
                />

                {/* Success Icon Center */}
                <motion.div
                  initial={{ scale: 0.2, rotate: -25 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 450, damping: 18 }}
                  className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30"
                >
                  <CheckCircle2 className="w-9 h-9" />
                </motion.div>

                {/* Mini decorative celebratory sparkle dots */}
                <motion.span
                  initial={{ scale: 0, x: 0, y: 0 }}
                  animate={{ scale: [0, 1, 0], x: 26, y: -26 }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
                  className="absolute w-2 h-2 rounded-full bg-amber-400"
                />
                <motion.span
                  initial={{ scale: 0, x: 0, y: 0 }}
                  animate={{ scale: [0, 1, 0], x: -28, y: -20 }}
                  transition={{ duration: 1.6, repeat: Infinity, delay: 0.5 }}
                  className="absolute w-2 h-2 rounded-full bg-teal-400"
                />
                <motion.span
                  initial={{ scale: 0, x: 0, y: 0 }}
                  animate={{ scale: [0, 1, 0], x: 28, y: 20 }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.7 }}
                  className="absolute w-2.5 h-2.5 rounded-full bg-indigo-400"
                />
              </div>

              {/* Status Header */}
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Synced Successfully • HTTP 200 OK
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Application Approved!
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Candidate profile for <strong className="text-slate-900 dark:text-white">{candidateName}</strong> was
                  approved and synchronized with the external consultant system.
                </p>
              </div>

              {/* Confirmation Details Card */}
              <div className="w-full p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/60 text-left text-xs space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-emerald-100 dark:border-emerald-900/50">
                  <span className="text-emerald-800 dark:text-emerald-300 font-medium">Candidate:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{candidateName}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-emerald-100 dark:border-emerald-900/50">
                  <span className="text-emerald-800 dark:text-emerald-300 font-medium">Role:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{jobTitle}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-emerald-100 dark:border-emerald-900/50">
                  <span className="text-emerald-800 dark:text-emerald-300 font-medium">External Consultant Sync:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified & Active
                  </span>
                </div>
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-emerald-800 dark:text-emerald-300 font-medium">Candidate Next Step:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Login at nexus.softmax.in with same ID
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="w-full pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 transition transform active:scale-[0.98] hover:scale-[1.01]"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STATE 3: WARNING WITH RELEVANT EFFECT */}
          {/* ========================================================= */}
          {status === "warning" && (
            <div className="flex flex-col items-center text-center space-y-5 py-2">
              {/* Animated Warning Icon with Attention-Grabbing Halo */}
              <div className="relative w-24 h-24 flex items-center justify-center my-2">
                {/* Glowing warning halo */}
                <motion.div
                  animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.75, 0.4] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-amber-500/30 blur-xl"
                />

                {/* Outer pulsing dashed ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border-2 border-dashed border-amber-400/60"
                />

                {/* Warning Center Icon */}
                <motion.div
                  initial={{ scale: 0.3 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30"
                >
                  <AlertTriangle className="w-8 h-8" />
                </motion.div>
              </div>

              {/* Status Header */}
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  External Integration Notice
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Sync Warning Received
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                  The application was marked as <strong className="text-slate-900 dark:text-white">Approved</strong> in the portal database, but the external consultant service returned a warning or error.
                </p>
              </div>

              {/* Warning Details Box */}
              <div className="w-full p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-left text-xs space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/60 dark:border-amber-900/40">
                  <span className="font-bold text-amber-900 dark:text-amber-300">External Response / Error:</span>
                  <span className="font-mono text-[10px] text-amber-700 dark:text-amber-400">system.softmax.in</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-200/80 dark:border-amber-900/60 font-mono text-[11px] text-amber-900 dark:text-amber-200 break-words leading-relaxed max-h-32 overflow-y-auto">
                  {errorDetails || "The external consultant service could not be reached or returned an error status."}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 leading-normal">
                  You can retry syncing this candidate to the external service now, or acknowledge and review external service connectivity.
                </p>
              </div>

              {/* Dual Action Buttons */}
              <div className="w-full flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition transform active:scale-[0.98] inline-flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry External Sync</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition"
                >
                  Acknowledge & Close
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
