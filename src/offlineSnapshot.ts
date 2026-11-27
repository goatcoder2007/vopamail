import { readJson, writeJson } from "./utils";
import type { AppState } from "./selectors";

export interface OfflineSnapshot {
  savedAt: number;
  classCode: string;
  uid: string;
  data: Pick<AppState, "members" | "messages" | "drafts" | "settings" | "assignments" | "submissions" | "submissionFiles" | "announcements" | "itemViews" | "adminOverview">;
}

function key(uid: string, classCode: string) {
  return `classroomMail.snapshot.v1.${uid}.${classCode.toLowerCase()}`;
}

export function saveSnapshot(uid: string, classCode: string, data: OfflineSnapshot["data"]) {
  const snapshot: OfflineSnapshot = { savedAt: Date.now(), classCode, uid, data };
  try { writeJson(key(uid, classCode), snapshot); } catch { /* ignore quota */ }
}

export function readSnapshot(uid: string, classCode: string): OfflineSnapshot | null {
  return readJson<OfflineSnapshot | null>(key(uid, classCode), null);
}

export function clearSnapshot(uid: string, classCode: string) {
  try { localStorage.removeItem(key(uid, classCode)); } catch { /* ignore */ }
}

export function isOfflineError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message || error || "");
  return /failed to fetch|network|load failed|offline/i.test(message) || (typeof navigator !== "undefined" && navigator.onLine === false);
}
