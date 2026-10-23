"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export interface TechItem {
  id: string;
  name: string;
  icon: string;
  level: string;
  description: string;
  highlights: string[];
  categoryIds: string[];
}

interface Props {
  tech: TechItem;
  onClick: (tech: TechItem) => void;
  index?: number;
}

export default function TechnologyCard3D({ tech, onClick, index = 0 }: Props) {
  return (
    <motion.button
      type="button"
      onClick={() => onClick(tech)}
      initial={{ opacity: 0, y: 24, rotateX: -10 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      whileHover={{
        y: -8,
        rotateX: 6,
        rotateY: -6,
        scale: 1.03,
        transition: { duration: 0.2 },
      }}
      style={{ transformStyle: "preserve-3d", perspective: 1000 }}
      className="group relative text-left p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-800/60 transition-all cursor-pointer overflow-hidden"
    >
      {/* Glow */}
      <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-indigo-500/0 via-indigo-500/0 to-indigo-500/0 group-hover:from-indigo-500/10 group-hover:to-purple-500/10 transition-opacity" />

      <div className="relative flex items-start gap-3">
        <div
          className="w-12 h-12 flex-shrink-0 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center p-2"
          style={{ transform: "translateZ(30px)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tech.icon}
            alt={tech.name}
            width={32}
            height={32}
            loading="lazy"
            className="w-8 h-8 object-contain"
          />
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {tech.name}
          </h3>
          <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 truncate">
            {tech.level}
          </p>
        </div>
      </div>

      <p className="relative mt-3 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
        {tech.description}
      </p>

      <div className="relative mt-3 flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
        <span>Click to expand</span>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </motion.button>
  );
}