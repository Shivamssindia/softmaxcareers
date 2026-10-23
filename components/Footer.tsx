"use client";

import React from "react";
import Link from "next/link";
import {
  Code2,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  ShieldCheck,
} from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d111c] text-slate-600 dark:text-slate-400 text-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Info */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <img
                src="/logo.jpg"
                alt="SoftMax Logo"
                className="w-9 h-9 rounded-xl object-contain bg-white shadow-sm border border-slate-200 dark:border-slate-800 p-0.5"
              />
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                SoftMax <span className="text-indigo-600 dark:text-indigo-400 font-medium text-xs">Careers</span>
              </span>
            </Link>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              The official careers and talent platform for SoftMax (softmax.in). We connect top engineering, AI, and non-tech talent with rewarding IT careers.
            </p>
            <div>
              <a
                href="https://softmax.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <span>Visit softmax.in</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Core Areas */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">
              Specializations
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/technologies" className="hover:text-indigo-600 dark:hover:text-white transition">
                  AI & Machine Learning
                </Link>
              </li>
              <li>
                <Link href="/technologies" className="hover:text-indigo-600 dark:hover:text-white transition">
                  Distributed System Design
                </Link>
              </li>
              <li>
                <Link href="/technologies" className="hover:text-indigo-600 dark:hover:text-white transition">
                  Software Engineering
                </Link>
              </li>
              <li>
                <Link href="/technologies" className="hover:text-indigo-600 dark:hover:text-white transition">
                  Cloud & DevOps
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">
              Career Links
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/openings" className="hover:text-indigo-600 dark:hover:text-white transition flex items-center gap-1">
                  <span>Job Openings</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-semibold px-1.5 py-0.2 rounded-full">
                    Hiring
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/candidate" className="hover:text-indigo-600 dark:hover:text-white transition">
                  Candidate Console
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-indigo-600 dark:hover:text-white transition">
                  About SoftMax
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-indigo-600 dark:hover:text-white transition">
                  Contact Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">
              Office & Support
            </h4>
            <div className="space-y-2.5 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <span>SoftMax Technologies and IT Services, Indore, Madhya Pradesh, India</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            © {new Date().getFullYear()} SoftMax Technologies. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <Link href="/contact" className="hover:underline">
              Support
            </Link>
            <Link href="/openings" className="hover:underline">
              Careers
            </Link>
            <a href="https://softmax.in" target="_blank" rel="noopener noreferrer" className="hover:underline">
              softmax.in
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
