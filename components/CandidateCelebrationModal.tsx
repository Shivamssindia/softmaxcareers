"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ExternalLink,
  Info,
  X,
  Briefcase,
} from "lucide-react";

interface CandidateCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  applicationId?: string;
}

export const CandidateCelebrationModal: React.FC<
  CandidateCelebrationModalProps
> = ({
  isOpen,
  onClose,
  candidateName,
  candidateEmail,
  jobTitle,
  applicationId,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-6 text-slate-900 dark:text-slate-100 space-y-5 z-10"
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon + Title */}
          <div className="flex flex-col items-center text-center space-y-3 pt-1">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Application Forwarded
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Hi {candidateName.split(" ")[0] || "there"}, your application
                for{" "}
                <strong className="text-slate-900 dark:text-white">
                  {jobTitle}
                </strong>{" "}
                has been forwarded to the Nexus portal.
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">
                Candidate
              </span>
              <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
                {candidateName}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">
                Status
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Forwarded to Nexus
              </span>
            </div>
          </div>

          {/* Instruction */}
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Next step</span>
            </div>
            <p className="leading-relaxed">
              Log in to{" "}
              <a
                href="https://nexus.softmax.in"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline hover:text-amber-950 dark:hover:text-white"
              >
                nexus.softmax.in
              </a>{" "}
              using the same email address:
            </p>
            <div className="pt-0.5">
              <span className="inline-block px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 font-mono text-[11px] font-semibold text-slate-900 dark:text-white select-all break-all">
                {candidateEmail || "your registered email"}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href="https://nexus.softmax.in"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition inline-flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Nexus Portal</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition inline-flex items-center justify-center gap-1.5"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Back to Console</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};