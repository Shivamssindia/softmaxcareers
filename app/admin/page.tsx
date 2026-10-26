"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useJobs } from "@/context/JobContext";
import { useModal } from "@/context/ModalContext";
import {
  User,
  Job,
  JobApplication,
  ContactMessage,
  JobCategoryType,
  DepartmentType,
  ApplicationStatus,
} from "@/types";
import {
  getAllUsersFromFirestore,
  updateUserInFirestore,
  deleteUserFromFirestore,
  deleteApplicationInFirestore,
  deleteContactMessageFromFirestore,
  getUserByEmailFromFirestore,
  getUserFromFirestore,
} from "@/lib/firestore";
import {
  Shield,
  Briefcase,
  Users,
  Mail,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  Clock,
  Search,
  ExternalLink,
  X,
  Sparkles,
  Filter,
  RotateCcw,
  UserPlus,
  Ban,
  Download,
  GraduationCap, // ✅ EXAM SYSTEM — ADDED
} from "lucide-react";
import {
  ApprovalSyncModal,
  ApprovalSyncStatus,
} from "@/components/admin/ApprovalSyncModal";
import {
  ResumeViewerModal,
  downloadResumeFile,
} from "@/components/ResumeViewerModal";

// ============================================================================
// Consultant payload shape (secret key now lives only on the server route)
// ============================================================================
type ConsultantCandidateData = {
  uid?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  resumeLink?: string;
  skill?: string;
  skillType?: string;
  stream?: string;
  experience?: string;
  ctc?: string;
  marks10?: number;
  marks12?: number;
  graduationMarks?: number;
};

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { showAlert, showConfirm } = useModal();
  const {
    jobs,
    applications,
    contactMessages,
    addJob,
    updateJob,
    deleteJob,
    deleteApplication,
    updateApplicationStatus,
    refreshJobs,
    refreshApplications,
    refreshContactMessages,
  } = useJobs();

  const [activeTab, setActiveTab] = useState<"jobs" | "applications" | "messages" | "users">("jobs");
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Modals & Selection
  const [isAddJobModalOpen, setIsAddJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [viewingResumeApp, setViewingResumeApp] = useState<(JobApplication & Record<string, any>) | null>(null);
  const [approvingAppId, setApprovingAppId] = useState<string | null>(null);
  const [rejectingAppId, setRejectingAppId] = useState<string | null>(null);
  const [deletingAppId, setDeletingAppId] = useState<string | null>(null);

  // Resume Viewer Window Modal State
  const [resumeModalData, setResumeModalData] = useState<{
    isOpen: boolean;
    resumeUrl?: string | null;
    fileName?: string | null;
    candidateName?: string | null;
    jobTitle?: string | null;
    candidateEmail?: string | null;
  }>({
    isOpen: false,
  });

  const openResumeViewer = (data: {
    resumeUrl?: string | null;
    fileName?: string | null;
    candidateName?: string | null;
    jobTitle?: string | null;
    candidateEmail?: string | null;
  }) => {
    setResumeModalData({
      isOpen: true,
      ...data,
    });
  };

  // Approval Sync Modal State (Processing, Success & Warning)
  const [approvalModalState, setApprovalModalState] = useState<{
    isOpen: boolean;
    status: ApprovalSyncStatus;
    app: (JobApplication & Record<string, any>) | null;
    candidateName: string;
    candidateEmail?: string;
    jobTitle: string;
    errorDetails?: string;
  }>({
    isOpen: false,
    status: "processing",
    app: null,
    candidateName: "",
    candidateEmail: "",
    jobTitle: "",
  });

  // Application Filter States (Role, Status, Experience, Name)
  const [appNameFilter, setAppNameFilter] = useState("");
  const [appRoleFilter, setAppRoleFilter] = useState("all");
  const [appStatusFilter, setAppStatusFilter] = useState("all");
  const [appExpFilter, setAppExpFilter] = useState("all");
  const [jobSearch, setJobSearch] = useState("");

  // Job Form State
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<JobCategoryType>("Tech");
  const [formDept, setFormDept] = useState<DepartmentType>("Web Development");
  const [formLocation, setFormLocation] = useState("Bengaluru, India (Hybrid)");
  const [formType, setFormType] = useState<Job["type"]>("Full-time");
  const [formExperience, setFormExperience] = useState("3 - 5 Years");
  const [formSalary, setFormSalary] = useState("₹18,00,000 - ₹26,00,000 / year");
  const [formDesc, setFormDesc] = useState("");
  const [formResponsibilities, setFormResponsibilities] = useState("");
  const [formRequirements, setFormRequirements] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "closed">("active");

  // Route protection: only admin allowed
  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace("/");
    }
  }, [user, loading, router]);

  // Fetch registered users
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const all = await getAllUsersFromFirestore();
      setUsersList(all);
    } catch (e) {
      console.warn("Could not fetch registered users:", e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users" || usersList.length === 0) {
      fetchUsers();
    }
  }, [activeTab]);

  const handleToggleUserRole = async (targetUser: User) => {
    const isCurrentAdmin = targetUser.role === "admin";
    const newRole = isCurrentAdmin ? "candidate" : "admin";

    const confirmed = await showConfirm(
      `Change role of ${targetUser.name || (targetUser as any).displayName} to ${newRole.toUpperCase()}?`,
      "Change User Role",
      {
        type: "warning",
        confirmText: `Switch to ${newRole.toUpperCase()}`,
        cancelText: "Cancel",
      }
    );
    if (!confirmed) return;

    try {
      await updateUserInFirestore(targetUser.uid, {
        role: newRole,
      });
      setUsersList((prev) =>
        prev.map((u) => (u.uid === targetUser.uid ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      await showAlert("Failed to update user role.", "Error", "error");
    }
  };

  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");

  const handleDeleteUser = async (targetUser: User) => {
    if (user && targetUser.uid === user.uid) {
      await showAlert(
        "Security Protection: You cannot delete your own logged-in administrator account.",
        "Security Notice",
        "warning"
      );
      return;
    }

    const displayName =
      targetUser.name || (targetUser as any).displayName || targetUser.email || "this candidate";
    const roleLabel = targetUser.role === "admin" ? "Administrator" : "Candidate";

    const confirmed = await showConfirm(
      `Are you sure you want to permanently delete ${roleLabel} "${displayName}" (${targetUser.email})?\n\nThis will remove their profile from the database. This action cannot be undone.`,
      "Delete User Profile",
      {
        type: "danger",
        confirmText: "Yes, Delete Profile",
        cancelText: "Keep User",
      }
    );
    if (!confirmed) return;

    setDeletingUserId(targetUser.uid);
    try {
      await deleteUserFromFirestore(targetUser.uid);
      setUsersList((prev) => prev.filter((u) => u.uid !== targetUser.uid));
    } catch (err: any) {
      console.error("Failed to delete user:", err);
      await showAlert(err?.message || "Failed to delete candidate profile.", "Error", "error");
    } finally {
      setDeletingUserId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      if (userRoleFilter !== "all" && u.role !== userRoleFilter) return false;
      if (userSearchQuery.trim()) {
        const q = userSearchQuery.toLowerCase();
        const matchesName = (u.name || (u as any).displayName || "").toLowerCase().includes(q);
        const matchesEmail = (u.email || "").toLowerCase().includes(q);
        const matchesTitle = (u.title || "").toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesTitle) return false;
      }
      return true;
    });
  }, [usersList, userRoleFilter, userSearchQuery]);

  // Job modal opener
  const openCreateModal = () => {
    setEditingJob(null);
    setFormTitle("");
    setFormCategory("Tech");
    setFormDept("Web Development");
    setFormLocation("Bengaluru, India (Hybrid)");
    setFormType("Full-time");
    setFormExperience("3 - 5 Years");
    setFormSalary("₹18,00,000 - ₹26,00,000 / year");
    setFormDesc("");
    setFormResponsibilities("Ship clean, scalable software.\nCollaborate across technical specifications.");
    setFormRequirements("Strong problem solving.\nExperience with modern stacks.");
    setFormTags("Next.js, TypeScript, React");
    setFormStatus("active");
    setIsAddJobModalOpen(true);
  };

  const openEditModal = (job: Job) => {
    setEditingJob(job);
    setFormTitle(job.title);
    setFormCategory(job.category);
    setFormDept(job.department);
    setFormLocation(job.location);
    setFormType(job.type);
    setFormExperience(job.experience);
    setFormSalary(job.salaryRange);
    setFormDesc(job.description);
    setFormResponsibilities(job.responsibilities.join("\n"));
    setFormRequirements(job.requirements.join("\n"));
    setFormTags(job.tags.join(", "));
    setFormStatus(job.status);
    setIsAddJobModalOpen(true);
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    const responsibilities = formResponsibilities.split("\n").map((r) => r.trim()).filter(Boolean);
    const requirements = formRequirements.split("\n").map((r) => r.trim()).filter(Boolean);
    const tags = formTags.split(",").map((t) => t.trim()).filter(Boolean);

    try {
      if (editingJob) {
        await updateJob(editingJob.id, {
          title: formTitle,
          category: formCategory,
          department: formDept,
          location: formLocation,
          type: formType,
          experience: formExperience,
          salaryRange: formSalary,
          description: formDesc,
          responsibilities,
          requirements,
          tags,
          status: formStatus,
        });
      } else {
        await addJob({
          title: formTitle,
          category: formCategory,
          department: formDept,
          location: formLocation,
          type: formType,
          experience: formExperience,
          salaryRange: formSalary,
          description: formDesc,
          responsibilities,
          requirements,
          tags,
          status: formStatus,
        });
      }
      setIsAddJobModalOpen(false);
    } catch (err: any) {
      await showAlert(err?.message || "Failed to save job opening.", "Error", "error");
    }
  };

  const handleDeleteJob = async (id: string, title: string) => {
    const confirmed = await showConfirm(
      `Are you sure you want to delete job "${title}"? This cannot be undone.`,
      "Delete Job Opening",
      {
        type: "danger",
        confirmText: "Yes, Delete Job",
        cancelText: "Cancel",
      }
    );
    if (confirmed) {
      try {
        await deleteJob(id);
        await showAlert(`Job opening "${title}" has been deleted.`, "Job Deleted", "success");
      } catch (err: any) {
        await showAlert(err?.message || "Failed to delete job opening.", "Error", "error");
      }
    }
  };

  const handleToggleJobStatus = async (job: Job) => {
    const nextStatus = job.status === "active" ? "closed" : "active";
    const confirmed = await showConfirm(
      `Are you sure you want to ${nextStatus === "closed" ? "close" : "reopen"} the opening for "${job.title}"? ${
        nextStatus === "closed"
          ? "It will still be visible in /openings but candidates will have the apply button disabled."
          : "Candidates will now be able to apply."
      }`,
      nextStatus === "closed" ? "Close Job Opening" : "Reopen Job Opening",
      {
        type: nextStatus === "closed" ? "danger" : "info",
        confirmText: nextStatus === "closed" ? "Yes, Close Job" : "Yes, Reopen Job",
        cancelText: "Cancel",
      }
    );
    if (confirmed) {
      try {
        await updateJob(job.id, { status: nextStatus });
        await showAlert(`Job "${job.title}" is now marked as ${nextStatus}.`, "Status Updated", "success");
      } catch (err: any) {
        await showAlert(err?.message || "Failed to update job status.", "Error", "error");
      }
    }
  };

  // ==========================================================================
  // SECURE CALL to Consultant API via our Next.js server route.
  // The secret api key is NEVER sent by this client component.
  // ==========================================================================
  const syncCandidateToConsultant = async (
    application: JobApplication
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      // 1) Resolve candidate user profile
      let profile: User | null = null;

      const uidFromApp = application.uid || ((application as any).candidateUid as string | undefined);
      if (uidFromApp) {
        profile = await getUserFromFirestore(uidFromApp);
      }
      if (!profile && (application as any).candidateEmail) {
        profile = await getUserByEmailFromFirestore((application as any).candidateEmail);
      }

      // 2) Build the payload — exact keys expected by the external backend
      const candidate: ConsultantCandidateData = {
        uid: profile?.uid || uidFromApp || application.id,
        name: profile?.name || (profile as any)?.displayName || (application as any).candidateName || "",
        email: profile?.email || (application as any).candidateEmail || "",
        phoneNumber: profile?.phone || (application as any).candidatePhone || "",
        resumeLink:
          (application as any).resumeUrl || profile?.resumeUrl || (profile as any)?.resumeData || "",
        skill:
          profile?.skills && profile.skills.length > 0
            ? profile.skills.join(", ")
            : "",
        skillType: (profile as any)?.skillType || profile?.department || "",
        stream: (profile as any)?.stream || "",
        experience: application.experienceYears || "",
        ctc: String((profile as any)?.ctc ?? ""),
        marks10: Number((profile as any)?.marks10 ?? 0),
        marks12: Number((profile as any)?.marks12 ?? 0),
        graduationMarks: Number((profile as any)?.graduationMarks ?? 0),
      };

      // Sanity check required fields before hitting the server route
      if (!candidate.uid || !candidate.name || !candidate.email) {
        return {
          ok: false,
          error:
            "Missing required candidate fields (uid / name / email). " +
            "Ensure the user profile exists.",
        };
      }

      // 3) Call our Next.js server route (server-side fetch with secret key)
      const res = await axios.post("/api/consultant", candidate, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("[consultant] sync success:", res.status, res.data);
      return { ok: true };
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        if (err.response) {
          const data = err.response.data as any;
          const msg =
            (typeof data === "string" ? data : data?.message || data?.error) ||
            `HTTP ${err.response.status} ${err.response.statusText}`;
          return { ok: false, error: msg };
        }
        return {
          ok: false,
          error:
            err.message ||
            "Network connection error — check network and server availability.",
        };
      }
      return { ok: false, error: err?.message || "Unknown error calling Consultant service." };
    }
  };

  // ==========================================================================
  // Application status handlers
  // ==========================================================================
  const handleApproveApplication = async (app: JobApplication) => {
    const cand = usersList.find((u) => u.uid === app.uid);
    const candName = (app as any).candidateName || cand?.name || (cand as any)?.displayName || "Candidate";
    const candEmail = (app as any).candidateEmail || cand?.email || "";
    const jobTitle = (app as any).jobTitle || jobs.find((j) => j.id === app.jobId)?.title || "Role Application";

    setApprovingAppId(app.id);

    // 1) Open popup window immediately with processing effect
    setApprovalModalState({
      isOpen: true,
      status: "processing",
      app,
      candidateName: candName,
      candidateEmail: candEmail,
      jobTitle,
      errorDetails: undefined,
    });

    try {
      // 2) Commit local approval first
      await updateApplicationStatus(app.id, "Approved");

      // 3) Secure server-side consultant backend call
      const result = await syncCandidateToConsultant(app);

      // 4) Reflect status in the open review modal if present
      if (viewingResumeApp?.id === app.id) {
        setViewingResumeApp({ ...viewingResumeApp, status: "Approved" });
      }

      // 5) Transition modal to success or warning based on external response
      if (result.ok) {
        setApprovalModalState((prev) => ({
          ...prev,
          status: "success",
        }));
      } else {
        console.error("[approve] consultant sync failed:", result.error);
        setApprovalModalState((prev) => ({
          ...prev,
          status: "warning",
          errorDetails:
            result.error ||
            "The external consultant service returned an unconfirmed response. Please verify external service status.",
        }));
      }
    } catch (err: any) {
      console.error("[approve] unexpected error:", err);
      setApprovalModalState((prev) => ({
        ...prev,
        status: "warning",
        errorDetails:
          err?.message || "Failed to communicate with external consultant service.",
      }));
    } finally {
      setApprovingAppId(null);
    }
  };

  const handleRetryApprovalSync = async () => {
    if (!approvalModalState.app) return;
    const targetApp = approvalModalState.app;

    setApprovalModalState((prev) => ({
      ...prev,
      status: "processing",
      errorDetails: undefined,
    }));

    try {
      const result = await syncCandidateToConsultant(targetApp);
      if (result.ok) {
        setApprovalModalState((prev) => ({
          ...prev,
          status: "success",
        }));
      } else {
        setApprovalModalState((prev) => ({
          ...prev,
          status: "warning",
          errorDetails: result.error || "External consultant sync failed on retry.",
        }));
      }
    } catch (err: any) {
      setApprovalModalState((prev) => ({
        ...prev,
        status: "warning",
        errorDetails: err?.message || "Retry attempt encountered a network error.",
      }));
    }
  };

  const handleRejectApplication = async (app: JobApplication) => {
    const candName = (app as any).candidateName || usersList.find((u) => u.uid === app.uid)?.name || "Candidate";
    const confirmed = await showConfirm(
      `Mark application from ${candName} as Rejected?`,
      "Reject Application",
      {
        type: "danger",
        confirmText: "Mark Rejected",
        cancelText: "Cancel",
      }
    );
    if (!confirmed) return;

    setRejectingAppId(app.id);
    try {
      await updateApplicationStatus(app.id, "Rejected");
      if (viewingResumeApp?.id === app.id) {
        setViewingResumeApp({ ...viewingResumeApp, status: "Rejected" });
      }
    } catch (err: any) {
      await showAlert("Failed to reject application.", "Error", "error");
    } finally {
      setRejectingAppId(null);
    }
  };

  const handleSwitchStatus = async (
    app: JobApplication,
    newStatus: ApplicationStatus
  ) => {
    if (app.status === newStatus) return;

    if (newStatus === "Approved") {
      await handleApproveApplication(app);
      return;
    }

    if (newStatus === "Rejected") {
      await handleRejectApplication(app);
      return;
    }

    if (newStatus === "Cancelled") {
      const candName = (app as any).candidateName || usersList.find((u) => u.uid === app.uid)?.name || "Candidate";
      const confirmed = await showConfirm(
        `Mark application from ${candName} as Cancelled?`,
        "Cancel Application",
        {
          type: "danger",
          confirmText: "Mark Cancelled",
          cancelText: "Keep Status",
        }
      );
      if (!confirmed) return;
      try {
        await updateApplicationStatus(app.id, "Cancelled");
        if (viewingResumeApp?.id === app.id) {
          setViewingResumeApp({ ...viewingResumeApp, status: "Cancelled" });
        }
      } catch (err: any) {
        await showAlert("Failed to update application status.", "Error", "error");
      }
      return;
    }

    if (newStatus === "Pending") {
      const candName = (app as any).candidateName || usersList.find((u) => u.uid === app.uid)?.name || "Candidate";
      const confirmed = await showConfirm(
        `Switch status of application from ${candName} back to Pending?`,
        "Reactivate Application",
        {
          type: "warning",
          confirmText: "Switch to Pending",
          cancelText: "Cancel",
        }
      );
      if (!confirmed) return;

      try {
        await updateApplicationStatus(app.id, "Pending");
        if (viewingResumeApp?.id === app.id) {
          setViewingResumeApp({ ...viewingResumeApp, status: "Pending" });
        }
      } catch (err: any) {
        await showAlert("Failed to update application status.", "Error", "error");
      }
    }
  };

  const handleDeleteApplication = async (id: string, name: string) => {
    const confirmed = await showConfirm(
      `Are you sure you want to delete the application for "${name}"? This action cannot be undone.`,
      "Delete Application",
      {
        type: "danger",
        confirmText: "Yes, Delete",
        cancelText: "Cancel",
      }
    );
    if (confirmed) {
      setDeletingAppId(id);
      try {
        if (deleteApplication) {
          await deleteApplication(id);
        } else {
          await deleteApplicationInFirestore(id);
          await refreshApplications();
        }
      } catch (err) {
        await showAlert("Failed to delete application.", "Error", "error");
      } finally {
        setDeletingAppId(null);
      }
    }
  };

  const handleDeleteMessage = async (id: string) => {
    const confirmed = await showConfirm(
      "Are you sure you want to delete this contact inquiry?",
      "Delete Contact Message",
      {
        type: "danger",
        confirmText: "Yes, Delete",
        cancelText: "Cancel",
      }
    );
    if (confirmed) {
      try {
        await deleteContactMessageFromFirestore(id);
        await refreshContactMessages();
      } catch (err) {
        await showAlert("Failed to delete contact message.", "Error", "error");
      }
    }
  };

  // Filtered lists
  const filteredJobs = jobs.filter((j) => {
    if (!jobSearch.trim()) return true;
    const q = jobSearch.toLowerCase();
    return j.title.toLowerCase().includes(q) || j.department.toLowerCase().includes(q);
  });

  // Available unique roles for filter dropdown
  const availableRoles = useMemo(() => {
    const rolesFromApps = applications.map((a) => a.jobTitle?.trim()).filter(Boolean);
    const rolesFromJobs = jobs.map((j) => j.title?.trim()).filter(Boolean);
    return Array.from(new Set([...rolesFromApps, ...rolesFromJobs])).sort();
  }, [applications, jobs]);

  // Available unique experience levels for filter dropdown
  const availableExperiences = useMemo(() => {
    const expsFromApps = applications.map((a) => a.experienceYears?.trim()).filter(Boolean);
    const standardExps = [
      "Fresher (0 - 1 Year)",
      "1 - 3 Years",
      "3 - 5 Years",
      "5 - 8 Years",
      "8+ Years",
    ];
    return Array.from(new Set([...expsFromApps, ...standardExps])).sort();
  }, [applications]);

  const isAnyAppFilterActive =
    appNameFilter.trim() !== "" ||
    appRoleFilter !== "all" ||
    appStatusFilter !== "all" ||
    appExpFilter !== "all";

  const resetAppFilters = () => {
    setAppNameFilter("");
    setAppRoleFilter("all");
    setAppStatusFilter("all");
    setAppExpFilter("all");
  };

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // 1. Role Filter
      if (appRoleFilter !== "all") {
        const candRole = (app.jobTitle || "").trim().toLowerCase();
        const targetRole = appRoleFilter.trim().toLowerCase();
        if (candRole !== targetRole && !candRole.includes(targetRole)) {
          return false;
        }
      }

      // 2. Status Filter
      if (appStatusFilter !== "all" && app.status !== appStatusFilter) {
        return false;
      }

      // 3. Experience Filter
      if (appExpFilter !== "all") {
        const candExp = (app.experienceYears || "").trim().toLowerCase();
        const targetExp = appExpFilter.trim().toLowerCase();
        if (
          candExp !== targetExp &&
          !candExp.includes(targetExp) &&
          !targetExp.includes(candExp)
        ) {
          return false;
        }
      }

      // 4. Name Filter (Candidate Name)
      if (appNameFilter.trim()) {
        const q = appNameFilter.trim().toLowerCase();
        const cand = usersList.find((u) => u.uid === app.uid);
        const matchesName = (((app as any).candidateName || cand?.name || (cand as any)?.displayName || "") as string).toLowerCase().includes(q);
        const matchesEmail = (((app as any).candidateEmail || cand?.email || "") as string).toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) {
          return false;
        }
      }

      return true;
    });
  }, [applications, usersList, appRoleFilter, appStatusFilter, appExpFilter, appNameFilter]);

  const viewingCandidate = viewingResumeApp ? usersList.find((u) => u.uid === viewingResumeApp.uid) : null;
  const viewingJob = viewingResumeApp ? jobs.find((j) => j.id === viewingResumeApp.jobId) : null;
  const [directCandidateResume, setDirectCandidateResume] = useState<string | null>(null);

  useEffect(() => {
    if (viewingResumeApp?.uid) {
      setDirectCandidateResume(null);
      getUserFromFirestore(viewingResumeApp.uid).then((u) => {
        if (u) {
          const r = u.resumeUrl || (u as any).resumeData;
          if (r) setDirectCandidateResume(r);
        }
      }).catch(() => {});
    }
  }, [viewingResumeApp]);

  const viewingResumeUrl = viewingResumeApp
    ? (viewingResumeApp as any).resumeUrl ||
      viewingCandidate?.resumeUrl ||
      directCandidateResume ||
      (viewingResumeApp as any).resumeDataUrl ||
      (viewingCandidate as any)?.resumeData
    : null;

  const handleViewResume = (src?: string | null) => {
    if (!src) return;
    openResumeViewer({
      resumeUrl: src,
      fileName: (viewingResumeApp as any)?.resumeFileName || "Candidate Resume.pdf",
      candidateName:
        (viewingResumeApp as any)?.candidateName ||
        viewingCandidate?.name ||
        (viewingCandidate as any)?.displayName ||
        "Candidate",
      jobTitle: (viewingResumeApp as any)?.jobTitle || viewingJob?.title || "Role Application",
      candidateEmail: (viewingResumeApp as any)?.candidateEmail || viewingCandidate?.email,
    });
  };

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Admin Portal
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Active Management
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage job postings, review candidate applications, and respond to inquiries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start">
          <Link
            href="/admin/uploadByRecruter"
            className="ui-btn-secondary text-xs font-semibold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 text-slate-700 dark:text-slate-200 transition"
          >
            <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Recruiter Candidate Upload</span>
          </Link>

          {/* ✅ EXAM SYSTEM — ADDED: Exam Dashboard button */}
          <Link
            href="/exam/admin"
            className="ui-btn-secondary text-xs font-semibold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 text-slate-700 dark:text-slate-200 transition"
          >
            <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Exam Dashboard</span>
          </Link>

          <button
            type="button"
            onClick={openCreateModal}
            className="ui-btn-primary text-xs font-semibold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Post New Opening</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {/* ✅ EXAM SYSTEM — ADDED: widened to lg:grid-cols-5 to fit Exam Center card */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Total Openings</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {jobs.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {jobs.filter((j) => j.status === "active").length} active
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Applications</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {applications.length}
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
            {applications.filter((a) => a.status === "Pending").length} pending review
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Contact Messages</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {contactMessages.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">From contact page</div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Registered Users</div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
            {usersList.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Platform user accounts</div>
        </div>

        {/* ✅ EXAM SYSTEM — ADDED: Exam Center card */}
        <Link
          href="/exam/admin"
          className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/40 dark:to-slate-900 shadow-sm hover:shadow-md transition group"
        >
          <div className="text-xs font-semibold text-indigo-500 uppercase inline-flex items-center gap-1">
            <GraduationCap className="w-3 h-3" />
            Exam Center
          </div>
          <div className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-1 group-hover:scale-105 transition-transform inline-block">
            →
          </div>
          <div className="text-[11px] text-indigo-500/80 mt-1">Manage exams & enrollments</div>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        <button          onClick={() => setActiveTab("jobs")}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "jobs"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Job Openings ({jobs.length})
        </button>
        <button
          onClick={() => setActiveTab("applications")}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "applications"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Applications ({applications.length})
        </button>
        <button
          onClick={() => setActiveTab("messages")}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "messages"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Messages ({contactMessages.length})
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "users"
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Users ({usersList.length})
        </button>
      </div>

      {/* TAB 1: JOB OPENINGS */}
      {activeTab === "jobs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Filter jobs by title..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <span className="text-xs text-slate-500">
              Showing {filteredJobs.length} openings
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">Position</th>
                    <th className="p-3.5">Department</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Mode</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">{job.title}</div>
                        <div className="text-[11px] text-slate-500 leading-relaxed mb-4 line-clamp-1 class-leadaxed md-4">{job.salaryRange}</div>
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300">{job.department}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            job.category === "Non-Tech"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                              : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          }`}
                        >
                          {job.category}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500">{job.type}</td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleJobStatus(job)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition hover:scale-105 active:scale-95 inline-flex items-center gap-1.5 ${
                            job.status === "active"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                          }`}
                          title={`Click to ${job.status === "active" ? "close" : "reopen"} this job opening`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              job.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                            }`}
                          />
                          <span className="capitalize">{job.status}</span>
                        </button>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEditModal(job)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 transition"
                            title="Edit Job"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span className="text-xs">Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteJob(job.id, job.title)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1 transition"
                            title="Delete Job"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-xs">Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CANDIDATE APPLICATIONS */}
      {activeTab === "applications" && (
        <div className="space-y-4">
          {/* Applications Filter Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Application Filters
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/60 dark:border-indigo-800/60">
                  {filteredApplications.length} of {applications.length}
                </span>
              </div>

              {isAnyAppFilterActive && (
                <button
                  type="button"
                  onClick={resetAppFilters}
                  className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-medium transition-colors self-start sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Candidate Name Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Candidate Name
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={appNameFilter}
                    onChange={(e) => setAppNameFilter(e.target.value)}
                    placeholder="Filter by name..."
                    className="w-full pl-8 pr-7 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                  />
                  {appNameFilter && (
                    <button
                      type="button"
                      onClick={() => setAppNameFilter("")}
                      className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title="Clear candidate name"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Role Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Role (Job Title)
                </label>
                <select
                  value={appRoleFilter}
                  onChange={(e) => setAppRoleFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                >
                  <option value="all">All Roles ({availableRoles.length})</option>
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Status Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={appStatusFilter}
                  onChange={(e) => setAppStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* 4. Experience Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Experience
                </label>
                <select
                  value={appExpFilter}
                  onChange={(e) => setAppExpFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
                >
                  <option value="all">All Experience</option>
                  {availableExperiences.map((exp) => (
                    <option key={exp} value={exp}>
                      {exp}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">Candidate</th>
                    <th className="p-3.5">Applied For</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5 text-right">Review & Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredApplications.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center">
                        <div className="max-w-xs mx-auto text-center space-y-2">
                          <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            No applications found
                          </p>
                          <p className="text-xs text-slate-400">
                            {isAnyAppFilterActive
                              ? "No applications match your active filters. Try resetting or adjusting your criteria."
                              : "No candidate applications recorded yet."}
                          </p>
                          {isAnyAppFilterActive && (
                            <button
                              type="button"
                              onClick={resetAppFilters}
                              className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold pt-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Reset all filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredApplications.map((app) => {
                      const cand = usersList.find((u) => u.uid === app.uid);
                      const candName = (app as any).candidateName || cand?.name || (cand as any)?.displayName || "Candidate";
                      const candEmail = (app as any).candidateEmail || cand?.email || "—";
                      const candPhone = (app as any).candidatePhone || cand?.phone || "";
                      const roleTitle = (app as any).jobTitle || jobs.find((j) => j.id === app.jobId)?.title || "Role Application";
                      const appResume =
                        (app as any).resumeUrl ||
                        (app as any).resumeDataUrl ||
                        cand?.resumeUrl ||
                        (cand as any)?.resumeData ||
                        null;
                      const appResumeName =
                        (app as any).resumeFileName ||
                        cand?.resumeFileName ||
                        `${candName} - Resume.pdf`;
                      return (
                      <tr key={app.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850">
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900 dark:text-white">{candName}</div>
                          <div className="text-[11px] text-slate-500 leading-relaxed mb-4 line-clamp-1 class-leadaxed md-4">{candEmail}</div>
                          {candPhone && (
                            <div className="text-[11px] text-slate-400">{candPhone}</div>
                          )}
                        </td>
                        <td className="p-3.5">
                          <div className="font-medium text-slate-900 dark:text-white">{roleTitle}</div>
                          <div className="text-[11px] text-slate-400 leading-relaxed mb-4 line-clamp-1 class-leadaxed md-4">Exp: {app.experienceYears}</div>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              app.status === "Approved"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : app.status === "Rejected"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                : app.status === "Cancelled"
                                ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {app.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500">
                          {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : "Recent"}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {appResume && (
                              <button
                                type="button"
                                onClick={() =>
                                  openResumeViewer({
                                    resumeUrl: appResume,
                                    fileName: appResumeName,
                                    candidateName: candName,
                                    jobTitle: roleTitle,
                                    candidateEmail: candEmail,
                                  })
                                }
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 inline-flex items-center gap-1 transition shadow-xs"
                                title="Open resume window"
                              >
                                <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span>Resume</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setViewingResumeApp(app)}
                              className="ui-btn-secondary px-2.5 py-1 text-xs font-semibold rounded-lg hover:border-indigo-400 transition inline-flex items-center gap-1"
                            >
                              Review
                            </button>
                            
                            <button
                              type="button"
                              disabled={deletingAppId === app.id}
                              onClick={() => handleDeleteApplication(app.id, candName)}
                              className="px-2.5 py-1 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 transition inline-flex items-center gap-1 text-xs font-semibold disabled:opacity-40"
                              title="Delete application"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{deletingAppId === app.id ? "Deleting..." : "Delete"}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONTACT INQUIRIES */}
      {activeTab === "messages" && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Sender</th>
                  <th className="p-3.5">Topic</th>
                  <th className="p-3.5">Message</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {contactMessages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">{msg.name}</div>
                      <div className="text-[11px] text-slate-500 leading-relaxed mb-4 line-clamp-1 class-leadaxed md-4">{msg.email}</div>
                      {msg.phone && <div className="text-[11px] text-slate-400">{msg.phone}</div>}
                    </td>
                    <td className="p-3.5 text-indigo-600 dark:text-indigo-400 font-medium">
                      {msg.service}
                    </td>
                    <td className="p-3.5 max-w-sm text-slate-600 dark:text-slate-300">
                      <div className="leading-relaxed mb-4 line-clamp-1 class-leadaxed md-4">{msg.message}</div>
                    </td>
                    <td className="p-3.5 text-slate-500">
                      {msg.submittedAt ? new Date(msg.submittedAt).toLocaleDateString() : "Recent"}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: USERS MANAGEMENT */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* User Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 max-w-md w-full">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search users by name, email, or title..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Roles</option>
                <option value="candidate">Candidates</option>
                <option value="admin">Administrators</option>
              </select>
            </div>

            <span className="text-xs text-slate-500">
              Showing {filteredUsers.length} of {usersList.length} registered accounts
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">User Profile</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Registered</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No user accounts match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-850">
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {u.name || (u as any).displayName || "User"}
                          </div>
                          <div className="text-[11px] text-slate-400 leading-relaxed mb-4 line-clamp-1 class-leadaxed md-4">{u.title || "User"}</div>
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-300">{u.email}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              u.role === "admin"
                                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "Recent"}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(u.resumeUrl || (u as any).resumeData) && (
                              <button
                                type="button"
                                onClick={() =>
                                  openResumeViewer({
                                    resumeUrl: u.resumeUrl || (u as any).resumeData,
                                    fileName: u.resumeFileName || `${u.name || "Candidate"} - Resume.pdf`,
                                    candidateName: u.name || (u as any).displayName || "Candidate",
                                    candidateEmail: u.email,
                                    jobTitle: u.title || "Registered Candidate",
                                  })
                                }
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 inline-flex items-center gap-1 transition shadow-xs"
                                title="Open candidate resume window"
                              >
                                <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span>Resume</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleToggleUserRole(u)}
                              className="ui-btn-secondary px-2.5 py-1 text-xs font-semibold rounded-lg hover:border-indigo-400 transition"
                              title={`Toggle role to ${u.role === "admin" ? "Candidate" : "Admin"}`}
                            >
                              Make {u.role === "admin" ? "Candidate" : "Admin"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              disabled={deletingUserId === u.uid || (user && u.uid === user.uid)}
                              className="px-2.5 py-1 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 transition inline-flex items-center gap-1 text-xs font-semibold disabled:opacity-40"
                              title={
                                user && u.uid === user.uid
                                  ? "Cannot delete your own admin account"
                                  : `Permanently delete ${u.name || u.email}`
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{deletingUserId === u.uid ? "Deleting..." : "Delete"}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT JOB MODAL */}
      <AnimatePresence>
        {isAddJobModalOpen && (
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
              className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 text-slate-900 dark:text-white space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  {editingJob ? "Edit Job Opening" : "Create New Job Opening"}
                </h2>
                <button
                  onClick={() => setIsAddJobModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

            <form onSubmit={handleSaveJob} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Senior Full Stack Engineer"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as JobCategoryType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Tech">Tech</option>
                    <option value="Non-Tech">Non-Tech</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Department *</label>
                  <select
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value as DepartmentType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="">Select Department</option>
                    <option value="Head">Head</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Business Developement">Business Developement</option>
                    <option value="Finencial">Finencial</option>
                    <option value="AI & Software Engineering">AI & Software Engineering</option>
                    <option value="IT Project Management">IT Project Management</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Location *</label>
                  <input
                    type="text"
                    required
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Bengaluru, India (Hybrid)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Work Mode</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as Job["type"])}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Experience *</label>
                  <input
                    type="text"
                    required
                    value={formExperience}
                    onChange={(e) => setFormExperience(e.target.value)}
                    placeholder="3 - 5 Years"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Salary Range *</label>
                  <input
                    type="text"
                    required
                    value={formSalary}
                    onChange={(e) => setFormSalary(e.target.value)}
                    placeholder="₹18,00,000 - ₹26,00,000 / year"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Role Description *</label>
                <textarea
                  required
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Summary of the role responsibilities and mission..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Responsibilities (One per line)</label>
                <textarea
                  rows={3}
                  value={formResponsibilities}
                  onChange={(e) => setFormResponsibilities(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Requirements (One per line)</label>
                <textarea
                  rows={3}
                  value={formRequirements}
                  onChange={(e) => setFormRequirements(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Key Skill Tags (comma separated)</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="React, Next.js, Node.js"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as "active" | "closed")}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                >
                  <option value="active">Active (Open for applications on job board)</option>
                  <option value="closed">Closed (Visible on /openings with Apply disabled)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddJobModalOpen(false)}
                  className="ui-btn-secondary px-4 py-2 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ui-btn-primary px-5 py-2 text-xs font-semibold rounded-lg hover:scale-105 active:scale-95 transition-transform"
                >
                  {editingJob ? "Update Job" : "Create Job"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* REVIEW APPLICATION MODAL */}
    <AnimatePresence>
      {viewingResumeApp && (
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
            className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 text-slate-900 dark:text-white space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Candidate Application</h2>
              <button
                onClick={() => setViewingResumeApp(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block">Candidate:</span>
                  <span className="font-semibold">
                    {(viewingResumeApp as any).candidateName || viewingCandidate?.name || (viewingCandidate as any)?.displayName || "Candidate"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Email:</span>
                  <span className="font-semibold">
                    {(viewingResumeApp as any).candidateEmail || viewingCandidate?.email || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Role:</span>
                  <span className="font-semibold">
                    {(viewingResumeApp as any).jobTitle || viewingJob?.title || "Role Application"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Experience:</span>
                  <span className="font-semibold">{viewingResumeApp.experienceYears}</span>
                </div>
              </div>

              {(viewingCandidate?.portfolioUrl || (viewingResumeApp as any).portfolioUrl) && (
                <div>
                  <span className="text-slate-400 block mb-0.5">Portfolio / Link:</span>
                  <a
                    href={viewingCandidate?.portfolioUrl || (viewingResumeApp as any).portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>{viewingCandidate?.portfolioUrl || (viewingResumeApp as any).portfolioUrl}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <div>
                <span className="text-slate-400 block mb-0.5">Cover Note:</span>
                <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 leading-relaxed">
                  {viewingResumeApp.description}
                </p>
              </div>

              {((viewingResumeApp as any).resumeFileName || viewingResumeUrl) && (
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <span className="font-semibold text-slate-900 dark:text-white truncate block text-xs">
                        {(viewingResumeApp as any).resumeFileName || "Candidate Resume.pdf"}
                      </span>
                      <span className="text-[11px] text-slate-400">Attached resume document</span>
                    </div>
                  </div>
                  {viewingResumeUrl && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          openResumeViewer({
                            resumeUrl: viewingResumeUrl,
                            fileName: (viewingResumeApp as any).resumeFileName || "Candidate Resume.pdf",
                            candidateName:
                              (viewingResumeApp as any).candidateName ||
                              viewingCandidate?.name ||
                              (viewingCandidate as any)?.displayName ||
                              "Candidate",
                            jobTitle: (viewingResumeApp as any).jobTitle || viewingJob?.title || "Role Application",
                            candidateEmail: (viewingResumeApp as any).candidateEmail || viewingCandidate?.email,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition shadow-sm hover:scale-105 active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Resume</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadResumeFile(
                            viewingResumeUrl,
                            (viewingResumeApp as any).resumeFileName || "resume.pdf"
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold inline-flex items-center gap-1 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Status & Switch Status Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">Application Status:</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        viewingResumeApp.status === "Approved"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : viewingResumeApp.status === "Rejected"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          : viewingResumeApp.status === "Cancelled"
                          ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {viewingResumeApp.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    disabled={deletingAppId === viewingResumeApp.id}
                    onClick={async () => {
                      const cand = usersList.find((u) => u.uid === viewingResumeApp.uid);
                      const cName = (viewingResumeApp as any).candidateName || cand?.name || (cand as any)?.displayName || "Candidate";
                      const confirmed = await showConfirm(
                        `Are you sure you want to delete the application for "${cName}"? This action cannot be undone.`,
                        "Delete Application",
                        {
                          type: "danger",
                          confirmText: "Yes, Delete",
                          cancelText: "Cancel",
                        }
                      );
                      if (confirmed) {
                        setDeletingAppId(viewingResumeApp.id);
                        try {
                          if (deleteApplication) {
                            await deleteApplication(viewingResumeApp.id);
                          } else {
                            await deleteApplicationInFirestore(viewingResumeApp.id);
                            await refreshApplications();
                          }
                          setViewingResumeApp(null);
                        } catch (err) {
                          await showAlert("Failed to delete application.", "Error", "error");
                        } finally {
                          setDeletingAppId(null);
                        }
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 font-semibold text-xs inline-flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deletingAppId === viewingResumeApp.id ? "Deleting..." : "Delete Application"}</span>
                  </button>

                  <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
                    {/* First pending logic: initial decision if Pending */}
                    {viewingResumeApp.status === "Pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApproveApplication(viewingResumeApp)}
                          disabled={approvingAppId === viewingResumeApp.id}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 text-xs inline-flex items-center gap-1.5"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{approvingAppId === viewingResumeApp.id ? "Syncing..." : "Approve Application"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectApplication(viewingResumeApp)}
                          disabled={rejectingAppId === viewingResumeApp.id}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50 text-xs inline-flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject Application</span>
                        </button>
                      </>
                    )}

                    {/* Only one button: Switch Approved to Rejected */}
                    {viewingResumeApp.status === "Approved" && (
                      <button
                        type="button"
                        onClick={() => handleRejectApplication(viewingResumeApp)}
                        disabled={rejectingAppId === viewingResumeApp.id}
                        className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50 text-xs inline-flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Switch to Rejected</span>
                      </button>
                    )}

                    {/* Only one button: Switch Rejected to Approved */}
                    {viewingResumeApp.status === "Rejected" && (
                      <button
                        type="button"
                        onClick={() => handleApproveApplication(viewingResumeApp)}
                        disabled={approvingAppId === viewingResumeApp.id}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 text-xs inline-flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{approvingAppId === viewingResumeApp.id ? "Syncing..." : "Switch to Approved"}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setViewingResumeApp(null)}
                      className="ui-btn-secondary px-3.5 py-1.5 font-semibold rounded-lg text-xs hover:scale-105 active:scale-95 transition-transform"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Approval & External Sync Status Modal with Processing, Success & Warning Effects */}
    <ApprovalSyncModal
      isOpen={approvalModalState.isOpen}
      status={approvalModalState.status}
      candidateName={approvalModalState.candidateName}
      candidateEmail={approvalModalState.candidateEmail}
      jobTitle={approvalModalState.jobTitle}
      errorDetails={approvalModalState.errorDetails}
      onClose={() => setApprovalModalState((prev) => ({ ...prev, isOpen: false }))}
      onRetry={handleRetryApprovalSync}
    />

    {/* Resume Document Viewer Window */}
    <ResumeViewerModal
      isOpen={resumeModalData.isOpen}
      onClose={() => setResumeModalData((prev) => ({ ...prev, isOpen: false }))}
      resumeUrl={resumeModalData.resumeUrl}
      fileName={resumeModalData.fileName}
      candidateName={resumeModalData.candidateName}
      jobTitle={resumeModalData.jobTitle}
      candidateEmail={resumeModalData.candidateEmail}
    />
    </div>
  );
}