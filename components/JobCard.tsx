"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useJobs } from "@/context/JobContext";
import { Job } from "@/types";
import { getJobSlug } from "@/lib/slug";
import {
  MapPin,
  Clock,
  Briefcase,
  ArrowRight,
  DollarSign,
  ChevronRight,
  X,
  Code2,
  Users2,
  CheckCircle2,
} from "lucide-react";

interface JobCardProps {
  job: Job;
  onApply?: (job: Job) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const { getCandidateApplications } = useJobs();
  const applyUrl = `/apply/${getJobSlug(job)}`;

  const candidateApps = user ? getCandidateApplications(user.uid) : [];
  const blockingApp = candidateApps.find((app) => {
    const s = String(app.status || "").toLowerCase();
    return s === "pending" || s === "approved" || s === "offer extended";
  });
  const isAppliedToThisJob = blockingApp?.jobId === job.id;

  const handleApplyClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      router.push(`/auth?redirect=${encodeURIComponent(applyUrl)}`);
    }
  };

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-30px" }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className="ui-card-hover p-5 sm:p-6 flex flex-col justify-between border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm"
      >
        <div>
          {/* Badges: Category & Department */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                  job.category === "Non-Tech"
                    ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/40"
                }`}
              >
                {job.category === "Non-Tech" ? (
                  <Users2 className="w-3 h-3" />
                ) : (
                  <Code2 className="w-3 h-3" />
                )}
                {job.category}
              </span>

              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {job.department}
              </span>
            </div>

            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {job.type}
            </span>
          </div>

          {/* Job Title */}
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-1 hover:text-indigo-600 transition-colors">
            {job.title}
          </h3>

          {/* Details Bar */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {job.location}
            </span>
            <span className="flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              {job.experience}
            </span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <DollarSign className="w-3.5 h-3.5" />
              {job.salaryRange}
            </span>
          </div>

          {/* Short Description */}
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4 line-clamp-2">
            {job.description}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {job.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                {tag}
              </span>
            ))}
            {job.tags.length > 4 && (
              <span className="text-[11px] text-slate-400 px-1 py-0.5">
                +{job.tags.length - 4} more
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white transition flex items-center gap-1"
          >
            <span>View Details</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {isAppliedToThisJob ? (
            <Link
              href="/candidate"
              className="text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40 hover:scale-[1.02] transition-transform"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Applied ({blockingApp?.status || "Active"})</span>
            </Link>
          ) : (
            <Link
              href={applyUrl}
              onClick={handleApplyClick}
              className="ui-btn-primary text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5"
            >
              <span>Apply Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </motion.article>

      {/* Details Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 320 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 sm:p-8 text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto"
            >
              {/* Close Button */}
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Badges */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    job.category === "Non-Tech"
                      ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300"
                      : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300"
                  }`}
                >
                  {job.category} Role
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {job.department}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {job.type}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold mb-3">{job.title}</h2>

              <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl mb-6 text-xs">
                <div>
                  <span className="text-slate-500 block mb-0.5">Location</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {job.location}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Experience</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {job.experience}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Compensation</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {job.salaryRange}
                  </span>
                </div>
              </div>

              {/* Description & Responsibilities */}
              <div className="space-y-5 text-sm text-slate-700 dark:text-slate-300">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Role Overview
                  </h4>
                  <p className="leading-relaxed">{job.description}</p>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Key Responsibilities
                  </h4>
                  <ul className="space-y-1.5 text-xs sm:text-sm">
                    {job.responsibilities.map((resp, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Requirements
                  </h4>
                  <ul className="space-y-1.5 text-xs sm:text-sm">
                    {job.requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Key Skills
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {job.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-white px-3 py-2"
                >
                  Close
                </button>
                {isAppliedToThisJob ? (
                  <Link
                    href="/candidate"
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>View Application in Console</span>
                  </Link>
                ) : (
                  <Link
                    href={applyUrl}
                    onClick={handleApplyClick}
                    className="ui-btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                  >
                    <span>Apply for this Position</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
