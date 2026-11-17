"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole, isProfileComplete } from "@/types";
import { auth, isFirebaseConfigured, db } from "@/lib/firebase";
import {
  saveUserToFirestore,
  getUserFromFirestore,
  updateUserInFirestore,
  determineUserRoleInFirestore,
  generateCandidateId,
  isEmailTakenInFirestore,
  claimEmailAndCandidateIdInFirestore,
  migrateUploadedUserToFirebaseUid,
} from "@/lib/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as fbSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export type UserWithCompat = User & { displayName?: string; isAdmin?: boolean };

export interface PreviousUserEntry {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  signInIp?: string;
  browserName?: string;
  signedInAt: string;
}

export interface MsgHistoryEntry {
  msgId: string;
  submittedAt: string;
  isSignedIn: boolean;
  previousUserId?: string;
}

const PREV_USERS_KEY = "softmax_previous_users";
const MSG_HISTORY_KEY = "softmax_msg_history";
const MAX_PREV_USERS = 3;
const MAX_MSG_HISTORY = 10;

export function getPreviousUsers(): PreviousUserEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PREV_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePreviousUser(entry: PreviousUserEntry) {
  if (typeof window === "undefined") return;
  try {
    const current = getPreviousUsers();
    const latest = current[0];
    const sameUser =
      latest?.userId === entry.userId &&
      Date.now() - new Date(latest.signedInAt).getTime() < 60_000;
    const next = sameUser ? [entry, ...current.slice(1)] : [entry, ...current];
    localStorage.setItem(PREV_USERS_KEY, JSON.stringify(next.slice(0, MAX_PREV_USERS)));
  } catch {}
}

export function appendMsgHistory(entry: MsgHistoryEntry) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(MSG_HISTORY_KEY);
    const current: MsgHistoryEntry[] = raw ? JSON.parse(raw) : [];
    const next = [entry, ...current].slice(0, MAX_MSG_HISTORY);
    localStorage.setItem(MSG_HISTORY_KEY, JSON.stringify(next));
  } catch {}
}

export function getMsgHistory(): MsgHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MSG_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function fetchClientIp(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return typeof data?.ip === "string" ? data.ip : undefined;
  } catch {
    return undefined;
  }
}

function detectBrowserName(): string {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  let browser = "Unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua) || /Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  else if (/MSIE|Trident/.test(ua)) browser = "Internet Explorer";

  let os = "Unknown";
  if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return `${browser} / ${os}`;
}

async function persistLoginMeta(uid: string, ipAddress?: string, browserName?: string) {
  if (!isFirebaseConfigured || !db || !uid) return;
  try {
    await setDoc(
      doc(db, "users", uid),
      {
        ipAddress: ipAddress || null,
        browserName: browserName || null,
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("persistLoginMeta failed:", e);
  }
}

interface AuthContextType {
  user: UserWithCompat | null;
  loading: boolean;
  isFirebaseActive: boolean;
  login: (email: string, password: string) => Promise<UserWithCompat>;
  signup: (email: string, password: string, name: string, role?: UserRole) => Promise<UserWithCompat>;
  loginWithGoogle: () => Promise<UserWithCompat>;
  logout: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserWithCompat>) => Promise<UserWithCompat>;
  resetPassword: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const setRoleCookie = (role?: UserRole | null) => {
  if (typeof document !== "undefined") {
    if (role) {
      document.cookie = `softmax_auth_role=${role}; path=/; max-age=86400; SameSite=Lax`;
    } else {
      document.cookie = "softmax_auth_role=; path=/; max-age=0; SameSite=Lax";
    }
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserWithCompat | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const saveUserSession = (newUser: UserWithCompat | null) => {
    setUser(newUser);
    if (typeof window !== "undefined") {
      if (newUser) {
        localStorage.setItem("softmax_auth_user", JSON.stringify(newUser));
        setRoleCookie(newUser.role);
      } else {
        localStorage.removeItem("softmax_auth_user");
        setRoleCookie(null);
      }
    }
  };

  const runPostSignInTracking = async (profile: UserWithCompat) => {
    const ip = await fetchClientIp();
    const browser = detectBrowserName();

    if (ip || browser) {
      await persistLoginMeta(profile.uid, ip, browser);
    }

    savePreviousUser({
      userId: profile.uid,
      name: profile.name || (profile as any).displayName || "",
      email: profile.email || "",
      phone: profile.phone,
      signInIp: ip,
      browserName: browser,
      signedInAt: new Date().toISOString(),
    });

    if (ip || browser) {
      saveUserSession({
        ...profile,
        ipAddress: ip,
        browserName: browser,
      } as UserWithCompat);
    }
  };

  const buildUserProfile = async (
    fbUser?: FirebaseUser | null,
    fallback?: {
      uid?: string;
      email?: string;
      displayName?: string;
      name?: string;
      role?: UserRole;
    }
  ): Promise<UserWithCompat> => {
    const uid = fbUser?.uid || fallback?.uid || "usr-" + Date.now();
    const email = fbUser?.email || fallback?.email || "user@softmax.in";
    const name =
      fbUser?.displayName ||
      fallback?.name ||
      fallback?.displayName ||
      email.split("@")[0].replace(".", " ").replace(/^./, (c) => c.toUpperCase()) ||
      "User";
    const photoURL = fbUser?.photoURL || undefined;
    const emailVerified = fbUser?.emailVerified ?? false;
    const providerId = fbUser?.providerData?.[0]?.providerId || "password";
    const createdAt = fbUser?.metadata?.creationTime || new Date().toISOString();
    const lastLoginAt = fbUser?.metadata?.lastSignInTime || new Date().toISOString();
    const phone = fbUser?.phoneNumber || undefined;

    // FIRST: migrate a recruiter-uploaded placeholder doc → this Firebase uid
    if (fbUser?.uid && email) {
      try {
        const migrated = await migrateUploadedUserToFirebaseUid(fbUser.uid, email);
        if (migrated) {
          console.log("[auth] Migrated recruiter-uploaded user to Firebase uid:", {
            to: fbUser.uid,
            candidateId: migrated.candidateId,
          });
        }
      } catch (migrateErr) {
        console.warn("[auth] migration failed, continuing:", migrateErr);
      }
    }

    const existingDoc = await getUserFromFirestore(uid);

    let profile: UserWithCompat;

    if (existingDoc) {
      const preservedRole: UserRole = existingDoc.role || "candidate";
      const preservedIsAdmin: boolean =
        preservedRole === "admin"
          ? true
          : preservedRole === "candidate"
          ? false
          : Boolean((existingDoc as any).isAdmin);

      const hasCompleted =
        preservedRole === "admin" ||
        (isProfileComplete(existingDoc) && existingDoc.profileCompleted !== false);

      let candidateId = existingDoc.candidateId;
      if (!candidateId) {
        try {
          const claim = await claimEmailAndCandidateIdInFirestore(
            uid,
            email || existingDoc.email || ""
          );
          candidateId = claim.candidateId;
        } catch (e) {
          console.warn("candidateId backfill failed:", e);
          candidateId = generateCandidateId();
        }
      }

      profile = {
        ...existingDoc,
        candidateId,
        role: preservedRole,
        isAdmin: preservedIsAdmin,
        email: email || existingDoc.email,
        name: name || existingDoc.name,
        displayName: name || existingDoc.name,
        photoURL: photoURL || existingDoc.photoURL,
        profileCompleted: hasCompleted,
        emailVerified,
        providerId,
        lastLoginAt: new Date().toISOString(),
      };
      await saveUserToFirestore(profile);
    } else {
      const role: UserRole = "candidate";

      let candidateId: string;
      try {
        const claim = await claimEmailAndCandidateIdInFirestore(uid, email);
        candidateId = claim.candidateId;
      } catch (claimErr: any) {
        if (String(claimErr?.message || "").toLowerCase().includes("already registered")) {
          throw claimErr;
        }
        candidateId = generateCandidateId();
      }

      profile = {
        uid,
        candidateId,
        email,
        name,
        displayName: name,
        role,
        isAdmin: false,
        photoURL,
        emailVerified,
        providerId,
        createdAt,
        lastLoginAt,
        phone,
        title: undefined,
        location: undefined,
        bio: undefined,
        skills: [],
        department: undefined,
        portfolioUrl: undefined,
        resumeUrl: undefined,
        profileCompleted: false,
      };

      await saveUserToFirestore(profile);
    }

    return profile;
  };

  useEffect(() => {
    const savedUserStr =
      typeof window !== "undefined" ? localStorage.getItem("softmax_auth_user") : null;

    if (savedUserStr) {
      try {
        const initialUser: UserWithCompat = JSON.parse(savedUserStr);
        setUser(initialUser);
        if (initialUser?.role) setRoleCookie(initialUser.role);
      } catch {}
    }

    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          try {
            const profile = await buildUserProfile(fbUser);
            await runPostSignInTracking(profile);
            saveUserSession(profile);
          } catch (err) {
            console.warn("Post-signin tracking failed:", err);
            const fallback = await buildUserProfile(fbUser).catch(() => null);
            if (fallback) saveUserSession(fallback);
          }
        } else {
          if (!isFirebaseConfigured) {
            // keep mock user in offline mode
          } else {
            saveUserSession(null);
          }
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<UserWithCompat> => {
    setLoading(true);
    try {
      if (isFirebaseConfigured && auth) {
        const res = await signInWithEmailAndPassword(auth, email, password);
        const profile = await buildUserProfile(res.user);
        await runPostSignInTracking(profile);
        saveUserSession(profile);
        return profile;
      } else {
        let preservedRole: UserRole = "candidate";
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("softmax_auth_user");
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              if (parsed.email?.toLowerCase() === email.toLowerCase() && parsed.role) {
                preservedRole = parsed.role;
              }
            } catch {}
          }
        }
        const profile = await buildUserProfile(null, { email, role: preservedRole });
        await runPostSignInTracking(profile);
        saveUserSession(profile);
        return profile;
      }
    } finally {
      setLoading(false);
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string,
    explicitRole?: UserRole
  ): Promise<UserWithCompat> => {
    setLoading(true);
    try {
      const taken = await isEmailTakenInFirestore(email);
      if (taken) {
        throw new Error(
          "This email address is already registered. Duplicate emails are not allowed."
        );
      }

      if (isFirebaseConfigured && auth) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        const fbUser = res.user;

        if (name) {
          try {
            await updateProfile(fbUser, { displayName: name });
          } catch (e) {
            console.warn("Could not update displayName on auth:", e);
          }
        }

        const assignedRole: UserRole = "candidate";

        let candidateId: string;
        try {
          const claim = await claimEmailAndCandidateIdInFirestore(
            fbUser.uid,
            fbUser.email || email
          );
          candidateId = claim.candidateId;
        } catch (claimErr: any) {
          try {
            await fbSignOut(auth);
          } catch {}
          throw claimErr;
        }

        const profile: UserWithCompat = {
          uid: fbUser.uid,
          candidateId,
          email: fbUser.email || email,
          name: name || email.split("@")[0],
          displayName: name || email.split("@")[0],
          role: assignedRole,
          isAdmin: false,
          photoURL: fbUser.photoURL || undefined,
          emailVerified: fbUser.emailVerified,
          providerId: "password",
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          title: undefined,
          location: undefined,
          bio: undefined,
          skills: [],
          department: undefined,
          portfolioUrl: undefined,
          profileCompleted: false,
        };

        await saveUserToFirestore(profile);
        await runPostSignInTracking(profile);
        saveUserSession(profile);
        return profile;
      } else {
        const profile = await buildUserProfile(null, {
          email,
          name,
          displayName: name,
          role: "candidate",
        });
        await runPostSignInTracking(profile);
        saveUserSession(profile);
        return profile;
      }
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (): Promise<UserWithCompat> => {
    setLoading(true);
    try {
      if (isFirebaseConfigured && auth) {
        const provider = new GoogleAuthProvider();
        provider.addScope("https://www.googleapis.com/auth/drive.file");
        const res = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(res);
        if (credential?.accessToken && typeof window !== "undefined") {
          try {
            sessionStorage.setItem("gdrive_access_token", credential.accessToken);
            sessionStorage.setItem(
              "gdrive_token_expires_at",
              String(Date.now() + 3500 * 1000)
            );
          } catch {}
        }

        const existing = await getUserFromFirestore(res.user.uid);
        if (!existing) {
          const taken = await isEmailTakenInFirestore(
            res.user.email || "",
            res.user.uid
          );
          if (taken) {
            try {
              await fbSignOut(auth);
            } catch {}
            throw new Error(
              "This email address is already registered to another account. Duplicate emails are not allowed."
            );
          }
        }

        const profile = await buildUserProfile(res.user);
        await runPostSignInTracking(profile);
        saveUserSession(profile);
        return profile;
      } else {
        throw new Error("Firebase Authentication is not configured in .env.local");
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (isFirebaseConfigured && auth) {
      try {
        await fbSignOut(auth);
      } catch (err) {
        console.error("Firebase Signout error:", err);
      }
    }
    saveUserSession(null);
  };

  const updateUserProfile = async (
    updates: Partial<UserWithCompat>
  ): Promise<UserWithCompat> => {
    if (!user) throw new Error("No authenticated user to update");

    const mergedUser = {
      ...user,
      ...updates,
      name: updates.name || updates.displayName || user.name,
      displayName: updates.displayName || updates.name || user.name,
    };

    const effectiveProfileCompleted =
      updates.profileCompleted !== undefined
        ? updates.profileCompleted && (user.role === "admin" || isProfileComplete(mergedUser))
        : isProfileComplete(mergedUser);

    const updatedUser: UserWithCompat = {
      ...mergedUser,
      profileCompleted: effectiveProfileCompleted,
    };

    if (isFirebaseConfigured && auth?.currentUser) {
      const authUpdates: { displayName?: string; photoURL?: string } = {};
      const newName = updates.displayName || updates.name;
      if (newName !== undefined) authUpdates.displayName = newName;
      if (updates.photoURL !== undefined) authUpdates.photoURL = updates.photoURL;

      if (Object.keys(authUpdates).length > 0) {
        try {
          await updateProfile(auth.currentUser, authUpdates);
        } catch (e) {
          console.warn("Could not update auth profile:", e);
        }
      }
    }

    await updateUserInFirestore(user.uid, updates);

    saveUserSession(updatedUser);
    return updatedUser;
  };

  const resetPassword = async (email: string) => {
    if (isFirebaseConfigured && auth) {
      await sendPasswordResetEmail(auth, email);
    } else {
      console.log("Mock password reset sent to:", email);
    }
  };

  const sendVerificationEmail = async () => {
    if (isFirebaseConfigured && auth?.currentUser) {
      await sendEmailVerification(auth.currentUser);
    } else {
      console.log("Mock verification email requested");
    }
  };

  const switchRole = async (newRole: UserRole) => {
    if (!user) return;
    const safeRole: UserRole = "candidate";
    const updated: UserWithCompat = { ...user, role: safeRole };
    saveUserSession(updated);
    if (user.uid) {
      await updateUserInFirestore(user.uid, { role: safeRole });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isFirebaseActive: isFirebaseConfigured,
        login,
        signup,
        loginWithGoogle,
        logout,
        updateUserProfile,
        resetPassword,
        sendVerificationEmail,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};


// "use client";

// import React, { createContext, useContext, useState, useEffect } from "react";
// import { User, UserRole, isProfileComplete } from "@/types";
// import { auth, isFirebaseConfigured, db } from "@/lib/firebase";
// import {
//   saveUserToFirestore,
//   getUserFromFirestore,
//   updateUserInFirestore,
//   determineUserRoleInFirestore,
// } from "@/lib/firestore";
// import {
//   signInWithEmailAndPassword,
//   createUserWithEmailAndPassword,
//   updateProfile,
//   signOut as fbSignOut,
//   onAuthStateChanged,
//   GoogleAuthProvider,
//   signInWithPopup,
//   sendPasswordResetEmail,
//   sendEmailVerification,
//   User as FirebaseUser,
// } from "firebase/auth";
// import { doc, setDoc } from "firebase/firestore";

// export type UserWithCompat = User & { displayName?: string; isAdmin?: boolean };

// // ─── ADDED: client-side tracking helpers (no new files) ─────────────
// export interface PreviousUserEntry {
//   userId: string;
//   name: string;
//   email: string;
//   phone?: string;
//   signInIp?: string;
//   browserName?: string;
//   signedInAt: string;
// }

// export interface MsgHistoryEntry {
//   msgId: string;
//   submittedAt: string;
//   isSignedIn: boolean;
//   previousUserId?: string;
// }

// const PREV_USERS_KEY = "softmax_previous_users";
// const MSG_HISTORY_KEY = "softmax_msg_history";
// const MAX_PREV_USERS = 3;
// const MAX_MSG_HISTORY = 10;

// export function getPreviousUsers(): PreviousUserEntry[] {
//   if (typeof window === "undefined") return [];
//   try {
//     const raw = localStorage.getItem(PREV_USERS_KEY);
//     if (!raw) return [];
//     const parsed = JSON.parse(raw);
//     return Array.isArray(parsed) ? parsed : [];
//   } catch {
//     return [];
//   }
// }

// export function savePreviousUser(entry: PreviousUserEntry) {
//   if (typeof window === "undefined") return;
//   try {
//     const current = getPreviousUsers();
//     const latest = current[0];
//     const sameUser =
//       latest?.userId === entry.userId &&
//       Date.now() - new Date(latest.signedInAt).getTime() < 60_000;
//     const next = sameUser
//       ? [entry, ...current.slice(1)]
//       : [entry, ...current];
//     localStorage.setItem(
//       PREV_USERS_KEY,
//       JSON.stringify(next.slice(0, MAX_PREV_USERS))
//     );
//   } catch {}
// }

// export function appendMsgHistory(entry: MsgHistoryEntry) {
//   if (typeof window === "undefined") return;
//   try {
//     const raw = localStorage.getItem(MSG_HISTORY_KEY);
//     const current: MsgHistoryEntry[] = raw ? JSON.parse(raw) : [];
//     const next = [entry, ...current].slice(0, MAX_MSG_HISTORY);
//     localStorage.setItem(MSG_HISTORY_KEY, JSON.stringify(next));
//   } catch {}
// }

// export function getMsgHistory(): MsgHistoryEntry[] {
//   if (typeof window === "undefined") return [];
//   try {
//     const raw = localStorage.getItem(MSG_HISTORY_KEY);
//     return raw ? JSON.parse(raw) : [];
//   } catch {
//     return [];
//   }
// }

// // Client-side IP fetch (no server route required)
// async function fetchClientIp(): Promise<string | undefined> {
//   if (typeof window === "undefined") return undefined;
//   try {
//     const res = await fetch("https://api.ipify.org?format=json", {
//       method: "GET",
//       cache: "no-store",
//     });
//     if (!res.ok) return undefined;
//     const data = await res.json();
//     return typeof data?.ip === "string" ? data.ip : undefined;
//   } catch {
//     return undefined;
//   }
// }

// // Browser name from User-Agent
// function detectBrowserName(): string {
//   if (typeof navigator === "undefined") return "Unknown";
//   const ua = navigator.userAgent;
//   let browser = "Unknown";
//   if (/Edg\//.test(ua)) browser = "Edge";
//   else if (/OPR\//.test(ua) || /Opera/.test(ua)) browser = "Opera";
//   else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
//   else if (/Firefox\//.test(ua)) browser = "Firefox";
//   else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
//   else if (/MSIE|Trident/.test(ua)) browser = "Internet Explorer";

//   let os = "Unknown";
//   if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
//   else if (/Windows NT/.test(ua)) os = "Windows";
//   else if (/Mac OS X/.test(ua)) os = "macOS";
//   else if (/Android/.test(ua)) os = "Android";
//   else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
//   else if (/Linux/.test(ua)) os = "Linux";

//   return `${browser} / ${os}`;
// }

// async function persistLoginMeta(
//   uid: string,
//   ipAddress?: string,
//   browserName?: string
// ) {
//   if (!isFirebaseConfigured || !db || !uid) return;
//   try {
//     await setDoc(
//       doc(db, "users", uid),
//       {
//         ipAddress: ipAddress || null,
//         browserName: browserName || null,
//         lastLoginAt: new Date().toISOString(),
//       },
//       { merge: true }
//     );
//   } catch (e) {
//     console.warn("persistLoginMeta failed:", e);
//   }
// }
// // ─── END ADDED ──────────────────────────────────────────────────────

// interface AuthContextType {
//   user: UserWithCompat | null;
//   loading: boolean;
//   isFirebaseActive: boolean;
//   login: (email: string, password: string) => Promise<UserWithCompat>;
//   signup: (
//     email: string,
//     password: string,
//     name: string,
//     role?: UserRole
//   ) => Promise<UserWithCompat>;
//   loginWithGoogle: () => Promise<UserWithCompat>;
//   logout: () => Promise<void>;
//   updateUserProfile: (updates: Partial<UserWithCompat>) => Promise<UserWithCompat>;
//   resetPassword: (email: string) => Promise<void>;
//   sendVerificationEmail: () => Promise<void>;
//   switchRole: (role: UserRole) => void;
// }

// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// const setRoleCookie = (role?: UserRole | null) => {
//   if (typeof document !== "undefined") {
//     if (role) {
//       document.cookie = `softmax_auth_role=${role}; path=/; max-age=86400; SameSite=Lax`;
//     } else {
//       document.cookie = "softmax_auth_role=; path=/; max-age=0; SameSite=Lax";
//     }
//   }
// };

// export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
//   children,
// }) => {
//   const [user, setUser] = useState<UserWithCompat | null>(null);
//   const [loading, setLoading] = useState<boolean>(true);

//   const saveUserSession = (newUser: UserWithCompat | null) => {
//     setUser(newUser);
//     if (typeof window !== "undefined") {
//       if (newUser) {
//         localStorage.setItem("softmax_auth_user", JSON.stringify(newUser));
//         setRoleCookie(newUser.role);
//       } else {
//         localStorage.removeItem("softmax_auth_user");
//         setRoleCookie(null);
//       }
//     }
//   };

//   // ─── ADDED: unified post-sign-in tracking ──────────────────────
//   const runPostSignInTracking = async (profile: UserWithCompat) => {
//     const ip = await fetchClientIp();
//     const browser = detectBrowserName();

//     if (ip || browser) {
//       await persistLoginMeta(profile.uid, ip, browser);
//     }

//     savePreviousUser({
//       userId: profile.uid,
//       name: profile.name || (profile as any).displayName || "",
//       email: profile.email || "",
//       phone: profile.phone,
//       signInIp: ip,
//       browserName: browser,
//       signedInAt: new Date().toISOString(),
//     });

//     if (ip || browser) {
//       saveUserSession({
//         ...profile,
//         ipAddress: ip,
//         browserName: browser,
//       } as UserWithCompat);
//     }
//   };
//   // ─── END ADDED ────────────────────────────────────────────────

//   const buildUserProfile = async (
//     fbUser?: FirebaseUser | null,
//     fallback?: {
//       uid?: string;
//       email?: string;
//       displayName?: string;
//       name?: string;
//       role?: UserRole;
//     }
//   ): Promise<UserWithCompat> => {
//     const uid = fbUser?.uid || fallback?.uid || "usr-" + Date.now();
//     const email = fbUser?.email || fallback?.email || "user@softmax.in";
//     const name =
//       fbUser?.displayName ||
//       fallback?.name ||
//       fallback?.displayName ||
//       email.split("@")[0].replace(".", " ").replace(/^./, (c) => c.toUpperCase()) ||
//       "User";
//     const photoURL = fbUser?.photoURL || undefined;
//     const emailVerified = fbUser?.emailVerified ?? false;
//     const providerId = fbUser?.providerData?.[0]?.providerId || "password";
//     const createdAt = fbUser?.metadata?.creationTime || new Date().toISOString();
//     const lastLoginAt = fbUser?.metadata?.lastSignInTime || new Date().toISOString();
//     const phone = fbUser?.phoneNumber || undefined;

//     const existingDoc = await getUserFromFirestore(uid);

//     let profile: UserWithCompat;

//     if (existingDoc) {
//       const preservedRole: UserRole = existingDoc.role || "candidate";
//       const preservedIsAdmin: boolean =
//         preservedRole === "admin"
//           ? true
//           : preservedRole === "candidate"
//           ? false
//           : Boolean((existingDoc as any).isAdmin);

//       const hasCompleted =
//         preservedRole === "admin" ||
//         (isProfileComplete(existingDoc) && existingDoc.profileCompleted !== false);

//       profile = {
//         ...existingDoc,
//         role: preservedRole,
//         isAdmin: preservedIsAdmin,
//         email: email || existingDoc.email,
//         name: name || existingDoc.name,
//         displayName: name || existingDoc.name,
//         photoURL: photoURL || existingDoc.photoURL,
//         profileCompleted: hasCompleted,
//         emailVerified,
//         providerId,
//         lastLoginAt: new Date().toISOString(),
//       };
//       await saveUserToFirestore(profile);
//     } else {
//       const role: UserRole = "candidate";

//       profile = {
//         uid,
//         email,
//         name,
//         displayName: name,
//         role,
//         isAdmin: false,
//         photoURL,
//         emailVerified,
//         providerId,
//         createdAt,
//         lastLoginAt,
//         phone,
//         title: undefined,
//         location: undefined,
//         bio: undefined,
//         skills: [],
//         department: undefined,
//         portfolioUrl: undefined,
//         resumeUrl: undefined,
//         profileCompleted: false,
//       };

//       await saveUserToFirestore(profile);
//     }

//     return profile;
//   };

//   useEffect(() => {
//     const savedUserStr =
//       typeof window !== "undefined"
//         ? localStorage.getItem("softmax_auth_user")
//         : null;

//     if (savedUserStr) {
//       try {
//         const initialUser: UserWithCompat = JSON.parse(savedUserStr);
//         setUser(initialUser);
//         if (initialUser?.role) {
//           setRoleCookie(initialUser.role);
//         }
//       } catch {}
//     }

//     if (isFirebaseConfigured && auth) {
//       const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
//         if (fbUser) {
//           const profile = await buildUserProfile(fbUser);
//           // ─── ADDED: track on session restore ─────────────
//           await runPostSignInTracking(profile);
//           // ─── END ADDED ────────────────────────────────────
//           saveUserSession(profile);
//         } else {
//           if (!isFirebaseConfigured) {
//             // keep mock user in offline mode
//           } else {
//             saveUserSession(null);
//           }
//         }
//         setLoading(false);
//       });
//       return () => unsubscribe();
//     } else {
//       setLoading(false);
//     }
//   }, []);

//   const login = async (email: string, password: string): Promise<UserWithCompat> => {
//     setLoading(true);
//     try {
//       if (isFirebaseConfigured && auth) {
//         const res = await signInWithEmailAndPassword(auth, email, password);
//         const profile = await buildUserProfile(res.user);
//         await runPostSignInTracking(profile); // ─── ADDED
//         saveUserSession(profile);
//         return profile;
//       } else {
//         let preservedRole: UserRole = "candidate";
//         if (typeof window !== "undefined") {
//           const stored = localStorage.getItem("softmax_auth_user");
//           if (stored) {
//             try {
//               const parsed = JSON.parse(stored);
//               if (parsed.email?.toLowerCase() === email.toLowerCase() && parsed.role) {
//                 preservedRole = parsed.role;
//               }
//             } catch {}
//           }
//         }
//         const profile = await buildUserProfile(null, { email, role: preservedRole });
//         await runPostSignInTracking(profile); // ─── ADDED
//         saveUserSession(profile);
//         return profile;
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   const signup = async (
//     email: string,
//     password: string,
//     name: string,
//     explicitRole?: UserRole
//   ): Promise<UserWithCompat> => {
//     setLoading(true);
//     try {
//       if (isFirebaseConfigured && auth) {
//         const res = await createUserWithEmailAndPassword(auth, email, password);
//         const fbUser = res.user;

//         if (name) {
//           try {
//             await updateProfile(fbUser, { displayName: name });
//           } catch (e) {
//             console.warn("Could not update displayName on auth:", e);
//           }
//         }

//         const assignedRole: UserRole = "candidate";

//         const profile: UserWithCompat = {
//           uid: fbUser.uid,
//           email: fbUser.email || email,
//           name: name || email.split("@")[0],
//           displayName: name || email.split("@")[0],
//           role: assignedRole,
//           isAdmin: false,
//           photoURL: fbUser.photoURL || undefined,
//           emailVerified: fbUser.emailVerified,
//           providerId: "password",
//           createdAt: new Date().toISOString(),
//           lastLoginAt: new Date().toISOString(),
//           title: undefined,
//           location: undefined,
//           bio: undefined,
//           skills: [],
//           department: undefined,
//           portfolioUrl: undefined,
//           profileCompleted: false,
//         };

//         await saveUserToFirestore(profile);
//         await runPostSignInTracking(profile); // ─── ADDED
//         saveUserSession(profile);
//         return profile;
//       } else {
//         const profile = await buildUserProfile(null, {
//           email,
//           name,
//           displayName: name,
//           role: "candidate",
//         });
//         await runPostSignInTracking(profile); // ─── ADDED
//         saveUserSession(profile);
//         return profile;
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   const loginWithGoogle = async (): Promise<UserWithCompat> => {
//     setLoading(true);
//     try {
//       if (isFirebaseConfigured && auth) {
//         const provider = new GoogleAuthProvider();
//         provider.addScope("https://www.googleapis.com/auth/drive.file");
//         const res = await signInWithPopup(auth, provider);
//         const credential = GoogleAuthProvider.credentialFromResult(res);
//         if (credential?.accessToken && typeof window !== "undefined") {
//           try {
//             sessionStorage.setItem("gdrive_access_token", credential.accessToken);
//             sessionStorage.setItem(
//               "gdrive_token_expires_at",
//               String(Date.now() + 3500 * 1000)
//             );
//           } catch {}
//         }
//         const profile = await buildUserProfile(res.user);
//         await runPostSignInTracking(profile); // ─── ADDED
//         saveUserSession(profile);
//         return profile;
//       } else {
//         throw new Error("Firebase Authentication is not configured in .env.local");
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   const logout = async () => {
//     if (isFirebaseConfigured && auth) {
//       try {
//         await fbSignOut(auth);
//       } catch (err) {
//         console.error("Firebase Signout error:", err);
//       }
//     }
//     // ─── NOTE: previousUser localStorage is INTENTIONALLY NOT cleared ───
//     saveUserSession(null);
//   };

//   const updateUserProfile = async (
//     updates: Partial<UserWithCompat>
//   ): Promise<UserWithCompat> => {
//     if (!user) throw new Error("No authenticated user to update");

//     const mergedUser = {
//       ...user,
//       ...updates,
//       name: updates.name || updates.displayName || user.name,
//       displayName: updates.displayName || updates.name || user.name,
//     };

//     const effectiveProfileCompleted =
//       updates.profileCompleted !== undefined
//         ? updates.profileCompleted && (user.role === "admin" || isProfileComplete(mergedUser))
//         : isProfileComplete(mergedUser);

//     const updatedUser: UserWithCompat = {
//       ...mergedUser,
//       profileCompleted: effectiveProfileCompleted,
//     };

//     if (isFirebaseConfigured && auth?.currentUser) {
//       const authUpdates: { displayName?: string; photoURL?: string } = {};
//       const newName = updates.displayName || updates.name;
//       if (newName !== undefined) authUpdates.displayName = newName;
//       if (updates.photoURL !== undefined) authUpdates.photoURL = updates.photoURL;

//       if (Object.keys(authUpdates).length > 0) {
//         try {
//           await updateProfile(auth.currentUser, authUpdates);
//         } catch (e) {
//           console.warn("Could not update auth profile:", e);
//         }
//       }
//     }

//     await updateUserInFirestore(user.uid, updates);

//     saveUserSession(updatedUser);
//     return updatedUser;
//   };

//   const resetPassword = async (email: string) => {
//     if (isFirebaseConfigured && auth) {
//       await sendPasswordResetEmail(auth, email);
//     } else {
//       console.log("Mock password reset sent to:", email);
//     }
//   };

//   const sendVerificationEmail = async () => {
//     if (isFirebaseConfigured && auth?.currentUser) {
//       await sendEmailVerification(auth.currentUser);
//     } else {
//       console.log("Mock verification email requested");
//     }
//   };

//   const switchRole = async (newRole: UserRole) => {
//     if (!user) return;
//     const safeRole: UserRole = "candidate";
//     const updated: UserWithCompat = {
//       ...user,
//       role: safeRole,
//     };
//     saveUserSession(updated);

//     if (user.uid) {
//       await updateUserInFirestore(user.uid, { role: safeRole });
//     }
//   };

//   return (
//     <AuthContext.Provider
//       value={{
//         user,
//         loading,
//         isFirebaseActive: isFirebaseConfigured,
//         login,
//         signup,
//         loginWithGoogle,
//         logout,
//         updateUserProfile,
//         resetPassword,
//         sendVerificationEmail,
//         switchRole,
//       }}
//     >
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (!context) {
//     throw new Error("useAuth must be used within an AuthProvider");
//   }
//   return context;
// };