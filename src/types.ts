export type Role = "teacher" | "student";

export interface ClassMailConfig {
  url?: string;
  publishableKey?: string;
  anonKey?: string;
  teacherHomeClassCode?: string;
}

declare global {
  interface Window {
    CLASSROOM_MAIL_CONFIG?: ClassMailConfig;
    supabase?: {
      createClient: (url: string, key: string, options?: Record<string, unknown>) => any;
    };
  }
}

export interface Profile {
  uid: string;
  classCode: string;
  name: string;
  nameLower: string;
  role: Role;
}

export interface Member {
  uid: string;
  name: string;
  nameLower: string;
  role: Role;
}

export interface Message {
  id: string;
  fromUid: string;
  fromName: string;
  fromRole: Role;
  toUids: string[];
  toNames: string[];
  subject: string;
  body: string;
  readBy: string[];
  starredBy: string[];
  deletedBy: string[];
  moderationStatus: string;
  flaggedTerms: string[];
  flaggedAt: number | null;
  createdAt: number;
}

export interface FileRef {
  name: string;
  path: string;
  size: number;
  type: string;
  thumb?: string | null;
  preview?: string | null;
}

export interface Draft {
  id: string;
  to: string;
  subject: string;
  body: string;
  attachments: FileRef[];
  updatedAt?: number;
}

export interface MessageFileRow {
  id?: string;
  message_id: string;
  class_code: string;
  from_id: string;
  to_ids: string[];
  file_name: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string;
  thumb?: string | null;
  preview?: string | null;
}

export interface Assignment {
  id: string;
  classCode: string;
  teacherId: string;
  title: string;
  instructions: string;
  dueAt: number | null;
  createdAt: number;
}

export interface Submission {
  id: string;
  assignmentId: string;
  classCode: string;
  studentId: string;
  body: string;
  grade: string;
  feedback: string;
  gradedAt: number | null;
  submittedAt: number;
  createdAt: number;
}

export interface SubmissionFile {
  id: string;
  submissionId: string;
  classCode: string;
  studentId: string;
  name: string;
  path: string;
  size: number;
  type: string;
  createdAt: number;
}

export interface Announcement {
  id: string;
  classCode: string;
  authorId: string;
  title: string;
  body: string;
  createdAt: number;
}

export interface ItemView {
  id?: string;
  itemType: "message" | "assignment" | "announcement";
  itemId: string;
  classCode: string;
  viewerId: string;
  viewedAt: number;
}

export interface ClassSettings {
  studentMessaging: boolean;
}

export interface AdminSection {
  code: string;
  students: number;
  studentNames: string[];
  messages: number;
  unread: number;
  flagged: number;
  lastActivity: number;
  studentMessaging: boolean;
  recentMessages: Array<{
    id: string;
    subject: string;
    fromName: string;
    fromRole: Role;
    toNames: string[];
    createdAt: number;
  }>;
}

export interface AdminOverview {
  sections: AdminSection[];
  totals: {
    sections: number;
    students: number;
    messages: number;
    unread: number;
  };
}

export type Folder =
  | "inbox"
  | "starred"
  | "sent"
  | "drafts"
  | "trash"
  | "classmates"
  | "dashboard"
  | "roster"
  | "all"
  | "flags"
  | "assignments"
  | "announcements";

export type MailItem = (Message & { kind: "message" }) | (Draft & { kind: "draft" });
