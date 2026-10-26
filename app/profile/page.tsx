"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useJobs } from "@/context/JobContext";
import { useModal } from "@/context/ModalContext";
import { isProfileComplete, getMissingProfileFields, DepartmentType } from "@/types";
import { CompleteProfileForm } from "@/components/CompleteProfileForm";
import {
  User as UserIcon,
  Mail,
  Shield,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  Globe,
  Edit3,
  LogOut,
  X,
  ExternalLink,
  FileText,
  FileCheck,
  UploadCloud,
  Trash2,
  Eye,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Building,
} from "lucide-react";
import { uploadResume, deleteResume } from "@/lib/resumeStorage";
import { ResumeViewerModal } from "@/components/ResumeViewerModal";

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

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const forceCompleteParam = searchParams.get("complete") === "true";
  const justCompletedParam = searchParams.get("completed") === "true";

  const { showAlert, showConfirm } = useModal();
  const {
    user,
    loading,
    logout,
    updateUserProfile,
    sendVerificationEmail,
    isFirebaseActive,
  } = useAuth();
  const { applications } = useJobs();

  const [verificationSent, setVerificationSent] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(
    justCompletedParam ? "Profile completed successfully! Welcome to your SoftMax profile." : null
  );
  const [saving, setSaving] = useState(false);

  // Form State for Edit Modal
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDepartment, setEditDepartment] = useState<DepartmentType>("Web Development");
  const [editLocation, setEditLocation] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editSkills, setEditSkills] = useState("");
  const [editPortfolio, setEditPortfolio] = useState("");

  // Resume State
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeMsg, setResumeMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isResumeViewerOpen, setIsResumeViewerOpen] = useState(false);

  // ---------------- Route Protection ----------------
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [user, loading, router]);

  // ---------------- Resume Handlers ----------------
  const handleResumeUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate type — resumes should be PDF/DOC/DOCX
    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const isDoc = /\.(docx?|pdf)$/i.test(file.name);
    if (!validTypes.includes(file.type) && !isDoc) {
      setResumeMsg({
        type: "error",
        text: "Please upload a PDF, DOC, or DOCX file.",
      });
      e.target.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setResumeMsg({ type: "error", text: "Resume exceeds 20MB limit." });
      e.target.value = "";
      return;
    }

    setResumeLoading(true);
    setResumeMsg(null);

    try {
      const uploadResult = await uploadResume(user.uid, file);

      // Sync AuthContext so UI updates immediately
      await updateUserProfile({
        resumeUrl: uploadResult.url,
      });

      // Surface compression savings
      const { utilization } = uploadResult;
      const savingsText =
        utilization.status === "utilized"
          ? ` (optimized ${utilization.originalSizeFormatted} → ${utilization.utilizedSizeFormatted})`
          : "";

      setResumeMsg({
        type: "success",
        text: `Resume "${file.name}" saved to your profile${savingsText}.`,
      });
      setTimeout(() => setResumeMsg(null), 6000);
    } catch (err: any) {
      console.error("handleResumeUpload error:", err);
      setResumeMsg({
        type: "error",
        text: err?.message || "Failed to save resume",
      });
    } finally {
      setResumeLoading(false);
      e.target.value = "";
    }
  };

  const handleDeleteResume = async () => {
    if (!user) return;

    const confirmed = await showConfirm(
      "Are you sure you want to remove your resume? This will delete the file from your Google Drive and unlink it from your profile.",
      "Remove Resume",
      {
        type: "danger",
        confirmText: "Yes, Remove Resume",
        cancelText: "Keep Resume",
      }
    );
    if (!confirmed) return;

    setResumeLoading(true);
    setResumeMsg(null);

    try {
      const outcome = await deleteResume(
        user.uid,
        (user as any).resumeFileId,
        user.resumeUrl || undefined
      );

      // Sync AuthContext so UI updates immediately
      await updateUserProfile({
        resumeUrl: null,
      });

      const driveNote = outcome.driveDeleted
        ? " Removed from Google Drive."
        : outcome.driveAlreadyGone
        ? " (File was already removed from Drive.)"
        : " (Drive file could not be deleted — profile unlinked.)";

      setResumeMsg({
        type: "success",
        text: `Resume removed from your profile.${driveNote}`,
      });
      setTimeout(() => setResumeMsg(null), 6000);
    } catch (err: any) {
      console.error("handleDeleteResume error:", err);
      setResumeMsg({
        type: "error",
        text: err?.message || "Failed to remove resume",
      });
    } finally {
      setResumeLoading(false);
    }
  };

  const handleViewResume = () => {
    const src = user?.resumeUrl || (user as any)?.resumeData;
    if (!src) return;
    setIsResumeViewerOpen(true);
  };

  // ---------------- Profile Edit ----------------
  const openEditModal = () => {
    if (!user) return;
    setEditName(user.name || (user as any).displayName || "");
    setEditPhone(user.phone || "");
    setEditTitle(user.title || "");
    setEditDepartment((user.department as DepartmentType) || "Web Development");
    setEditLocation(user.location || "");
    setEditBio(user.bio || "");
    setEditSkills(user.skills ? user.skills.join(", ") : "");
    setEditPortfolio(user.portfolioUrl || "");
    setIsEditModalOpen(true);
  };

  const handleSendVerification = async () => {
    try {
      await sendVerificationEmail();
      setVerificationSent(true);
      setTimeout(() => setVerificationSent(false), 5000);
      await showAlert(
        "A verification email has been dispatched to your email address. Please check your inbox and spam folder.",
        "Verification Email Sent",
        "success"
      );
    } catch (err: any) {
      await showAlert(
        err?.message || "Failed to send verification email",
        "Verification Error",
        "error"
      );
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const skillsArray = editSkills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (!editName.trim()) {
        await showAlert("Please enter your full name.", "Validation Error", "error");
        setSaving(false);
        return;
      }
      if (!editPhone.trim() || editPhone.trim().length < 7) {
        await showAlert("Please enter a valid phone number (at least 7 digits).", "Validation Error", "error");
        setSaving(false);
        return;
      }
      if (!editTitle.trim()) {
        await showAlert("Please enter your professional title.", "Validation Error", "error");
        setSaving(false);
        return;
      }
      if (!editLocation.trim()) {
        await showAlert("Please enter your location.", "Validation Error", "error");
        setSaving(false);
        return;
      }
      if (!skillsArray.length) {
        await showAlert("Please add at least one skill.", "Validation Error", "error");
        setSaving(false);
        return;
      }
      if (!editBio.trim() || editBio.trim().length < 10) {
        await showAlert("Please enter a professional summary or bio (at least 10 characters).", "Validation Error", "error");
        setSaving(false);
        return;
      }

      await updateUserProfile({
        name: editName.trim(),
        displayName: editName.trim(),
        phone: editPhone.trim(),
        title: editTitle.trim(),
        department: editDepartment,
        location: editLocation.trim(),
        bio: editBio.trim(),
        skills: skillsArray,
        portfolioUrl: editPortfolio.trim() || undefined,
        profileCompleted: true,
      });

      setSaveSuccess("Profile updated successfully!");
      setIsEditModalOpen(false);
      setTimeout(() => setSaveSuccess(null), 4000);
      await showAlert(
        "Your profile information has been saved successfully.",
        "Profile Updated",
        "success"
      );
    } catch (err: any) {
      await showAlert(
        err?.message || "Failed to update profile",
        "Update Error",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  // Reset profile for demo/testing purposes
  const handleResetProfileForDemo = async () => {
    const confirmed = await showConfirm(
      "This will reset your profile completion flag so you can test the 'Complete Profile' form workflow from scratch.\n\nWould you like to reset now?",
      "Reset Profile for Demo Testing",
      {
        type: "info",
        confirmText: "Yes, Reset for Demo",
        cancelText: "Cancel",
      }
    );
    if (!confirmed) return;

    await updateUserProfile({
      profileCompleted: false,
      phone: undefined,
      title: undefined,
      bio: undefined,
      skills: [],
    });
    router.replace("/profile?complete=true");
  };

  const handleSignOut = async () => {
    await logout();
    router.replace("/");
  };

  const candidateAppsCount = user
    ? applications.filter(
        (a) =>
          a.uid === user.uid ||
          (a as any).candidateEmail?.toLowerCase() ===
            user.email.toLowerCase()
      ).length
    : 0;

  if (loading || !user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500">Loading user profile...</p>
      </div>
    );
  }

  // If candidate's profile is not complete (or URL requests ?complete=true)
  if (user.role !== "admin" && (!isProfileComplete(user) || forceCompleteParam)) {
    const missingFields = getMissingProfileFields(user);
    return (
      <div className="max-w-3xl mx-auto py-10 sm:py-16 px-4 sm:px-6 space-y-6">
        {missingFields.length > 0 && !forceCompleteParam && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start gap-3.5 shadow-sm"
          >
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold block text-sm sm:text-base text-amber-900 dark:text-amber-100">
                Profile Details Incomplete
              </strong>
              <p className="text-amber-800 dark:text-amber-300">
                Some required information is missing from your profile. Please complete the details below to unlock your full profile.
              </p>
              <div className="pt-1 flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  Missing information:
                </span>
                {missingFields.map((field) => (
                  <span
                    key={field}
                    className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <CompleteProfileForm
          user={user}
          redirectUrl={redirectParam ? decodeURIComponent(redirectParam) : undefined}
          onCompleted={() => {
            const dest = `/profile?completed=true${
              redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : ""
            }`;
            router.replace(dest);
          }}
        />
      </div>
    );
  }

  // Profile is complete: Render the user's complete profile
  return (
    <div className="max-w-4xl mx-auto py-10 sm:py-16 px-4 sm:px-6 space-y-8">
      {/* Context banner when redirected from Job Application */}
      {redirectParam && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <Briefcase className="w-4 h-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
            <div>
              <span className="font-bold">Your profile is complete!</span> You are ready to submit your job application.
            </div>
          </div>
          <Link
            href={decodeURIComponent(redirectParam)}
            className="ui-btn-primary px-4 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 self-start sm:self-auto hover:scale-105 active:scale-95 transition-transform"
          >
            <span>Continue to Application</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              User Profile
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>100% Complete</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your personal details, credentials, and resume settings.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={openEditModal}
            className="ui-btn-secondary px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>

          <button
            type="button"
            onClick={handleResetProfileForDemo}
            className="px-3 py-2 text-xs font-semibold rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 transition flex items-center gap-1"
            title="Reset profile completion to test the setup form again"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset (Demo)</span>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{saveSuccess}</span>
        </motion.div>
      )}

      {/* Main Profile Card - Displays Full Profile Completely */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.name || (user as any).displayName}
                className="w-16 h-16 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-bold text-2xl flex items-center justify-center shadow-sm">
                {(user.name || (user as any).displayName || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {user.name || (user as any).displayName}
                </h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 uppercase">
                  {user.role}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Profile Complete</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {user.title || "Software Professional"}
                {user.department && ` • ${user.department}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user.role === "candidate" ? (
              <Link
                href="/candidate"
                className="ui-btn-primary px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>My Applications ({candidateAppsCount})</span>
              </Link>
            ) : (
              <Link
                href="/admin"
                className="ui-btn-primary px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Console</span>
              </Link>
            )}
          </div>
        </div>

        {/* Detailed Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-300">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1">
            <span className="text-slate-400 block font-medium">Email Address</span>
            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
              <Mail className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1">
            <span className="text-slate-400 block font-medium">Phone Number</span>
            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <span>{user.phone || "Not specified"}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1">
            <span className="text-slate-400 block font-medium">Location</span>
            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <span>{user.location || "Bengaluru, India"}</span>
            </div>
          </div>

          {user.department && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1">
              <span className="text-slate-400 block font-medium">Department</span>
              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                <span>{user.department}</span>
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1 sm:col-span-2">
            <span className="text-slate-400 block font-medium">Portfolio / GitHub / Web</span>
            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
              <Globe className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              {user.portfolioUrl ? (
                <a
                  href={user.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                >
                  {user.portfolioUrl}
                </a>
              ) : (
                <span className="text-slate-400 font-normal">Not added yet</span>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {user.bio && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              <span>About / Professional Summary</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              {user.bio}
            </p>
          </div>
        )}

        {/* Skills */}
        {user.skills && user.skills.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Skills & Expertise ({user.skills.length})</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {user.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resume Management Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              <span>Resume / Curriculum Vitae</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Your resume is saved in your profile and used automatically when you apply for SoftMax roles.
            </p>
          </div>

          {(user.resumeUrl || (user as any).resumeData) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 self-start sm:self-auto">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Resume Active</span>
            </span>
          )}
        </div>

        {resumeMsg && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
              resumeMsg.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
            }`}
          >
            {resumeMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{resumeMsg.text}</span>
          </div>
        )}

        {user.resumeUrl || (user as any).resumeData ? (
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Candidate Resume on File
                </div>
                <div className="text-[11px] text-slate-500">
                  Attached to your profile & ready for 1-click job applications
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={handleViewResume}
                className="ui-btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View / Download</span>
              </button>

              <button
                type="button"
                disabled={resumeLoading}
                onClick={() =>
                  document.getElementById("profile-resume-replace")?.click()
                }
                className="ui-btn-primary px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{resumeLoading ? "Updating..." : "Replace Resume"}</span>
              </button>

              <button
                type="button"
                disabled={resumeLoading}
                onClick={handleDeleteResume}
                className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg border border-transparent hover:border-rose-200 transition disabled:opacity-50"
                title="Remove resume"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <input
                id="profile-resume-replace"
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={handleResumeUpload}
              />
            </div>
          </div>
        ) : (
          <div
            onClick={() =>
              document.getElementById("profile-resume-input")?.click()
            }
            className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center hover:border-indigo-400 transition cursor-pointer bg-slate-50/50 dark:bg-slate-800/20"
          >
            <input
              id="profile-resume-input"
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleResumeUpload}
            />
            <UploadCloud className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {resumeLoading
                ? "Optimizing & saving resume..."
                : "Click or drag to upload your Resume / CV"}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports PDF, DOC, DOCX up to 20MB. Automatically optimized and saved in your profile.
            </p>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
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
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 text-slate-900 dark:text-white space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Edit Profile Details</h2>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Job Title
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="e.g. Software Engineer"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Department
                    </label>
                    <select
                      value={editDepartment}
                      onChange={(e) => setEditDepartment(e.target.value as DepartmentType)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      placeholder="e.g. Bengaluru, India"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Skills (comma separated)
                  </label>
                  <input
                    type="text"
                    value={editSkills}
                    onChange={(e) => setEditSkills(e.target.value)}
                    placeholder="React, TypeScript, Next.js, Node.js"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Portfolio / GitHub Link
                  </label>
                  <input
                    type="url"
                    value={editPortfolio}
                    onChange={(e) => setEditPortfolio(e.target.value)}
                    placeholder="https://github.com/username"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bio / Summary
                  </label>
                  <textarea
                    rows={3}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="ui-btn-secondary px-4 py-2 text-xs font-semibold rounded-lg hover:scale-105 active:scale-95 transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="ui-btn-primary px-5 py-2 text-xs font-semibold rounded-lg hover:scale-105 active:scale-95 transition-transform"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resume Document Viewer Window */}
      <ResumeViewerModal
        isOpen={isResumeViewerOpen}
        onClose={() => setIsResumeViewerOpen(false)}
        resumeUrl={user?.resumeUrl || (user as any)?.resumeData}
        fileName={user?.resumeFileName || `${user?.name || "Candidate"} - Resume.pdf`}
        candidateName={user?.name || (user as any)?.displayName || "Candidate"}
        jobTitle={user?.title || "Candidate Profile"}
        candidateEmail={user?.email}
      />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-xs text-slate-400">Loading user profile...</div>}>
      <ProfileContent />
    </Suspense>
  );
}
