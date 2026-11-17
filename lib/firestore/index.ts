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
  ContactFormSettings,
  DEFAULT_CONTACT_FORM_SETTINGS,
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
  runTransaction,
  QuerySnapshot,
  DocumentData,
  Unsubscribe,
  DocumentReference,
} from "firebase/firestore";

/* ========================================================================== */
/* 0. SHARED MAPPERS                                                          */
/* ========================================================================== */

function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) clean[k] = v;
  }
  return clean;
}

/* ========================================================================== */
/* Candidate ID + Runtime Email Uniqueness (no emailLower, no extra field)    */
/* ========================================================================== */

const CANDIDATE_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Generate a new business candidate ID: CAND-YYYY-XXXXXX */
export function generateCandidateId(now: Date = new Date()): string {
  const year = now.getFullYear();
  let suffix = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint8Array(6);
    crypto.getRandomValues(buf);
    for (let i = 0; i < 6; i++) {
      suffix += CANDIDATE_ID_CHARS[buf[i] % CANDIDATE_ID_CHARS.length];
    }
  } else {
    for (let i = 0; i < 6; i++) {
      suffix += CANDIDATE_ID_CHARS[Math.floor(Math.random() * CANDIDATE_ID_CHARS.length)];
    }
  }
  return `CAND-${year}-${suffix}`;
}

/** Runtime normalizer — never stored. */
function normalizeEmailKey(email: string): string {
  return (email || "").trim().toLowerCase();
}

/**
 * Runtime lookup: scan `users`, compare normalized email in JS.
 * No emailLower field, no side collection.
 */
async function findUserByEmail(
  email: string
): Promise<{ uid: string; user: User } | null> {
  if (!isFirebaseConfigured || !db) return null;
  const key = normalizeEmailKey(email);
  if (!key) return null;
  try {
    const snap = await getDocs(collection(db, "users"));
    const match = snap.docs.find(
      (d) => normalizeEmailKey(String(d.data()?.email || "")) === key
    );
    if (!match) return null;
    return { uid: match.id, user: mapUserDoc(match.id, match.data()) };
  } catch (err) {
    console.warn("findUserByEmail failed:", err);
    return null;
  }
}

/** Is this email already registered to a DIFFERENT uid? */
export async function isEmailTakenInFirestore(
  email: string,
  excludeUid?: string
): Promise<boolean> {
  const found = await findUserByEmail(email);
  if (!found) return false;
  if (excludeUid && found.uid === excludeUid) return false;
  return true;
}

/**
 * Atomically claim an email for a uid and (optionally) assign a candidateId.
 * Writes ONLY `users/{uid}.candidateId` — nothing else. No emailLower.
 */
export async function claimEmailAndCandidateIdInFirestore(
  uid: string,
  email: string,
  existingCandidateId?: string
): Promise<{ candidateId: string }> {
  if (!isFirebaseConfigured || !db) {
    return { candidateId: existingCandidateId || generateCandidateId() };
  }
  const key = normalizeEmailKey(email);
  if (!key) throw new Error("Email is required to claim a candidate identity.");

  const firestore = db;

  // Runtime duplicate pre-check
  const preexisting = await findUserByEmail(key);
  if (preexisting && preexisting.uid !== uid) {
    throw new Error(
      "This email address is already registered to another account. Duplicate emails are not allowed."
    );
  }

  return await runTransaction(firestore, async (tx) => {
    const userRef = doc(firestore, "users", uid);
    const userSnap = await tx.get(userRef);

    let candidateId = existingCandidateId;
    if (!candidateId && userSnap.exists()) {
      candidateId = userSnap.data()?.candidateId as string | undefined;
    }
    if (!candidateId) candidateId = generateCandidateId();

    tx.set(userRef, { candidateId }, { merge: true });
    return { candidateId };
  });
}

/* ========================================================================== */
/* FIRST-TIME SIGN-IN MIGRATION (placeholder uid → Firebase uid)              */
/* ========================================================================== */

/**
 * When a recruiter-uploaded user signs in for the FIRST time:
 *
 *   old uid (placeholder: uploaded_* / cand_*)  →  new uid (Firebase)
 *
 * What this does (single transaction):
 *   1. `users/{oldUid}` is deleted.
 *   2. `users/{firebaseUid}` is written with the same `candidateId`
 *      plus the full recruiter-uploaded profile.
 *   3. Every `applications/*` where `uid === oldUid` has `uid` replaced
 *      with `firebaseUid` (candidateId preserved).
 *
 * No-op if the existing user doc's uid already equals the Firebase uid.
 * Throws on a different REAL Firebase uid (duplicate email).
 */
export async function migrateUploadedUserToFirebaseUid(
  firebaseUid: string,
  email: string,
  fallbackProfile?: Partial<User>
): Promise<User | null> {
  if (!isFirebaseConfigured || !db) return null;
  const key = normalizeEmailKey(email);
  if (!key) return null;

  const firestore = db;

  // Runtime lookup — no emailLower
  const existing = await findUserByEmail(key);
  if (!existing) return null;

  // UID already matches → nothing to migrate.
  if (existing.uid === firebaseUid) return existing.user;

  // Different uid: only migrate placeholder (recruiter-uploaded) docs.
  const isPlaceholder =
    existing.uid.startsWith("uploaded_") || existing.uid.startsWith("cand_");
  if (!isPlaceholder) {
    throw new Error(
      "This email address is already registered to another account. Duplicate emails are not allowed."
    );
  }

  const oldUid = existing.uid;
  const oldUserRef = doc(firestore, "users", oldUid);
  const newUserRef = doc(firestore, "users", firebaseUid);

  // Pre-fetch application doc refs pointing at the old uid
  let appDocRefs: DocumentReference[] = [];
  try {
    const appSnap = await getDocs(
      query(collection(firestore, "applications"), where("uid", "==", oldUid))
    );
    appDocRefs = appSnap.docs.map((d) => d.ref);
  } catch (err) {
    console.warn("[migration] applications fetch failed:", err);
  }

  return await runTransaction(firestore, async (tx) => {
    const oldSnap = await tx.get(oldUserRef);
    if (!oldSnap.exists()) return null;

    const oldData = oldSnap.data();
    const candidateId =
      oldData.candidateId || existing.user.candidateId || generateCandidateId();

    // New user doc payload — same candidateId, new uid
    const migratedPayload: Record<string, any> = {
      ...oldData,
      ...(fallbackProfile || {}),
      uid: firebaseUid,
      candidateId,
      email: oldData.email || email,
      updatedAt: new Date().toISOString(),
    };

    // Read + update each application in the same transaction
    const appSnaps = await Promise.all(appDocRefs.map((ref) => tx.get(ref)));

    appSnaps.forEach((appSnap) => {
      if (!appSnap.exists()) return;
      const appData = appSnap.data();
      if (appData.uid !== oldUid) return;

      tx.update(appSnap.ref, {
        uid: firebaseUid,
        candidateId: appData.candidateId || candidateId,
        updatedAt: new Date().toISOString(),
      });
    });

    // Delete placeholder user doc, write new one under Firebase uid
    tx.delete(oldUserRef);
    tx.set(newUserRef, migratedPayload, { merge: true });

    return mapUserDoc(firebaseUid, migratedPayload);
  });
}

function mapUserDoc(id: string, data: DocumentData): User {
  const role: UserRole = (data.role as UserRole) || "candidate";
  return {
    uid: id,
    candidateId: data.candidateId || undefined,
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
    resumeUrl: data.resumeUrl || data.resumeData || data.resumeDataUrl || undefined,
    resumeFileId: data.resumeFileId || undefined,
    resumeFileName: data.resumeFileName || undefined,
    profileCompleted:
      data.profileCompleted !== undefined ? Boolean(data.profileCompleted) : undefined,
    emailVerified: data.emailVerified,
    providerId: data.providerId,
    createdAt: data.createdAt,
    lastLoginAt: data.lastLoginAt,
    ipAddress: data.ipAddress || undefined,
    browserName: data.browserName || undefined,
    currentCtc: data.currentCtc || undefined,
    noticePeriod: data.noticePeriod || undefined,
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
    responsibilities: Array.isArray(data.responsibilities) ? data.responsibilities : [],
    requirements: Array.isArray(data.requirements) ? data.requirements : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    status: data.status === "closed" ? "closed" : "active",
    postedDate: data.postedDate || new Date().toISOString().split("T")[0],
    validThrough: data.validThrough,
    enableResumeUpload:
      data.enableResumeUpload !== undefined
        ? data.enableResumeUpload
        : data.requireResume !== undefined
        ? data.requireResume
        : true,
    requireResume:
      data.requireResume !== undefined
        ? data.requireResume
        : data.enableResumeUpload !== undefined
        ? data.enableResumeUpload
        : true,
  };
}

export function normalizeApplicationStatus(status?: string): ApplicationStatus {
  if (status === "Approved" || status === "Offer Extended") return "Approved";
  if (status === "Rejected") return "Rejected";
  if (status === "Cancelled" || status === "Canceled") return "Cancelled";
  return "Pending";
}

function mapApplicationDoc(id: string, data: DocumentData): JobApplication {
  return {
    id,
    jobId: data.jobId || "",
    uid: data.uid || "",
    candidateId: data.candidateId || undefined,
    experienceYears: data.experienceYears || "0",
    description: data.description || "",
    status: normalizeApplicationStatus(data.status),
    appliedAt: data.appliedAt || new Date().toISOString(),
    feedback: data.feedback || undefined,
    resumeUrl: data.resumeUrl || undefined,
    resumeFileName: data.resumeFileName || undefined,
    currentCtc: data.currentCtc || undefined,
    noticePeriod: data.noticePeriod || undefined,
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
    msgId: data.msgId || undefined,
    location: data.location || undefined,
    ipAddress: data.ipAddress || undefined,
    browserName: data.browserName || undefined,
    isSignedIn: data.isSignedIn ?? false,
    signedInUid: data.signedInUid || undefined,
    previousUserId: data.previousUserId || undefined,
    previousUserEmail: data.previousUserEmail || undefined,
    previousUserName: data.previousUserName || undefined,
    previousUserPhone: data.previousUserPhone || undefined,
    previousSignInIp: data.previousSignInIp || undefined,
    previousBrowserName: data.previousBrowserName || undefined,
    captchaPassed: data.captchaPassed ?? false,
    captchaTypedCode: data.captchaTypedCode || undefined,
    msgHistoryIds: Array.isArray(data.msgHistoryIds) ? data.msgHistoryIds : [],
  };
}

/* ========================================================================== */
/* 1. USER PROFILE OPERATIONS                                                 */
/* ========================================================================== */

export async function determineUserRoleInFirestore(uid?: string): Promise<UserRole> {
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

export async function saveUserToFirestore(userData: User): Promise<void> {
  if (!isFirebaseConfigured || !db) return;

  try {
    const userRef = doc(db, "users", userData.uid);
    const role: UserRole = userData.role || "candidate";

    // Runtime uniqueness pre-check (no emailLower)
    if (userData.email) {
      const existing = await findUserByEmail(userData.email);
      if (existing && existing.uid !== userData.uid) {
        throw new Error(
          "This email address is already registered to another account. Duplicate emails are not allowed."
        );
      }
    }

    let candidateId = (userData as any).candidateId as string | undefined;
    try {
      if (userData.email) {
        const claim = await claimEmailAndCandidateIdInFirestore(
          userData.uid,
          userData.email,
          candidateId
        );
        candidateId = claim.candidateId;
      } else if (!candidateId) {
        candidateId = generateCandidateId();
      }
    } catch (claimErr: any) {
      if (String(claimErr?.message || "").toLowerCase().includes("already registered")) {
        throw claimErr;
      }
      console.warn("Email-claim warning:", claimErr);
      if (!candidateId) candidateId = generateCandidateId();
    }

    const rawPayload: Record<string, any> = {
      uid: userData.uid,
      candidateId,
      email: userData.email,
      name: userData.name || (userData as any).displayName || "User",
      displayName: userData.name || (userData as any).displayName || "User",
      role,
      photoURL: userData.photoURL || null,
      phone: userData.phone || null,
      title: userData.title || (role === "admin" ? "System Administrator" : null),
      location: userData.location || (role === "admin" ? "Bengaluru, India" : null),
      bio: userData.bio || (role === "admin" ? "SoftMax System Administrator" : null),
      skills: userData.skills || (role === "admin" ? ["Administration", "Security"] : []),
      department:
        userData.department || (role === "admin" ? "Engineering Management" : null),
      profileCompleted:
        userData.profileCompleted !== undefined ? Boolean(userData.profileCompleted) : false,
      emailVerified: userData.emailVerified ?? false,
      providerId: userData.providerId || "password",
      createdAt: userData.createdAt || new Date().toISOString(),
      lastLoginAt: userData.lastLoginAt || new Date().toISOString(),
    };

    if (userData.portfolioUrl !== undefined) rawPayload.portfolioUrl = userData.portfolioUrl;
    if (userData.resumeUrl !== undefined) rawPayload.resumeUrl = userData.resumeUrl;
    if (userData.ipAddress !== undefined) rawPayload.ipAddress = userData.ipAddress;
    if (userData.browserName !== undefined) rawPayload.browserName = userData.browserName;
    if ((userData as any).currentCtc !== undefined) rawPayload.currentCtc = (userData as any).currentCtc;
    if ((userData as any).noticePeriod !== undefined) rawPayload.noticePeriod = (userData as any).noticePeriod;

    const payload = sanitizeForFirestore(rawPayload);
    await setDoc(userRef, payload, { merge: true });
  } catch (err) {
    console.error("Error saving user to Firestore database:", err);
    throw err;
  }
}

export async function getUserFromFirestore(uid: string): Promise<User | null> {
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

export async function getUserByEmailFromFirestore(email: string): Promise<User | null> {
  if (!isFirebaseConfigured || !db) return null;
  const key = normalizeEmailKey(email);
  if (!key) return null;

  try {
    const found = await findUserByEmail(key);
    return found ? found.user : null;
  } catch (err) {
    console.warn("getUserByEmailFromFirestore failed:", err);
    return null;
  }
}

export async function updateUserInFirestore(
  uid: string,
  updates: Partial<User>
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;

  try {
    if (updates.email) {
      const taken = await isEmailTakenInFirestore(updates.email, uid);
      if (taken) {
        throw new Error(
          "This email address is already registered to another account. Duplicate emails are not allowed."
        );
      }
    }

    const userRef = doc(db, "users", uid);
    const cleanUpdates = sanitizeForFirestore(updates);
    if ((updates as any).displayName && !updates.name) {
      cleanUpdates.name = (updates as any).displayName;
    }
    if ("candidateId" in cleanUpdates && !cleanUpdates.candidateId) {
      delete cleanUpdates.candidateId;
    }

    if ("resumeData" in cleanUpdates) delete cleanUpdates.resumeData;

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

export async function deleteUserFromFirestore(uid: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    await deleteDoc(doc(db, "users", uid));
  } catch (err) {
    console.error(`Error deleting user ${uid} from Firestore:`, err);
    throw err;
  }
}

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

export async function getUsersByRoleFromFirestore(role: UserRole): Promise<User[]> {
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

export async function createJobInFirestore(
  jobData: Omit<Job, "id" | "postedDate"> & {
    id?: string;
    postedDate?: string;
  }
): Promise<Job> {
  const id = jobData.id || "job-" + Date.now();
  const postedDate = jobData.postedDate || new Date().toISOString().split("T")[0];

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

export async function getJobsByStatusFromFirestore(
  status: "active" | "closed"
): Promise<Job[]> {
  if (!isFirebaseConfigured || !db) return [];
  try {
    const q = query(collection(db, "jobs"), where("status", "==", status));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapJobDoc(d.id, d.data()));
  } catch (err) {
    console.warn(`Error reading jobs with status=${status}:`, err);
    return [];
  }
}

export async function getJobByIdFromFirestore(id: string): Promise<Job | null> {
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

export async function deleteJobInFirestore(id: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    await deleteDoc(doc(db, "jobs", id));
  } catch (err) {
    console.error(`Error deleting job ${id}:`, err);
    throw err;
  }
}

export function subscribeToJobs(callback: (jobs: Job[]) => void): Unsubscribe {
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

export async function createApplicationInFirestore(
  applicationData: Omit<JobApplication, "id" | "appliedAt" | "status"> & {
    id?: string;
    appliedAt?: string;
    status?: ApplicationStatus;
    candidateId?: string;
  }
): Promise<JobApplication> {
  const id =
    applicationData.id || "app-" + Math.floor(1000 + Math.random() * 9000);
  const appliedAt = applicationData.appliedAt || new Date().toISOString();
  const status: ApplicationStatus = applicationData.status || "Pending";

  const newApp: JobApplication = {
    id,
    jobId: applicationData.jobId,
    uid: applicationData.uid || "",
    candidateId: applicationData.candidateId || undefined,
    experienceYears: applicationData.experienceYears || "0",
    description: applicationData.description || "",
    status,
    appliedAt,
  };

  if ((applicationData as any).feedback) newApp.feedback = (applicationData as any).feedback;
  if ((applicationData as any).resumeUrl) newApp.resumeUrl = (applicationData as any).resumeUrl;
  if ((applicationData as any).resumeFileName) newApp.resumeFileName = (applicationData as any).resumeFileName;
  if ((applicationData as any).currentCtc) newApp.currentCtc = (applicationData as any).currentCtc;
  if ((applicationData as any).noticePeriod) newApp.noticePeriod = (applicationData as any).noticePeriod;

  if (isFirebaseConfigured && db) {
    try {
      const docData = sanitizeForFirestore(newApp);
      await setDoc(doc(db, "applications", id), docData);
    } catch (err) {
      console.error("Error creating application in Firestore:", err);
      throw err;
    }
  }

  return newApp;
}

export async function getApplicationsFromFirestore(
  candidateUidOrEmail?: string
): Promise<JobApplication[]> {
  if (!isFirebaseConfigured || !db) return [];

  try {
    const appsRef = collection(db, "applications");
    let snap: QuerySnapshot<DocumentData>;

    if (candidateUidOrEmail) {
      const target = candidateUidOrEmail.trim();
      const targetLower = target.toLowerCase();

      try {
        const qCid = query(appsRef, where("candidateId", "==", target));
        const snapCid = await getDocs(qCid);
        if (!snapCid.empty) {
          return snapCid.docs.map((d) => mapApplicationDoc(d.id, d.data()));
        }
      } catch {}

      try {
        const qUid = query(appsRef, where("uid", "==", target));
        const snapUid = await getDocs(qUid);
        if (!snapUid.empty) {
          return snapUid.docs.map((d) => mapApplicationDoc(d.id, d.data()));
        }
      } catch {}

      const allSnap = await getDocs(appsRef);
      return allSnap.docs
        .map((d) => mapApplicationDoc(d.id, d.data()))
        .filter((app) => {
          if (app.candidateId && app.candidateId === target) return true;
          if (app.uid === target) return true;
          const rawDoc = allSnap.docs.find((dd) => dd.id === app.id)?.data();
          if (rawDoc?.candidateEmail && String(rawDoc.candidateEmail).toLowerCase() === targetLower) {
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

export async function getApplicationsByJobIdFromFirestore(
  jobId: string
): Promise<JobApplication[]> {
  if (!isFirebaseConfigured || !db) return [];
  try {
    const q = query(collection(db, "applications"), where("jobId", "==", jobId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapApplicationDoc(d.id, d.data()));
  } catch (err) {
    console.warn(`Error reading applications for job ${jobId}:`, err);
    return [];
  }
}

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

export async function deleteApplicationInFirestore(id: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    await deleteDoc(doc(db, "applications", id));
  } catch (err) {
    console.error(`Error deleting application ${id}:`, err);
    throw err;
  }
}

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

export function subscribeToApplications(
  callback: (apps: JobApplication[]) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    callback([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, "applications"),
    (snap) => callback(snap.docs.map((d) => mapApplicationDoc(d.id, d.data()))),
    (err) => {
      console.warn("subscribeToApplications error:", err);
      callback([]);
    }
  );
}

/* ========================================================================== */
/* 4. CONTACT INQUIRIES                                                       */
/* ========================================================================== */

export async function saveContactMessageToFirestore(
  msgData: Omit<ContactMessage, "id" | "submittedAt"> & {
    id?: string;
    submittedAt?: string;
  }
): Promise<ContactMessage> {
  const id = msgData.id || "msg-" + Date.now();
  const submittedAt = msgData.submittedAt || new Date().toISOString();

  const newMsg: ContactMessage = { ...msgData, id, submittedAt };

  if (isFirebaseConfigured && db) {
    try {
      await setDoc(
        doc(db, "contact_messages", id),
        sanitizeForFirestore(newMsg as any)
      );
    } catch (err) {
      console.error("Error creating contact message in Firestore:", err);
      throw err;
    }
  }
  return newMsg;
}

export async function getContactMessagesFromFirestore(): Promise<ContactMessage[]> {
  if (!isFirebaseConfigured || !db) return [];
  try {
    const snap = await getDocs(collection(db, "contact_messages"));
    return snap.docs.map((d) => mapContactDoc(d.id, d.data()));
  } catch (err) {
    console.warn("Error reading contact messages from Firestore:", err);
    return [];
  }
}

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

export async function deleteContactMessageFromFirestore(id: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    await deleteDoc(doc(db, "contact_messages", id));
  } catch (err) {
    console.error(`Error deleting contact message ${id}:`, err);
    throw err;
  }
}

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

/* ========================================================================== */
/* 5. CONTACT FORM SETTINGS                                                   */
/* ========================================================================== */

export async function getContactFormSettings(): Promise<ContactFormSettings> {
  if (!isFirebaseConfigured || !db) return DEFAULT_CONTACT_FORM_SETTINGS;
  try {
    const snap = await getDoc(doc(db, "settings", "contactForm"));
    if (!snap.exists()) return DEFAULT_CONTACT_FORM_SETTINGS;
    const data = snap.data();
    return {
      requireSignIn: Boolean(data.requireSignIn ?? false),
      requireLocation: Boolean(data.requireLocation ?? false),
      requireCaptcha: Boolean(data.requireCaptcha ?? true),
      requirePhone: Boolean(data.requirePhone ?? false),
      updatedAt: data.updatedAt || undefined,
      updatedBy: data.updatedBy || undefined,
    };
  } catch (err) {
    console.warn("getContactFormSettings failed:", err);
    return DEFAULT_CONTACT_FORM_SETTINGS;
  }
}

export async function updateContactFormSettings(
  updates: Partial<ContactFormSettings>,
  updatedBy?: string
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    await setDoc(
      doc(db, "settings", "contactForm"),
      {
        ...updates,
        updatedAt: new Date().toISOString(),
        ...(updatedBy ? { updatedBy } : {}),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("updateContactFormSettings failed:", err);
    throw err;
  }
}

/* ========================================================================== */
/* 6. ONE-TIME BACKFILL                                                       */
/* ========================================================================== */

/**
 * Idempotent: assign candidateId to legacy users missing one.
 * Does NOT touch emailLower (removed).
 */
export async function backfillCandidateIdsInFirestore(): Promise<{
  processed: number;
  updated: number;
  errors: number;
}> {
  if (!isFirebaseConfigured || !db) return { processed: 0, updated: 0, errors: 0 };
  const snap = await getDocs(collection(db, "users"));
  let updated = 0;
  let errors = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.candidateId) continue;
    try {
      const candidateId = generateCandidateId();
      await updateDoc(doc(db, "users", d.id), { candidateId });
      updated++;
    } catch (e) {
      console.warn(`Backfill failed for ${d.id}:`, e);
      errors++;
    }
  }
  return { processed: snap.docs.length, updated, errors };
}