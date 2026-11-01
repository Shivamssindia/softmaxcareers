"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Phone,
  MapPin,
  Send,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  AlertTriangle,
  Lock,
  RefreshCw,
  ShieldCheck,
  Globe,
  Loader2,
} from "lucide-react";
import { useJobs } from "@/context/JobContext";
import {
  useAuth,
  getPreviousUsers,
  getMsgHistory,
  appendMsgHistory,
} from "@/context/AuthContext";
import HeroBackgroundEffect from "@/components/HeroBackgroundEffect";
import { getContactFormSettings } from "@/lib/firestore";
import type { ContactFormSettings } from "@/types";
import { DEFAULT_CONTACT_FORM_SETTINGS } from "@/types";

// ─── simple math captcha generator ────────────────────────────
function makeCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const op = Math.random() > 0.5 ? "+" : "-";
  const answer = op === "+" ? a + b : a - b;
  return { question: `${a} ${op} ${b}`, answer };
}

function generateMsgId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return (crypto as any).randomUUID();
    } catch {}
  }
  return "msg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
}

// ─── OpenStreetMap reverse geocode (Nominatim) ────────────────
// Returns structured parts so we can build a rich location label.
async function reverseGeocode(
  lat: number,
  lon: number
): Promise<{
  city: string | null;
  state: string | null;
  country: string | null;
  display: string | null;
}> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );
    if (!res.ok) {
      return { city: null, state: null, country: null, display: null };
    }
    const data = await res.json();
    const addr = data.address || {};

    // Try city first, then fall back through smaller units
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.county ||
      addr.suburb ||
      addr.neighbourhood ||
      null;
    const state = addr.state || addr.state_district || null;
    const country = addr.country || null;
    const display = data.display_name || null;

    return { city, state, country, display };
  } catch {
    return { city: null, state: null, country: null, display: null };
  }
}

// Build: "City, State, Country (lat, lon)"
// Example: "Indore, Madhya Pradesh, India (22.719600, 75.857700)"
function buildLocationLabel(
  city: string | null,
  state: string | null,
  country: string | null,
  display: string | null,
  lat: number,
  lon: number
): string {
  const parts: string[] = [];

  if (city) parts.push(city);
  if (state && state !== city) parts.push(state);
  if (country) parts.push(country);

  let place: string;
  if (parts.length > 0) {
    place = parts.join(", ");
  } else if (display) {
    // Fallback: use first 3 meaningful chunks from display_name
    const chunks = display
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    place = chunks.slice(0, 3).join(", ");
  } else {
    place = "Unknown location";
  }

  return `${place} (${lat.toFixed(6)}, ${lon.toFixed(6)})`;
}

export default function ContactPage() {
  const { submitContactMessage } = useJobs();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState("Careers & Openings");
  const [message, setMessage] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");

  // ─── Captcha is generated CLIENT-SIDE ONLY (fixes hydration) ─
  const [captcha, setCaptcha] = useState<{
    question: string;
    answer: number;
  } | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [isRefreshingCaptcha, setIsRefreshingCaptcha] = useState(false);

  useEffect(() => {
    setCaptcha(makeCaptcha());
  }, []);

  // ─── Silent auto location (never shown to user) ─────────────
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [locationName, setLocationName] = useState<string>("");
  const [locationMeta, setLocationMeta] = useState<{
    city: string | null;
    state: string | null;
    country: string | null;
    display: string | null;
  }>({ city: null, state: null, country: null, display: null });
  const locationRequestedRef = useRef(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<ContactFormSettings>(
    DEFAULT_CONTACT_FORM_SETTINGS
  );
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load admin settings once
  useEffect(() => {
    let alive = true;
    getContactFormSettings().then((s) => {
      if (alive) {
        setSettings(s);
        setSettingsLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // Prefill from signed-in user
  useEffect(() => {
    if (user) {
      setName((prev) => prev || user.name || (user as any).displayName || "");
      setEmail((prev) => prev || user.email || "");
      setPhone((prev) => prev || user.phone || "");
    }
  }, [user]);

  // ─── Silent location fetch (runs in background) ────────────
  const requestLocation = () => {
    if (locationRequestedRef.current) return;
    locationRequestedRef.current = true;

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setCoords({ lat, lon });

        const meta = await reverseGeocode(lat, lon);
        setLocationMeta(meta);

        // Build rich location string: "City, State, Country (lat, lon)"
        const label = buildLocationLabel(
          meta.city,
          meta.state,
          meta.country,
          meta.display,
          lat,
          lon
        );
        setLocationName(label);
      },
      (err) => {
        console.warn("Geolocation error:", err.message);
        locationRequestedRef.current = false;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    if (settingsLoaded && settings.requireLocation) {
      requestLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded, settings.requireLocation]);

  const prevUsers = useMemo(() => getPreviousUsers(), []);
  const msgHistory = useMemo(() => getMsgHistory(), []);
  const lastPrev = prevUsers[0];

  const resolvedSignInIp = user?.ipAddress || lastPrev?.signInIp;
  const resolvedBrowser = user?.browserName || lastPrev?.browserName;

  const handleRefreshCaptcha = () => {
    setIsRefreshingCaptcha(true);
    setCaptcha(makeCaptcha());
    setCaptchaInput("");
    setCaptchaKey((k) => k + 1);
    setTimeout(() => setIsRefreshingCaptcha(false), 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (settings.requireSignIn && !user) {
      setError(
        "Sign-in is required to submit this form. Please sign in first."
      );
      return;
    }
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (settings.requirePhone && (!phone.trim() || phone.trim().length < 7)) {
      setError("A valid phone number is required.");
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      setError("Please enter a message (at least 10 characters).");
      return;
    }
    if (settings.requireCaptcha) {
      if (!captcha) {
        setError("Captcha is still loading. Please wait a moment.");
        return;
      }
      const typed = parseInt(captchaInput.trim(), 10);
      if (Number.isNaN(typed) || typed !== captcha.answer) {
        setError("Captcha answer is incorrect. Please try again.");
        handleRefreshCaptcha();
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const msgId = generateMsgId();
      const historyIds = [msgId, ...msgHistory.map((h) => h.msgId)].slice(
        0,
        10
      );

      await submitContactMessage({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        service,
        message: message.trim(),

        msgId,
        // Location stored as: "City, State, Country (lat, lon)"
        // e.g. "Indore, Madhya Pradesh, India (22.719600, 75.857700)"
        location: settings.requireLocation
          ? locationName || undefined
          : undefined,
        latitude: settings.requireLocation ? coords?.lat : undefined,
        longitude: settings.requireLocation ? coords?.lon : undefined,
        // Structured fields for admin dashboard filtering
        locationCity: settings.requireLocation
          ? locationMeta.city || undefined
          : undefined,
        locationState: settings.requireLocation
          ? locationMeta.state || undefined
          : undefined,
        locationCountry: settings.requireLocation
          ? locationMeta.country || undefined
          : undefined,
        ipAddress: resolvedSignInIp,
        browserName: resolvedBrowser,
        isSignedIn: Boolean(user),
        signedInUid: user?.uid,
        previousUserId: lastPrev?.userId,
        previousUserEmail: lastPrev?.email,
        previousUserName: lastPrev?.name,
        previousUserPhone: lastPrev?.phone,
        previousSignInIp: lastPrev?.signInIp,
        previousBrowserName: lastPrev?.browserName,
        captchaPassed: settings.requireCaptcha ? true : undefined,
        captchaTypedCode: settings.requireCaptcha
          ? captchaInput.trim()
          : undefined,
        msgHistoryIds: historyIds,
      } as any);

      appendMsgHistory({
        msgId,
        submittedAt: new Date().toISOString(),
        isSignedIn: Boolean(user),
        previousUserId: lastPrev?.userId,
      });

      setSubmitted(true);

      setName(user?.name || (user as any)?.displayName || "");
      setEmail(user?.email || "");
      setPhone(user?.phone || "");
      setMessage("");
      setCaptchaInput("");
      handleRefreshCaptcha();
    } catch (err: any) {
      console.error("Failed to send contact inquiry:", err);
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl py-12 sm:py-16 px-4 sm:px-8 border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-b from-indigo-50/40 via-white to-transparent dark:from-indigo-950/20 dark:via-slate-900/40 dark:to-transparent shadow-sm">
        <HeroBackgroundEffect />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 text-center max-w-2xl mx-auto space-y-3"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Get In Touch</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Contact SoftMax Careers
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Whether you have a question about open career opportunities,
            application status, or interview processes, we would love to hear
            from you.
          </p>
        </motion.div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Contact Information */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-5 space-y-6"
        >
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Office & Channels
            </h2>

            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Headquarters
                  </div>
                  <div className="text-slate-500 mt-0.5 leading-relaxed">
                    Remote Indore, India
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Direct Email
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    <div>
                      <a
                        href="mailto:softmaxdigitals@gmail.com"
                        className="hover:underline text-indigo-600 dark:text-indigo-400"
                      >
                        softmaxdigitals@gmail.com
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <a
                href="https://softmax.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <span>Visit main corporate showcase: softmax.in</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Notice */}
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 border-l-4 border-l-amber-500 dark:border-l-amber-500 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                  Important Notice
                </h3>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  <strong>Do not send resumes via mail</strong> or through any
                  other channel. Any unsolicited resumes or personal information
                  sent will <strong>not be considered</strong>. Please apply
                  only through the official application form on this portal.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Contact Form */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="lg:col-span-7"
        >
          <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="py-8 text-center space-y-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 20,
                      delay: 0.1,
                    }}
                    className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                  </motion.div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Message Sent Successfully!
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Thank you for reaching out. Your message has been received
                    successfully. Our team will get back to you shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="ui-btn-secondary px-4 py-2 text-xs font-semibold rounded-lg hover:scale-105 active:scale-95 transition-transform"
                  >
                    Send Another Message
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                      Send a Direct Message
                    </h3>
                    {settingsLoaded && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {settings.requireSignIn && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <Lock className="w-2.5 h-2.5" />
                            Sign-in required
                          </span>
                        )}
                        {settings.requireCaptcha && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            Captcha
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Sharma"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Phone Number{" "}
                        {settings.requirePhone ? (
                          <span className="text-rose-500">*</span>
                        ) : (
                          <span className="text-slate-400 font-normal">
                            (Optional)
                          </span>
                        )}
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Inquiry Topic
                      </label>
                      <select
                        value={service}
                        onChange={(e) => setService(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Careers & Openings">
                          Careers & Openings
                        </option>
                        <option value="AI & Machine Learning Roles">
                          AI & Machine Learning Roles
                        </option>
                        <option value="Software & Distributed Systems Roles">
                          Software & Distributed Systems Roles
                        </option>
                        <option value="Cloud & DevOps Engineering Roles">
                          Cloud & DevOps Engineering Roles
                        </option>
                        <option value="Non-Tech & Project Management Roles">
                          Non-Tech & Project Management Roles
                        </option>
                        <option value="Application Status & Feedback">
                          Application Status & Feedback
                        </option>
                        <option value="General Career Inquiry">
                          General Career Inquiry
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Your Message *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us about your background, the role you are inquiring about, or your question..."
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>

                  {/* ═══════════ STYLISH CAPTCHA BOX ═══════════ */}
                  {settings.requireCaptcha && (
                    <div className="relative">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Security Verification{" "}
                        <span className="text-rose-500">*</span>
                      </label>

                      <div className="relative rounded-2xl overflow-hidden border border-indigo-200/70 dark:border-indigo-800/70 bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-violet-950/40 p-3.5 shadow-sm">
                        <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-indigo-300/30 dark:bg-indigo-600/20 blur-2xl" />
                        <div className="pointer-events-none absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-violet-300/30 dark:bg-violet-600/20 blur-2xl" />

                        <div className="relative flex flex-wrap items-center gap-2.5">
                          {captcha ? (
                            <motion.div
                              key={captchaKey}
                              initial={{ opacity: 0, scale: 0.85, rotate: -4 }}
                              animate={{ opacity: 1, scale: 1, rotate: 0 }}
                              transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 22,
                              }}
                              className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 shadow-[0_2px_10px_-2px_rgba(99,102,241,0.35)] select-none"
                            >
                              <ShieldCheck className="w-4 h-4 text-indigo-500" />
                              <span
                                className="font-mono font-extrabold text-lg tracking-[0.15em] text-indigo-700 dark:text-indigo-300"
                                style={{
                                  textShadow:
                                    "0 1px 0 rgba(255,255,255,0.6), 0 -1px 0 rgba(0,0,0,0.1)",
                                }}
                              >
                                {captcha.question}
                              </span>
                              <span className="font-mono font-extrabold text-lg text-indigo-400 dark:text-indigo-500">
                                = ?
                              </span>
                              <span className="pointer-events-none absolute inset-0 rounded-xl opacity-[0.06] bg-[repeating-linear-gradient(45deg,#4f46e5_0px,#4f46e5_1px,transparent_1px,transparent_6px)]" />
                            </motion.div>
                          ) : (
                            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 shadow-sm">
                              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                              <span className="font-mono font-extrabold text-lg text-indigo-400 dark:text-indigo-500">
                                • • •
                              </span>
                            </div>
                          )}

                          <input
                            type="number"
                            required
                            value={captchaInput}
                            onChange={(e) => setCaptchaInput(e.target.value)}
                            placeholder="Answer"
                            className="w-24 px-3 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-sm font-semibold text-center text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all"
                          />

                          <button
                            type="button"
                            onClick={handleRefreshCaptcha}
                            disabled={!captcha}
                            className="group p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:border-indigo-300 transition-all shadow-sm disabled:opacity-50"
                            title="Get new challenge"
                          >
                            <RefreshCw
                              className={`w-4 h-4 transition-transform duration-500 ${
                                isRefreshingCaptcha
                                  ? "rotate-180"
                                  : "group-hover:rotate-180"
                              }`}
                            />
                          </button>
                        </div>

                        <p className="relative mt-2 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          Solve the math challenge to verify you're human
                        </p>
                      </div>
                    </div>
                  )}
                  {/* ═══════════ END STYLISH CAPTCHA ═══════════ */}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="ui-btn-primary w-full py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] transition-transform"
                  >
                    {isSubmitting ? (
                      <span>Sending Message...</span>
                    ) : (
                      <>
                        <span>Send Career Inquiry</span>
                        <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>

                  {settings.requireSignIn && !user && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        You must{" "}
                        <Link
                          href="/auth"
                          className="font-bold underline hover:text-rose-900 dark:hover:text-white"
                        >
                          sign in
                        </Link>{" "}
                        before submitting this form.
                      </span>
                    </div>
                  )}
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}