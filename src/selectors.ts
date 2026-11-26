import { FOLDER_LABELS } from "./constants";
import { createSnippet, displayEmail, normalizeName, toMs } from "./utils";
import type {
  AdminSection,
  Assignment,
  ClassSettings,
  Folder,
  MailItem,
  Member,
  Message,
  Profile,
  Role,
  Submission
} from "./types";

export interface AppState {
  profile: Profile | null;
  members: Member[];
  messages: Message[];
  drafts: import("./types").Draft[];
  messageFiles: import("./types").MessageFileRow[];
  fileUrls: Record<number, string>;
  assignments: Assignment[];
  submissions: Submission[];
  submissionFiles: import("./types").SubmissionFile[];
  announcements: import("./types").Announcement[];
  itemViews: import("./types").ItemView[];
  selectedAssignmentId: string | null;
  selectedAnnouncementId: string | null;
  workFormOpen: boolean;
  submissionDraftFor: string | null;
  submissionDraftBody: string;
  submissionDraftFiles: import("./types").FileRef[];
  settings: ClassSettings;
  folder: Folder;
  filter: "all" | "unread";
  query: string;
  openId: string | null;
  openKind: "message" | "draft" | null;
  selectedStudentId: string | null;
  selectedClassmateId: string | null;
  loading: boolean;
  sidebarOpen: boolean;
  knownSections: string[];
  adminOverview: import("./types").AdminOverview | null;
  selectedAdminSection: string | null;
  pendingOpenMessageId: string | null;
  pendingComposeTo: string | null;
  view: "list" | "detail";
}

function itemTime(item: MailItem) {
  return "createdAt" in item ? item.createdAt : item.updatedAt || 0;
}

export function currentItems(state: AppState): MailItem[] {
  if (!state.profile || state.folder === "roster" || state.folder === "dashboard") return [];
  const me = state.profile.uid;
  let items: MailItem[];
  if (state.folder === "drafts") {
    items = state.drafts.map((draft) => ({ ...draft, kind: "draft" as const }));
  } else {
    items = state.messages
      .filter((message) => {
        const deleted = message.deletedBy.includes(me);
        if (state.folder === "inbox") return message.toUids.includes(me) && !deleted;
        if (state.folder === "sent") return message.fromUid === me && !deleted;
        if (state.folder === "starred") return message.starredBy.includes(me) && !deleted;
        if (state.folder === "trash") return deleted;
        if (state.folder === "all") return state.profile?.role === "teacher";
        if (state.folder === "flags") {
          return state.profile?.role === "teacher" && message.moderationStatus === "flagged" && !deleted;
        }
        return false;
      })
      .map((message) => ({ ...message, kind: "message" as const }));
  }

  const query = state.query.trim().toLowerCase();
  if (query) {
    items = items.filter((item) => {
      const haystack =
        item.kind === "draft"
          ? [item.to, item.subject, item.body].join(" ").toLowerCase()
          : [item.fromName, (item.toNames || []).join(" "), item.subject, item.body].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }

  if (state.folder !== "drafts" && state.filter === "unread") {
    items = items.filter(
      (item) => item.kind === "message" && item.toUids.includes(me) && !item.readBy.includes(me)
    );
  }

  return [...items].sort((a, b) => toMs(itemTime(b)) - toMs(itemTime(a)));
}

export function unreadCount(state: AppState) {
  if (!state.profile) return 0;
  const me = state.profile.uid;
  return state.messages.filter(
    (message) =>
      message.toUids.includes(me) && !message.readBy.includes(me) && !message.deletedBy.includes(me)
  ).length;
}

export function flaggedCount(state: AppState) {
  if (!state.profile || state.profile.role !== "teacher") return 0;
  return state.messages.filter(
    (message) => message.moderationStatus === "flagged" && !message.deletedBy.includes(state.profile!.uid)
  ).length;
}

export function resolveRecipients(state: AppState, text: string): Member[] {
  const parts = String(text || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) throw new Error("Add at least one classmate in the To field.");
  const resolved: Member[] = [];
  const seen: Record<string, boolean> = {};
  const add = (member: Member) => {
    if (!seen[member.uid]) {
      seen[member.uid] = true;
      resolved.push(member);
    }
  };
  parts.forEach((part) => {
    const key = normalizeName(part);
    if (key === "/all" || key === "all students" || key === "all") {
      if (state.profile?.role !== "teacher") throw new Error("Only the teacher can use /all to email all students.");
      const students = state.members.filter((item) => item.role === "student");
      if (!students.length) throw new Error("There are no students in this section yet.");
      students.forEach(add);
      return;
    }
    const member = state.members.find((item) => item.nameLower === key);
    if (!member) throw new Error('No one named "' + part + '" is in this class. Choose a name from the suggestions.');
    if (
      state.profile?.role === "student" &&
      member.role === "student" &&
      state.settings.studentMessaging === false
    ) {
      throw new Error("Your teacher has turned off student-to-student mail. You can still email your teacher.");
    }
    add(member);
  });
  return resolved;
}

export function currentClassmates(state: AppState) {
  const isTeacher = state.profile?.role === "teacher";
  const query = state.query.trim().toLowerCase();
  return state.members
    .filter((member) => member.role === "student" && (isTeacher || member.uid !== state.profile?.uid))
    .filter((_member) => isTeacher || state.settings.studentMessaging !== false)
    .filter((member) => !query || member.nameLower.includes(query) || displayEmail(member.name).includes(query))
    .sort((a, b) => a.nameLower.localeCompare(b.nameLower));
}

export function assignmentsForList(state: AppState) {
  return state.assignments
    .filter(
      (item) =>
        !state.query || (item.title + " " + item.instructions).toLowerCase().includes(state.query.toLowerCase())
    )
    .sort((a, b) => {
      if (a.dueAt && b.dueAt) return a.dueAt - b.dueAt;
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return b.createdAt - a.createdAt;
    });
}

export function announcementsForList(state: AppState) {
  return state.announcements
    .filter((item) => !state.query || (item.title + " " + item.body).toLowerCase().includes(state.query.toLowerCase()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function mySubmission(state: AppState, assignmentId: string) {
  return state.submissions.find((item) => item.assignmentId === assignmentId && item.studentId === state.profile?.uid) || null;
}

export function assignmentStatus(state: AppState, assignment: Assignment) {
  const submissions = state.submissions.filter((item) => item.assignmentId === assignment.id);
  if (state.profile?.role === "teacher") {
    const graded = submissions.filter((item) => item.gradedAt != null).length;
    if (!submissions.length) return { label: "No submissions", tone: "muted" };
    return {
      label: graded + "/" + submissions.length + " graded",
      tone: graded === submissions.length ? "good" : "progress"
    };
  }
  const mine = mySubmission(state, assignment.id);
  if (mine && mine.gradedAt != null) return { label: "Graded", tone: "good" };
  if (mine) return { label: "Submitted", tone: "progress" };
  if (assignment.dueAt && assignment.dueAt < Date.now()) return { label: "Due", tone: "warn" };
  return { label: "Assigned", tone: "muted" };
}

export function emptyCopy(state: AppState) {
  if (state.query) {
    return {
      title: "No matches",
      body: 'Nothing in ' + FOLDER_LABELS[state.folder] + ' matches "' + state.query + '".'
    };
  }
  if (state.filter === "unread" && state.folder === "inbox") {
    return { title: "All caught up", body: "You have no unread messages in your inbox." };
  }
  const copy: Record<string, { title: string; body: string }> = {
    inbox: { title: "Your inbox is clear", body: "New messages from your class will appear here." },
    starred: { title: "No starred messages", body: "Star a message to keep it easy to find." },
    sent: { title: "Nothing sent yet", body: "Compose a message to practice a clear email." },
    drafts: { title: "No drafts", body: "Start a message and save it to finish later." },
    trash: { title: "Trash is empty", body: "Messages you delete will appear here." },
    all: { title: "No class mail yet", body: "Messages sent in this class will appear here." },
    flags: { title: "No flagged messages", body: "Messages with inappropriate language will appear here for review." }
  };
  return copy[state.folder] || copy.inbox;
}

export function adminSection(sections: AdminSection[] | undefined, code: string | null) {
  return sections?.find((section) => section.code === code) || null;
}

export function roleText(role: Role) {
  return role === "teacher" ? "teacher" : "student";
}

export function snippet(value: string, length: number) {
  return createSnippet(value, length);
}
