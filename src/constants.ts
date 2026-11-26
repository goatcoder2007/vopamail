export const FOLDER_LABELS: Record<string, string> = {
  inbox: "Inbox",
  starred: "Starred",
  sent: "Sent",
  drafts: "Drafts",
  trash: "Trash",
  classmates: "Classmates",
  dashboard: "All sections",
  roster: "Class roster",
  all: "All class mail",
  flags: "Flagged messages",
  assignments: "Assignments",
  announcements: "Announcements"
};

export const FOLDERS = [
  "inbox",
  "starred",
  "sent",
  "drafts",
  "trash",
  "assignments",
  "announcements",
  "classmates",
  "dashboard",
  "roster",
  "all",
  "flags"
] as const;

export const TEACHER_FOLDERS = new Set(["dashboard", "roster", "all", "flags"]);
