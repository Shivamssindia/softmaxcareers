"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Code2,
  ExternalLink,
  Target,
  Sparkles,
  Award,
  Users,
  Compass,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl mx-auto space-y-3"
      >
        <img
          src="/logo.jpg"
          alt="SoftMax Logo"
          className="w-14 h-14 rounded-2xl mx-auto object-contain bg-white shadow-md border border-slate-200 dark:border-slate-800 p-1"
        />
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>Engineering with Purpose</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          About SoftMax Careers
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          We are a technology innovation leader specializing in high-performance AI systems, distributed architectures, and modern cloud engineering. SoftMax Careers is our dedicated platform for top engineering and tech talent.
        </p>
      </motion.div>

      {/* Main Corporate Portal Card */}
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 hover:border-slate-300 dark:hover:border-slate-700 transition"
      >
        <div className="space-y-1.5 text-center sm:text-left">
          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            SoftMax Ecosystem
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            Want to learn more about the SoftMax ecosystem?
          </h2>
          <p className="text-xs text-slate-500 max-w-xl">
            Explore our technology innovations, company culture, research, and corporate initiatives directly on softmax.in.
          </p>
        </div>

        <a
          href="https://softmax.in"
          target="_blank"
          rel="noopener noreferrer"
          className="ui-btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 flex-shrink-0 hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          <span>Visit softmax.in</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </motion.div>

      {/* Mission, Vision, Values */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.1 }}
          whileHover={{ y: -6, transition: { duration: 0.2 } }}
          className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 cursor-default"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Target className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Our Mission</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            To empower engineers and innovators by building an ecosystem where talent solves complex problems and builds high-impact technology.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.2 }}
          whileHover={{ y: -6, transition: { duration: 0.2 } }}
          className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 cursor-default"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Compass className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Our Vision</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            To build an engineering community where developers grow continuously, master advanced systems, and build world-class products.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.3 }}
          whileHover={{ y: -6, transition: { duration: 0.2 } }}
          className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 cursor-default"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Our Values</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Continuous learning, transparency, craftsmanship over quick hacks, and delivering measurable impact and long-term career growth.
          </p>
        </motion.div>
      </div>

      {/* Join the Team CTA */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
        className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-3"
      >
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Want to Join the SoftMax Team?
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
          We are actively hiring for tech and non-tech IT positions. Check out our job openings and submit your application today.
        </p>
        <Link
          href="/openings"
          className="ui-btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          <span>Explore Job Openings</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </motion.div>
    </div>
  );
}
