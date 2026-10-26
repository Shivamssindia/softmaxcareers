export type UserRole = "candidate" | "admin";

export interface User {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  photoURL?: string;
  phone?: string;
  title?: string;
  location?: string;
  bio?: string;
  skills?: string[];
  department?: string;
  portfolioUrl?: string;
  resumeUrl?: string | null;
  resumeFileId?: string | null;
  resumeFileName?: string | null;
  profileCompleted?: boolean;
  emailVerified?: boolean;
  providerId?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

/**
 * Helper to get the list of missing required profile field names for a candidate.
 * If every required field is present and non-empty, returns an empty array.
 */
export function getMissingProfileFields(user?: Partial<User> | null): string[] {
  if (!user || user.role === "admin") return [];

  const missing: string[] = [];

  const name = (user.name || (user as any).displayName || "").trim();
  if (!name) missing.push("Full Name");

  const email = (user.email || "").trim();
  if (!email) missing.push("Email Address");

  const phone = (user.phone || "").trim();
  if (!phone || phone.length < 7) missing.push("Phone Number");

  const title = (user.title || "").trim();
  if (!title) missing.push("Job Title / Headline");

  const department = (user.department || "").trim();
  if (!department) missing.push("Primary Department");

  const location = (user.location || "").trim();
  if (!location) missing.push("Location / City");

  const validSkills = Array.isArray(user.skills)
    ? user.skills.filter((s) => typeof s === "string" && s.trim().length > 0)
    : [];
  if (validSkills.length === 0) missing.push("Skills & Expertise");

  const bio = (user.bio || "").trim();
  if (!bio || bio.length < 10) missing.push("Professional Summary / Bio");

  return missing;
}

/**
 * Helper to determine if a user has completed their profile details.
 * Admin users are considered complete by default.
 * Candidates must have ALL required data fields present.
 * If even a single piece of required data is missing, profile is considered incomplete.
 */
export function isProfileComplete(user?: Partial<User> | null): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.profileCompleted === false) return false;

  return getMissingProfileFields(user).length === 0;
}

// UserProfile alias for backward compatibility across modules
export type UserProfile = User;

export type JobType = "Full-time" | "Part-time" | "Contract" | "Remote" | "Hybrid";

export type JobCategoryType = "Tech" | "Non-Tech";

export type DepartmentType =
  | "Web Development"
  | "System Design"
  | "Software Engineering"
  | "Cloud & DevOps"
  | "UI/UX Design"
  | "AI & Data"
  | "IT Project Management"
  | "Business Analysis & Consulting"
  | "Talent Acquisition & HR"
  | "Sales & Client Relations";

export interface Job {
  id: string;
  slug?: string;
  title: string;
  category: JobCategoryType; // Tech or Non-Tech
  department: DepartmentType;
  location: string;
  type: JobType;
  experience: string;
  salaryRange: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  tags: string[];
  status: "active" | "closed";
  postedDate: string;
  validThrough?: string;
  enableResumeUpload?: boolean;
}

export type ApplicationStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export interface JobApplication {
  id: string;
  jobId: string;
  uid: string;
  experienceYears: string;
  portfolioUrl?: string;
  description: string;
  status: ApplicationStatus;
  appliedAt: string;
  feedback?: string;
  resumeUrl?: string;
  resumeFileName?: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  service: string;
  message: string;
  submittedAt: string;
}
