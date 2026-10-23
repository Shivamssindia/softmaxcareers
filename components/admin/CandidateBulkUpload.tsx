"use client";

import React, { useState, useRef } from "react";
import {
  parseCandidateExcel,
  bulkImportCandidates,
  generateCandidateImportTemplateBlob,
  validateSpreadsheetFile,
  ImportResult,
  BulkImportSummary,
} from "@/lib/candidateImport";
import { Job } from "@/types";
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  X,
  FileCheck,
  ShieldCheck,
  Search,
  Filter,
  Check,
  AlertTriangle,
} from "lucide-react";

interface CandidateBulkUploadProps {
  jobs: Job[];
  onImportComplete?: () => void;
}

export default function CandidateBulkUpload({
  jobs,
  onImportComplete,
}: CandidateBulkUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [defaultJobId, setDefaultJobId] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [summary, setSummary] = useState<BulkImportSummary | { error: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    try {
      const blob = generateCandidateImportTemplateBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Candidate_Import_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Failed to generate template: " + (e?.message || e));
    }
  };

  const handleFileSelect = (selectedFile: File | null) => {
    setFileError(null);
    setSummary(null);
    setResults([]);
    if (!selectedFile) {
      setFile(null);
      return;
    }

    const validation = validateSpreadsheetFile(selectedFile);
    if (!validation.valid) {
      setFileError(validation.error || "Invalid file.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const runImport = async () => {
    if (!file) return;
    setRunning(true);
    setResults([]);
    setSummary(null);
    setFileError(null);
    setProgress({ done: 0, total: 0 });

    try {
      // 1. Parse rows & execute client-side format/security validation
      const rows = await parseCandidateExcel(file);
      if (rows.length === 0) {
        throw new Error("No valid candidate rows with both name and email were found in the file.");
      }

      setProgress({ done: 0, total: rows.length });

      // 2. Perform bulk import with live progress feedback
      const importSummary = await bulkImportCandidates(rows, {
        defaultJobId: defaultJobId || undefined,
        onProgress: (done, total) => setProgress({ done, total }),
      });

      setResults(importSummary.results);
      setSummary(importSummary);
      onImportComplete?.();
    } catch (err: any) {
      setSummary({ error: err?.message || String(err) });
    } finally {
      setRunning(false);
    }
  };

  // Filtered results
  const filteredResults = results.filter((res) => {
    if (statusFilter !== "all" && res.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        res.email.toLowerCase().includes(q) ||
        res.message.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const percentComplete =
    progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Bulk Upload Candidates (Excel / CSV)
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Import batches of candidate records from spreadsheet files directly into the platform.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-indigo-600 dark:text-indigo-400 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all shadow-sm inline-flex items-center gap-1.5 self-start"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Excel Template</span>
        </button>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        {/* Step-by-step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Step 1: Prepare Sheet
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Download our standardized Excel template or use headers matching: <i>name, email, phone, title, skills</i>.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Step 2: Upload File
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Select or drag-and-drop your .xlsx, .xls, or .csv document (Max 500 candidates per batch, 10MB limit).
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Step 3: Security & Sync
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Formula injection sanitized, admin accounts protected, and candidate profiles registered automatically.
            </p>
          </div>
        </div>

        {/* File Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20"
              : file
              ? "border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10"
              : "border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/40 dark:bg-slate-800/40"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            className="hidden"
          />

          {file ? (
            <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-800 max-w-md mx-auto">
              <div className="flex items-center gap-3 truncate text-left">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {file.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB • Verified spreadsheet format
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileSelect(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                title="Remove selected file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Click to browse or drag and drop spreadsheet
              </div>
              <p className="text-[11px] text-slate-400">
                Supported formats: <b className="text-slate-600 dark:text-slate-300">.xlsx, .xls, .csv</b> (Max 10 MB, up to 500 rows)
              </p>
            </div>
          )}
        </div>

        {fileError && (
          <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{fileError}</span>
          </p>
        )}

        {/* Optional Link to Job */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Target Job Opening (Optional for entire sheet)
            </label>
            <select
              value={defaultJobId}
              onChange={(e) => setDefaultJobId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-xs sm:text-sm transition-all"
            >
              <option value="">— Use job IDs from file or leave unlinked —</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} — {job.department} ({job.type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={runImport}
              disabled={!file || running}
              className="ui-btn-primary px-6 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 shadow-sm disabled:opacity-50 w-full sm:w-auto justify-center"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    Importing... {progress.done} / {progress.total}
                  </span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Import Candidates Batch</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {running && (
          <div className="space-y-2 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                Importing candidate records...
              </span>
              <span>
                {progress.done} of {progress.total} ({percentComplete}%)
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-200"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>
        )}

        {/* Summary Feedback */}
        {summary && "error" in summary && (
          <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/80 dark:bg-rose-950/30 text-rose-900 dark:text-rose-100 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-bold text-sm">Import Failed</div>
              <p>{summary.error}</p>
            </div>
          </div>
        )}

        {summary && !("error" in summary) && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total Rows</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {summary.total}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20">
                <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Created</div>
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {summary.created}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/40 dark:bg-indigo-950/20">
                <div className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">Updated</div>
                <div className="text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
                  {summary.updated}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20">
                <div className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Skipped</div>
                <div className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                  {summary.skipped}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/40 dark:bg-rose-950/20">
                <div className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">Errors</div>
                <div className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                  {summary.failed}
                </div>
              </div>
            </div>

            {/* Results Table Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Import Details ({filteredResults.length})
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="all">All Statuses</option>
                  <option value="created">Created</option>
                  <option value="updated">Updated</option>
                  <option value="skipped">Skipped</option>
                  <option value="error">Errors</option>
                </select>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search results..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase font-semibold tracking-wider sticky top-0 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">Candidate Email</th>
                      <th className="p-3 w-28">Status</th>
                      <th className="p-3">Outcome / Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredResults.map((r) => (
                      <tr
                        key={`${r.rowIndex}-${r.email}`}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-850"
                      >
                        <td className="p-3 text-center text-slate-400 font-mono">
                          {r.rowIndex}
                        </td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">
                          {r.email}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              r.status === "created"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : r.status === "updated"
                                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                                : r.status === "skipped"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {r.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
