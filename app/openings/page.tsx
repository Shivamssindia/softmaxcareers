"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useJobs } from "@/context/JobContext";
import { useAuth } from "@/context/AuthContext";
import { JobCard } from "@/components/JobCard";
import {
  Briefcase,
  Search,
  Filter,
  Sparkles,
  ArrowRight,
  Code2,
  Users2,
  RotateCcw,
} from "lucide-react";

export default function OpeningsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { jobs, loading } = useJobs();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "Tech" | "Non-Tech">("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedType, setSelectedType] = useState("all");

  const techDepartments = [
    "Web Development",
    "System Design",
    "Software Engineering",
    "Cloud & DevOps",
    "UI/UX Design",
    "AI & Data",
  ];

  const nonTechDepartments = [
    "IT Project Management",
    "Business Analysis & Consulting",
    "Talent Acquisition & HR",
    "Sales & Client Relations",
  ];

  const availableDepartments =
    selectedCategory === "Tech"
      ? techDepartments
      : selectedCategory === "Non-Tech"
      ? nonTechDepartments
      : [...techDepartments, ...nonTechDepartments];

  const filteredJobs = jobs.filter((job) => {
    if (job.status !== "active") return false;

    if (selectedCategory !== "all" && job.category !== selectedCategory) {
      return false;
    }

    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const matchesSearch =
        job.title.toLowerCase().includes(query) ||
        job.description.toLowerCase().includes(query) ||
        job.department.toLowerCase().includes(query) ||
        job.category.toLowerCase().includes(query) ||
        job.tags.some((tag) => tag.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    if (selectedDepartment !== "all" && job.department !== selectedDepartment) {
      return false;
    }

    if (
      selectedType !== "all" &&
      !job.type.toLowerCase().includes(selectedType.toLowerCase()) &&
      !job.location.toLowerCase().includes(selectedType.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedDepartment("all");
    setSelectedType("all");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-center max-w-3xl mx-auto space-y-3"
      >
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>SoftMax Careers Hub</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Find Top Jobs in IT Field
        </h1>
        <p className="text-xs sm:text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          Explore open positions in Tech & Non-Tech IT tracks. Apply online and track your application status live.
        </p>
      </motion.header>

      {/* Filter and Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-grow">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by role, skill, or keyword (e.g. Next.js, Project Manager)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* Department Dropdown */}
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Departments</option>
            {availableDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Job Type Dropdown */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Work Modes</option>
            <option value="Full-time">Full-time</option>
            <option value="Remote">Remote</option>
            <option value="Hybrid">Hybrid</option>
          </select>
        </div>

        {/* Category Pills & Count */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedCategory("all");
                setSelectedDepartment("all");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedCategory === "all"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All Categories
            </button>
            <button
              onClick={() => {
                setSelectedCategory("Tech");
                setSelectedDepartment("all");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                selectedCategory === "Tech"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Tech Roles</span>
            </button>
            <button
              onClick={() => {
                setSelectedCategory("Non-Tech");
                setSelectedDepartment("all");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                selectedCategory === "Non-Tech"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Users2 className="w-3.5 h-3.5" />
              <span>Non-Tech Roles</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Showing <strong>{filteredJobs.length}</strong> of {jobs.filter((j) => j.status === "active").length} active positions
            </span>
            {(searchQuery || selectedCategory !== "all" || selectedDepartment !== "all" || selectedType !== "all") && (
              <button
                onClick={resetFilters}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Jobs Grid */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Loading open positions...</p>
        </div>
      ) : filteredJobs.length > 0 ? (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {filteredJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
        >
          <Briefcase className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No matching job openings found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search query or reset your filters to see all available roles.
          </p>
          <button
            onClick={resetFilters}
            className="ui-btn-secondary px-4 py-2 text-xs font-semibold rounded-lg hover:scale-105 active:scale-95 transition-transform"
          >
            Reset All Filters
          </button>
        </motion.div>
      )}

      {/* General Application Banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
        className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-3"
      >
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
          Don&apos;t see the exact role you&apos;re looking for?
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          We are constantly growing. Submit an open application and our talent acquisition team will review your profile for upcoming opportunities.
        </p>
        <Link
          href="/apply"
          onClick={(e) => {
            if (!user) {
              e.preventDefault();
              router.push(`/auth?redirect=${encodeURIComponent("/apply")}`);
            }
          }}
          className="ui-btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          <span>Submit Open Application</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </motion.div>
    </div>
  );
}
