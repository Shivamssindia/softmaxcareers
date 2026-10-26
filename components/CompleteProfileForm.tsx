"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, DepartmentType } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { uploadResume } from "@/lib/resumeStorage";
import {
  User as UserIcon,
  Phone,
  Briefcase,
  Building,
  MapPin,
  FileText,
  Globe,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Plus,
  X,
  FileCheck,
  Loader2,
  ArrowRight,
} from "lucide-react";

const DEPARTMENTS: DepartmentType[] = [
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

const POPULAR_SKILLS = [
  "React",
  "TypeScript",
  "Next.js",
  "Node.js",
  "Python",
  "Tailwind CSS",
  "PostgreSQL",
  "AWS",
  "Docker",
  "GraphQL",
  "REST APIs",
  "Git",
];

interface CompleteProfileFormProps {
  user: User;
  onCompleted?: (updatedUser: User) => void;
  redirectUrl?: string;
  cancelable?: boolean;
  onCancel?: () => void;
}

export const CompleteProfileForm: React.FC<CompleteProfileFormProps> = ({
  user,
  onCompleted,
  redirectUrl,
  cancelable = false,
  onCancel,
}) => {
  const { updateUserProfile } = useAuth();

  // Form Fields
  const [name, setName] = useState(user.name || (user as any).displayName || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [title, setTitle] = useState(user.title || "");
  const [department, setDepartment] = useState<DepartmentType>(
    (user.department as DepartmentType) || "Web Development"
  );
  const [location, setLocation] = useState(user.location || "");
  const [bio, setBio] = useState(user.bio || "");
  const [portfolioUrl, setPortfolioUrl] = useState(user.portfolioUrl || "");

  // Skills
  const [skills, setSkills] = useState<string[]>(
    user.skills && user.skills.length > 0 ? user.skills : []
  );
  const [skillInput, setSkillInput] = useState("");

  // Resume state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [existingResumeUrl, setExistingResumeUrl] = useState<string | null>(
    user.resumeUrl || null
  );
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeUploadMsg, setResumeUploadMsg] = useState<string | null>(null);

  // Sync if user object updates
  React.useEffect(() => {
    if (user) {
      if (!name && (user.name || (user as any).displayName)) {
        setName(user.name || (user as any).displayName || "");
      }
      if (!phone && user.phone) setPhone(user.phone);
      if (!title && user.title) setTitle(user.title);
      if (user.department) setDepartment(user.department as DepartmentType);
      if (!location && user.location) setLocation(user.location);
      if (!bio && user.bio) setBio(user.bio);
      if (!portfolioUrl && user.portfolioUrl) setPortfolioUrl(user.portfolioUrl);
      if (skills.length === 0 && user.skills && user.skills.length > 0) {
        setSkills(user.skills);
      }
      if (!existingResumeUrl && user.resumeUrl) {
        setExistingResumeUrl(user.resumeUrl);
      }
    }
  }, [user]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Skill Add / Remove
  const handleAddSkill = (skillToAdd: string) => {
    const trimmed = skillToAdd.trim();
    if (!trimmed) return;
    if (!skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setSkillInput("");
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills((prev) => prev.filter((s) => s !== skillToRemove));
  };

  const handleKeyDownSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddSkill(skillInput);
    }
  };

  // Resume File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const isDoc = /\.(docx?|pdf)$/i.test(file.name);
    if (!validTypes.includes(file.type) && !isDoc) {
      setErrorMsg("Please upload a PDF, DOC, or DOCX document.");
      e.target.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg("Resume file exceeds 20MB limit.");
      e.target.value = "";
      return;
    }

    setErrorMsg(null);
    setResumeFile(file);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation
    if (!name.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      setErrorMsg("Please enter a valid phone number (at least 7 digits).");
      return;
    }
    if (!title.trim()) {
      setErrorMsg("Please enter your professional title (e.g. Software Engineer).");
      return;
    }
    if (!location.trim()) {
      setErrorMsg("Please enter your current location or 'Remote'.");
      return;
    }
    if (skills.length === 0) {
      setErrorMsg("Please add at least one technical or professional skill.");
      return;
    }
    if (!bio.trim() || bio.trim().length < 10) {
      setErrorMsg("Please enter a brief professional summary or bio (at least 10 characters).");
      return;
    }

    setSubmitting(true);

    try {
      let finalResumeUrl = existingResumeUrl;

      // If candidate attached a new resume, upload it now
      if (resumeFile && user.uid) {
        setResumeUploading(true);
        try {
          const uploadRes = await uploadResume(user.uid, resumeFile);
          finalResumeUrl = uploadRes.url;
        } catch (uploadErr: any) {
          console.warn("Resume upload non-fatal warning:", uploadErr);
          // If resume upload has network hiccup, don't block profile completion
        } finally {
          setResumeUploading(false);
        }
      }

      // Save complete profile
      const updated = await updateUserProfile({
        name: name.trim(),
        displayName: name.trim(),
        phone: phone.trim(),
        title: title.trim(),
        department,
        location: location.trim(),
        bio: bio.trim(),
        skills,
        portfolioUrl: portfolioUrl.trim() || undefined,
        resumeUrl: finalResumeUrl,
        profileCompleted: true,
      });

      setIsSuccess(true);

      setTimeout(() => {
        if (onCompleted) {
          onCompleted(updated);
        }
      }, 700);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-6 sm:p-8 space-y-6"
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/40">
                Profile Setup
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
              <span className="text-xs text-slate-500 font-medium">Complete Required Details</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
              Complete Your Candidate Profile
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
              Welcome, <strong className="text-slate-700 dark:text-slate-300">{name || user.email}</strong>! Please enter your details below. Once completed, your full profile will be unlocked.
            </p>
          </div>
        </div>

        {cancelable && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="self-start sm:self-auto p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Redirect Context Note */}
      {redirectUrl && (
        <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs flex items-center gap-2">
          <Briefcase className="w-4 h-4 flex-shrink-0" />
          <span>Complete this form to continue directly to your job application.</span>
        </div>
      )}

      {/* Notifications */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </motion.div>
        )}

        {isSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2.5 font-medium"
          >
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>Profile completed successfully! Loading your complete profile...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Completion Form */}
      <form onSubmit={handleSubmit} className="space-y-6 text-xs sm:text-sm">
        {/* Row 1: Full Name & Phone Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-indigo-500" />
              <span>Full Name <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-indigo-500" />
              <span>Phone Number <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* Row 2: Professional Title & Department */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
              <span>Job Title / Headline <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-indigo-500" />
              <span>Primary Department <span className="text-rose-500">*</span></span>
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value as DepartmentType)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-xs sm:text-sm"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Location & Portfolio URL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-500" />
              <span>Location / City <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Bengaluru, India or Remote"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              <span>Portfolio / GitHub / LinkedIn <span className="text-slate-400 font-normal">(Optional)</span></span>
            </label>
            <input
              type="url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              placeholder="https://github.com/yourhandle"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* Skills Section */}
        <div className="space-y-2">
          <label className="block font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Skills & Expertise <span className="text-rose-500">*</span></span>
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              {skills.length} added (Press Enter to add)
            </span>
          </label>

          {/* Active Skills Tags */}
          <div className="flex flex-wrap gap-2 p-3 min-h-[50px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
              >
                <span>{skill}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  className="hover:text-rose-600 transition"
                  aria-label={`Remove ${skill}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            <div className="flex-1 min-w-[140px] flex items-center gap-1">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleKeyDownSkill}
                placeholder={skills.length === 0 ? "Type a skill and hit Enter..." : "Add more..."}
                className="w-full bg-transparent border-none text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none py-1"
              />
              {skillInput.trim() && (
                <button
                  type="button"
                  onClick={() => handleAddSkill(skillInput)}
                  className="px-2 py-1 bg-indigo-600 text-white rounded text-[11px] font-semibold hover:bg-indigo-700 transition"
                >
                  Add
                </button>
              )}
            </div>
          </div>

          {/* Quick Add Popular Pills */}
          <div className="space-y-1 pt-1">
            <span className="text-[11px] text-slate-400 block">Suggested skills (click to add):</span>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_SKILLS.filter((s) => !skills.includes(s)).map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => handleAddSkill(skill)}
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>{skill}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bio / Summary */}
        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              <span>About / Professional Summary <span className="text-rose-500">*</span></span>
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              {bio.length} characters
            </span>
          </label>
          <textarea
            required
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about your background, career focus, and what technical challenges excite you..."
            className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-xs sm:text-sm leading-relaxed"
          />
        </div>

        {/* Resume Upload Section */}
        <div className="space-y-2">
          <label className="block font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <UploadCloud className="w-3.5 h-3.5 text-indigo-500" />
              <span>Resume / CV Attachment <span className="text-slate-400 font-normal">(Optional)</span></span>
            </span>
            {existingResumeUrl && !resumeFile && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Resume active on account</span>
              </span>
            )}
          </label>

          {resumeFile ? (
            <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs">
                    {resumeFile.name}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {(resumeFile.size / 1024 / 1024).toFixed(2)} MB • Ready to save
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResumeFile(null)}
                className="text-slate-400 hover:text-rose-600 p-1"
                title="Remove"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : existingResumeUrl ? (
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-slate-700 dark:text-slate-300">Resume on file</span>
              </div>
              <label className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium">
                <span>Replace file</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <label className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 dark:bg-slate-800/20 transition">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
              <UploadCloud className="w-6 h-6 text-indigo-500 mb-1" />
              <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                Upload Resume (PDF, DOC, DOCX up to 20MB)
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Automatically saved to your profile for 1-click applications
              </span>
            </label>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          {cancelable && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="ui-btn-secondary px-4 py-2.5 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={submitting || isSuccess}
            className="ui-btn-primary px-6 py-3 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition shadow-md disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Profile...</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Profile Saved!</span>
              </>
            ) : (
              <>
                <span>Save & Complete Profile</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
};
