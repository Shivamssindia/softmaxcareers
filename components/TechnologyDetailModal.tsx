"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { TechItem } from "./TechnologyCard3D";

interface Props {
  tech: TechItem | null;
  onClose: () => void;
}

export default function TechnologyDetailModal({ tech, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (tech) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", onKey);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [tech, onClose]);

  return (
    <AnimatePresence>
      {tech && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md"
        >
          <motion.div
            key="card"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.75, rotateY: -35, rotateX: 12, y: 40 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, rotateY: 25, rotateX: -8, y: 30 }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            style={{
              transformStyle: "preserve-3d",
              perspective: 1400,
            }}
            className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
          >
            {/* Gradient header glow */}
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-transparent pointer-events-none" />

            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition"
            >
              ✕
            </button>

            <div className="relative p-6 sm:p-8" style={{ transform: "translateZ(20px)" }}>
              <motion.div
                initial={{ scale: 0.6, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 260 }}
                className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center p-3 mb-5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tech.icon}
                  alt={tech.name}
                  className="w-full h-full object-contain"
                />
              </motion.div>

              <span className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-2">
                {tech.level}
              </span>

              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
                {tech.name}
              </h2>

              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
                {tech.description}
              </p>

              <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                  Key Highlights
                </h4>
                {tech.highlights.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.06 }}
                    className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
                  >
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span>{h}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}