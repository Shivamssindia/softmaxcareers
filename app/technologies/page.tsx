"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { motion, useAnimationFrame, useMotionValue } from "framer-motion";
import { ArrowRight, Sparkles, Zap, Code2, Cloud, Bot, Smartphone, Database, Shield } from "lucide-react";
import data from "@/lib/data/data.json";
import TechnologyDetailModal from "@/components/TechnologyDetailModal";
import { TechItem } from "@/components/TechnologyCard3D";

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const CATEGORIES: Category[] = data.categories;
const TECHNOLOGIES: TechItem[] = data.technologies as TechItem[];

/* ---------- ICON FALLBACK MAP ---------- */
const ICON_MAP: Record<string, React.ElementType> = {
  code: Code2,
  cloud: Cloud,
  ai: Bot,
  mobile: Smartphone,
  database: Database,
  security: Shield,
  default: Zap,
};

function getTechIcon(tech: TechItem): React.ElementType {
  const name = (tech.name || "").toLowerCase();
  if (name.includes("react") || name.includes("next") || name.includes("vue") || name.includes("angular") || name.includes("svelte") || name.includes("node") || name.includes("python") || name.includes("java") || name.includes("go") || name.includes("rust")) return Code2;
  if (name.includes("aws") || name.includes("azure") || name.includes("gcp") || name.includes("cloud") || name.includes("docker") || name.includes("kubernetes")) return Cloud;
  if (name.includes("ai") || name.includes("ml") || name.includes("tensor") || name.includes("pytorch") || name.includes("gpt") || name.includes("llm")) return Bot;
  if (name.includes("ios") || name.includes("android") || name.includes("flutter") || name.includes("react native") || name.includes("swift") || name.includes("kotlin")) return Smartphone;
  if (name.includes("sql") || name.includes("mongo") || name.includes("postgres") || name.includes("redis") || name.includes("db")) return Database;
  if (name.includes("security") || name.includes("auth") || name.includes("oauth")) return Shield;
  return ICON_MAP.default;
}

/* ---------- MARQUEE ROW ---------- */
function MarqueeRow({
  items,
  direction = "left",
  speed = 40,
  onSelect,
}: {
  items: TechItem[];
  direction?: "left" | "right";
  speed?: number;
  onSelect: (t: TechItem) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const x = useMotionValue(0);
  const baseX = useRef(0);

  // Measure content width once
  useEffect(() => {
    if (containerRef.current) {
      setContentWidth(containerRef.current.scrollWidth / 2);
    }
  }, [items]);

  useAnimationFrame((_, delta) => {
    if (!contentWidth) return;
    const move = (speed * delta) / 1000;
    baseX.current += direction === "left" ? -move : move;

    // wrap around
    if (baseX.current <= -contentWidth) baseX.current += contentWidth;
    if (baseX.current >= 0) baseX.current -= contentWidth;

    x.set(baseX.current);
  });

  // Double the items for seamless loop
  const loopItems = [...items, ...items];

  return (
    <div className="relative overflow-hidden py-3 group">
      {/* Edge fade masks */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-20 bg-gradient-to-r from-white dark:from-slate-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-20 bg-gradient-to-l from-white dark:from-slate-950 to-transparent" />

      <motion.div
        ref={containerRef}
        style={{ x }}
        className="flex gap-4 w-max will-change-transform"
      >
        {loopItems.map((tech, i) => {
          const Icon = getTechIcon(tech);
          return (
            <button
              key={`${tech.id}-${i}`}
              onClick={() => onSelect(tech)}
              className="group/card relative flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-[0_8px_30px_rgb(99,102,241,0.15)] transition-all duration-300 hover:-translate-y-1 min-w-[160px]"
            >
              {/* 3D icon container */}
              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-indigo-500/20 dark:via-purple-500/20 dark:to-pink-500/20 border border-indigo-100 dark:border-indigo-900/50 shadow-inner group-hover/card:scale-110 transition-transform duration-300">
                <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 drop-shadow-sm" strokeWidth={2} />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                  {tech.name}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {tech.categoryIds?.[0]?.replace(/-/g, " ") || "technology"}
                </p>
              </div>
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}

/* ---------- MAIN PAGE ---------- */
export default function TechnologiesPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedTech, setSelectedTech] = useState<TechItem | null>(null);

  const filteredTech = useMemo(() => {
    if (activeCategory === "all") return TECHNOLOGIES;
    return TECHNOLOGIES.filter((t) => t.categoryIds.includes(activeCategory));
  }, [activeCategory]);

  const row1 = useMemo(() => filteredTech.slice(0, Math.ceil(filteredTech.length / 2)), [filteredTech]);
  const row2 = useMemo(() => filteredTech.slice(Math.ceil(filteredTech.length / 2)), [filteredTech]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-white dark:bg-slate-950">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-400/10 dark:bg-indigo-600/10 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-400/10 dark:bg-purple-600/10 rounded-full blur-[120px]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-12">
        {/* ---------- HEADER ---------- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center max-w-3xl mx-auto space-y-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/60 dark:to-purple-950/60 border border-indigo-100 dark:border-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
            <span>Powered by Modern Engineering</span>
          </motion.div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            The{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Technology
            </span>{" "}
            We Build With
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Explore {TECHNOLOGIES.length}+ battle-tested technologies powering our
            products. Hover to pause, click any tech to dive deeper.
          </p>
        </motion.div>

        {/* ---------- CATEGORY FILTER ---------- */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex flex-wrap items-center justify-center gap-2 max-w-4xl mx-auto"
        >
          <button
            onClick={() => setActiveCategory("all")}
            className={`relative px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 flex items-center gap-1.5 border ${
              activeCategory === "all"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-lg shadow-indigo-500/30 scale-105"
                : "bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>All</span>
          </button>

          {CATEGORIES.map((cat) => {
            const isActive = cat.id === activeCategory;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`relative px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 flex items-center gap-1.5 border ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-lg shadow-indigo-500/30 scale-105"
                    : "bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cat.icon} alt="" className="w-3.5 h-3.5 object-contain" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </motion.div>

        {/* ---------- MARQUEE ROWS ---------- */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="relative space-y-2"
        >
          {/* Row 1 — left to right */}
          <MarqueeRow items={row1} direction="left" speed={35} onSelect={setSelectedTech} />

          {/* Row 2 — right to left */}
          <MarqueeRow items={row2} direction="right" speed={30} onSelect={setSelectedTech} />

          {/* Subtle center divider */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-200 dark:via-indigo-900 to-transparent -translate-y-1/2 pointer-events-none" />
        </motion.div>

        {/* ---------- STATS / TRUST BAND ---------- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto"
        >
          {[
            { label: "Technologies", value: `${TECHNOLOGIES.length}+` },
            { label: "Categories", value: `${CATEGORIES.length}` },
            // { label: "Projects Shipped", value: "250+" },
            // { label: "Engineers", value: "80+" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="text-center p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
            >
              <p className="text-xl sm:text-2xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {stat.value}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>

        {/* ---------- CAREERS CTA ---------- */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-white to-indigo-50/50 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950/40 p-8 sm:p-12 text-center"
        >
          <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 bg-indigo-400/20 dark:bg-indigo-600/20 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 bg-purple-400/20 dark:bg-purple-600/20 rounded-full blur-3xl" />

          <div className="relative space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 dark:bg-slate-900/70 border border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              We&apos;re Hiring
            </div>
            <h3 className="text-xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Build the Future With These Technologies
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
              We hire engineers, designers, and technical managers who love working
              with modern stacks. Find your next role today.
            </p>
            <Link
              href="/openings"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300"
            >
              <span>View Open Roles</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </div>

      {/* ---------- DETAIL MODAL ---------- */}
      <TechnologyDetailModal tech={selectedTech} onClose={() => setSelectedTech(null)} />
    </div>
  );
}