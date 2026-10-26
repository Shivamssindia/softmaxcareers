"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
  Code2,
  Users2,
  CheckCircle2,
} from "lucide-react";

interface JobCardProps {
  job: Job;
  onApply?: (job: Job) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job }) => {
  const router = useRouter();
  const { user } = useAuth();
  const { getCandidateApplications } = useJobs();
  const jobSlug = getJobSlug(job);
  const detailUrl = `/detail/${jobSlug}`;
  const applyUrl = `/apply/${jobSlug}`;
  const isClosed = job.status === "closed";

  const candidateApps = user ? getCandidateApplications(user.uid) : [];
  const blockingApp = candidateApps.find((app) => {
    const s = String(app.status || "").toLowerCase();
    return s === "pending" || s === "approved" || s === "offer extended";
  });
  const isAppliedToThisJob = blockingApp?.jobId === job.id;

  const handleApplyClick = (e: React.MouseEvent) => {
    if (isClosed) {
      e.preventDefault();
      return;
    }
    if (!user) {
      e.preventDefault();
      router.push(`/auth?redirect=${encodeURIComponent(applyUrl)}`);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`ui-card-hover p-5 sm:p-6 flex flex-col justify-between border bg-white dark:bg-slate-900 rounded-2xl shadow-sm ${
        isClosed
          ? "border-slate-200/80 dark:border-slate-800/80 opacity-95"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <div>
        {/* Badges: Category & Department & Status */}
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

            {isClosed ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40">
                Closed
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
            )}
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {job.type}
          </span>
        </div>

        {/* Job Title - Links directly to detail page */}
        <Link href={detailUrl} className="block group">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {job.title}
          </h3>
        </Link>

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
          <p className="text-emerald-600 dark:text-emerald-400 font-semibold leading-relaxed line-clamp-1">
            <DollarSign className="w-3.5 h-3.5 inline" />
            {job.salaryRange}
          </p>
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
      <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2.5">
        <Link
          href={detailUrl}
          className="ui-btn-secondary flex-1 text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1 group hover:text-indigo-600 dark:hover:text-white transition"
        >
          <span>View Details</span>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        {isAppliedToThisJob ? (
          <Link
            href="/candidate"
            className="text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40 hover:scale-[1.02] transition-transform flex-shrink-0"
            title="View in Candidate Console"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Applied</span>
          </Link>
        ) : isClosed ? (
          <button
            type="button"
            disabled
            className="text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/90 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-80 flex-shrink-0"
            title="Applications are closed for this position"
          >
            <span>Apply (Closed)</span>
          </button>
        ) : (
          <Link
            href={applyUrl}
            onClick={handleApplyClick}
            className="ui-btn-primary text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 flex-shrink-0 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            <span>Apply</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </motion.article>
  );
};
