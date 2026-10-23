"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole } from "@/types";
import { auth, isFirebaseConfigured } from "@/lib/firebase";
import {
  saveUserToFirestore,
  getUserFromFirestore,
  updateUserInFirestore,
  determineUserRoleInFirestore,
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

export type UserWithCompat = User & { displayName?: string; isAdmin?: boolean };

interface AuthContextType {
  user: UserWithCompat | null;
  loading: boolean;
  isFirebaseActive: boolean;
  login: (email: string, password: string) => Promise<UserWithCompat>;
  signup: (
    email: string,
    password: string,
    name: string,
    role?: UserRole
  ) => Promise<UserWithCompat>;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
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

  // Helper to build and sync user profile in Firestore database using lib/firestore/index.ts
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

    // Check if user already exists in Firestore database
    const existingDoc = await getUserFromFirestore(uid);

    let profile: UserWithCompat;

    if (existingDoc) {
      // Existing user signing in second time or later:
      // DO NOT CHANGE THEIR ROLE. Preserve existing role and admin permissions.
      const preservedRole: UserRole = existingDoc.role || "candidate";
      const preservedIsAdmin: boolean =
        preservedRole === "admin"
          ? true
          : preservedRole === "candidate"
          ? false
          : Boolean((existingDoc as any).isAdmin);

      profile = {
        ...existingDoc,
        role: preservedRole,
        isAdmin: preservedIsAdmin,
        email: email || existingDoc.email,
        name: name || existingDoc.name,
        displayName: name || existingDoc.name,
        photoURL: photoURL || existingDoc.photoURL,
        emailVerified,
        providerId,
        lastLoginAt: new Date().toISOString(),
      };
      // Synchronize updated timestamp/profile back to Firestore without altering role
      await saveUserToFirestore(profile);
    } else {
      // First-time authentication: Assign Candidate role with isAdmin: false
      const role: UserRole = "candidate";

      profile = {
        uid,
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
        title: "Software Engineer",
        location: "Bengaluru, India",
        bio: "Passionate engineer eager to contribute to innovative software solutions.",
        skills: ["React", "TypeScript", "Node.js", "Next.js", "Tailwind CSS"],
        department: "Web Development",
        portfolioUrl: "https://github.com",
        resumeUrl: undefined,
      };

      // Store in Firestore database
      await saveUserToFirestore(profile);
    }

    return profile;
  };

  // Initialize Auth state from LocalStorage or Firebase on mount
  useEffect(() => {
    const savedUserStr =
      typeof window !== "undefined"
        ? localStorage.getItem("softmax_auth_user")
        : null;

    if (savedUserStr) {
      try {
        const initialUser: UserWithCompat = JSON.parse(savedUserStr);
        setUser(initialUser);
        if (initialUser?.role) {
          setRoleCookie(initialUser.role);
        }
      } catch {
        // Ignore parse error
      }
    }

    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          const profile = await buildUserProfile(fbUser);
          saveUserSession(profile);
        } else {
          if (!isFirebaseConfigured) {
            // Keep saved mock user in offline mode
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
        const profile = await buildUserProfile(null, {
          email,
          role: preservedRole,
        });
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

        // All authenticated users are assigned the candidate role
        const assignedRole: UserRole = "candidate";

        const profile: UserWithCompat = {
          uid: fbUser.uid,
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
          title: "Software Engineer",
          location: "Bengaluru, India",
          bio: "Passionate engineer eager to contribute to innovative software solutions.",
          skills: ["React", "TypeScript", "Node.js", "Next.js", "Tailwind CSS"],
          department: "Web Development",
          portfolioUrl: "https://github.com",
        };

        // Store user in Firestore database
        await saveUserToFirestore(profile);

        saveUserSession(profile);
        return profile;
      } else {
        const profile = await buildUserProfile(null, {
          email,
          name,
          displayName: name,
          role: "candidate",
        });
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
        // buildUserProfile stores or merges user data in Firestore
        const profile = await buildUserProfile(res.user);
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

  const updateUserProfile = async (updates: Partial<UserWithCompat>): Promise<UserWithCompat> => {
    if (!user) throw new Error("No authenticated user to update");

    const updatedUser: UserWithCompat = {
      ...user,
      ...updates,
      name: updates.name || updates.displayName || user.name,
      displayName: updates.displayName || updates.name || user.name,
    };

    // Update Firebase Auth displayName and photoURL if present
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

    // Persist full profile to Firestore using lib/firestore/index.ts
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
    // Switch admin is removed; authenticated users operate as candidates
    if (!user) return;
    const safeRole: UserRole = "candidate";
    const updated: UserWithCompat = {
      ...user,
      role: safeRole,
    };
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
