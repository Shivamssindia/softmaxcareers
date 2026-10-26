"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useJobs } from "@/context/JobContext";
import { useAuth } from "@/context/AuthContext";
import { Job } from "@/types";
import { getJobSlug, findJobBySlugOrId } from "@/lib/slug";
import { getJobsFromFirestore } from "@/lib/firestore";
import { JobCard } from "@/components/JobCard";
import {
  MapPin,
  Clock,
  Briefcase,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  Share2,
  CheckCircle2,
  XCircle,
  Code2,
  Users2,
  Calendar,
  Sparkles,
  Building2,
  ShieldCheck,
  Check,
  Search,
  ExternalLink,
  Award,
  Zap,
} from "lucide-react";

export default function JobDetailPage({
  params: initialParams,
}: {
  params?: { jobName?: string };
}) {
  const router = useRouter();
  const routeParams = useParams();
  const rawIdentifier =
    initialParams?.jobName || (routeParams?.jobName as string) || "";
  const identifier = decodeURIComponent(rawIdentifier);

  const { jobs, loading: jobsLoading, getCandidateApplications } = useJobs();
  const { user } = useAuth();

  const [fallbackJobs, setFallbackJobs] = useState<Job[]>([]);
  const [fetchingFallback, setFetchingFallback] = useState(false);
  const [copied, setCopied] = useState(false);

  // If jobs from context are empty, fetch from firestore directly
  useEffect(() => {
    if (jobs.length === 0 && !jobsLoading) {
      setFetchingFallback(true);
      getJobsFromFirestore()
        .then((fetched) => setFallbackJobs(fetched))
        .catch(() => {})
        .finally(() => setFetchingFallback(false));
    }
  }, [jobs, jobsLoading]);

  const allJobs = useMemo(() => {
    if (jobs.length > 0) return jobs;
    return fallbackJobs;
  }, [jobs, fallbackJobs]);

  const job = useMemo(() => {
    return findJobBySlugOrId(identifier, allJobs);
  }, [identifier, allJobs]);

  const jobSlug = job ? getJobSlug(job) : "";
  const applyUrl = job ? `/apply/${jobSlug}` : "/openings";
  const isClosed = job?.status === "closed";

  // Check if current user already applied
  const candidateApps = user ? getCandidateApplications(user.uid) : [];
  const blockingApp = candidateApps.find((app) => {
    const s = String(app.status || "").toLowerCase();
    return s === "pending" || s === "approved" || s === "offer extended";
  });
  const isAppliedToThisJob = job && blockingApp?.jobId === job.id;

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

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2400);
      }
    } catch {
      // Fallback
    }
  };

  // Related jobs in same department or category
  const relatedJobs = useMemo(() => {
    if (!job) return [];
    return allJobs
      .filter((j) => j.id !== job.id && j.status === "active")
      .filter((j) => j.department === job.department || j.category === job.category)
      .slice(0, 3);
  }, [job, allJobs]);

  // Loading state
  if ((jobsLoading || fetchingFallback) && !job && allJobs.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
          Loading Job Details...
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Fetching full role description and requirements
        </p>
      </div>
    );
  }

  // Not Found State
  if (!job) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
          <Briefcase className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Job Opening Not Found
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            The position you are looking for ({identifier}) might have been filled,
            unlisted, or relocated.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/openings"
            className="ui-btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            <span>Browse All Open Roles</span>
          </Link>
          <Link
            href="/"
            className="ui-btn-secondary px-5 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2"
          >
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Schema.org JobPosting structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "JobPosting",
            title: job.title,
            description: job.description,
            datePosted: `${job.postedDate}T09:00:00+05:30`,
            employmentType: "FULL_TIME",
            hiringOrganization: {
              "@type": "Organization",
              name: "SoftMax Technologies",
              sameAs: "https://softmax.in",
              logo: "https://softmax.in/logo.jpg",
            },
            jobLocation: {
              "@type": "Place",
              address: {
                "@type": "PostalAddress",
                streetAddress: "SoftMax Tech Park",
                addressLocality: job.location,
                addressCountry: "IN",
              },
            },
            baseSalary: {
              "@type": "MonetaryAmount",
              currency: job.salaryCurrency || "INR",
              value: {
                "@type": "QuantitativeValue",
                minValue: job.salaryMin || 1200000,
                maxValue: job.salaryMax || 2800000,
                unitText: "YEAR",
              },
            },
            skills: job.tags.join(", "),
          }),
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* Breadcrumb & Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <nav className="flex items-center gap-2 flex-wrap">
            <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Home
            </Link>
            <span>/</span>
            <Link href="/openings" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">
              Job Openings
            </Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-xs">
              {job.title}
            </span>
          </nav>

          <Link
            href="/openings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Open Positions</span>
          </Link>
        </div>

        {/* Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="p-6 sm:p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6"
        >
          {/* Badges & Meta */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                  job.category === "Non-Tech"
                    ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/40"
                }`}
              >
                {job.category === "Non-Tech" ? (
                  <Users2 className="w-3.5 h-3.5" />
                ) : (
                  <Code2 className="w-3.5 h-3.5" />
                )}
                <span>{job.category} Track</span>
              </span>

              <span className="text-xs font-medium px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {job.department}
              </span>

              <span className="text-xs font-medium px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>{job.type}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {isClosed ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200/60 dark:border-rose-800/60">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Position Closed</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200/60 dark:border-emerald-800/60">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Actively Hiring</span>
                </span>
              )}
              <button
                type="button"
                onClick={handleShare}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition relative"
                title="Share this job link"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                {copied && (
                  <span className="absolute -bottom-8 right-0 bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded shadow whitespace-nowrap z-20">
                    Link Copied!
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Job Title */}
          <div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {job.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>SoftMax Technologies</span>
              <span>•</span>
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Posted {job.postedDate || "Recently"}</span>
            </p>
          </div>

          {/* Key Metric Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Location
              </span>
              <span className="font-semibold text-slate-900 dark:text-white text-sm block">
                {job.location}
              </span>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                Experience
              </span>
              <span className="font-semibold text-slate-900 dark:text-white text-sm block">
                {job.experience}
              </span>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Work Mode
              </span>
              <span className="font-semibold text-slate-900 dark:text-white text-sm block">
                {job.type}
              </span>
            </div>
          </div>

          {/* Top CTA Row */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              One application per candidate rule applies. Track status directly in console.
            </div>

            <div className="flex items-center gap-3">
              {isClosed ? (
                <button
                  type="button"
                  disabled
                  className="px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-80"
                  title="Applications are closed for this position"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Applications Closed</span>
                </button>
              ) : isAppliedToThisJob ? (
                <Link
                  href="/candidate"
                  className="px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40 hover:scale-[1.02] transition-transform"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Applied ({blockingApp?.status || "Active"}) - View Console</span>
                </Link>
              ) : (
                <Link
                  href={applyUrl}
                  onClick={handleApplyClick}
                  className="ui-btn-primary px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 shadow-md shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  <span>Apply for this Position</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </motion.div>

        {/* 2-Column Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column: Details */}
          <div className="lg:col-span-2 space-y-8">
            {/* Role Overview */}
            <section className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Role Overview
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {job.description}
              </p>
            </section>

            {/* Compensation */}
            <section className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Compensation
                </h2>
              </div>
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Salary / Package
                </span>
                <span className="text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                  {job.salaryRange}
                </span>
              </div>
            </section>

            {/* Key Responsibilities */}
            {job.responsibilities && job.responsibilities.length > 0 && (
              <section className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Key Responsibilities
                  </h2>
                </div>
                <ul className="space-y-3">
                  {job.responsibilities.map((resp, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{resp}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Requirements & Qualifications */}
            {job.requirements && job.requirements.length > 0 && (
              <section className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Requirements & Qualifications
                  </h2>
                </div>
                <ul className="space-y-3">
                  {job.requirements.map((req, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{req}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Bottom Apply Banner */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 text-white shadow-lg space-y-4">
              <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Ready to Join Our Team?
              </h3>
              <p className="text-xs sm:text-sm text-indigo-100 max-w-xl leading-relaxed">
                We review applications on a rolling basis. Submit your details and resume
                to jumpstart your career with SoftMax.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                {isClosed ? (
                  <button
                    type="button"
                    disabled
                    className="px-6 py-3 rounded-xl text-xs sm:text-sm font-bold bg-white/20 text-white/60 cursor-not-allowed inline-flex items-center gap-2"
                    title="Applications are closed for this position"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Applications Closed</span>
                  </button>
                ) : isAppliedToThisJob ? (
                  <Link
                    href="/candidate"
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white text-indigo-700 hover:bg-indigo-50 shadow-sm inline-flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    <span>View Application in Console</span>
                  </Link>
                ) : (
                  <Link
                    href={applyUrl}
                    onClick={handleApplyClick}
                    className="px-6 py-3 rounded-xl text-xs sm:text-sm font-bold bg-white text-indigo-700 hover:bg-indigo-50 shadow-md inline-flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  >
                    <span>Apply for this Role Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
                <Link
                  href="/openings"
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white/90 hover:text-white hover:bg-white/10 transition"
                >
                  View Other Roles
                </Link>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Key Info & Perks */}
          <div className="space-y-6">
            {/* Required Skills Chips */}
            {job.tags && job.tags.length > 0 && (
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Required Skills & Stacks
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {job.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-medium px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Why SoftMax card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Why SoftMax?
              </h3>
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="block text-slate-900 dark:text-white font-semibold">
                      Production Impact
                    </strong>
                    <span>Ship to real customers across web, AI, and distributed systems.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="block text-slate-900 dark:text-white font-semibold">
                      Transparent Hiring
                    </strong>
                    <span>Track your review, screening, and offer status live online.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Award className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="block text-slate-900 dark:text-white font-semibold">
                      Growth & Mentorship
                    </strong>
                    <span>Direct access to principal architects and technical leadership.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Corporate Link */}
            <div className="p-6 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Learn more about our core client solutions and engineering services:
              </p>
              <a
                href="https://softmax.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <span>Visit softmax.in</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Related Job Openings Section */}
        {relatedJobs.length > 0 && (
          <section className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Related Positions
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Explore other roles in {job.department} or {job.category} tracks.
                </p>
              </div>
              <Link
                href="/openings"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
              >
                <span>Browse All Openings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedJobs.map((rJob) => (
                <JobCard key={rJob.id} job={rJob} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
