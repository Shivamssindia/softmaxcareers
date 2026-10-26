// src/app/exam/[id]/page.tsx
'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Script from 'next/script';
import { useAuth } from '@/context/AuthContext';
import {
  getExamByIdFromFirestore,
  computeExamPhase,
  isUserEnrolledInExam,
  isExamPermittedTime,
} from '@/lib/firestore/exams';
import { getUserFromFirestore, updateUserInFirestore } from '@/lib/firestore';
import { Exam, ExamPhase, ExamLockRecord } from '@/types/exam';

interface UserLockMap {
  [examId: string]: ExamLockRecord;
}

export default function ExamPage() {
  const params = useParams();
  const { user, loading } = useAuth();
  const examId = String(params?.id || '');

  const [exam, setExam] = useState<Exam | null>(null);
  const [examLoading, setExamLoading] = useState(true);
  const [examError, setExamError] = useState<string | null>(null);
  const [phase, setPhase] = useState<ExamPhase>('scheduled');
  const [countdown, setCountdown] = useState<string>('');
  const [persistedLock, setPersistedLock] = useState<ExamLockRecord | null>(null);

  const [examState, setExamState] = useState({
    isFullscreen: false,
    showForm: false,
    examLocked: false,
    violationCount: 0,
    cameraActive: false,
    cameraError: false,
    examStarted: false,
    showInstructions: true,
    lockReason: '',
    warningMessage: '',
    showWarning: false,
    videoInitialized: false,
    fullscreenAttempted: false,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const violationsKey = useMemo(() => `exam_${examId}_violations`, [examId]);
  const lockedKey = useMemo(() => `exam_${examId}_locked`, [examId]);
  const reasonKey = useMemo(() => `exam_${examId}_lock_reason`, [examId]);

  /* ==================== EXAM LOAD ==================== */

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!examId) return;
      setExamLoading(true);
      const e = await getExamByIdFromFirestore(examId);
      if (!alive) return;
      if (!e) {
        setExamError('Exam not found.');
      } else {
        setExam(e);
      }
      setExamLoading(false);
    };
    load();
    return () => {
      alive = false;
    };
  }, [examId]);

  /* ==================== LOAD PERSISTED LOCK FROM FIRESTORE ==================== */

  useEffect(() => {
    if (!user || !examId) return;
    (async () => {
      const profile = await getUserFromFirestore(user.uid);
      const map: UserLockMap = (profile as any)?.lockedExams || {};
      const record = map[examId];
      if (record && record.locked) {
        setPersistedLock(record);
        setExamState((prev) => ({
          ...prev,
          examLocked: true,
          showForm: false,
          showInstructions: false,
          lockReason: record.reason || 'Maximum violations',
          violationCount: record.violations || 0,
        }));
        localStorage.setItem(lockedKey, 'true');
        localStorage.setItem(reasonKey, record.reason || 'Maximum violations');
        localStorage.setItem(violationsKey, String(record.violations || 0));
      }
    })();
  }, [user, examId, lockedKey, reasonKey, violationsKey]);

  /* ==================== PHASE COMPUTATION + COUNTDOWN ==================== */

  useEffect(() => {
    if (!exam || !user) return;
    const recompute = () => {
      if (persistedLock?.locked) {
        setPhase('locked');
        return;
      }
      const p = computeExamPhase(exam, user.uid);
      setPhase(p);

      if (p === 'scheduled') {
        const start = new Date(exam.examDateTime).getTime();
        const diff = start - Date.now();
        if (diff <= 0) {
          setCountdown('Starting now...');
        } else {
          const d = Math.floor(diff / 86400000);
          const h = Math.floor((diff % 86400000) / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setCountdown(
            `${d > 0 ? `${d}d ` : ''}${String(h).padStart(2, '0')}h ${String(
              m
            ).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
          );
        }
      }
    };
    recompute();
    const t = setInterval(recompute, 1000);
    return () => clearInterval(t);
  }, [exam, user, persistedLock]);

  /* ==================== CAMERA ==================== */

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current
            ?.play()
            .then(() =>
              setExamState((p) => ({ ...p, cameraActive: true, videoInitialized: true }))
            )
            .catch(() => {
              setTimeout(() => {
                videoRef.current
                  ?.play()
                  .then(() =>
                    setExamState((p) => ({
                      ...p,
                      cameraActive: true,
                      videoInitialized: true,
                    }))
                  )
                  .catch(() => {});
              }, 500);
            });
        };
        videoRef.current.load();
      }
    } catch (err) {
      setExamState((p) => ({ ...p, cameraError: true }));
      showWarning('⚠️ Camera access required! Please allow camera permissions.');
    }
  };

  /* ==================== HELPERS ==================== */

  const showWarning = (message: string, duration = 4000) => {
    setExamState((p) => ({ ...p, warningMessage: message, showWarning: true }));
    setTimeout(() => {
      setExamState((p) => ({ ...p, showWarning: false, warningMessage: '' }));
    }, duration);
  };

  const persistLockToFirestore = async (reason: string, violations: number) => {
    if (!user) return;
    try {
      const profile = await getUserFromFirestore(user.uid);
      const existing: UserLockMap = (profile as any)?.lockedExams || {};
      const record: ExamLockRecord = {
        locked: true,
        violations,
        reason,
        lockedAt: new Date().toISOString(),
      };
      await updateUserInFirestore(user.uid, {
        lockedExams: { ...existing, [examId]: record },
      } as any);
    } catch (e) {
      console.warn('persistLockToFirestore failed:', e);
    }
  };

  const lockExam = (reason: string) => {
    setExamState((p) => ({
      ...p,
      examLocked: true,
      showForm: false,
      showInstructions: false,
      lockReason: reason,
      examStarted: false,
    }));
    localStorage.setItem(lockedKey, 'true');
    localStorage.setItem(reasonKey, reason);
    localStorage.setItem(violationsKey, String(examState.violationCount));

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      setExamState((p) => ({ ...p, cameraActive: false }));
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    persistLockToFirestore(reason, examState.violationCount);
    showWarning(`🔒 EXAM LOCKED! Reason: ${reason}`, 5000);
  };

  const incrementViolation = (reason: string) => {
    if (examState.examLocked) return;
    const newCount = examState.violationCount + 1;
    const maxV = exam?.maxViolations || 3;
    setExamState((p) => ({ ...p, violationCount: newCount }));
    localStorage.setItem(violationsKey, String(newCount));
    showWarning(`⚠️ VIOLATION ${newCount}/${maxV}: ${reason}`, 3000);
    if (newCount >= maxV) lockExam(`Maximum violations (${maxV})`);
  };

  /* ==================== FULLSCREEN ==================== */

  const enterFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement
        .requestFullscreen()
        .then(() =>
          setExamState((p) => ({ ...p, isFullscreen: true, fullscreenAttempted: true }))
        )
        .catch(() => showWarning('⚠️ Please allow fullscreen access'));
    }
  };

  /* ==================== START EXAM ==================== */

  const startExam = () => {
    if (examState.examLocked) {
      lockExam('Exam already locked');
      return;
    }
    if (!exam) return;
    const permittedCheck = isExamPermittedTime(exam);
    if (!permittedCheck.permitted) {
      showWarning(`⚠️ ${permittedCheck.message || 'Cannot start exam outside permitted window.'}`, 5000);
      return;
    }
    if (!examState.cameraActive) {
      showWarning('⚠️ Camera not active! Please allow camera access.');
      return;
    }
    if (!examState.isFullscreen) {
      showWarning('⚠️ Please enter FULLSCREEN first!', 4000);
      return;
    }
    setExamState((p) => ({
      ...p,
      examStarted: true,
      showInstructions: false,
      showForm: true,
    }));
    startMonitoring();
  };

  /* ==================== MONITORING ==================== */

  const startMonitoring = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (examState.examLocked || !examState.examStarted) return;
      if (exam) {
        const start = new Date(exam.examDateTime).getTime();
        const end = start + (Number(exam.durationMinutes) || 60) * 60 * 1000;
        if (Date.now() > end) {
          setPhase('completed');
          setExamState((p) => ({ ...p, examStarted: false, showForm: false }));
          return;
        }
      }
      const isFull = document.fullscreenElement !== null;
      if (!isFull) {
        incrementViolation('Fullscreen exited');
        if (examState.examStarted && !examState.examLocked) {
          setTimeout(() => window.location.reload(), 100);
        }
      }
      if (!examState.cameraActive && !examState.examLocked) {
        incrementViolation('Camera turned off');
      }
    }, 300);
  };

  /* ==================== EVENT HANDLERS ==================== */

  const handleFullscreenChange = () => {
    const isFull = document.fullscreenElement !== null;
    setExamState((p) => ({ ...p, isFullscreen: isFull }));
    if (!isFull && examState.examStarted && !examState.examLocked) {
      incrementViolation('Fullscreen exited');
      setTimeout(() => window.location.reload(), 100);
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden && examState.examStarted && !examState.examLocked) {
      incrementViolation('Tab switched');
    }
  };

  const handleBlur = () => {
    if (examState.examStarted && !examState.examLocked) {
      incrementViolation('Window blurred');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'F11') {
      e.preventDefault();
      if (examState.examStarted && !examState.examLocked) {
        incrementViolation('F11 key pressed');
        setTimeout(() => window.location.reload(), 100);
      }
    }
    if (examState.examStarted && !examState.examLocked) {
      if (e.key === 'F12') { e.preventDefault(); incrementViolation('DevTools attempted'); }
      if (e.ctrlKey && e.shiftKey && e.key === 'I') { e.preventDefault(); incrementViolation('DevTools attempted'); }
      if (e.ctrlKey && e.shiftKey && e.key === 'C') { e.preventDefault(); incrementViolation('DevTools attempted'); }
      if (e.ctrlKey && e.key === 'u') { e.preventDefault(); incrementViolation('View source attempted'); }
      if (e.ctrlKey && e.shiftKey && e.key === 'J') { e.preventDefault(); incrementViolation('DevTools attempted'); }
      if (e.key === 'Escape') {
        e.preventDefault();
        incrementViolation('ESC key pressed');
        setTimeout(() => window.location.reload(), 100);
      }
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    if (examState.examStarted && !examState.examLocked) {
      e.preventDefault();
      incrementViolation('Right click detected');
    }
  };

  const handleResize = () => {
    if (examState.examStarted && !examState.examLocked) {
      const isFull = document.fullscreenElement !== null;
      if (!isFull) {
        incrementViolation('Fullscreen exited');
        setTimeout(() => window.location.reload(), 100);
      }
    }
  };

  /* ==================== SETUP LISTENERS ==================== */

  useEffect(() => {
    if (examLoading || !exam || !user) return;
    if (phase !== 'in_progress' && phase !== 'locked') return;

    startCamera();

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('resize', handleResize);
    document.addEventListener('keydown', handleKeyDown as any);
    document.addEventListener('contextmenu', handleContextMenu as any);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', handleKeyDown as any);
      document.removeEventListener('contextmenu', handleContextMenu as any);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examLoading, exam?.id, user?.uid, phase]);

  useEffect(() => {
    if (examState.examStarted && !examState.examLocked) {
      startMonitoring();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examState.examStarted, examState.examLocked]);

  /* ==================== RENDER: LOADING ==================== */

  if (loading || examLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (examError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="bg-slate-900 border border-rose-600 rounded-2xl p-8 max-w-md text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-rose-500 font-bold text-xl mb-2">Exam Not Found</h1>
          <p className="text-slate-400 text-sm">{examError}</p>
        </div>
      </div>
    );
  }

  // NOT SIGNED IN → inline sign-in on THIS page (no redirect)
  if (!user) {
    return <SignInForExam exam={exam} examId={examId} />;
  }

  if (!exam) return null;

  /* ==================== RENDER: NOT ENROLLED ==================== */

  if (phase === 'not_enrolled') {
    return (
      <ClarityScript>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 p-4">
          <div className="bg-slate-900 border border-amber-500 rounded-2xl p-8 max-w-md text-center shadow-2xl">
            <div className="text-5xl mb-4">🔐</div>
            <h1 className="text-amber-400 font-extrabold text-2xl mb-3">
              Not Enrolled
            </h1>
            <p className="text-slate-300 text-sm mb-4">
              You are not enrolled in <strong>{exam.examName}</strong>.
            </p>
            <p className="text-slate-500 text-xs">
              Logged in as {user.email}. Please contact the exam administrator to
              be enrolled.
            </p>
          </div>
        </div>
      </ClarityScript>
    );
  }

  /* ==================== RENDER: CANCELLED ==================== */

  if (phase === 'cancelled') {
    return (
      <ClarityScript>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 p-4">
          <div className="bg-slate-900 border border-rose-500 rounded-3xl p-10 max-w-xl w-full text-center shadow-2xl">
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-rose-400 font-extrabold text-3xl mb-2">
              Exam Cancelled
            </h1>
            <p className="text-slate-300 text-sm mb-4">
              {exam.examName}
            </p>
            <p className="text-slate-400 text-xs mb-6 max-w-md mx-auto leading-relaxed">
              This exam has been explicitly cancelled by the administrator. If you believe this is in error or need rescheduling, please contact your recruitment coordinator.
            </p>
            <a
              href="/candidate"
              className="inline-block bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs px-5 py-2.5 rounded-xl border border-slate-700 transition"
            >
              Return to Candidate Console
            </a>
          </div>
        </div>
      </ClarityScript>
    );
  }

  /* ==================== RENDER: SCHEDULED ==================== */

  if (phase === 'scheduled' && !examState.examLocked) {
    return (
      <ClarityScript>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 p-4">
          <div className="bg-slate-900 border border-indigo-500 rounded-3xl p-10 max-w-xl w-full text-center shadow-2xl">
            <div className="text-6xl mb-4">⏳</div>
            <h1 className="text-indigo-300 font-extrabold text-3xl mb-2">
              {exam.examName}
            </h1>
            <p className="text-slate-400 text-sm mb-6">
              This exam has not started yet.
            </p>
            <div className="bg-slate-950 rounded-2xl py-6 px-4 border border-slate-800 mb-4">
              <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">
                Starts In
              </p>
              <p className="text-amber-400 font-mono text-3xl font-bold">
                {countdown || '--'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-left text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="text-slate-500 uppercase text-[10px]">Start Time</p>
                <p className="text-slate-200 font-semibold">
                  {new Date(exam.examDateTime).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="text-slate-500 uppercase text-[10px]">Duration</p>
                <p className="text-slate-200 font-semibold">
                  {exam.durationMinutes} minutes
                </p>
              </div>
            </div>
            {exam.description && (
              <p className="text-slate-400 text-xs mt-4">{exam.description}</p>
            )}
          </div>
        </div>
      </ClarityScript>
    );
  }

  /* ==================== RENDER: COMPLETED ==================== */

  if (phase === 'completed' && !examState.examLocked) {
    return (
      <ClarityScript>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 p-4">
          <div className="bg-slate-900 border border-emerald-500 rounded-3xl p-10 max-w-xl w-full text-center shadow-2xl">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-emerald-400 font-extrabold text-3xl mb-2">
              Exam Completed
            </h1>
            <p className="text-slate-300 text-sm mb-6">
              {exam.examName}
            </p>
            <div className="grid grid-cols-2 gap-3 text-left text-xs mb-5">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="text-slate-500 uppercase text-[10px]">Completed At</p>
                <p className="text-slate-200 font-semibold">
                  {new Date(
                    new Date(exam.examDateTime).getTime() +
                      exam.durationMinutes * 60000
                  ).toLocaleString()}
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="text-slate-500 uppercase text-[10px]">Duration</p>
                <p className="text-slate-200 font-semibold">
                  {exam.durationMinutes} minutes
                </p>
              </div>
            </div>
            {exam.examResourceLink && (
              <a
                href={exam.examResourceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition"
              >
                Open Exam Resource
              </a>
            )}
            {exam.instructions && (
              <p className="text-slate-400 text-xs mt-4">{exam.instructions}</p>
            )}
          </div>
        </div>
      </ClarityScript>
    );
  }

  /* ==================== RENDER: LOCKED ==================== */

  if (examState.examLocked) {
    return (
      <ClarityScript>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-red-950/40 p-4">
          <div className="bg-slate-900 border-2 border-rose-600 rounded-3xl p-10 max-w-lg w-full text-center shadow-2xl">
            <div className="text-6xl mb-4">🔒</div>
            <h1 className="text-rose-500 font-extrabold text-3xl mb-2">
              EXAM LOCKED
            </h1>
            <p className="text-amber-400 font-semibold text-sm mb-5">
              ⛔ This exam has been permanently locked
            </p>
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 text-left text-xs mb-4">
              <p className="text-slate-500 uppercase text-[10px] mb-1">Lock Reason</p>
              <p className="text-rose-400 font-bold text-sm mb-3">
                {examState.lockReason || 'Violation detected'}
              </p>
              <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-3">
                <div>
                  <p className="text-slate-500 uppercase text-[10px]">Violations</p>
                  <p className="text-rose-400 font-bold text-lg">
                    {examState.violationCount}/{exam.maxViolations}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase text-[10px]">Status</p>
                  <p className="text-rose-400 font-bold">🔴 LOCKED</p>
                </div>
              </div>
            </div>
            <p className="text-slate-400 text-xs">
              Please contact the administrator for assistance.
            </p>
          </div>
        </div>
      </ClarityScript>
    );
  }

  /* ==================== RENDER: INSTRUCTIONS ==================== */

  if (examState.showInstructions) {
    return (
      <ClarityScript>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 max-w-2xl w-full shadow-2xl">
            <div className="text-center mb-6">
              <h1 className="text-amber-400 font-extrabold text-3xl mb-1">
                {exam.examName}
              </h1>
              <p className="text-slate-400 text-sm">
                Duration: {exam.durationMinutes} minutes · Max violations: {exam.maxViolations}
              </p>
            </div>

            <div className="bg-amber-500/10 border-2 border-amber-500 rounded-xl p-4 mb-5">
              <p className="text-amber-400 font-bold text-sm text-center">
                ⚠️ You must enter FULLSCREEN before starting the exam!
              </p>
              <p className="text-slate-300 text-xs text-center mt-1">
                Click "Enter Fullscreen" first, then "Start Exam"
              </p>
            </div>

            {/* Camera preview */}
            <div className="bg-slate-950 rounded-2xl p-4 mb-5 border border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-300 text-sm font-semibold">📹 Camera Preview</span>
                {examState.cameraActive ? (
                  <span className="text-emerald-400 text-xs bg-emerald-500/10 px-3 py-1 rounded-xl">
                    ✅ Connected
                  </span>
                ) : (
                  <span className="text-rose-400 text-xs bg-rose-500/10 px-3 py-1 rounded-xl">
                    {examState.cameraError ? '❌ Access Denied' : '⏳ Loading...'}
                  </span>
                )}
              </div>
              <div className="bg-black rounded-xl overflow-hidden aspect-video relative flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {examState.cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-rose-500 text-sm p-4 text-center">
                    <div className="text-3xl mb-2">🚫</div>
                    <div>⚠️ Camera access required</div>
                    <div className="text-xs text-slate-400 mt-2">
                      Please allow camera + microphone permissions
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={enterFullscreen}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition ${
                  examState.isFullscreen
                    ? 'bg-emerald-500 text-black'
                    : 'bg-amber-500 text-black hover:bg-amber-400'
                }`}
              >
                {examState.isFullscreen ? '✅ Fullscreen Active' : '⛶ Enter Fullscreen (Required)'}
              </button>

              <button
                onClick={startExam}
                disabled={!examState.cameraActive || examState.cameraError || !examState.isFullscreen}
                className={`w-full py-4 rounded-xl font-bold text-base transition ${
                  examState.cameraActive && !examState.cameraError && examState.isFullscreen
                    ? 'bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                {!examState.isFullscreen
                  ? '⚠️ Enter Fullscreen First'
                  : examState.cameraActive && !examState.cameraError
                    ? '✅ Start Exam'
                    : examState.cameraError
                      ? '⚠️ Camera Required'
                      : '⏳ Loading Camera...'}
              </button>
            </div>

            {exam.instructions && (
              <div className="bg-slate-950 rounded-2xl p-4 mt-5 border border-slate-800">
                <h3 className="text-amber-400 text-sm font-semibold mb-2">
                  ⚠️ Instructions
                </h3>
                <p className="text-slate-300 text-xs whitespace-pre-line">
                  {exam.instructions}
                </p>
              </div>
            )}
          </div>
        </div>
      </ClarityScript>
    );
  }

  /* ==================== RENDER: ACTIVE EXAM ==================== */

  return (
    <ClarityScript>
      <div className="h-screen flex flex-col bg-slate-950 relative overflow-hidden">
        {examState.showWarning && (
          <div
            className={`fixed top-0 left-0 right-0 z-[9999] text-center font-bold text-base p-4 shadow-2xl ${
              examState.violationCount >= exam.maxViolations - 1
                ? 'bg-rose-600/95 text-white'
                : 'bg-amber-500/95 text-black'
            }`}
          >
            {examState.warningMessage}
            <div className="text-xs mt-1 opacity-90">
              ⚠️ Violations: {examState.violationCount}/{exam.maxViolations}
            </div>
          </div>
        )}

        {/* Status bar */}
        <div className="bg-slate-900/95 border-b-2 border-slate-800 px-6 py-2.5 flex justify-between items-center flex-shrink-0 z-10">
          <div className="flex gap-6 items-center text-xs">
            <div className="flex items-center gap-1.5">
              <span>📹</span>
              <span className={examState.cameraActive ? 'text-emerald-400 font-semibold' : 'text-rose-500 font-semibold'}>
                {examState.cameraActive ? '● ON' : '● OFF'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>⚠️</span>
              <span
                className={
                  examState.violationCount >= exam.maxViolations - 1
                    ? 'text-rose-500 font-bold'
                    : 'text-amber-400 font-bold'
                }
              >
                Violations: {examState.violationCount}/{exam.maxViolations}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!examState.isFullscreen ? (
              <button
                onClick={enterFullscreen}
                className="bg-amber-500 text-black px-4 py-1.5 rounded-lg font-bold text-xs"
              >
                ⛶ Enter Fullscreen
              </button>
            ) : (
              <span className="text-emerald-400 text-xs font-semibold bg-emerald-500/10 px-4 py-1.5 rounded-full">
                ✅ Fullscreen
              </span>
            )}
            <span className="text-slate-500 text-xs">
              {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Live video box */}
        <div className="fixed bottom-6 right-6 w-72 h-52 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl z-[100] bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {examState.cameraActive && (
            <>
              <div className="absolute top-3 left-3 bg-black/80 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                LIVE
              </div>
              <div className="absolute bottom-3 left-3 right-3 bg-black/80 text-slate-300 px-3 py-1 rounded-xl text-[10px] text-center font-semibold">
                👤 You
              </div>
            </>
          )}
        </div>

        {/* Exam iframe */}
        {examState.showForm && !examState.examLocked && exam.examResourceLink && (
          <iframe
            src={exam.examResourceLink}
            className="flex-1 w-full border-none bg-white"
            allow="camera; microphone; fullscreen"
            allowFullScreen
            title={exam.examName}
          />
        )}
      </div>
    </ClarityScript>
  );
}

/* ========================================================================== */
/* INLINE SIGN-IN (Google-only, shown when user not signed in)                 */
/* ========================================================================== */

function SignInForExam({
  exam,
  examId,
}: {
  exam: Exam | null;
  examId: string;
}) {
  const { loginWithGoogle } = useAuth() as any;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);

    // Safety timeout — popup flows can hang if COOP / auth domain is misconfigured
    const timeoutId = setTimeout(() => {
      setBusy(false);
      setError(
        'Google sign-in timed out. Please check that popups are allowed and try again.'
      );
    }, 60000);

    try {
      if (typeof loginWithGoogle !== 'function') {
        throw new Error(
          'Google sign-in is not available. Please contact the administrator.'
        );
      }
      await loginWithGoogle();
      // On success, useAuth().user becomes non-null → ExamPage re-renders
      // automatically into the correct exam phase. No redirect needed.
    } catch (err: any) {
      const code = err?.code || '';
      const msg = err?.message || '';

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Sign-in window was closed. Please try again.');
      } else if (code === 'auth/popup-blocked') {
        setError(
          'Your browser blocked the sign-in popup. Please allow popups for this site and try again.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setError(
          'This domain is not authorized for Google sign-in. The administrator must add it to Firebase Console → Authentication → Settings → Authorized domains.'
        );
      } else if (
        msg.toLowerCase().includes('cross-origin') ||
        msg.toLowerCase().includes('coop')
      ) {
        setError(
          'Sign-in was blocked by a browser security policy. Please refresh the page and try again.'
        );
      } else {
        setError(msg || 'Google sign-in failed. Please try again.');
      }
    } finally {
      clearTimeout(timeoutId);
      setBusy(false);
    }
  };

  return (
    <ClarityScript>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 p-4">
        <div className="bg-slate-900 border border-indigo-600 rounded-3xl p-8 sm:p-10 max-w-md w-full shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🎓</div>
            <h1 className="text-indigo-300 font-extrabold text-2xl mb-1">
              {exam?.examName || 'Exam'}
            </h1>
            <p className="text-slate-400 text-xs">
              Sign in to continue to your exam
            </p>
            <p className="text-slate-500 text-[10px] mt-1">
              Exam ID: {examId}
            </p>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-3 mb-4 text-[11px] text-rose-400 leading-relaxed">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 text-sm font-bold transition flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <p className="text-center text-[10px] text-slate-500 mt-4 leading-relaxed">
            You'll stay on this page — no redirect.
            <br />
            After sign-in, your exam will start automatically.
          </p>
        </div>
      </div>
    </ClarityScript>
  );
}

/* ========================================================================== */
/* CLARITY SCRIPT WRAPPER                                                     */
/* ========================================================================== */

function ClarityScript({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        id="clarity-script"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "y4pia34m1q");
          `,
        }}
      />
      {children}
    </>
  );
}