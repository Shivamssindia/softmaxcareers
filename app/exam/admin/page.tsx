// src/app/exam/admin/page.tsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useModal } from '@/context/ModalContext';
import {
  subscribeToExams,
  createExamInFirestore,
  updateExamInFirestore,
  deleteExamInFirestore,
  enrollCandidatesInExam,
  removeCandidateFromExam,
  isUserEnrolledInExam,
  computeExamStatus,
  getExamStatusMeta,
} from '@/lib/firestore/exams';
import { getAllUsersFromFirestore } from '@/lib/firestore';
import { Exam, ExamStatus } from '@/types/exam';
import { User } from '@/types';
import {
  Plus,
  Edit,
  Trash2,
  Users,
  X,
  Search,
  Calendar,
  Clock,
  ExternalLink,
  Shield,
  UserPlus,
  CheckCircle,
  ArrowLeft,
} from 'lucide-react';

export default function ExamAdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { showAlert, showConfirm } = useModal();

  const [exams, setExams] = useState<Exam[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [now, setNow] = useState<Date>(() => new Date());

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  const [enrollExam, setEnrollExam] = useState<Exam | null>(null);
  const [enrollSearch, setEnrollSearch] = useState('');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);

  // Live 1-second tick for real-time exam status transitions
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Form state
  const [fName, setFName] = useState('');
  const [fDateTime, setFDateTime] = useState('');
  const [fDuration, setFDuration] = useState(60);
  const [fLink, setFLink] = useState('');
  const [fMaxViolations, setFMaxViolations] = useState(3);
  const [fDescription, setFDescription] = useState('');
  const [fInstructions, setFInstructions] = useState('');
  const [fStatus, setFStatus] = useState<ExamStatus>('scheduled');
  const [saving, setSaving] = useState(false);

  /* ==================== AUTH GUARD ==================== */
  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.replace('/');
    }
  }, [user, loading, router]);

  /* ==================== LIVE EXAMS ==================== */
  useEffect(() => {
    const unsub = subscribeToExams(setExams);
    return () => unsub();
  }, []);

  /* ==================== USERS ==================== */
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    getAllUsersFromFirestore().then(setUsersList).catch(() => {});
  }, [user]);

  /* ==================== REAL-TIME STATS ==================== */
  const examStats = useMemo(() => {
    const scheduled = exams.filter((e) => computeExamStatus(e, now) === 'scheduled').length;
    const active = exams.filter((e) => computeExamStatus(e, now) === 'active').length;
    const completed = exams.filter((e) => computeExamStatus(e, now) === 'completed').length;
    const totalEnrollments = exams.reduce((s, e) => s + e.enrolledCandidates.length, 0);
    return { scheduled, active, completed, totalEnrollments };
  }, [exams, now]);

  /* ==================== FILTERED EXAMS ==================== */
  const filteredExams = useMemo(() => {
    if (!search.trim()) return exams;
    const q = search.toLowerCase();
    return exams.filter((e) => {
      const liveStatus = computeExamStatus(e, now);
      return (
        e.examName.toLowerCase().includes(q) ||
        liveStatus.toLowerCase().includes(q) ||
        (e.status || '').toLowerCase().includes(q)
      );
    });
  }, [exams, search, now]);

  /* ==================== OPEN CREATE / EDIT ==================== */
  const openCreate = () => {
    setEditingExam(null);
    setFName('');
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setFDateTime(local);
    setFDuration(60);
    setFLink('');
    setFMaxViolations(3);
    setFDescription('');
    setFInstructions('');
    setFStatus('scheduled');
    setIsFormOpen(true);
  };

  const openEdit = (exam: Exam) => {
    setEditingExam(exam);
    setFName(exam.examName);
    const d = new Date(exam.examDateTime);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setFDateTime(local);
    setFDuration(exam.durationMinutes);
    setFLink(exam.examResourceLink);
    setFMaxViolations(exam.maxViolations);
    setFDescription(exam.description || '');
    setFInstructions(exam.instructions || '');
    setFStatus(exam.status);
    setIsFormOpen(true);
  };

  /* ==================== SAVE ==================== */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!fName.trim()) return showAlert('Exam name is required.', 'Error', 'error');
    if (!fDateTime) return showAlert('Start date/time is required.', 'Error', 'error');
    if (!fLink.trim()) return showAlert('Exam resource link is required.', 'Error', 'error');

    setSaving(true);
    try {
      const iso = new Date(fDateTime).toISOString();
      if (editingExam) {
        await updateExamInFirestore(editingExam.id, {
          examName: fName.trim(),
          examDateTime: iso,
          durationMinutes: Number(fDuration) || 60,
          examResourceLink: fLink.trim(),
          maxViolations: Number(fMaxViolations) || 3,
          description: fDescription.trim() || undefined,
          instructions: fInstructions.trim() || undefined,
          status: fStatus,
        });
      } else {
        await createExamInFirestore({
          examName: fName.trim(),
          examDateTime: iso,
          durationMinutes: Number(fDuration) || 60,
          examResourceLink: fLink.trim(),
          maxViolations: Number(fMaxViolations) || 3,
          description: fDescription.trim() || undefined,
          instructions: fInstructions.trim() || undefined,
          status: fStatus,
          createdBy: user.uid,
        });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      await showAlert(err?.message || 'Failed to save exam.', 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ==================== DELETE ==================== */
  const handleDelete = async (exam: Exam) => {
    const ok = await showConfirm(
      `Delete exam "${exam.examName}"? This cannot be undone.`,
      'Delete Exam',
      { type: 'danger', confirmText: 'Delete', cancelText: 'Cancel' }
    );
    if (!ok) return;
    try {
      await deleteExamInFirestore(exam.id);
    } catch (err: any) {
      await showAlert(err?.message || 'Failed to delete exam.', 'Error', 'error');
    }
  };

  /* ==================== ENROLL ==================== */
  const openEnroll = (exam: Exam) => {
    setEnrollExam(exam);
    setEnrollSearch('');
    setSelectedUids([]);
  };

  const candidateUsers = useMemo(() => {
    return usersList.filter((u) => u.role === 'candidate');
  }, [usersList]);

  const filteredCandidates = useMemo(() => {
    if (!enrollSearch.trim()) return candidateUsers;
    const q = enrollSearch.toLowerCase();
    return candidateUsers.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    );
  }, [candidateUsers, enrollSearch]);

  const toggleSelect = (uid: string) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  };

  const handleEnrollSubmit = async () => {
    if (!enrollExam || !user || selectedUids.length === 0) return;
    try {
      const alreadyEnrolled = selectedUids.filter((uid) =>
        isUserEnrolledInExam(enrollExam, uid)
      );
      const toAdd = selectedUids.filter(
        (uid) => !isUserEnrolledInExam(enrollExam, uid)
      );
      if (toAdd.length) {
        await enrollCandidatesInExam(enrollExam.id, toAdd, user.uid);
      }
      await showAlert(
        `Enrolled ${toAdd.length} candidate(s).${
          alreadyEnrolled.length
            ? ` ${alreadyEnrolled.length} were already enrolled.`
            : ''
        }`,
        'Success',
        'success'
      );
      setEnrollExam(null);
      setSelectedUids([]);
    } catch (err: any) {
      await showAlert(err?.message || 'Failed to enroll.', 'Error', 'error');
    }
  };

  const handleRemoveEnrollment = async (exam: Exam, uid: string) => {
    const record = exam.enrolledCandidates.find((e) => e.uid === uid);
    if (!record) return;
    const ok = await showConfirm(
      'Remove this candidate from the exam?',
      'Remove Enrollment',
      { type: 'danger', confirmText: 'Remove', cancelText: 'Cancel' }
    );
    if (!ok) return;
    try {
      await removeCandidateFromExam(exam.id, record);
    } catch (err: any) {
      await showAlert(err?.message || 'Failed to remove.', 'Error', 'error');
    }
  };

  /* ==================== GUARDS ==================== */
  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500">Checking admin privileges...</p>
      </div>
    );
  }

  /* ==================== RENDER ==================== */
  return (
    <div className="max-w-7xl mx-auto py-10 sm:py-14 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Admin Portal
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Exam Dashboard
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Admin Only
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Create exams, enroll candidates, and monitor exam status.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="ui-btn-primary text-xs font-semibold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Exam</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Exams" value={exams.length} sub={`${examStats.scheduled} scheduled`} />
        <StatCard label="Active" value={examStats.active} sub="Live right now" />
        <StatCard label="Completed" value={examStats.completed} sub="Finished exams" />
        <StatCard label="Total Enrollments" value={examStats.totalEnrollments} sub="Across all exams" />
      </div>

      {/* Search */}
      <div className="relative max-w-sm w-full">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exams by name or status..."
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Exams table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[680px]">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3.5">Exam</th>
                <th className="p-3.5">Start Time</th>
                <th className="p-3.5">Duration</th>
                <th className="p-3.5">Enrolled</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="max-w-xs mx-auto text-center space-y-2">
                      <Calendar className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        No exams yet
                      </p>
                      <p className="text-xs text-slate-400">
                        Click "Create New Exam" to schedule your first exam.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExams.map((exam) => {
                  const currentStatus = computeExamStatus(exam, now);
                  const meta = getExamStatusMeta(currentStatus);
                  return (
                    <tr key={exam.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {exam.examName}
                        </div>
                        <a
                          href={exam.examResourceLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 leading-relaxed mb-4 line-clamp-1 class-leadaxed md-4"
                        >
                          Resource <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300">
                        {new Date(exam.examDateTime).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-slate-500">
                        {exam.durationMinutes} min
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300">
                        {exam.enrolledCandidates.length}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1.5 ${meta.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                          {meta.label}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                          <Link
                            href={`/exam/${exam.id}`}
                            target="_blank"
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center gap-1"
                            title="Preview candidate view"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Preview
                          </Link>
                          <button
                            onClick={() => openEnroll(exam)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 inline-flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" />
                            Enroll ({exam.enrolledCandidates.length})
                          </button>
                          <button
                            onClick={() => openEdit(exam)}
                            className="px-2 py-1 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(exam)}
                            className="px-2 py-1 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ CREATE / EDIT MODAL ============ */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 text-slate-900 dark:text-white space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  {editingExam ? 'Edit Exam' : 'Create New Exam'}
                </h2>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Exam Name *</label>
                  <input
                    type="text"
                    required
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                    placeholder="e.g. Softmax BDE Requirement Test"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Start Date & Time *</label>
                    <input
                      type="datetime-local"
                      required
                      value={fDateTime}
                      onChange={(e) => setFDateTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Duration (minutes) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={fDuration}
                      onChange={(e) => setFDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Exam Resource Link (Google Form / Quiz URL) *</label>
                  <input
                    type="url"
                    required
                    value={fLink}
                    onChange={(e) => setFLink(e.target.value)}
                    placeholder="https://forms.gle/..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Max Violations</label>
                    <input
                      type="number"
                      min={1}
                      value={fMaxViolations}
                      onChange={(e) => setFMaxViolations(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Status</label>
                    <select
                      value={fStatus}
                      onChange={(e) => setFStatus(e.target.value as ExamStatus)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled (Automatic time-based)</option>
                      <option value="active">Active (Live)</option>
                      <option value="completed">Completed (Manual complete)</option>
                      <option value="cancelled">Cancelled (Explicitly Cancelled)</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={fDescription}
                    onChange={(e) => setFDescription(e.target.value)}
                    placeholder="Short description shown to candidates..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Instructions</label>
                  <textarea
                    rows={3}
                    value={fInstructions}
                    onChange={(e) => setFInstructions(e.target.value)}
                    placeholder="Rules and instructions for the candidate..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="ui-btn-secondary px-4 py-2 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="ui-btn-primary px-5 py-2 text-xs font-semibold rounded-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingExam ? 'Update Exam' : 'Create Exam'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ ENROLL MODAL ============ */}
      <AnimatePresence>
        {enrollExam && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 text-slate-900 dark:text-white space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Enroll Candidates</h2>
                  <p className="text-xs text-slate-500">{enrollExam.examName}</p>
                </div>
                <button
                  onClick={() => setEnrollExam(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={enrollSearch}
                  onChange={(e) => setEnrollSearch(e.target.value)}
                  placeholder="Search candidates by name or email..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="max-h-80 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCandidates.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">
                    No candidates found.
                  </p>
                ) : (
                  filteredCandidates.map((u) => {
                    const enrolled = isUserEnrolledInExam(enrollExam, u.uid);
                    const selected = selectedUids.includes(u.uid);
                    return (
                      <label
                        key={u.uid}
                        className={`flex items-center gap-3 p-3 cursor-pointer transition ${
                          enrolled
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 opacity-70'
                            : selected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={enrolled || selected}
                          disabled={enrolled}
                          onChange={() => toggleSelect(u.uid)}
                          className="w-4 h-4 accent-indigo-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {u.name || 'Unnamed'}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {u.email}
                          </div>
                        </div>
                        {enrolled && (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Enrolled
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>

              {/* Currently enrolled list */}
              {enrollExam.enrolledCandidates.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase mb-2">
                    Currently Enrolled ({enrollExam.enrolledCandidates.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {enrollExam.enrolledCandidates.map((rec) => {
                      const u = usersList.find((x) => x.uid === rec.uid);
                      return (
                        <span
                          key={rec.uid}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300"
                        >
                          {u?.name || rec.uid.slice(0, 8)}
                          <button
                            type="button"
                            onClick={() => handleRemoveEnrollment(enrollExam, rec.uid)}
                            className="text-rose-500 hover:text-rose-700"
                            title="Remove"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500">
                  {selectedUids.length} selected
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEnrollExam(null)}
                    className="ui-btn-secondary px-4 py-2 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleEnrollSubmit}
                    disabled={selectedUids.length === 0}
                    className="ui-btn-primary px-5 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
                  >
                    Enroll Selected
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <div className="text-xs font-semibold text-slate-400 uppercase">{label}</div>
      <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
        {value}
      </div>
      <div className="text-[11px] text-slate-500 mt-1">{sub}</div>
    </div>
  );
}