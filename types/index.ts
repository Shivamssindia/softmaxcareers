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
  resumeFileId?: string | null;      // ← ADD
  resumeFileName?: string | null;    // ← ADD
  emailVerified?: boolean;
  providerId?: string;
  createdAt?: string;
  lastLoginAt?: string;
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

export type ApplicationStatus = "Pending" | "Approved" | "Rejected";

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
