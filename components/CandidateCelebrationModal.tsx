"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PartyPopper,
  Sparkles,
  Award,
  CheckCircle2,
  ExternalLink,
  X,
  ArrowRight,
  ShieldCheck,
  Briefcase,
  KeyRound,
  Info,
} from "lucide-react";

interface CandidateCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  applicationId?: string;
}

export const CandidateCelebrationModal: React.FC<CandidateCelebrationModalProps> = ({
  isOpen,
  onClose,
  candidateName,
  candidateEmail,
  jobTitle,
  applicationId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Confetti Canvas Animation
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const colors = [
      "#10B981", // emerald
      "#059669",
      "#34D399",
      "#6366F1", // indigo
      "#818CF8",
      "#F59E0B", // amber
      "#FBBF24",
      "#EC4899", // pink
      "#06B6D4", // cyan
      "#8B5CF6", // purple
    ];

    interface Particle {
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      vx: number;
      vy: number;
      rotation: number;
      vRot: number;
      shape: "rect" | "circle" | "ribbon";
      opacity: number;
    }

    const particles: Particle[] = [];
    const particleCount = 100;

    // Initial burst from top/center
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: width * 0.5 + (Math.random() - 0.5) * 400,
        y: Math.random() * -height * 0.4,
        w: Math.random() * 9 + 6,
        h: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 5,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 6,
        shape: Math.random() > 0.4 ? "rect" : Math.random() > 0.5 ? "circle" : "ribbon",
        opacity: Math.random() * 0.4 + 0.6,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRot;
        p.vx += (Math.random() - 0.5) * 0.08; // air flutter

        // Wrap around when falling past bottom
        if (p.y > height + 20) {
          p.y = -20;
          p.x = Math.random() * width;
          p.vy = Math.random() * 3 + 1.8;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;

        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === "ribbon") {
          ctx.fillRect(-p.w / 2, -p.h, p.w, p.h * 2.2);
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Confetti Background Canvas */}
        <canvas
          ref={canvasRef}
          className="fixed inset-0 pointer-events-none z-[112]"
        />

        {/* Modal Backdrop with rich blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[111]"
          onClick={onClose}
        />

        {/* Celebration Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{
            type: "spring",
            stiffness: 340,
            damping: 24,
          }}
          className="relative w-full max-w-xl overflow-hidden rounded-3xl border-2 border-emerald-400/80 dark:border-emerald-600/60 bg-gradient-to-b from-white via-white to-slate-50 dark:from-[#0d1527] dark:via-[#0b1120] dark:to-[#070b14] shadow-2xl shadow-emerald-500/20 z-[115] p-6 sm:p-8 text-slate-900 dark:text-slate-100 space-y-6 my-auto"
        >
          {/* Top Decorative Celebratory Gradient */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-emerald-400 via-teal-400 via-indigo-500 to-amber-400 animate-gradient" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition z-20"
            aria-label="Close celebration dialog"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Celebratory Icon & Badge Cluster */}
          <div className="flex flex-col items-center text-center space-y-3 pt-2">
            <div className="relative">
              {/* Outer pulsing celebratory halo */}
              <motion.div
                animate={{ scale: [1, 1.35, 1], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-400/40 via-emerald-400/40 to-teal-400/40 blur-2xl"
              />

              {/* Icon Container with multi-layered badges */}
              <motion.div
                initial={{ rotate: -15, scale: 0.5 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30"
              >
                <Award className="w-10 h-10 text-amber-300 drop-shadow-md" />

                {/* Floating mini celebration badges */}
                <motion.div
                  animate={{ y: [-2, 3, -2], rotate: [-5, 5, -5] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-2.5 -right-2.5 w-8 h-8 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center shadow-md text-sm"
                >
                  🎉
                </motion.div>
                <motion.div
                  animate={{ y: [2, -3, 2], rotate: [5, -5, 5] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                  className="absolute -bottom-2 -left-2 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md text-xs"
                >
                  ✨
                </motion.div>
              </motion.div>
            </div>

            {/* Celebratory Tag */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-extrabold bg-gradient-to-r from-amber-100 to-emerald-100 dark:from-amber-950/70 dark:to-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 uppercase tracking-widest shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Official Selection • Application Approved</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            </div>

            {/* Main Headline */}
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Congratulations, {candidateName.split(" ")[0]}!
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
              We are thrilled to share that your application for{" "}
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                {jobTitle}
              </strong>{" "}
              has been approved by the SoftMax hiring committee!
            </p>
          </div>

          {/* Application Details Summary */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60 dark:border-slate-800/80">
              <span className="text-slate-400 font-medium">Candidate Name:</span>
              <span className="font-bold text-slate-900 dark:text-white">{candidateName}</span>
            </div>
            <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60 dark:border-slate-800/80">
              <span className="text-slate-400 font-medium">Approved Role:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{jobTitle}</span>
            </div>
            {applicationId && (
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/60 dark:border-slate-800/80">
                <span className="text-slate-400 font-medium">Application Reference:</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">#{applicationId}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-0.5">
              <span className="text-slate-400 font-medium">Portal Status:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approved & Consultant Onboarding Ready
              </span>
            </div>
          </div>

          {/* SoftMax Nexus Action Box & Login Instruction (Requirements 2 & 3) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border-2 border-emerald-400/80 dark:border-emerald-500/50 space-y-3 shadow-inner">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
                <KeyRound className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Next Step: Access SoftMax Nexus Portal</span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                    nexus.softmax.in
                  </span>
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Your consultant workspace, team communications, and onboarding workflow are now ready on SoftMax Nexus.
                </p>
              </div>
            </div>

            {/* Instruction Callout Box */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span>Important Login Instruction:</span>
              </div>
              <p className="pl-5 text-[11px] leading-relaxed">
                Please log in to{" "}
                <a
                  href="https://nexus.softmax.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline hover:text-amber-950 dark:hover:text-white"
                >
                  nexus.softmax.in
                </a>{" "}
                using the <strong className="underline">SAME ID / Email address</strong> registered with this portal:
              </p>
              <div className="pl-5 pt-0.5">
                <span className="inline-block px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 font-mono font-bold text-slate-900 dark:text-white text-xs select-all">
                  {candidateEmail || "your registered email"}
                </span>
              </div>
            </div>

            {/* Nexus Portal Direct CTA Button */}
            <a
              href="https://nexus.softmax.in"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:via-teal-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 transition transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <span>Launch SoftMax Nexus (nexus.softmax.in)</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Modal Footer Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center sm:text-left">
              You can reopen this celebration anytime from your candidate console.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="ui-btn-secondary px-5 py-2 text-xs font-semibold rounded-xl hover:scale-105 active:scale-95 transition-transform flex-shrink-0 w-full sm:w-auto"
            >
              Continue to Console
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
