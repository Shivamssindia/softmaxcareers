"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  color: string;
  alpha: number;
}

export const HeroBackgroundEffect: React.FC<{
  className?: string;
  variant?: "default" | "intense" | "minimal";
}> = ({ className = "", variant = "default" }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { theme } = useTheme();

  // Mouse tracking within the hero section
  const mouseRef = useRef<{ x: number | null; y: number | null; radius: number }>({
    x: null,
    y: null,
    radius: 140,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = container.offsetWidth);
    let height = (canvas.height = container.offsetHeight);

    const isDark =
      theme === "dark" ||
      document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark";

    const particleCount = Math.min(
      Math.floor((width * height) / (variant === "minimal" ? 22000 : 13000)),
      55
    );

    const colors = isDark
      ? [
          "rgba(129, 140, 248, ", // indigo
          "rgba(168, 85, 247, ",  // purple
          "rgba(56, 189, 248, ",  // sky
          "rgba(20, 184, 166, ",  // teal
        ]
      : [
          "rgba(99, 102, 241, ",  // indigo
          "rgba(139, 92, 246, ",  // purple
          "rgba(14, 165, 233, ",  // sky
          "rgba(13, 148, 136, ",  // teal
        ];

    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const radius = Math.random() * 2 + 1.2;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        radius,
        baseRadius: radius,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.4 + 0.3,
      });
    }

    const handleResize = () => {
      if (!canvas || !container) return;
      width = canvas.width = container.offsetWidth;
      height = canvas.height = container.offsetHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = null;
      mouseRef.current.y = null;
    };

    window.addEventListener("resize", handleResize);
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    // Animation Loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const mouse = mouseRef.current;
      const maxConnectDist = 125;

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off walls smoothly
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Mouse interaction: subtle gravity and connection
        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < mouse.radius) {
            // Gentle gravitational pull towards cursor
            const force = (mouse.radius - dist) / mouse.radius;
            p.x += (dx / dist) * force * 1.2;
            p.y += (dy / dist) * force * 1.2;

            // Draw interactive beam from cursor to particle
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(p.x, p.y);
            const beamAlpha = (1 - dist / mouse.radius) * (isDark ? 0.35 : 0.22);
            ctx.strokeStyle = `${p.color}${beamAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // Draw particle node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.fill();

        // Connect nearby particles with luminous constellation lines
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxConnectDist) {
            const lineAlpha = (1 - dist / maxConnectDist) * (isDark ? 0.25 : 0.15);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `${p.color}${lineAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [theme, variant]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-auto select-none z-0 ${className}`}
      aria-hidden="true"
    >
      {/* 1. Cyber Dot-Matrix Grid with Radial Vignette Fade */}
      <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.14] dark:opacity-[0.22] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_45%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* 2. Ambient Multi-Spectrum Aurora Gradient Beams */}
      <motion.div
        animate={{
          scale: [1, 1.18, 1],
          x: [0, 25, 0],
          y: [0, -20, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -top-24 -left-20 w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-transparent dark:from-indigo-600/15 dark:via-purple-600/10 blur-3xl pointer-events-none"
      />

      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          x: [0, -30, 0],
          y: [0, 25, 0],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
        className="absolute -top-16 -right-20 w-80 h-80 sm:w-[420px] sm:h-[420px] rounded-full bg-gradient-to-bl from-cyan-400/20 via-blue-500/15 to-transparent dark:from-cyan-500/15 dark:via-indigo-600/10 blur-3xl pointer-events-none"
      />

      <motion.div
        animate={{
          scale: [1, 1.12, 1],
          opacity: [0.35, 0.6, 0.35],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5,
        }}
        className="absolute -bottom-16 left-1/3 w-72 h-72 sm:w-80 sm:h-80 rounded-full bg-gradient-to-tr from-violet-500/15 via-teal-400/15 to-transparent dark:from-violet-600/10 dark:via-emerald-500/10 blur-3xl pointer-events-none"
      />

      {/* 3. Subtle Cyber Scanlines Light Beam Sweep */}
      <motion.div
        animate={{
          x: ["-100%", "200%"],
        }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "linear",
          repeatDelay: 5,
        }}
        className="absolute inset-y-0 w-48 bg-gradient-to-r from-transparent via-indigo-500/5 dark:via-indigo-400/5 to-transparent -skew-x-12 pointer-events-none"
      />

      {/* 4. Interactive Constellation Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </div>
  );
};

export default HeroBackgroundEffect;
