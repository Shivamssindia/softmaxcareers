"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useJobs } from "@/context/JobContext";
import { useAuth } from "@/context/AuthContext";
import { JobCard } from "@/components/JobCard";
import HeroBackgroundEffect from "@/components/HeroBackgroundEffect";
import {
  Bot,
  Server,
  Cloud,
  Smartphone,
  Globe,
  Radio,
  Briefcase,
  ArrowRight,
  ExternalLink,
  CheckCircle,
  Code2,
  Users2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

/* ============================================================ */
/* 3D TILT WRAPPER                                               */
/* ============================================================ */
function TiltCard({
  children,
  className = "",
  intensity = 10,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [intensity, -intensity]), {
    stiffness: 300,
    damping: 25,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-intensity, intensity]), {
    stiffness: 300,
    damping: 25,
  });

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const onMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 1200,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ============================================================ */
/* FLOATING 3D ORB BACKGROUND                                    */
/* ============================================================ */
function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div
        animate={{ y: [0, -30, 0], x: [0, 20, 0], rotate: [0, 8, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-indigo-400/20 dark:bg-indigo-500/10 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, 40, 0], x: [0, -25, 0], rotate: [0, -10, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-32 -right-24 w-80 h-80 rounded-full bg-purple-400/20 dark:bg-purple-500/10 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, -20, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-10 left-1/3 w-64 h-64 rounded-full bg-sky-400/15 dark:bg-sky-500/10 blur-3xl"
      />
    </div>
  );
}

/* ============================================================ */
/* HOME PAGE                                                     */
/* ============================================================ */
export default function HomePage() {
  const router = useRouter();
  const { jobs } = useJobs();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<"all" | "Tech" | "Non-Tech">("all");

  const filteredPreviewJobs = jobs
    .filter((j) => j.status === "active")
    .filter((j) => (activeCategory === "all" ? true : j.category === activeCategory))
    .slice(0, 3);

  /* Feature technologies preview on homepage */
  const featuredTechs = [
    {
      name: "Next.js",
      level: "Full-Stack Web",
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg",
      desc: "Ship production React experiences with server rendering, edge APIs, and sub-second performance at scale.",
      color: "indigo",
    },
    {
      name: "Spring Boot",
      level: "Enterprise Backend",
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/spring/spring-original.svg",
      desc: "Build resilient, secure Java services trusted by banks, logistics platforms, and Fortune 500 systems.",
      color: "emerald",
    },
    {
      name: "Flutter",
      level: "Cross-Platform Mobile",
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/flutter/flutter-original.svg",
      desc: "Deliver one elegant codebase across iOS and Android — with native-grade performance and pixel-perfect UI.",
      color: "sky",
    },
    {
      name: "TensorFlow",
      level: "AI / Machine Learning",
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tensorflow/tensorflow-original.svg",
      desc: "Take models from research notebook to production — powering recommendation, vision, and language systems.",
      color: "amber",
    },
  ];

  return (
    <div className="space-y-16 sm:space-y-24 pb-20 relative">
      {/* ============================================================ */}
      {/* HERO SECTION — 3D PARALLAX + CYBER CONSTELLATION BACKGROUND   */}
      {/* ============================================================ */}
      <section className="relative pt-12 sm:pt-20 lg:pt-24 pb-8 sm:pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center overflow-hidden rounded-3xl">
        <HeroBackgroundEffect />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.12, delayChildren: 0.05 },
            },
          }}
          className="relative max-w-3xl mx-auto space-y-6"
          style={{ transformStyle: "preserve-3d", perspective: 1200 }}
        >
          {/* 3D badge */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20, rotateX: -20 },
              visible: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.6 } },
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold select-none shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Now Hiring Across Engineering, Product & Delivery</span>
          </motion.div>

          <motion.h1
            variants={{
              hidden: { opacity: 0, y: 30, rotateX: -25 },
              visible: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.7 } },
            }}
            style={{ transformStyle: "preserve-3d" }}
            className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight"
          >
            Do the Best Work of Your Career.{" "}
            <br />
            <span className="text-indigo-600 dark:text-indigo-400 inline-block">
              Build What Comes Next.
            </span>
          </motion.h1>

          <motion.p
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.55 } },
            }}
            className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto"
          >
            At SoftMax, we bring together{" "}
            <strong className="text-slate-900 dark:text-white">
              engineers, analysts, and delivery leaders
            </strong>{" "}
            to solve meaningful problems — from AI-driven platforms and distributed systems
            to cloud infrastructure that serves millions of users every day.
          </motion.p>

          {/* Action buttons — 3D press */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.55 } },
            }}
            className="pt-2 flex flex-wrap items-center justify-center gap-3"
          >
            <motion.div whileHover={{ scale: 1.05, rotateX: 8, rotateY: -5 }} whileTap={{ scale: 0.97 }} style={{ transformStyle: "preserve-3d" }}>
              <Link
                href="/openings"
                className="ui-btn-primary px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2"
              >
                <Briefcase className="w-4 h-4" />
                <span>Explore Open Roles</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05, rotateX: 8, rotateY: 5 }} whileTap={{ scale: 0.97 }} style={{ transformStyle: "preserve-3d" }}>
              <Link
                href="/apply"
                onClick={(e) => {
                  if (!user) {
                    e.preventDefault();
                    router.push(`/auth?redirect=${encodeURIComponent("/apply")}`);
                  }
                }}
                className="ui-btn-secondary px-5 py-3 rounded-xl text-sm font-semibold"
              >
                <span>Submit Your Application</span>
              </Link>
            </motion.div>

            <a
              href="https://softmax.in"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition flex items-center gap-1.5"
            >
              <span>Visit softmax.in</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </motion.div>

          {/* Trust highlights */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 15 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.55 } },
            }}
            className="pt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-500 dark:text-slate-400"
          >
            {[
              { icon: CheckCircle, color: "emerald", text: "Live Job Updates in Real Time" },
              { icon: CheckCircle, color: "indigo", text: "Open Roles Across Tech & Business" },
              { icon: CheckCircle, color: "emerald", text: "Transparent Application Tracking" },
            ].map(({ icon: Icon, color, text }, i) => (
              <motion.span
                key={text}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.12 }}
                className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition"
              >
                <Icon className={`w-4 h-4 text-${color}-500`} />
                {text}
              </motion.span>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ============================================================ */}
      {/* TECH FOCUS — 3D TILT CARDS + EXPLORE MORE                     */}
      {/* ============================================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20, rotateX: -8 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6 }}
          style={{ transformStyle: "preserve-3d", perspective: 1000 }}
          className="text-center max-w-2xl mx-auto mb-10 space-y-2"
        >
          <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            What We Build With
          </h2>
          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            The Stack Behind Everything We Ship
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Our teams work with the same modern platforms trusted by the world&apos;s
            leading product companies — from edge-rendered web apps to
            production-grade AI pipelines.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredTechs.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30, rotateX: -15 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <TiltCard intensity={12} className="h-full">
                <div className="group relative h-full p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-800/60 transition-all overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div
                    className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center p-2 mb-3"
                    style={{ transform: "translateZ(40px)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.icon} alt={t.name} className="w-8 h-8 object-contain" loading="lazy" />
                  </div>
                  <div style={{ transform: "translateZ(20px)" }}>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t.name}</h4>
                    <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 mb-2">
                      {t.level}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {t.desc}
                    </p>
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>

        {/* EXPLORE MORE — 3D */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 text-center"
        >
          <motion.div
            whileHover={{ scale: 1.06, rotateX: 10, rotateY: -6 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{ transformStyle: "preserve-3d", perspective: 800 }}
            className="inline-block"
          >
            <Link
              href="/technologies"
              className="ui-btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold shadow-lg"
            >
              <Sparkles className="w-4 h-4" />
              <span>See Every Technology We Use</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ============================================================ */}
      {/* TECH vs NON-TECH CAREER TRACKS — 3D SPLIT CARDS               */}
      {/* ============================================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6 }}
          className="ui-card p-6 sm:p-10 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-8"
        >
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Two Paths, One Mission
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Find Your Place — Technical or Business
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Great products are built by great teams. Whether you love writing code
              or driving delivery, there&apos;s a role designed for you here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tech track */}
            <motion.div
              initial={{ opacity: 0, x: -40, rotateY: 18 }}
              whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, type: "spring", stiffness: 90 }}
              style={{ transformStyle: "preserve-3d", perspective: 1000 }}
            >
              <TiltCard intensity={8}>
                <div className="p-6 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-4 h-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md">
                      <Code2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        Engineering & Data
                      </h4>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                        Software, AI, Cloud & Platform
                      </p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Join teams building distributed systems, cloud-native platforms,
                    and production AI. Work alongside engineers who care deeply
                    about scale, reliability, and craft.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/openings"
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 group"
                    >
                      <span>Browse Engineering Roles</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </TiltCard>
            </motion.div>

            {/* Non-tech track */}
            <motion.div
              initial={{ opacity: 0, x: 40, rotateY: -18 }}
              whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, type: "spring", stiffness: 90 }}
              style={{ transformStyle: "preserve-3d", perspective: 1000 }}
            >
              <TiltCard intensity={8}>
                <div className="p-6 rounded-xl border border-purple-100 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20 space-y-4 h-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-md">
                      <Users2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        Business & Delivery
                      </h4>
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                        Product, Agile, Analysis & Talent
                      </p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    Work with product owners, analysts, and delivery leads who
                    translate complex requirements into shipped outcomes. Shape
                    how technology gets built — not just what gets built.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/openings"
                      className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1 group"
                    >
                      <span>Browse Business Roles</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </TiltCard>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ============================================================ */}
      {/* FEATURED OPENINGS                                             */}
      {/* ============================================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6"
        >
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Open Roles Right Now
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Apply in minutes — and follow every step of your application in real time.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(["all", "Tech", "Non-Tech"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`relative px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeCategory === cat
                    ? "text-white"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {activeCategory === cat && (
                  <motion.div
                    layoutId="home-category-indicator"
                    className={`absolute inset-0 rounded-md shadow-sm ${
                      cat === "Non-Tech" ? "bg-purple-600" : "bg-indigo-600"
                    }`}
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{cat === "all" ? "All" : cat}</span>
              </button>
            ))}
          </div>
        </motion.div>

        <AnimatePresence mode="popLayout">
          {filteredPreviewJobs.length > 0 ? (
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 15, rotateX: -8 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -15, rotateX: 8 }}
              transition={{ duration: 0.4 }}
              style={{ transformStyle: "preserve-3d", perspective: 1200 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredPreviewJobs.map((job, i) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 30, rotateY: -8 }}
                  animate={{ opacity: 1, y: 0, rotateY: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <TiltCard intensity={6}>
                    <JobCard job={job} />
                  </TiltCard>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl"
            >
              <p className="text-sm text-slate-500">
                No open positions in this track right now — but new roles are added every week.
                Check back soon or follow us to stay updated.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mt-8"
        >
          <Link
            href="/openings"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline group"
          >
            <span>See All {jobs.length} Open Positions</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </section>

      {/* ============================================================ */}
      {/* CANDIDATE CONSOLE PROMO — 3D FLOAT                            */}
      {/* ============================================================ */}
      <motion.section
        initial={{ opacity: 0, y: 40, rotateX: -12 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.65, type: "spring", stiffness: 80 }}
        style={{ transformStyle: "preserve-3d", perspective: 1200 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <TiltCard intensity={5}>
          <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 hover:border-slate-300 dark:hover:border-slate-700 transition">
            <div className="space-y-2 max-w-xl">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Never Wonder Where You Stand
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Track your application from the moment you apply — see when it&apos;s
                under review, shortlisted, or moved forward. Full transparency,
                every step of the way.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {user?.role === "candidate" ? (
                <motion.div whileHover={{ scale: 1.05, rotateY: 10 }} whileTap={{ scale: 0.97 }} style={{ transformStyle: "preserve-3d" }}>
                  <Link
                    href="/candidate"
                    className="ui-btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2"
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>Open My Dashboard</span>
                  </Link>
                </motion.div>
              ) : user?.role === "admin" ? (
                <motion.div whileHover={{ scale: 1.05, rotateY: 10 }} whileTap={{ scale: 0.97 }} style={{ transformStyle: "preserve-3d" }}>
                  <Link
                    href="/admin"
                    className="ui-btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Open Admin Portal</span>
                  </Link>
                </motion.div>
              ) : (
                <motion.div whileHover={{ scale: 1.05, rotateY: 10 }} whileTap={{ scale: 0.97 }} style={{ transformStyle: "preserve-3d" }}>
                  <Link
                    href="/auth"
                    className="ui-btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2"
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>Sign In to Track Applications</span>
                  </Link>
                </motion.div>
              )}
            </div>
          </div>
        </TiltCard>
      </motion.section>
    </div>
  );
}