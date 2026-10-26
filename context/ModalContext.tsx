"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  HelpCircle,
} from "lucide-react";

export type ModalType = "success" | "error" | "warning" | "info" | "danger";

export interface ModalOptions {
  title?: string;
  message: string | React.ReactNode;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string;
  isConfirm?: boolean;
}

interface ModalContextType {
  showAlert: (
    message: string | React.ReactNode,
    title?: string,
    type?: ModalType,
    confirmText?: string
  ) => Promise<boolean>;
  showConfirm: (
    message: string | React.ReactNode,
    title?: string,
    options?: {
      type?: ModalType;
      confirmText?: string;
      cancelText?: string;
    }
  ) => Promise<boolean>;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    options: ModalOptions;
    resolve?: (value: boolean) => void;
  }>({
    isOpen: false,
    options: { message: "" },
  });

  const closeModal = useCallback(() => {
    setModalState((prev) => {
      if (prev.resolve) prev.resolve(false);
      return { ...prev, isOpen: false };
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setModalState((prev) => {
      if (prev.resolve) prev.resolve(true);
      return { ...prev, isOpen: false };
    });
  }, []);

  const handleCancel = useCallback(() => {
    setModalState((prev) => {
      if (prev.resolve) prev.resolve(false);
      return { ...prev, isOpen: false };
    });
  }, []);

  const showAlert = useCallback(
    (
      message: string | React.ReactNode,
      title: string = "Notice",
      type: ModalType = "info",
      confirmText: string = "Understood"
    ): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setModalState({
          isOpen: true,
          options: {
            title,
            message,
            type,
            confirmText,
            isConfirm: false,
          },
          resolve,
        });
      });
    },
    []
  );

  const showConfirm = useCallback(
    (
      message: string | React.ReactNode,
      title: string = "Please Confirm",
      options?: {
        type?: ModalType;
        confirmText?: string;
        cancelText?: string;
      }
    ): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setModalState({
          isOpen: true,
          options: {
            title,
            message,
            type: options?.type || "warning",
            confirmText: options?.confirmText || "Confirm",
            cancelText: options?.cancelText || "Cancel",
            isConfirm: true,
          },
          resolve,
        });
      });
    },
    []
  );

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modalState.isOpen) {
        handleCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalState.isOpen, handleCancel]);

  const { options, isOpen } = modalState;
  const currentType = options.type || "info";

  // Visual configuration and condition effects
  const getThemeConfig = () => {
    switch (currentType) {
      case "success":
        return {
          icon: CheckCircle2,
          iconColor: "text-emerald-500 dark:text-emerald-400",
          ringBg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/80",
          topGradient: "from-emerald-500 via-teal-500 to-emerald-400",
          confirmBtn:
            "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-600/25",
          badgeText: "Success",
          badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        };
      case "error":
        return {
          icon: AlertCircle,
          iconColor: "text-rose-500 dark:text-rose-400",
          ringBg: "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/80",
          topGradient: "from-rose-500 via-red-500 to-rose-400",
          confirmBtn:
            "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-lg shadow-rose-600/25",
          badgeText: "Action Required",
          badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
        };
      case "danger":
        return {
          icon: AlertTriangle,
          iconColor: "text-rose-500 dark:text-rose-400",
          ringBg: "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/80",
          topGradient: "from-rose-600 via-amber-500 to-rose-500",
          confirmBtn:
            "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-lg shadow-rose-600/25",
          badgeText: "Warning",
          badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
        };
      case "warning":
        return {
          icon: AlertTriangle,
          iconColor: "text-amber-500 dark:text-amber-400",
          ringBg: "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/80",
          topGradient: "from-amber-500 via-orange-500 to-amber-400",
          confirmBtn:
            "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg shadow-amber-600/25",
          badgeText: "Confirmation",
          badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        };
      case "info":
      default:
        return {
          icon: Info,
          iconColor: "text-indigo-500 dark:text-indigo-400",
          ringBg: "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800/80",
          topGradient: "from-indigo-600 via-blue-600 to-purple-600",
          confirmBtn:
            "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg shadow-indigo-600/25",
          badgeText: "Information",
          badgeColor: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
        };
    }
  };

  const themeConfig = getThemeConfig();
  const IconComponent = themeConfig.icon;

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, closeModal }}>
      {children}

      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
          >
            {/* Backdrop with modern blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleCancel}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={
                currentType === "error"
                  ? { opacity: 1, scale: 1, y: 0, x: [0, -8, 8, -5, 5, -2, 2, 0] }
                  : currentType === "danger"
                  ? { opacity: 1, scale: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }
                  : { opacity: 1, scale: 1, y: 0, x: 0 }
              }
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{
                opacity: { duration: 0.2 },
                scale: { type: "spring", stiffness: 350, damping: 25 },
                y: { type: "spring", stiffness: 350, damping: 25 },
                x: { duration: 0.45, ease: "easeInOut" },
              }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-2xl z-10"
            >
              {/* Top Accent Gradient Bar */}
              <div
                className={`h-1.5 w-full bg-gradient-to-r ${themeConfig.topGradient}`}
              />

              {/* Close Button */}
              <button
                type="button"
                onClick={handleCancel}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-6 sm:p-7 space-y-5">
                {/* Header with animated Icon Badge */}
                <div className="flex items-start gap-4">
                  <motion.div
                    initial={{ scale: 0.6, rotate: currentType === "success" ? -25 : 0 }}
                    animate={{
                      scale: 1,
                      rotate:
                        currentType === "error"
                          ? [0, -8, 8, -5, 5, 0]
                          : currentType === "warning" || currentType === "danger"
                          ? [0, -10, 10, -5, 5, 0]
                          : 0,
                    }}
                    transition={{
                      scale: { type: "spring", stiffness: 450, damping: 18 },
                      rotate: { duration: 0.5, ease: "easeInOut" },
                    }}
                    className={`relative p-3 rounded-2xl border flex-shrink-0 flex items-center justify-center ${themeConfig.ringBg}`}
                  >
                    <IconComponent className={`w-6 h-6 ${themeConfig.iconColor}`} />
                    {currentType === "success" && (
                      <span className="absolute inset-0 rounded-2xl bg-emerald-400/20 animate-ping pointer-events-none" />
                    )}
                    {currentType === "error" && (
                      <span className="absolute inset-0 rounded-2xl bg-rose-400/20 animate-pulse pointer-events-none" />
                    )}
                  </motion.div>

                  <div className="space-y-1 pr-6 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${themeConfig.badgeColor}`}
                      >
                        {themeConfig.badgeText}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                      {options.title || "Notification"}
                    </h3>
                  </div>
                </div>

                {/* Message Content */}
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto whitespace-pre-line">
                  {options.message}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  {options.isConfirm && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-xs sm:text-sm font-semibold transition active:scale-95 shadow-sm"
                    >
                      {options.cancelText || "Cancel"}
                    </button>
                  )}

                  <button
                    type="button"
                    autoFocus
                    onClick={handleConfirm}
                    className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition hover:scale-[1.02] active:scale-95 ${themeConfig.confirmBtn}`}
                  >
                    {options.confirmText || (options.isConfirm ? "Confirm" : "Understood")}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
};
