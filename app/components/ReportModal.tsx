"use client";

import { useState } from "react";

export type ReportType = "post" | "comment" | "account";
export type ReportReason =
  | "spam"
  | "harassment"
  | "inappropriate"
  | "scam"
  | "child_safety"
  | "fake_account"
  | "other";

interface ReportModalProps {
  isOpen: boolean;
  reportType: ReportType;
  targetId: string;
  targetAuthorId?: string;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details?: string) => Promise<void>;
}

const reasonOptions: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment/Bullying" },
  { value: "inappropriate", label: "Inappropriate Comment" },
  { value: "scam", label: "Scam/Fraud" },
  { value: "child_safety", label: "Child Safety Concern" },
  { value: "fake_account", label: "Fake Account" },
  { value: "other", label: "Other" },
];

export default function ReportModal({
  isOpen,
  reportType,
  targetId,
  onClose,
  onSubmit,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(
    null
  );
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeLabel =
    reportType === "post"
      ? "Post"
      : reportType === "comment"
        ? "Comment"
        : "Account";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) {
      setError("Please select a reason");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit(selectedReason, details);
      setSelectedReason(null);
      setDetails("");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to submit report");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg max-w-md w-full">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Report {typeLabel}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Why are you reporting this {typeLabel.toLowerCase()}?
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            {reasonOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                <input
                  type="radio"
                  name="reason"
                  value={option.value}
                  checked={selectedReason === option.value}
                  onChange={(e) => setSelectedReason(e.target.value as ReportReason)}
                  className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                />
                <span className="ml-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {option.label}
                </span>
              </label>
            ))}
          </div>

          {selectedReason === "other" && (
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Please explain why you're reporting this..."
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm min-h-[100px] resize-none"
            />
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedReason}
              className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
