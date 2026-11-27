import { FOLDER_LABELS } from "./constants";
import type { ClassSettings, Profile, Role } from "./types";

export const SESSION_KEY = "classroomMail.session.v1";
export const SECTIONS_KEY = "classroomMail.sections.v1";

export function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function saveSession(profile: Profile) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
}

export function readSession(): Profile | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? (JSON.parse(value) as Profile) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function readSections(): string[] {
  const value = readJson<unknown>(SECTIONS_KEY, []);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function rememberSection(code: string) {
  const clean = String(code || "").trim();
  if (!clean) return;
  const sections = readSections().filter((item) => item !== clean);
  sections.unshift(clean);
  localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections.slice(0, 12)));
}

export function hashHex(value: string) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 16777619);
    h2 = Math.imul(h2 + code, 2246822519);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

export function normalizeName(value: string) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function displayEmail(name: string) {
  const local = normalizeName(name).replace(/[^a-z0-9]/g, "") || "student";
  return local + "@vopamail.com";
}

export function validatePassword(value: string) {
  if (String(value || "").length < 6) {
    throw new Error("Use a password with at least 6 characters.");
  }
}

export function validateClassCode(value: string) {
  const code = String(value || "").trim();
  if (!/^[A-Za-z0-9-]{3,24}$/.test(code)) {
    throw new Error("Use a section code with 3–24 letters, numbers, or dashes.");
  }
  return code;
}

export function initials(value: string) {
  const parts = normalizeName(value).split(" ").filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

export function toMs(value: unknown) {
  if (!value) return Date.now();
  if (typeof value === "number") return value;
  if (typeof (value as { toMillis?: () => number }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  const time = new Date(value as string).getTime();
  return Number.isNaN(time) ? Date.now() : time;
}

export function formatDate(value: unknown) {
  const date = new Date(toMs(value));
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" });
}

export function formatFullDate(value: unknown) {
  return new Date(toMs(value)).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function createSnippet(value: string, length: number) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= length ? text : text.slice(0, length).trimEnd() + "…";
}

export function friendlyError(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  const code = err?.code ? String(err.code) : "";
  const message = err?.message || "Something went wrong. Please try again.";
  if (code === "42501" || /permission denied|row-level security/i.test(message)) {
    return "The class mailbox is not set up yet. Ask your teacher to run the Supabase setup SQL.";
  }
  if (code === "23505" || /duplicate key|already exists/i.test(message)) {
    return "That exact name is already used in this class. Try the name on your teacher's roster.";
  }
  if (/email not confirmed|email_not_confirmed/i.test(message)) {
    return "Email confirmation is on in Supabase. Turn it off in Auth settings, then try again.";
  }
  if (/invalid login credentials|invalid_credentials/i.test(message)) {
    return "We could not open that mailbox. Check the class code and name, including account type.";
  }
  if (/failed to fetch|network|load failed/i.test(message)) {
    return "Could not reach the mail server. Check your connection and try again.";
  }
  if (/supabase (library|configuration)/i.test(message)) {
    return "Supabase is not configured. Add your keys in supabase-config.js or use demo mode.";
  }
  return message;
}

const MODERATION_RULES = [
  { severity: "high", words: ["fuck", "shit", "bitch", "asshole", "bastard", "dick", "pussy", "cunt", "motherfucker"] },
  { severity: "high", words: ["nigger", "faggot", "retard"] },
  { severity: "high", words: ["kill you", "kill yourself", "kys", "shoot you", "stab you"] },
  { severity: "medium", words: ["damn", "hell", "crap", "stupid", "idiot", "dumb", "shut up", "jerk", "loser"] }
];

function normalizeModerationText(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[@]/g, "a")
    .replace(/[4]/g, "a")
    .replace(/[8]/g, "b")
    .replace(/[3]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[5$]/g, "s")
    .replace(/[7+]/g, "t")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function scanModeration(text: string) {
  const normalized = " " + normalizeModerationText(text) + " ";
  const hits: string[] = [];
  let severity = "clean";
  const rank: Record<string, number> = { clean: 0, medium: 1, high: 2 };
  MODERATION_RULES.forEach((rule) => {
    rule.words.forEach((word) => {
      const needle = " " + normalizeModerationText(word) + " ";
      if (needle.trim() && normalized.includes(needle) && !hits.includes(word)) {
        hits.push(word);
        if (rank[rule.severity] > rank[severity]) severity = rule.severity;
      }
    });
  });
  return { flagged: hits.length > 0, severity, terms: hits };
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const ALLOWED_FILE_TYPES = [
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf", "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
];

export function isAllowedFileType(file: File) {
  const type = String(file.type || "").toLowerCase();
  if (!type || type === "application/octet-stream") {
    return /\.(pdf|txt|doc|docx|xls|xlsx|png|jpe?g|gif|webp)$/i.test(file.name || "");
  }
  return ALLOWED_FILE_TYPES.includes(type);
}

export function formatFileSize(bytes: unknown) {
  const size = Number(bytes) || 0;
  if (size < 1024) return size + " B";
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
  return (size / (1024 * 1024)).toFixed(1) + " MB";
}

export function fileKind(file: { type?: string; mime_type?: string; name?: string; file_name?: string }) {
  const type = String(file.type || file.mime_type || "").toLowerCase();
  const name = String(file.name || file.file_name || "").toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(name)) return "image";
  if (type === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (type === "text/plain" || /\.txt$/i.test(name)) return "text";
  if (/word|docx?/i.test(type + " " + name)) return "word";
  if (/excel|spreadsheet|xlsx?/i.test(type + " " + name)) return "sheet";
  return "file";
}

export function fileExt(file: { name?: string; file_name?: string }) {
  const name = String(file.name || file.file_name || "");
  const dot = name.lastIndexOf(".");
  return dot > -1 ? name.slice(dot + 1).toUpperCase().slice(0, 4) : "FILE";
}

export function makeImageThumb(file: File): Promise<string | null> {
  if (!/^image\//i.test(file.type || "")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 180;
      const scale = Math.min(max / img.width, max / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function readTextPreview(file: File): Promise<string | null> {
  if (fileKind(file) !== "text" || typeof file.text !== "function") return Promise.resolve(null);
  return file
    .slice(0, 4096)
    .text()
    .then((text) => String(text || "").trim().slice(0, 180))
    .catch(() => null);
}

export function roleOf(value: string): Role {
  return value === "teacher" ? "teacher" : "student";
}

export const DEFAULT_SETTINGS: ClassSettings = { studentMessaging: true };

export function folderLabel(folder: string) {
  return FOLDER_LABELS[folder] || "Mail";
}
