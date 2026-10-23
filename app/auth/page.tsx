"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { UserRole } from "@/types";
import {
  CheckCircle2,
  AlertCircle,
  Briefcase,
  ArrowRight,
  Home,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");

  const {
    user,
    loading,
    loginWithGoogle,
    login,
    isFirebaseActive,
  } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handlePostAuthRedirect = (targetRole?: UserRole) => {
    if (redirectParam) {
      router.replace(decodeURIComponent(redirectParam));
    } else if (targetRole === "admin") {
      router.replace("/admin");
    } else {
      router.replace("/candidate");
    }
  };

  const formatFirebaseError = (err: any): string => {
    const code = err?.code || "";
    if (code === "auth/popup-closed-by-user") {
      return "Google authentication window was closed before completing.";
    }
    if (code === "auth/popup-blocked") {
      return "Popup was blocked by your browser. Please allow popups for authentication.";
    }
    if (code === "auth/unauthorized-domain") {
      return "Current domain is not authorized in Firebase OAuth settings.";
    }
    return err?.message || "Authentication failed. Please try again.";
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const gUser = await loginWithGoogle();
      setSuccessMsg(`Welcome, ${gUser.name || (gUser as any).displayName}! Redirecting...`);
      setTimeout(() => {
        handlePostAuthRedirect(gUser.role);
      }, 500);
    } catch (err: any) {
      setError(formatFirebaseError(err));
      setSubmitting(false);
    }
  };

  // Instant 1-click Candidate Authentication (no ID/password input required)
  const handleInstantCandidateAuth = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const candidateUser = await login("candidate@softmax.in", "candidate123");
      setSuccessMsg(`Authenticated as Candidate (${candidateUser.name || (candidateUser as any).displayName})! Redirecting...`);
      setTimeout(() => {
        handlePostAuthRedirect(candidateUser.role);
      }, 500);
    } catch (err: any) {
      setError(formatFirebaseError(err));
      setSubmitting(false);
    }
  };

  // If already signed in
  if (!loading && user) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md mx-auto p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-6"
      >
        <img
          src="/logo.jpg"
          alt="SoftMax Logo"
          className="w-16 h-16 mx-auto rounded-2xl object-contain shadow-md bg-white p-1 border border-slate-200 dark:border-slate-800"
        />

        <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Already Authenticated</h2>
          <p className="text-xs text-slate-500">
            Signed in as <strong>{user.name || (user as any).displayName}</strong> ({user.email})
          </p>
          <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 capitalize border border-indigo-200 dark:border-indigo-800/50">
            Role: {user.role}
          </span>
        </div>

        {redirectParam && (
          <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300">
            <p className="font-semibold mb-2">You were navigating to a job application.</p>
            <Link
              href={decodeURIComponent(redirectParam)}
              className="ui-btn-primary w-full py-2 px-3 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5"
            >
              <span>Continue to Job Application</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Link
            href="/profile"
            className="ui-btn-secondary py-2.5 px-3 text-xs font-semibold rounded-xl hover:scale-105 active:scale-95 transition-transform"
          >
            My Profile
          </Link>
          {user.role === "admin" ? (
            <Link
              href="/admin"
              className="ui-btn-primary py-2.5 px-3 text-xs font-semibold rounded-xl hover:scale-105 active:scale-95 transition-transform"
            >
              Admin Portal
            </Link>
          ) : (
            <Link
              href="/candidate"
              className="ui-btn-primary py-2.5 px-3 text-xs font-semibold rounded-xl hover:scale-105 active:scale-95 transition-transform"
            >
              My Console
            </Link>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md mx-auto p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6"
    >
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition">
          <Home className="w-3.5 h-3.5" />
          <span>Home</span>
        </Link>
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isFirebaseActive ? "bg-emerald-500" : "bg-slate-400"}`} />
          <span>{isFirebaseActive ? "System Online" : "Standard Mode"}</span>
        </span>
      </div>

      {/* Header with official logo */}
      <div className="text-center space-y-2">
        <img
          src="/logo.jpg"
          alt="SoftMax Logo"
          className="w-16 h-16 mx-auto rounded-2xl object-contain shadow-md bg-white p-1 border border-slate-200 dark:border-slate-800 mb-2"
        />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Sign In to SoftMax
        </h1>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">
          {redirectParam
            ? "Sign in to complete your job application and track reviews live."
            : "Choose an authentication method to access your candidate console or admin dashboard."}
        </p>
      </div>

      {/* Context banner when redirected from Apply */}
      {redirectParam && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5">
          <Briefcase className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Authentication required before applying for this job opening.</span>
        </div>
      )}

      {/* Notifications */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Authentication Options (No ID / Password Inputs) */}
      <div className="space-y-3 pt-2">
        {/* Primary Option: Google Authentication */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={submitting}
          className="w-full py-3.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-slate-300 transition flex items-center justify-center gap-3 shadow-sm hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{submitting ? "Signing in..." : "Continue with Google"}</span>
        </button>

        {/* Secondary Instant Candidate Authentication (1-Click) */}
        <button
          type="button"
          onClick={handleInstantCandidateAuth}
          disabled={submitting}
          className="w-full py-3 px-4 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 transition flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
        >
          <Zap className="w-4 h-4 text-indigo-500" />
          <span>One-Click Candidate Sign In</span>
        </button>
      </div>

      {/* Security note */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span>Fast, secure single sign-on. No passwords to remember.</span>
        </p>
      </div>
    </motion.div>
  );
}

export default function AuthPage() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="text-xs text-slate-400">Loading authentication...</div>}>
        <AuthContent />
      </Suspense>
    </div>
  );
}
