"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useJobs } from "@/context/JobContext";
import { useTheme } from "@/context/ThemeContext";
import {
  Code2,
  ExternalLink,
  User,
  Shield,
  Briefcase,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Sun,
  Moon,
  UserPlus,
} from "lucide-react";

export const Header: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { applications } = useJobs();
  const { theme, toggleTheme } = useTheme();

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    await logout();
    setProfileDropdownOpen(false);
    setMobileMenuOpen(false);
    router.replace("/");
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Candidate applications count
  const myApplicationsCount = user
    ? applications.filter(
        (app) =>
          (user.uid && app.uid === user.uid) ||
          Boolean(
            user.email &&
              (app as any).candidateEmail?.toLowerCase() === user.email.toLowerCase()
          )
      ).length
    : 0;

  const hasApprovedApp = user
    ? applications.some(
        (app) =>
          ((user.uid && app.uid === user.uid) ||
            Boolean(
              user.email &&
                (app as any).candidateEmail?.toLowerCase() === user.email.toLowerCase()
            )) &&
          app.status === "Approved"
      )
    : false;

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Job Openings", href: "/openings" },
    { name: "Our Technologies", href: "/technologies" },
    { name: "About Us", href: "/about" },
    { name: "Contact", href: "/contact" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/logo.jpg"
              alt="SoftMax Logo"
              className="w-10 h-10 rounded-xl object-contain bg-white shadow-sm border border-slate-200 dark:border-slate-800 p-0.5 group-hover:scale-105 transition-transform"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  SoftMax
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Careers Platform
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 font-semibold"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}

            {/* Link to corporate site */}
            <a
              href="https://softmax.in"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 ml-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
              title="Visit main corporate website"
            >
              <span>softmax.in</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </nav>

          {/* Right Action: Theme Toggle + Candidate / Admin & Profile */}
          <div className="hidden md:flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={`Toggle Theme`}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* Candidate Console Shortcut */}
            {user?.role === "candidate" && (
              <Link
                href="/candidate"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
                  hasApprovedApp
                    ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700/80 text-emerald-700 dark:text-emerald-300 shadow-sm"
                    : pathname === "/candidate"
                    ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                    : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <Briefcase className={`w-3.5 h-3.5 ${hasApprovedApp ? "text-emerald-600 dark:text-emerald-400" : "text-indigo-500"}`} />
                <span>My Applications</span>
                {hasApprovedApp ? (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-0.5 animate-pulse">
                    <span>Approved</span>
                    <span>🎉</span>
                  </span>
                ) : myApplicationsCount > 0 ? (
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {myApplicationsCount}
                  </span>
                ) : null}
              </Link>
            )}

            {/* Admin Portal Shortcut */}
            {user?.role === "admin" && (
              <Link
                href="/admin"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
                  pathname === "/admin"
                    ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                    : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-indigo-500" />
                <span>Admin Console</span>
              </Link>
            )}

            {/* Profile Avatar / Dropdown OR Sign In */}
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 pr-2.5 rounded-full border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.name || (user as any).displayName}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-semibold flex items-center justify-center text-xs">
                      {(user.name || (user as any).displayName || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-semibold max-w-[100px] truncate">
                    {(user.name || (user as any).displayName || "User").split(" ")[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                <AnimatePresence>
                  {profileDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -6 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-2 text-slate-800 dark:text-slate-200 z-50"
                    >
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg mb-2">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {user.name || (user as any).displayName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {user.email}
                        </div>
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 uppercase">
                          {user.role}
                        </span>
                      </div>

                      <div className="space-y-0.5 text-xs">
                        <Link
                          href="/profile"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium"
                        >
                          <User className="w-3.5 h-3.5 text-indigo-500" />
                          <span>My Profile</span>
                        </Link>

                        {user.role === "candidate" && (
                          <Link
                            href="/candidate"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium"
                          >
                            <span className="flex items-center gap-2">
                              <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                              Candidate Console
                            </span>
                            {myApplicationsCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                                {myApplicationsCount}
                              </span>
                            )}
                          </Link>
                        )}

                        {user.role === "admin" && (
                          <>
                            <Link
                              href="/admin"
                              onClick={() => setProfileDropdownOpen(false)}
                              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium"
                            >
                              <Shield className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Admin Portal</span>
                            </Link>

                            <Link
                              href="/admin/uploadByRecruter"
                              onClick={() => setProfileDropdownOpen(false)}
                              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium"
                            >
                              <UserPlus className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Recruiter Upload</span>
                            </Link>
                          </>
                        )}
                      </div>

                      <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex items-center gap-2"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                href="/auth"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>

          {/* Mobile hamburger button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="md:hidden overflow-hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-3 pb-6 space-y-2"
          >
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                  pathname === link.href
                    ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {link.name}
              </Link>
            ))}

            <a
              href="https://softmax.in"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600"
            >
              <span>Visit softmax.in</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {user ? (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between px-3 py-1">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {user.name || (user as any).displayName}
                    </div>
                    <div className="text-xs text-slate-500 capitalize">
                      {user.role}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-xs text-rose-600 dark:text-rose-400 font-semibold px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-900/50"
                  >
                    Sign Out
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-center text-slate-700 dark:text-slate-200"
                  >
                    Profile
                  </Link>
                  {user.role === "candidate" ? (
                    <Link
                      href="/candidate"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`px-3 py-2 rounded-lg text-white text-xs font-semibold text-center flex items-center justify-center gap-1 ${
                        hasApprovedApp ? "bg-emerald-600 animate-pulse" : "bg-indigo-600"
                      }`}
                    >
                      <span>Console</span>
                      {hasApprovedApp && <span>🎉</span>}
                    </Link>
                  ) : (
                    <Link
                      href="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold text-center"
                    >
                      Admin
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <Link
                  href="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full py-2.5 text-center bg-indigo-600 text-white rounded-lg text-sm font-semibold shadow-sm"
                >
                  Sign In / Register
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
