"use client";

import React, { useState, useRef } from "react";
import {
  createCandidateFromInput,
  validateResumeFile,
  validateImportRow,
} from "@/lib/candidateImport";
import { Job, DepartmentType } from "@/types";
import {
  UserPlus,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  Building2,
  Code2,
  Globe,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  ShieldCheck,
  FileCheck,
  RotateCcw,
} from "lucide-react";

const POPULAR_DEPARTMENTS: DepartmentType[] = [
  "Web Development",
  "Software Engineering",
  "Cloud & DevOps",
  "System Design",
  "AI & Data",
  "UI/UX Design",
  "IT Project Management",
  "Business Analysis & Consulting",
  "Talent Acquisition & HR",
  "Sales & Client Relations",
];

const SUGGESTED_SKILLS = [
  "React",
  "TypeScript",
  "Next.js",
  "Node.js",
  "Python",
  "AWS",
  "Docker",
  "Tailwind CSS",
  "PostgreSQL",
  "Kubernetes",
  "GraphQL",
  "Figma",
];

interface CandidateManualFormProps {
  jobs: Job[];
  onCandidateCreated?: () => void;
}

export default function CandidateManualForm({
  jobs,
  onCandidateCreated,
}: CandidateManualFormProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    title: "",
    location: "Bengaluru, India",
    department: "Web Development",
    bio: "",
    skills: "",
    portfolioUrl: "",
    jobId: "",
    experienceYears: "3 - 5 Years",
    description: "",
  });

  const [resume, setResume] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    title: string;
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const onChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleAddSkill = (skill: string) => {
    const current = form.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!current.includes(skill)) {
      const updated = [...current, skill].join(", ");
      setForm((f) => ({ ...f, skills: updated }));
    }
  };

  const handleFileSelection = (file: File | null) => {
    setFileError(null);
    if (!file) {
      setResume(null);
      return;
    }

    // Security validation
    const validation = validateResumeFile(file);
    if (!validation.valid) {
      setFileError(validation.error || "Invalid file.");
      setResume(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setResume(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      phone: "",
      title: "",
      location: "Bengaluru, India",
      department: "Web Development",
      bio: "",
      skills: "",
      portfolioUrl: "",
      jobId: "",
      experienceYears: "3 - 5 Years",
      description: "",
    });
    setResume(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    setFileError(null);

    // 1. Client-side input validation
    const candidateInput = {
      ...form,
      role: "candidate" as const,
      skills: form.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      resumeFile: resume,
    };

    const rowErrors = validateImportRow(candidateInput);
    if (rowErrors.length > 0) {
      setFeedback({
        type: "error",
        title: "Validation Error",
        message: rowErrors.map((err) => `${err.field}: ${err.message}`).join(" • "),
      });
      setSubmitting(false);
      return;
    }

    // 2. Pre-flight file security check
    if (resume) {
      const fileCheck = validateResumeFile(resume);
      if (!fileCheck.valid) {
        setFileError(fileCheck.error || "File security check failed.");
        setSubmitting(false);
        return;
      }
    }

    try {
      const res = await createCandidateFromInput(candidateInput);

      if (res.status === "error") {
        setFeedback({
          type: "error",
          title: "Submission Failed",
          message: res.message,
        });
      } else if (res.status === "skipped") {
        setFeedback({
          type: "info",
          title: "Account Skipped",
          message: res.message,
        });
      } else {
        setFeedback({
          type: "success",
          title:
            res.status === "created"
              ? "Candidate Created Successfully"
              : "Candidate Updated Successfully",
          message: `${res.email}: ${res.message}`,
        });
        resetForm();
        onCandidateCreated?.();
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        title: "System Error",
        message: err?.message || "An unexpected error occurred while adding the candidate.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Form Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Add Individual Candidate
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Register a candidate profile, link them to an active opening, and attach a resume document.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Role Isolated
          </span>
          <button
            type="button"
            onClick={resetForm}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition inline-flex items-center gap-1"
            title="Reset all form fields"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-8">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
              feedback.type === "success"
                ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
                : feedback.type === "error"
                ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100"
                : "bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : feedback.type === "error" ? (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs">
              <div className="font-bold text-sm mb-0.5">{feedback.title}</div>
              <p className="whitespace-pre-wrap">{feedback.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* SECTION 1: Personal Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              1. Candidate Contact Information
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={onChange}
                required
                maxLength={120}
                placeholder="e.g. Aarav Patel"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={onChange}
                  required
                  maxLength={120}
                  placeholder="e.g. aarav.patel@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={onChange}
                  maxLength={25}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Location
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={onChange}
                  maxLength={80}
                  placeholder="e.g. Bengaluru, India (Hybrid)"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Professional Profile */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              2. Professional Profile & Skills
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Designation / Job Title
              </label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={onChange}
                maxLength={100}
                placeholder="e.g. Senior Full Stack Engineer"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Department
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <select
                  name="department"
                  value={form.department}
                  onChange={onChange}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm transition-all"
                >
                  {POPULAR_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Experience Level
              </label>
              <select
                name="experienceYears"
                value={form.experienceYears}
                onChange={onChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm transition-all"
              >
                <option value="Fresher (0 - 1 Year)">Fresher (0 - 1 Year)</option>
                <option value="1 - 3 Years">1 - 3 Years</option>
                <option value="3 - 5 Years">3 - 5 Years</option>
                <option value="5 - 8 Years">5 - 8 Years</option>
                <option value="8+ Years">8+ Years</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Portfolio / LinkedIn URL
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="url"
                  name="portfolioUrl"
                  value={form.portfolioUrl}
                  onChange={onChange}
                  placeholder="https://github.com/candidate"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm transition-all"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Key Skills (Comma Separated)
              </label>
              <div className="relative">
                <Code2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  name="skills"
                  value={form.skills}
                  onChange={onChange}
                  placeholder="React, TypeScript, Next.js, Node.js, GraphQL"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm transition-all"
                />
              </div>

              {/* Quick skill chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[11px] text-slate-400 font-medium">
                  Suggestions:
                </span>
                {SUGGESTED_SKILLS.map((sk) => (
                  <button
                    type="button"
                    key={sk}
                    onClick={() => handleAddSkill(sk)}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 transition"
                  >
                    + {sk}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Job Mapping & Recruiter Notes */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              3. Job Opening Association & Notes
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Job Opening (Optional)
              </label>
              <select
                name="jobId"
                value={form.jobId}
                onChange={onChange}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm transition-all"
              >
                <option value="">— Register candidate without job application —</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} — {job.department} ({job.type})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                If selected, an application record will be generated automatically in the candidate's name.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Recruiter Notes / Candidate Bio
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={onChange}
                rows={3}
                placeholder="Include candidate highlights, interview feedback, current notice period, or expected compensation..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm transition-all"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: Resume Attachment & Upload Security */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                4. Resume Document Attachment
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Optional</span>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20"
                : resume
                ? "border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10"
                : "border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/40 dark:bg-slate-800/40"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={(e) => handleFileSelection(e.target.files?.[0] || null)}
              className="hidden"
            />

            {resume ? (
              <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-800 max-w-lg mx-auto">
                <div className="flex items-center gap-3 truncate text-left">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {resume.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {(resume.size / 1024).toFixed(1)} KB • Ready for automated compression & Drive sync
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileSelection(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Remove selected file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Click to browse or drag and drop candidate resume
                </div>
                <p className="text-[11px] text-slate-400">
                  Accepted formats: <b className="text-slate-600 dark:text-slate-300">PDF, DOC, DOCX, PNG, JPG</b> (Max 10 MB)
                </p>
              </div>
            )}
          </div>

          {fileError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{fileError}</span>
            </p>
          )}

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <span>
              SoftMax Document Utilization automatically compresses uploaded resumes (e.g. 5MB → ~260KB) before saving securely to Google Drive.
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-slate-400">
            * Required fields. Profile is created under strictly isolated candidate credentials.
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={resetForm}
              disabled={submitting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Reset
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto ui-btn-primary px-6 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Candidate...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Candidate Profile</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
