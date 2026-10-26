// src/lib/firestore/index.ts
import { db, isFirebaseConfigured } from "@/lib/firebase";
import {
  User,
  UserRole,
  Job,
  JobType,
  JobCategoryType,
  DepartmentType,
  JobApplication,
  ApplicationStatus,
  ContactMessage,
} from "@/types";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  orderBy,
  where,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  Unsubscribe,
} from "firebase/firestore";

/* ========================================================================== */
/* 0. SHARED MAPPERS (single source of truth for field → interface mapping)   */
/* ========================================================================== */

function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean;
}

function mapUserDoc(id: string, data: DocumentData): User {
  const role: UserRole = (data.role as UserRole) || "candidate";
  return {
    uid: id,
    email: data.email || "",
    name: data.name || data.displayName || "User",
    role,
    photoURL: data.photoURL || undefined,
    phone: data.phone || undefined,
    title: data.title || undefined,
    location: data.location || undefined,
    bio: data.bio || undefined,
    skills: Array.isArray(data.skills) ? data.skills : [],
    department: data.department || undefined,
    portfolioUrl: data.portfolioUrl || undefined,
    resumeUrl:
      data.resumeUrl || data.resumeData || data.resumeDataUrl || undefined,
    resumeFileId: data.resumeFileId || undefined,     // ← ADD
    resumeFileName: data.resumeFileName || undefined, // ← ADD
    profileCompleted:
      data.profileCompleted !== undefined
        ? Boolean(data.profileCompleted)
        : undefined,
    emailVerified: data.emailVerified,
    providerId: data.providerId,
    createdAt: data.createdAt,
    lastLoginAt: data.lastLoginAt,
  };
}

function mapJobDoc(id: string, data: DocumentData): Job {
  return {
    id,
    title: data.title || "",
    category: (data.category as JobCategoryType) || "Tech",
    department: (data.department as DepartmentType) || "Web Development",
    location: data.location || "Bengaluru, India",
    type: (data.type as JobType) || "Full-time",
    experience: data.experience || "2 - 4 Years",
    salaryRange: data.salaryRange || "Competitive",
    salaryMin: data.salaryMin,
    salaryMax: data.salaryMax,
    salaryCurrency: data.salaryCurrency,
    description: data.description || "",
    responsibilities: Array.isArray(data.responsibilities)
      ? data.responsibilities
      : [],
    requirements: Array.isArray(data.requirements) ? data.requirements : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    status: data.status === "closed" ? "closed" : "active",
    postedDate:
      data.postedDate || new Date().toISOString().split("T")[0],
    validThrough: data.validThrough,
    enableResumeUpload:
      data.enableResumeUpload !== undefined ? data.enableResumeUpload : true,
  };
}

export function normalizeApplicationStatus(
  status?: string
): ApplicationStatus {
  if (status === "Approved" || status === "Offer Extended") return "Approved";
  if (status === "Rejected") return "Rejected";
  return "Pending";
}

function mapApplicationDoc(id: string, data: DocumentData): JobApplication {
  return {
    id,
    jobId: data.jobId || "",
    uid: data.uid || "",
    experienceYears: data.experienceYears || "0",
    description: data.description || "",
    status: normalizeApplicationStatus(data.status),
    appliedAt: data.appliedAt || new Date().toISOString(),
    feedback: data.feedback || undefined,
  };
}

function mapContactDoc(id: string, data: DocumentData): ContactMessage {
  return {
    id,
    name: data.name || "",
    email: data.email || "",
    phone: data.phone || undefined,
    service: data.service || "",
    message: data.message || "",
    submittedAt: data.submittedAt || new Date().toISOString(),
  };
}

/* ========================================================================== */
/* 1. USER PROFILE OPERATIONS                                                 */
/* ========================================================================== */

/**
 * Determine role for newly authenticated vs returning users.
 * Existing Firestore role is preserved; otherwise defaults to 'candidate'.
 */
export async function determineUserRoleInFirestore(
  uid?: string
): Promise<UserRole> {
  if (uid && isFirebaseConfigured && db) {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.role) return data.role as UserRole;
      }
    } catch (e) {
      console.warn("Could not check existing user role in Firestore:", e);
    }
  }
  return "candidate";
}

/**
 * Store or synchronize authenticated user data in `users/{uid}`.
 * Uses merge:true so partial payloads never wipe existing fields.
 */
export async function saveUserToFirestore(
  userData: User
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;

  try {
    const userRef = doc(db, "users", userData.uid);
    const role: UserRole = userData.role || "candidate";

    const rawPayload: Record<string, any> = {
      uid: userData.uid,
      email: userData.email,
      name: userData.name || (userData as any).displayName || "User",
      displayName: userData.name || (userData as any).displayName || "User",
      role,
      photoURL: userData.photoURL || null,
      phone: userData.phone || null,
      title: userData.title || (role === "admin" ? "System Administrator" : null),
      location: userData.location || (role === "admin" ? "Bengaluru, India" : null),
      bio:
        userData.bio ||
        (role === "admin"
          ? "SoftMax System Administrator"
          : null),
      skills:
        userData.skills ||
        (role === "admin" ? ["Administration", "Security"] : []),
      department:
        userData.department ||
        (role === "admin" ? "Engineering Management" : null),
      profileCompleted:
        userData.profileCompleted !== undefined
          ? Boolean(userData.profileCompleted)
          : false,
      emailVerified: userData.emailVerified ?? false,
      providerId: userData.providerId || "password",
      createdAt: userData.createdAt || new Date().toISOString(),
      lastLoginAt: userData.lastLoginAt || new Date().toISOString(),
    };

    if (userData.portfolioUrl !== undefined) {
      rawPayload.portfolioUrl = userData.portfolioUrl;
    }
    if (userData.resumeUrl !== undefined) {
      rawPayload.resumeUrl = userData.resumeUrl;
    }

    const payload = sanitizeForFirestore(rawPayload);
    await setDoc(userRef, payload, { merge: true });
  } catch (err) {
    console.error("Error saving user to Firestore database:", err);
    throw err;
  }
}

/** Retrieve a user profile by UID. */
export async function getUserFromFirestore(
  uid: string
): Promise<User | null> {
  if (!isFirebaseConfigured || !db) return null;

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return mapUserDoc(snap.id, snap.data());
  } catch (err) {
    console.warn("Error fetching user from Firestore:", err);
    return null;
  }
}

/**
 * Look up a single user profile by email (case-insensitive fallback).
 * Used by the Consultant API sync to enrich application data.
 */
export async function getUserByEmailFromFirestore(
  email: string
): Promise<User | null> {
  if (!isFirebaseConfigured || !db) return null;

  try {
    const usersRef = collection(db, "users");

    try {
      const q = query(usersRef, where("email", "==", email));
      const snap = await getDocs(q);
      if (!snap.empty) return mapUserDoc(snap.docs[0].id, snap.docs[0].data());
    } catch {
      /* fall through to case-insensitive scan */
    }

    const all = await getDocs(usersRef);
    const lower = email.toLowerCase();
    const match = all.docs.find(
      (d) => String(d.data().email || "").toLowerCase() === lower
    );
    return match ? mapUserDoc(match.id, match.data()) : null;
  } catch (err) {
    console.warn("getUserByEmailFromFirestore failed:", err);
    return null;
  }
}

/** Update partial user profile in Firestore. */
export async function updateUserInFirestore(
  uid: string,
  updates: Partial<User>
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;

  try {
    const userRef = doc(db, "users", uid);
    const cleanUpdates = sanitizeForFirestore(updates);
    if ((updates as any).displayName && !updates.name) {
      cleanUpdates.name = (updates as any).displayName;
    }

    // Remove deprecated resumeData option and ensure Firestore document stays lightweight
    if ("resumeData" in cleanUpdates) {
      delete cleanUpdates.resumeData;
    }

    // Persist resumeUrl and wipe out any deprecated resumeData field in Firestore
    if (updates.resumeUrl !== undefined) {
      if (updates.resumeUrl) {
        cleanUpdates.resumeUrl = updates.resumeUrl;
        cleanUpdates.resumeData = deleteField();
      } else {
        cleanUpdates.resumeUrl = deleteField();
        cleanUpdates.resumeData = deleteField();
      }
    }

    await setDoc(userRef, cleanUpdates, { merge: true });
  } catch (err) {
    console.error("Error updating user in Firestore:", err);
    throw err;
  }
}

/** Delete a user document (admin-only use case). */
export async function deleteUserFromFirestore(uid: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    await deleteDoc(doc(db, "users", uid));
  } catch (err) {
    console.error(`Error deleting user ${uid} from Firestore:`, err);
    throw err;
  }
}

/** Get all registered users (Admin portal). */
export async function getAllUsersFromFirestore(): Promise<User[]> {
  if (!isFirebaseConfigured || !db) return [];

  try {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map((d) => mapUserDoc(d.id, d.data()));
  } catch (err) {
    console.warn("Error fetching all users from Firestore:", err);
    return [];
  }
}

/** Get all users matching a role (Admin filtering). */
export async function getUsersByRoleFromFirestore(
  role: UserRole
): Promise<User[]> {
  if (!isFirebaseConfigured || !db) return [];

  try {
    const q = query(collection(db, "users"), where("role", "==", role));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapUserDoc(d.id, d.data()));
  } catch (err) {
    console.warn(`Error fetching users with role=${role}:`, err);
    return [];
  }
}

/** Real-time subscription to a single user profile. */
export function subscribeToUser(
  uid: string,
  callback: (user: User | null) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    callback(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      callback(snap.exists() ? mapUserDoc(snap.id, snap.data()) : null);
    },
    (err) => {
      console.warn(`subscribeToUser(${uid}) error:`, err);
      callback(null);
    }
  );
}

/* ========================================================================== */
/* 2. JOB CRUD OPERATIONS                                                     */
/* ========================================================================== */

/** CREATE a new Job opening. */
export async function createJobInFirestore(
  jobData: Omit<Job, "id" | "postedDate"> & {
    id?: string;
    postedDate?: string;
  }
): Promise<Job> {
  const id = jobData.id || "job-" + Date.now();
  const postedDate =
    jobData.postedDate || new Date().toISOString().split("T")[0];

  const newJob: Job = {
    ...jobData,
    id,
    postedDate,
    status: jobData.status || "active",
  };

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "jobs", id), newJob);
    } catch (err) {
      console.error("Error creating job in Firestore:", err);
      throw err;
    }
  }
  return newJob;
}

/** READ all Job openings (ordered by postedDate desc). */
export async function getJobsFromFirestore(): Promise<Job[]> {
  if (!isFirebaseConfigured || !db) return [];

  try {
    const jobsRef = collection(db, "jobs");
    let snap: QuerySnapshot<DocumentData>;
    try {
      snap = await getDocs(query(jobsRef, orderBy("postedDate", "desc")));
    } catch {
      snap = await getDocs(jobsRef);
    }
    return snap.docs.map((d) => mapJobDoc(d.id, d.data()));
  } catch (err) {
    console.warn("Error reading jobs from Firestore:", err);
    return [];
  }
}

/** READ jobs filtered by status. */
export async function getJobsByStatusFromFirestore(
  status: "active" | "closed"
): Promise<Job[]> {
  if (!isFirebaseConfigured || !db) {
    return [];
  }

  try {
    const q = query(collection(db, "jobs"), where("status", "==", status));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapJobDoc(d.id, d.data()));
  } catch (err) {
    console.warn(`Error reading jobs with status=${status}:`, err);
    return [];
  }
}

/** READ a single Job by ID. */
export async function getJobByIdFromFirestore(
  id: string
): Promise<Job | null> {
  if (isFirebaseConfigured && db) {
    try {
      const snap = await getDoc(doc(db, "jobs", id));
      if (snap.exists()) return mapJobDoc(snap.id, snap.data());
    } catch (err) {
      console.warn(`Error reading job ${id} from Firestore:`, err);
    }
  }
  return null;
}

/** UPDATE an existing Job. */
export async function updateJobInFirestore(
  id: string,
  updates: Partial<Job>
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    await updateDoc(doc(db, "jobs", id), updates);
  } catch (err) {
    console.error(`Error updating job ${id} in Firestore:`, err);
    throw err;
  }
}

/** DELETE a Job. */
export async function deleteJobInFirestore(id: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    await deleteDoc(doc(db, "jobs", id));
  } catch (err) {
    console.error(`Error deleting job ${id} in Firestore:`, err);
    throw err;
  }
}

/** Real-time subscription to the jobs collection. */
export function subscribeToJobs(
  callback: (jobs: Job[]) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    callback([]);
    return () => {};
  }
  const jobsRef = collection(db, "jobs");
  let unsub: Unsubscribe = () => {};

  const handleDocs = (docs: DocumentData[]) => {
    callback(docs.map((d) => mapJobDoc(d.id, d.data())));
  };

  try {
    unsub = onSnapshot(
      query(jobsRef, orderBy("postedDate", "desc")),
      (snap) => handleDocs(snap.docs),
      (err) => {
        console.warn("subscribeToJobs ordered error, falling back:", err);
        unsub = onSnapshot(
          jobsRef,
          (snap) => handleDocs(snap.docs),
          () => callback([])
        );
      }
    );
  } catch {
    unsub = onSnapshot(
      jobsRef,
      (snap) => handleDocs(snap.docs),
      () => callback([])
    );
  }
  return () => unsub();
}

/* ========================================================================== */
/* 3. APPLICATION OPERATIONS                                                  */
/* ========================================================================== */

/** CREATE a new candidate application. */
export async function createApplicationInFirestore(
  applicationData: Omit<JobApplication, "id" | "appliedAt" | "status"> & {
    id?: string;
    appliedAt?: string;
    status?: ApplicationStatus;
  }
): Promise<JobApplication> {
  const id =
    applicationData.id ||
    "app-" + Math.floor(1000 + Math.random() * 9000);
  const appliedAt = applicationData.appliedAt || new Date().toISOString();
  const status: ApplicationStatus = applicationData.status || "Pending";

  const newApp: JobApplication = {
    id,
    jobId: applicationData.jobId,
    uid: applicationData.uid || "",
    experienceYears: applicationData.experienceYears || "0",
    description: applicationData.description || "",
    status,
    appliedAt,
  };

  if ((applicationData as any).feedback) {
    newApp.feedback = (applicationData as any).feedback;
  }

  if (isFirebaseConfigured && db) {
    try {
      // Store strictly as JobApplication interface in Firestore
      const docData = sanitizeForFirestore(newApp);
      await setDoc(doc(db, "applications", id), docData);
    } catch (err) {
      console.error("Error creating application in Firestore:", err);
      throw err;
    }
  }

  return newApp;
}

/**
 * READ applications (optionally filtered by candidate UID or email).
 */
export async function getApplicationsFromFirestore(
  candidateUidOrEmail?: string
): Promise<JobApplication[]> {
  if (!isFirebaseConfigured || !db) return [];

  try {
    const appsRef = collection(db, "applications");
    let snap: QuerySnapshot<DocumentData>;

    if (candidateUidOrEmail) {
      // Try querying by UID first
      try {
        const qUid = query(appsRef, where("uid", "==", candidateUidOrEmail));
        snap = await getDocs(qUid);
        if (!snap.empty) {
          return snap.docs.map((d) => mapApplicationDoc(d.id, d.data()));
        }
      } catch {}

      // Fallback: search all docs by matching UID or email
      const allSnap = await getDocs(appsRef);
      const searchTarget = candidateUidOrEmail.toLowerCase();
      return allSnap.docs
        .map((d) => mapApplicationDoc(d.id, d.data()))
        .filter((app) => {
          if (app.uid === candidateUidOrEmail) return true;
          const rawDoc = allSnap.docs.find((d) => d.id === app.id)?.data();
          if (rawDoc?.candidateEmail && String(rawDoc.candidateEmail).toLowerCase() === searchTarget) {
            return true;
          }
          return false;
        });
    } else {
      snap = await getDocs(appsRef);
      return snap.docs.map((d) => mapApplicationDoc(d.id, d.data()));
    }
  } catch (err) {
    console.warn("Error reading applications from Firestore:", err);
    return [];
  }
}

/** READ all applications for a specific job posting. */
export async function getApplicationsByJobIdFromFirestore(
  jobId: string
): Promise<JobApplication[]> {
  if (!isFirebaseConfigured || !db) return [];

  try {
    const q = query(
      collection(db, "applications"),
      where("jobId", "==", jobId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapApplicationDoc(d.id, d.data()));
  } catch (err) {
    console.warn(`Error reading applications for job ${jobId}:`, err);
    return [];
  }
}

/** READ a single application by ID (used by consultant sync route). */
export async function getApplicationByIdFromFirestore(
  id: string
): Promise<JobApplication | null> {
  if (!isFirebaseConfigured || !db) return null;

  try {
    const snap = await getDoc(doc(db, "applications", id));
    if (!snap.exists()) return null;
    return mapApplicationDoc(snap.id, snap.data());
  } catch (err) {
    console.warn(`getApplicationByIdFromFirestore(${id}) failed:`, err);
    return null;
  }
}

/**
 * UPDATE an application's status + optional feedback.
 * Guarded: once Approved/Rejected, status is immutable.
 * @returns true if the update was applied, false if skipped.
 */
export async function updateApplicationStatusInFirestore(
  id: string,
  status: ApplicationStatus,
  feedback?: string
): Promise<boolean> {
  if (!isFirebaseConfigured || !db) return false;

  try {
    const appRef = doc(db, "applications", id);
    const updateData: Record<string, unknown> = { status };
    if (feedback !== undefined) updateData.feedback = feedback;
    await updateDoc(appRef, updateData);
    return true;
  } catch (err) {
    console.error(`Error updating application ${id} in Firestore:`, err);
    throw err;
  }
}

/** DELETE an application. */
export async function deleteApplicationInFirestore(
  id: string
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    await deleteDoc(doc(db, "applications", id));
  } catch (err) {
    console.error(`Error deleting application ${id}:`, err);
    throw err;
  }
}

/** Count applications for a given candidate email (dashboard stats). */
export async function getUserApplicationsCountFromFirestore(
  candidateEmail: string
): Promise<number> {
  if (!isFirebaseConfigured || !db) return 0;
  try {
    const apps = await getApplicationsFromFirestore(candidateEmail);
    return apps.length;
  } catch {
    return 0;
  }
}

/** Real-time subscription to the applications collection. */
export function subscribeToApplications(
  callback: (apps: JobApplication[]) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    callback([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, "applications"),
    (snap) =>
      callback(snap.docs.map((d) => mapApplicationDoc(d.id, d.data()))),
    (err) => {
      console.warn("subscribeToApplications error:", err);
      callback([]);
    }
  );
}

/* ========================================================================== */
/* 4. CONTACT INQUIRIES                                                       */
/* ========================================================================== */

/** CREATE a contact inquiry. */
export async function saveContactMessageToFirestore(
  msgData: Omit<ContactMessage, "id" | "submittedAt"> & {
    id?: string;
    submittedAt?: string;
  }
): Promise<ContactMessage> {
  const id = msgData.id || "msg-" + Date.now();
  const submittedAt = msgData.submittedAt || new Date().toISOString();

  const newMsg: ContactMessage = {
    ...msgData,
    id,
    submittedAt,
  };

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "contact_messages", id), newMsg);
    } catch (err) {
      console.error("Error creating contact message in Firestore:", err);
      throw err;
    }
  }
  return newMsg;
}

/** READ all contact inquiries. */
export async function getContactMessagesFromFirestore(): Promise<
  ContactMessage[]
> {
  if (!isFirebaseConfigured || !db) return [];

  try {
    const snap = await getDocs(collection(db, "contact_messages"));
    return snap.docs.map((d) => mapContactDoc(d.id, d.data()));
  } catch (err) {
    console.warn("Error reading contact messages from Firestore:", err);
    return [];
  }
}

/** READ a single contact message by ID. */
export async function getContactMessageByIdFromFirestore(
  id: string
): Promise<ContactMessage | null> {
  if (!isFirebaseConfigured || !db) return null;
  try {
    const snap = await getDoc(doc(db, "contact_messages", id));
    if (!snap.exists()) return null;
    return mapContactDoc(snap.id, snap.data());
  } catch (err) {
    console.warn(`getContactMessageByIdFromFirestore(${id}) failed:`, err);
    return null;
  }
}

/** DELETE a contact message. */
export async function deleteContactMessageFromFirestore(
  id: string
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    await deleteDoc(doc(db, "contact_messages", id));
  } catch (err) {
    console.error(`Error deleting contact message ${id}:`, err);
    throw err;
  }
}

/** Real-time subscription to contact messages (admin inbox). */
export function subscribeToContactMessages(
  callback: (messages: ContactMessage[]) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    callback([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, "contact_messages"),
    (snap) => callback(snap.docs.map((d) => mapContactDoc(d.id, d.data()))),
    (err) => {
      console.warn("subscribeToContactMessages error:", err);
      callback([]);
    }
  );
}