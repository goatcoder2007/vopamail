import { createClient } from "@supabase/supabase-js";
import type {
  AdminOverview,
  Announcement,
  Assignment,
  ClassSettings,
  Draft,
  FileRef,
  ItemView,
  Member,
  Message,
  MessageFileRow,
  Profile,
  Role,
  Submission,
  SubmissionFile
} from "./types";
import { hashHex, normalizeName, readJson, validatePassword, writeJson } from "./utils";

export interface SignInInput {
  classCode: string;
  name: string;
  role: Role;
  password: string;
}

export interface StudentInput {
  classCode: string;
  name: string;
  password: string;
}

export interface UpdateStudentInput extends StudentInput {
  studentId: string;
}

export interface ModerationAlertPayload {
  messageId: string;
  classCode: string;
  fromId: string;
  fromName: string;
  toNames: string[];
  subject: string;
  body: string;
  terms: string[];
  severity: string;
}

export interface BackendService {
  signIn(input: SignInInput): Promise<Profile>;
  createStudent(input: StudentInput): Promise<void>;
  updateStudent(input: UpdateStudentInput): Promise<void>;
  resetStudentPassword(input: { classCode: string; studentId: string; password: string }): Promise<void>;
  verifySession(profile: Profile): Promise<boolean>;
  signOut(): Promise<void>;
  getMembers(classCode: string): Promise<Member[]>;
  getSections(): Promise<string[]>;
  getAdminOverview(teacherUid: string): Promise<AdminOverview>;
  getMessages(classCode: string): Promise<Message[]>;
  getDrafts(classCode: string, uid: string): Promise<Draft[]>;
  createMessage(classCode: string, message: Omit<Message, "id" | "createdAt">): Promise<Message>;
  updateMessage(
    classCode: string,
    id: string,
    patch: Partial<Pick<Message, "readBy" | "starredBy" | "deletedBy">>
  ): Promise<void>;
  deleteMessage(classCode: string, id: string): Promise<void>;
  uploadFile(classCode: string, file: File): Promise<FileRef>;
  createMessageFiles(classCode: string, rows: MessageFileRow[]): Promise<void>;
  getMessageFiles(classCode: string, messageId: string): Promise<MessageFileRow[]>;
  fileUrl(path: string): Promise<string>;
  saveDraft(classCode: string, uid: string, draft: Omit<Draft, "id"> & { id?: string | null }): Promise<Draft>;
  deleteDraft(classCode: string, uid: string, id: string): Promise<void>;
  createModerationAlert?(payload: ModerationAlertPayload): Promise<void>;
  getAssignments(classCode: string): Promise<Assignment[]>;
  createAssignment(
    classCode: string,
    teacherId: string,
    assignment: { title: string; instructions: string; dueAt: string | null }
  ): Promise<Assignment>;
  deleteAssignment(classCode: string, assignmentId: string): Promise<void>;
  getSubmissions(classCode: string): Promise<Submission[]>;
  saveSubmission(
    classCode: string,
    submission: { assignmentId: string; studentId: string; body: string; files: FileRef[] }
  ): Promise<Submission>;
  gradeSubmission(classCode: string, submissionId: string, grade: string, feedback: string): Promise<Submission | null>;
  getSubmissionFiles(classCode: string): Promise<SubmissionFile[]>;
  uploadSubmissionFile(classCode: string, uid: string, file: File): Promise<FileRef>;
  deleteSubmissionFiles(classCode: string, submissionId: string): Promise<void>;
  getAnnouncements(classCode: string): Promise<Announcement[]>;
  createAnnouncement(
    classCode: string,
    authorId: string,
    announcement: { title: string; body: string }
  ): Promise<Announcement>;
  deleteAnnouncement(classCode: string, announcementId: string): Promise<void>;
  getItemViews(classCode: string): Promise<ItemView[]>;
  markItemViewed?(classCode: string, view: ItemView): Promise<ItemView>;
  getClassSettings(classCode: string): Promise<ClassSettings>;
  setClassSettings(classCode: string, patch: ClassSettings): Promise<ClassSettings>;
}

const CONFIG = window.CLASSROOM_MAIL_CONFIG || {};
export const publicKey = CONFIG.publishableKey || CONFIG.anonKey || "";
export const hasKeys = Boolean(
  CONFIG.url &&
    publicKey &&
    !String(CONFIG.url).includes("YOUR_") &&
    !String(publicKey).includes("YOUR_")
);
export const teacherHomeClassCode = CONFIG.teacherHomeClassCode || "";

const DEMO_PREFIX = "classroomMail.demo.v1.";
const SECTIONS_KEY = "classroomMail.sections.v1";

function demoKey(classCode: string, suffix: string) {
  return DEMO_PREFIX + classCode + "." + suffix;
}

function makeId(prefix: string) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function demoUid(classCode: string, name: string, role: Role) {
  return "demo-" + hashHex(classCode + "|" + role + "|" + normalizeName(name)).slice(0, 16);
}

function readSections(): string[] {
  const value = readJson<unknown>(SECTIONS_KEY, []);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function deleteDemoItemViews(classCode: string, itemType: string, itemId: string) {
  const views = readJson<ItemView[]>(demoKey(classCode, "itemViews"), []).filter(
    (view) => !(view.itemType === itemType && view.itemId === itemId)
  );
  writeJson(demoKey(classCode, "itemViews"), views);
}

function seedDemo(classCode: string) {
  if (localStorage.getItem(demoKey(classCode, "seeded"))) return;
  const names = [
    { name: "Teacher", role: "teacher" as Role },
    { name: "Ava Chen", role: "student" as Role },
    { name: "Jordan Lee", role: "student" as Role },
    { name: "Maya Patel", role: "student" as Role }
  ];
  const members: Member[] = names.map((item) => ({
    uid: demoUid(classCode, item.name, item.role),
    name: item.name,
    nameLower: normalizeName(item.name),
    role: item.role
  }));
  const passwords: Record<string, string> = {};
  members.forEach((member) => {
    passwords[member.uid] = member.role === "teacher" ? "teacher123" : "student123";
  });
  const byName = (name: string) => members.find((member) => member.name === name)!;
  const teacher = byName("Teacher");
  const ava = byName("Ava Chen");
  const jordan = byName("Jordan Lee");
  const maya = byName("Maya Patel");
  const now = Date.now();
  const messages: Message[] = [
    {
      id: "demo-message-1",
      fromUid: ava.uid,
      fromName: ava.name,
      fromRole: "student",
      toUids: [teacher.uid],
      toNames: [teacher.name],
      subject: "Question about Friday's essay",
      body: "Hi Teacher,\n\nI have a question about the essay due Friday. Should the second paragraph include a quote from the article, or is a summary enough?\n\nThank you,\nAva",
      readBy: [teacher.uid],
      starredBy: [],
      deletedBy: [],
      moderationStatus: "clean",
      flaggedTerms: [],
      flaggedAt: null,
      createdAt: now - 1000 * 60 * 42
    },
    {
      id: "demo-message-2",
      fromUid: teacher.uid,
      fromName: teacher.name,
      fromRole: "teacher",
      toUids: [ava.uid, jordan.uid, maya.uid],
      toNames: [ava.name, jordan.name, maya.name],
      subject: "Reminder: bring your notebook",
      body: "Class,\n\nPlease bring your notebook and a pen to class tomorrow. We will be drafting thesis statements, and you will need a clean page for the practice.\n\nSee you then,\nTeacher",
      readBy: [teacher.uid],
      starredBy: [],
      deletedBy: [],
      moderationStatus: "clean",
      flaggedTerms: [],
      flaggedAt: null,
      createdAt: now - 1000 * 60 * 60 * 3
    },
    {
      id: "demo-message-3",
      fromUid: jordan.uid,
      fromName: jordan.name,
      fromRole: "student",
      toUids: [ava.uid],
      toNames: [ava.name],
      subject: "Study group after school",
      body: "Hi Ava,\n\nDo you want to review the essay rubric after school today? I think we could finish in about twenty minutes.\n\nJordan",
      readBy: [],
      starredBy: [],
      deletedBy: [],
      moderationStatus: "clean",
      flaggedTerms: [],
      flaggedAt: null,
      createdAt: now - 1000 * 60 * 60 * 20
    },
    {
      id: "demo-message-4",
      fromUid: maya.uid,
      fromName: maya.name,
      fromRole: "student",
      toUids: [teacher.uid],
      toNames: [teacher.name],
      subject: "Thanks for the feedback",
      body: "Hi Teacher,\n\nThank you for the comments on my draft. I revised the introduction and made the claim more specific.\n\nMaya",
      readBy: [teacher.uid],
      starredBy: [teacher.uid],
      deletedBy: [],
      moderationStatus: "clean",
      flaggedTerms: [],
      flaggedAt: null,
      createdAt: now - 1000 * 60 * 60 * 26
    }
  ];
  writeJson(demoKey(classCode, "members"), members);
  writeJson(demoKey(classCode, "passwords"), passwords);
  writeJson(demoKey(classCode, "messages"), messages);
  localStorage.setItem(demoKey(classCode, "seeded"), "1");
}

function buildAdminOverview(
  sections: Array<{ code: string; members: Member[]; messages: Message[]; settings?: ClassSettings }>,
  teacherUid: string
): AdminOverview {
  const rows = sections
    .map((section) => {
      const messages = section.messages || [];
      const students = (section.members || []).filter((member) => member.role === "student");
      const unread = messages.filter(
        (message) =>
          message.toUids.includes(teacherUid) &&
          !message.readBy.includes(teacherUid) &&
          !message.deletedBy.includes(teacherUid)
      ).length;
      const flagged = messages.filter(
        (message) => message.moderationStatus === "flagged" && !message.deletedBy.includes(teacherUid)
      ).length;
      return {
        code: section.code,
        students: students.length,
        studentNames: students.map((member) => member.name),
        messages: messages.length,
        unread,
        flagged,
        lastActivity: messages.reduce((max, message) => Math.max(max, message.createdAt || 0), 0),
        studentMessaging: !section.settings || section.settings.studentMessaging !== false,
        recentMessages: messages.slice(0, 4).map((message) => ({
          id: message.id,
          subject: message.subject || "(no subject)",
          fromName: message.fromName,
          fromRole: message.fromRole,
          toNames: message.toNames,
          createdAt: message.createdAt
        }))
      };
    })
    .sort((a, b) => b.lastActivity - a.lastActivity);
  return {
    sections: rows,
    totals: {
      sections: rows.length,
      students: rows.reduce((sum, row) => sum + row.students, 0),
      messages: rows.reduce((sum, row) => sum + row.messages, 0),
      unread: rows.reduce((sum, row) => sum + row.unread, 0)
    }
  };
}

function createDemoBackend(): BackendService {
  async function updateStudent(input: UpdateStudentInput) {
    const lower = normalizeName(input.name || "");
    const members = readJson<Member[]>(demoKey(input.classCode, "members"), []);
    const member = members.find((item) => item.uid === input.studentId);
    if (!member) throw new Error("That student is not in this class.");
    if (lower && members.some((item) => item.uid !== input.studentId && item.nameLower === lower)) {
      throw new Error("That name is already used in this class.");
    }
    if (lower) {
      member.name = input.name.trim().replace(/\s+/g, " ");
      member.nameLower = lower;
    }
    if (input.password) {
      validatePassword(input.password);
      const passwords = readJson<Record<string, string>>(demoKey(input.classCode, "passwords"), {});
      passwords[input.studentId] = input.password;
      writeJson(demoKey(input.classCode, "passwords"), passwords);
    }
    writeJson(demoKey(input.classCode, "members"), members);
  }

  async function getMembers(classCode: string) {
    return readJson<Member[]>(demoKey(classCode, "members"), []);
  }

  async function getMessages(classCode: string) {
    return readJson<Message[]>(demoKey(classCode, "messages"), []);
  }

  async function getClassSettings(classCode: string) {
    const saved = readJson<Partial<ClassSettings>>(demoKey(classCode, "settings"), {});
    return { studentMessaging: saved.studentMessaging !== false };
  }

  return {
    async signIn(input) {
      seedDemo(input.classCode);
      validatePassword(input.password);
      const uid = demoUid(input.classCode, input.name, input.role);
      const members = readJson<Member[]>(demoKey(input.classCode, "members"), []);
      const passwords = readJson<Record<string, string>>(demoKey(input.classCode, "passwords"), {});
      let member = members.find((item) => item.uid === uid);

      if (input.role === "teacher" && !member) {
        if (members.some((item) => item.role === "teacher")) {
          throw new Error("A teacher account already exists for this class. Check the name or ask your school contact.");
        }
        member = {
          uid,
          name: input.name,
          nameLower: normalizeName(input.name),
          role: "teacher"
        };
        members.push(member);
        passwords[uid] = input.password;
        writeJson(demoKey(input.classCode, "members"), members);
        writeJson(demoKey(input.classCode, "passwords"), passwords);
      }

      if (!member || passwords[member.uid] !== input.password) {
        throw new Error(
          input.role === "student"
            ? "We could not open that account. Check your name and password, or ask your teacher for access."
            : "That teacher password does not match this class."
        );
      }

      return {
        uid: member.uid,
        classCode: input.classCode,
        name: member.name,
        nameLower: member.nameLower,
        role: member.role
      };
    },
    async createStudent(input) {
      seedDemo(input.classCode);
      validatePassword(input.password);
      const name = input.name.trim().replace(/\s+/g, " ");
      const lower = normalizeName(name);
      if (!name || name.length > 60) throw new Error("Enter a student name using 1–60 characters.");
      const members = readJson<Member[]>(demoKey(input.classCode, "members"), []);
      if (members.some((item) => item.role === "student" && item.nameLower === lower)) {
        throw new Error("That student name is already used in this class.");
      }
      const uid = demoUid(input.classCode, name, "student");
      members.push({ uid, name, nameLower: lower, role: "student" });
      const passwords = readJson<Record<string, string>>(demoKey(input.classCode, "passwords"), {});
      passwords[uid] = input.password;
      writeJson(demoKey(input.classCode, "members"), members);
      writeJson(demoKey(input.classCode, "passwords"), passwords);
    },
    updateStudent,
    async resetStudentPassword(input) {
      await updateStudent({ classCode: input.classCode, studentId: input.studentId, name: "", password: input.password });
    },
    async verifySession() {
      return true;
    },
    async signOut() {},
    getMembers,
    async getSections() {
      return readSections();
    },
    async getAdminOverview(teacherUid) {
      const codes = new Set(readSections());
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        const match = key && key.match(/^classroomMail\.demo\.v1\.([^.]+)\.messages$/);
        if (match) codes.add(match[1]);
      }
      const sections = await Promise.all(
        Array.from(codes).map(async (code) => ({
          code,
          members: await getMembers(code),
          messages: await getMessages(code),
          settings: await getClassSettings(code).catch(() => ({ studentMessaging: true }))
        }))
      );
      return buildAdminOverview(sections, teacherUid);
    },
    getMessages,
    async getDrafts(classCode, uid) {
      return readJson<Draft[]>(demoKey(classCode, "drafts." + uid), []);
    },
    async getAssignments(classCode) {
      return readJson<Assignment[]>(demoKey(classCode, "assignments"), []);
    },
    async createAssignment(classCode, teacherId, assignment) {
      const rows = readJson<Assignment[]>(demoKey(classCode, "assignments"), []);
      const row: Assignment = {
        ...assignment,
        dueAt: assignment.dueAt ? new Date(assignment.dueAt).getTime() : null,
        id: makeId("assign"),
        classCode,
        teacherId,
        createdAt: Date.now()
      };
      rows.unshift(row);
      writeJson(demoKey(classCode, "assignments"), rows);
      return row;
    },
    async deleteAssignment(classCode, assignmentId) {
      const rows = readJson<Assignment[]>(demoKey(classCode, "assignments"), []).filter((row) => row.id !== assignmentId);
      writeJson(demoKey(classCode, "assignments"), rows);
      const submissions = readJson<Submission[]>(demoKey(classCode, "submissions"), []).filter(
        (row) => row.assignmentId !== assignmentId
      );
      writeJson(demoKey(classCode, "submissions"), submissions);
      deleteDemoItemViews(classCode, "assignment", assignmentId);
    },
    async getSubmissions(classCode) {
      return readJson<Submission[]>(demoKey(classCode, "submissions"), []);
    },
    async saveSubmission(classCode, submission) {
      const rows = readJson<Submission[]>(demoKey(classCode, "submissions"), []);
      const existing = rows.find(
        (row) => row.assignmentId === submission.assignmentId && row.studentId === submission.studentId
      );
      const row: Submission = {
        id: existing ? existing.id : makeId("sub"),
        assignmentId: submission.assignmentId,
        classCode,
        studentId: submission.studentId,
        body: submission.body,
        grade: existing ? existing.grade : "",
        feedback: existing ? existing.feedback : "",
        gradedAt: existing ? existing.gradedAt : null,
        submittedAt: Date.now(),
        createdAt: existing ? existing.createdAt : Date.now()
      };
      if (existing) Object.assign(existing, row);
      else rows.unshift(row);
      writeJson(demoKey(classCode, "submissions"), rows);
      const files = readJson<Record<string, SubmissionFile[]>>(demoKey(classCode, "submissionFiles"), {});
      files[row.id] = submission.files.map((file) => ({
        ...file,
        id: makeId("sfile"),
        submissionId: row.id,
        classCode,
        studentId: submission.studentId,
        name: file.name,
        path: file.path,
        size: file.size,
        type: file.type,
        createdAt: Date.now()
      }));
      writeJson(demoKey(classCode, "submissionFiles"), files);
      return row;
    },
    async gradeSubmission(classCode, submissionId, grade, feedback) {
      const rows = readJson<Submission[]>(demoKey(classCode, "submissions"), []);
      const row = rows.find((item) => item.id === submissionId);
      if (!row) return null;
      row.grade = grade;
      row.feedback = feedback;
      row.gradedAt = Date.now();
      writeJson(demoKey(classCode, "submissions"), rows);
      return row;
    },
    async getSubmissionFiles(classCode) {
      const all = readJson<Record<string, SubmissionFile[]>>(demoKey(classCode, "submissionFiles"), {});
      return Object.keys(all).reduce<SubmissionFile[]>((result, key) => result.concat(all[key] || []), []);
    },
    async uploadSubmissionFile(classCode, uid, file) {
      return {
        name: file.name,
        path: classCode + "/submissions/" + uid + "/demo-" + makeId("file") + "-" + String(file.name).replace(/[^A-Za-z0-9._-]/g, "_"),
        size: file.size,
        type: file.type || "application/octet-stream"
      };
    },
    async deleteSubmissionFiles(classCode, submissionId) {
      const all = readJson<Record<string, SubmissionFile[]>>(demoKey(classCode, "submissionFiles"), {});
      delete all[submissionId];
      writeJson(demoKey(classCode, "submissionFiles"), all);
    },
    async getAnnouncements(classCode) {
      return readJson<Announcement[]>(demoKey(classCode, "announcements"), []);
    },
    async createAnnouncement(classCode, authorId, announcement) {
      const rows = readJson<Announcement[]>(demoKey(classCode, "announcements"), []);
      const row: Announcement = {
        ...announcement,
        id: makeId("ann"),
        classCode,
        authorId,
        createdAt: Date.now()
      };
      rows.unshift(row);
      writeJson(demoKey(classCode, "announcements"), rows);
      return row;
    },
    async deleteAnnouncement(classCode, announcementId) {
      const rows = readJson<Announcement[]>(demoKey(classCode, "announcements"), []).filter(
        (row) => row.id !== announcementId
      );
      writeJson(demoKey(classCode, "announcements"), rows);
      deleteDemoItemViews(classCode, "announcement", announcementId);
    },
    async getItemViews(classCode) {
      return readJson<ItemView[]>(demoKey(classCode, "itemViews"), []);
    },
    async markItemViewed(classCode, view) {
      const rows = readJson<ItemView[]>(demoKey(classCode, "itemViews"), []);
      const existing = rows.find(
        (row) => row.itemType === view.itemType && row.itemId === view.itemId && row.viewerId === view.viewerId
      );
      if (existing) {
        existing.viewedAt = view.viewedAt;
        writeJson(demoKey(classCode, "itemViews"), rows);
        return existing;
      }
      const row = { ...view, id: makeId("view") };
      rows.unshift(row);
      writeJson(demoKey(classCode, "itemViews"), rows);
      return row;
    },
    async createMessage(classCode, message) {
      const messages = readJson<Message[]>(demoKey(classCode, "messages"), []);
      const row: Message = { ...message, id: makeId("msg"), createdAt: Date.now() };
      messages.push(row);
      writeJson(demoKey(classCode, "messages"), messages);
      return row;
    },
    async uploadFile(classCode, file) {
      return {
        name: file.name,
        path: classCode + "/demo-" + makeId("file") + "-" + String(file.name).replace(/[^A-Za-z0-9._-]/g, "_"),
        size: file.size,
        type: file.type || "application/octet-stream"
      };
    },
    async createMessageFiles(classCode, rows) {
      const all = readJson<Record<string, MessageFileRow[]>>(demoKey(classCode, "files"), {});
      rows.forEach((row) => {
        if (!all[row.message_id]) all[row.message_id] = [];
        all[row.message_id].push(row);
      });
      writeJson(demoKey(classCode, "files"), all);
    },
    async getMessageFiles(classCode, messageId) {
      const all = readJson<Record<string, MessageFileRow[]>>(demoKey(classCode, "files"), {});
      return all[messageId] || [];
    },
    async fileUrl() {
      return "#";
    },
    getClassSettings,
    async setClassSettings(classCode, patch) {
      const settings = { ...readJson<Partial<ClassSettings>>(demoKey(classCode, "settings"), {}), ...patch };
      writeJson(demoKey(classCode, "settings"), settings);
      return { studentMessaging: settings.studentMessaging !== false };
    },
    async createModerationAlert(payload) {
      const key = demoKey(payload.classCode, "moderation");
      const rows = readJson<unknown[]>(key, []);
      rows.unshift({ ...payload, id: makeId("mod"), createdAt: Date.now() });
      writeJson(key, rows.slice(0, 200));
    },
    async updateMessage(classCode, id, patch) {
      const messages = readJson<Message[]>(demoKey(classCode, "messages"), []);
      const index = messages.findIndex((item) => item.id === id);
      if (index >= 0) {
        messages[index] = { ...messages[index], ...patch };
        writeJson(demoKey(classCode, "messages"), messages);
      }
    },
    async deleteMessage(classCode, id) {
      const messages = readJson<Message[]>(demoKey(classCode, "messages"), []);
      writeJson(
        demoKey(classCode, "messages"),
        messages.filter((item) => item.id !== id)
      );
      deleteDemoItemViews(classCode, "message", id);
    },
    async saveDraft(classCode, uid, draft) {
      const drafts = readJson<Draft[]>(demoKey(classCode, "drafts." + uid), []);
      let row = draft.id ? drafts.find((item) => item.id === draft.id) : undefined;
      if (!row) {
        row = { ...draft, id: makeId("draft"), updatedAt: Date.now() } as Draft;
        drafts.push(row);
      } else {
        Object.assign(row, draft, { updatedAt: Date.now() });
      }
      writeJson(demoKey(classCode, "drafts." + uid), drafts);
      return row;
    },
    async deleteDraft(classCode, uid, id) {
      const drafts = readJson<Draft[]>(demoKey(classCode, "drafts." + uid), []);
      writeJson(
        demoKey(classCode, "drafts." + uid),
        drafts.filter((item) => item.id !== id)
      );
    }
  };
}

function mapMember(row: any): Member {
  return { uid: row.id, name: row.name, nameLower: row.name_lower, role: row.role };
}

function mapMessage(row: any): Message {
  return {
    id: row.id,
    fromUid: row.from_id,
    fromName: row.from_name,
    fromRole: row.from_role,
    toUids: row.to_ids || [],
    toNames: row.to_names || [],
    subject: row.subject || "",
    body: row.body || "",
    readBy: row.read_by || [],
    starredBy: row.starred_by || [],
    deletedBy: row.deleted_by || [],
    moderationStatus: row.moderation_status || "clean",
    flaggedTerms: row.flagged_terms || [],
    flaggedAt: row.flagged_at ? new Date(row.flagged_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime()
  };
}

function mapDraft(row: any): Draft {
  return {
    id: row.id,
    to: row.recipient_text || "",
    subject: row.subject || "",
    body: row.body || "",
    attachments: row.attachments || [],
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined
  };
}

function mapAssignment(row: any): Assignment {
  return {
    id: row.id,
    classCode: row.class_code,
    teacherId: row.teacher_id,
    title: row.title || "",
    instructions: row.instructions || "",
    dueAt: row.due_at ? new Date(row.due_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime()
  };
}

function mapSubmission(row: any): Submission {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    classCode: row.class_code,
    studentId: row.student_id,
    body: row.body || "",
    grade: row.grade || "",
    feedback: row.feedback || "",
    gradedAt: row.graded_at ? new Date(row.graded_at).getTime() : null,
    submittedAt: new Date(row.submitted_at || row.created_at).getTime(),
    createdAt: new Date(row.created_at).getTime()
  };
}

function mapSubmissionFile(row: any): SubmissionFile {
  return {
    id: row.id,
    submissionId: row.submission_id,
    classCode: row.class_code,
    studentId: row.student_id,
    name: row.file_name || "file",
    path: row.storage_path,
    size: Number(row.size_bytes) || 0,
    type: row.mime_type || "application/octet-stream",
    createdAt: new Date(row.created_at).getTime()
  };
}

function mapAnnouncement(row: any): Announcement {
  return {
    id: row.id,
    classCode: row.class_code,
    authorId: row.author_id,
    title: row.title || "",
    body: row.body || "",
    createdAt: new Date(row.created_at).getTime()
  };
}

function mapItemView(row: any): ItemView {
  return {
    itemType: row.item_type,
    itemId: row.item_id,
    classCode: row.class_code,
    viewerId: row.viewer_id,
    viewedAt: new Date(row.viewed_at).getTime()
  };
}

function createSupabaseBackend(): BackendService {
  if (!hasKeys) {
    throw new Error("Supabase configuration is missing.");
  }
  const client = createClient(CONFIG.url!, publicKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  let tempClient: any = null;

  function emailFor(classCode: string, name: string, role: Role) {
    const authClass = role === "teacher" ? teacherHomeClassCode || classCode : classCode;
    return "cm." + hashHex(authClass + "|" + role + "|" + normalizeName(name)).slice(0, 16) + "@classroommail.school";
  }

  function classCodeVariants(code: string) {
    const original = String(code || "").trim();
    const lower = original.toLowerCase();
    const title = lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    return Array.from(new Set([original, original.toUpperCase(), lower, title])).filter(Boolean);
  }

  function getTempClient() {
    if (!tempClient) {
      tempClient = createClient(CONFIG.url!, publicKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: "classroommail.temp.auth"
        }
      });
    }
    return tempClient;
  }

  async function teacherExists(classCode: string) {
    const result = await client.rpc("teacher_exists", { code: classCode });
    if (result.error) throw result.error;
    return Boolean(result.data);
  }

  async function insertMember(profile: Profile) {
    const inserted = await client.from("members").insert({
      id: profile.uid,
      class_code: profile.classCode,
      name: profile.name,
      name_lower: normalizeName(profile.name),
      role: profile.role
    });
    if (inserted.error) throw inserted.error;
  }

  async function memberProfile(uid: string): Promise<Profile | null> {
    const result = await client.from("members").select("*").eq("id", uid).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return null;
    return {
      uid: result.data.id,
      classCode: result.data.class_code,
      name: result.data.name,
      nameLower: result.data.name_lower,
      role: result.data.role
    };
  }

  async function getMembers(classCode: string) {
    const result = await client.from("members").select("*").eq("class_code", classCode);
    if (result.error) throw result.error;
    return ((result.data || []) as any[]).map(mapMember);
  }

  async function getMessages(classCode: string) {
    const result = await client
      .from("messages")
      .select("*")
      .eq("class_code", classCode)
      .order("created_at", { ascending: false });
    if (result.error) throw result.error;
    return ((result.data || []) as any[]).map(mapMessage);
  }

  async function getClassSettings(classCode: string) {
    const result = await client
      .from("class_settings")
      .select("student_messaging")
      .eq("class_code", classCode)
      .maybeSingle();
    if (result.error) throw result.error;
    return { studentMessaging: result.data ? result.data.student_messaging !== false : true };
  }

  async function getSections() {
    const [memberResult, teacherResult] = await Promise.all([
      client.from("members").select("class_code"),
      client.from("teacher_sections").select("class_code")
    ]);
    if (memberResult.error) throw memberResult.error;
    if (teacherResult.error) throw teacherResult.error;
    const codes = [...(memberResult.data || []), ...(teacherResult.data || [])] as any[];
    return Array.from(new Set(codes.map((row) => row.class_code))).filter(Boolean) as string[];
  }

  return {
    async signIn(input) {
      validatePassword(input.password);
      const email = emailFor(input.classCode, input.name, input.role);
      const variants = input.role === "teacher" ? [input.classCode] : classCodeVariants(input.classCode);
      let result: any = null;
      for (const variant of variants) {
        result = await client.auth.signInWithPassword({
          email: emailFor(variant, input.name, input.role),
          password: input.password
        });
        if (!result.error) break;
      }
      if (result.error) {
        if (input.role !== "student") {
          if (await teacherExists(input.classCode)) {
            throw new Error("A teacher account already exists. Check the name or password.");
          }
          const signup = await client.auth.signUp({
            email,
            password: input.password,
            options: {
              data: { class_code: input.classCode, display_name: input.name, role: "teacher" }
            }
          });
          if (signup.error) throw signup.error;
          if (!signup.data || !signup.data.session) {
            throw new Error("Email confirmation is on in Supabase. Turn it off in Auth settings, then try again.");
          }
          if (!signup.data.user) throw new Error("The teacher account could not be created.");
          const teacher: Profile = {
            uid: signup.data.user.id,
            classCode: input.classCode,
            name: input.name,
            nameLower: normalizeName(input.name),
            role: "teacher"
          };
          await insertMember(teacher);
          return teacher;
        }
        throw new Error("We could not open that account. Check your name and password, or ask your teacher for access.");
      }
      const existing = await memberProfile(result.data.user.id);
      if (!existing || existing.role !== input.role) {
        throw new Error("That account is not set up for this class. Ask your teacher to check the roster.");
      }
      if (existing.role === "teacher") {
        const home = teacherHomeClassCode || input.classCode;
        const activeCode = input.classCode.toLowerCase() === String(home).toLowerCase() ? home : input.classCode;
        return { ...existing, classCode: activeCode };
      }
      return existing;
    },
    async createStudent(input) {
      validatePassword(input.password);
      const name = input.name.trim().replace(/\s+/g, " ");
      if (!name || name.length > 60) throw new Error("Enter a student name using 1–60 characters.");
      const members = await getMembers(input.classCode);
      if (members.some((item) => item.role === "student" && item.nameLower === normalizeName(name))) {
        throw new Error("That student name is already used in this class.");
      }
      const signup = await getTempClient().auth.signUp({
        email: emailFor(input.classCode, name, "student"),
        password: input.password,
        options: {
          data: { class_code: input.classCode, display_name: name, role: "student" }
        }
      });
      if (signup.error) {
        if (/already registered|already exists|user already/i.test(signup.error.message)) {
          throw new Error("That student name is already registered. Ask them to sign in, or reset their password.");
        }
        throw signup.error;
      }
      if (!signup.data || !signup.data.user) throw new Error("The student account could not be created.");
      await insertMember({
        uid: signup.data.user.id,
        classCode: input.classCode,
        name,
        nameLower: normalizeName(name),
        role: "student"
      });
    },
    async updateStudent(input) {
      const name = input.name ? String(input.name).trim().replace(/\s+/g, " ") : "";
      if (input.password) validatePassword(input.password);
      const body: Record<string, string> = { studentId: input.studentId, classCode: input.classCode };
      if (name) body.newName = name;
      if (input.password) body.newPassword = input.password;
      const response = await client.functions.invoke("set-user-password", { body });
      if (response.error) throw new Error(response.error.message || "The account could not be updated.");
      if (response.data && response.data.error) throw new Error(response.data.error);
    },
    async resetStudentPassword(input) {
      await this.updateStudent({ ...input, name: "" });
    },
    async verifySession(profile) {
      const result = await client.auth.getSession();
      return Boolean(result.data && result.data.session && result.data.session.user.id === profile.uid);
    },
    async signOut() {
      await client.auth.signOut({ scope: "local" });
    },
    getMembers,
    getSections,
    async getAdminOverview(teacherUid) {
      const codes = await getSections();
      const sections = await Promise.all(
        codes.map(async (code) => ({
          code,
          members: await getMembers(code),
          messages: await getMessages(code),
          settings: await getClassSettings(code).catch(() => ({ studentMessaging: true }))
        }))
      );
      return buildAdminOverview(sections, teacherUid);
    },
    getMessages,
    async getDrafts(classCode, uid) {
      const result = await client
        .from("drafts")
        .select("*")
        .eq("class_code", classCode)
        .eq("user_id", uid)
        .order("updated_at", { ascending: false });
      if (result.error) throw result.error;
      return ((result.data || []) as any[]).map(mapDraft);
    },
    async getAssignments(classCode) {
      const result = await client
        .from("assignments")
        .select("*")
        .eq("class_code", classCode)
        .order("created_at", { ascending: false });
      if (result.error) throw result.error;
      return ((result.data || []) as any[]).map(mapAssignment);
    },
    async createAssignment(classCode, teacherId, assignment) {
      const result = await client
        .from("assignments")
        .insert({
          class_code: classCode,
          teacher_id: teacherId,
          title: assignment.title,
          instructions: assignment.instructions,
          due_at: assignment.dueAt ? new Date(assignment.dueAt).toISOString() : null
        })
        .select()
        .single();
      if (result.error) throw result.error;
      return mapAssignment(result.data);
    },
    async deleteAssignment(classCode, assignmentId) {
      const result = await client.from("assignments").delete().eq("class_code", classCode).eq("id", assignmentId);
      if (result.error) throw result.error;
    },
    async getSubmissions(classCode) {
      const result = await client
        .from("assignment_submissions")
        .select("*")
        .eq("class_code", classCode)
        .order("submitted_at", { ascending: false });
      if (result.error) throw result.error;
      return ((result.data || []) as any[]).map(mapSubmission);
    },
    async saveSubmission(classCode, submission) {
      const result = await client
        .from("assignment_submissions")
        .upsert(
          {
            class_code: classCode,
            assignment_id: submission.assignmentId,
            student_id: submission.studentId,
            body: submission.body,
            submitted_at: new Date().toISOString()
          },
          { onConflict: "assignment_id,student_id" }
        )
        .select()
        .single();
      if (result.error) throw result.error;
      const saved = mapSubmission(result.data);
      await this.deleteSubmissionFiles(classCode, saved.id);
      if (submission.files.length) {
        const rows = submission.files.map((file) => ({
          submission_id: saved.id,
          class_code: classCode,
          student_id: submission.studentId,
          file_name: file.name,
          storage_path: file.path,
          size_bytes: file.size,
          mime_type: file.type
        }));
        const filesResult = await client.from("submission_files").insert(rows);
        if (filesResult.error) throw filesResult.error;
      }
      return saved;
    },
    async gradeSubmission(_classCode, submissionId, grade, feedback) {
      const result = await client.rpc("grade_submission", {
        p_submission_id: submissionId,
        p_grade: grade || null,
        p_feedback: feedback || ""
      });
      if (result.error) throw result.error;
      const row = await client.from("assignment_submissions").select("*").eq("id", submissionId).single();
      if (row.error) throw row.error;
      return mapSubmission(row.data);
    },
    async getSubmissionFiles(classCode) {
      const result = await client
        .from("submission_files")
        .select("*")
        .eq("class_code", classCode)
        .order("created_at", { ascending: false });
      if (result.error) throw result.error;
      return ((result.data || []) as any[]).map(mapSubmissionFile);
    },
    async uploadSubmissionFile(classCode, uid, file) {
      const safeName = String(file.name || "file").replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
      const path = classCode + "/submissions/" + uid + "/" + crypto.randomUUID() + "-" + safeName;
      const { error } = await client.storage.from("class-files").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });
      if (error) throw error;
      return { name: file.name, path, size: file.size, type: file.type || "application/octet-stream" };
    },
    async deleteSubmissionFiles(classCode, submissionId) {
      const result = await client
        .from("submission_files")
        .delete()
        .eq("class_code", classCode)
        .eq("submission_id", submissionId);
      if (result.error) throw result.error;
    },
    async getAnnouncements(classCode) {
      const result = await client
        .from("announcements")
        .select("*")
        .eq("class_code", classCode)
        .order("created_at", { ascending: false });
      if (result.error) throw result.error;
      return ((result.data || []) as any[]).map(mapAnnouncement);
    },
    async createAnnouncement(classCode, authorId, announcement) {
      const result = await client
        .from("announcements")
        .insert({ class_code: classCode, author_id: authorId, title: announcement.title, body: announcement.body })
        .select()
        .single();
      if (result.error) throw result.error;
      return mapAnnouncement(result.data);
    },
    async deleteAnnouncement(classCode, announcementId) {
      const result = await client.from("announcements").delete().eq("class_code", classCode).eq("id", announcementId);
      if (result.error) throw result.error;
    },
    async getItemViews(classCode) {
      const result = await client
        .from("item_views")
        .select("*")
        .eq("class_code", classCode)
        .order("viewed_at", { ascending: false });
      if (result.error) throw result.error;
      return ((result.data || []) as any[]).map(mapItemView);
    },
    async markItemViewed(classCode, view) {
      const result = await client.rpc("mark_item_viewed", {
        p_item_type: view.itemType,
        p_item_id: view.itemId,
        p_class_code: classCode
      });
      if (result.error) throw result.error;
      return view;
    },
    async createMessage(classCode, message) {
      const result = await client
        .from("messages")
        .insert({
          class_code: classCode,
          from_id: message.fromUid,
          from_name: message.fromName,
          from_role: message.fromRole,
          to_ids: message.toUids,
          to_names: message.toNames,
          subject: message.subject,
          body: message.body,
          read_by: message.readBy,
          starred_by: message.starredBy,
          deleted_by: message.deletedBy,
          moderation_status: message.moderationStatus || "clean",
          flagged_terms: message.flaggedTerms || [],
          flagged_at: message.flaggedAt ? new Date(message.flaggedAt).toISOString() : null
        })
        .select()
        .single();
      if (result.error) throw result.error;
      return mapMessage(result.data);
    },
    async uploadFile(classCode, file) {
      const safeName = String(file.name || "file").replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
      const path = classCode + "/" + crypto.randomUUID() + "-" + safeName;
      const { error } = await client.storage.from("class-files").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });
      if (error) throw error;
      return { name: file.name, path, size: file.size, type: file.type || "application/octet-stream" };
    },
    async createMessageFiles(_classCode, rows) {
      if (!rows.length) return;
      const result = await client.from("message_files").insert(rows);
      if (result.error) throw result.error;
    },
    async getMessageFiles(classCode, messageId) {
      const result = await client
        .from("message_files")
        .select("*")
        .eq("class_code", classCode)
        .eq("message_id", messageId);
      if (result.error) throw result.error;
      return (result.data || []) as MessageFileRow[];
    },
    async fileUrl(path) {
      const { data, error } = await client.storage.from("class-files").createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    getClassSettings,
    async setClassSettings(classCode, patch) {
      const result = await client.from("class_settings").upsert(
        {
          class_code: classCode,
          student_messaging: Boolean(patch.studentMessaging),
          updated_at: new Date().toISOString()
        },
        { onConflict: "class_code" }
      );
      if (result.error) throw result.error;
      return { studentMessaging: Boolean(patch.studentMessaging) };
    },
    async createModerationAlert(payload) {
      const result = await client.from("moderation_alerts").insert({
        message_id: payload.messageId,
        class_code: payload.classCode,
        from_id: payload.fromId,
        from_name: payload.fromName,
        to_names: payload.toNames || [],
        subject: payload.subject || "",
        snippet: String(payload.body || "").slice(0, 180),
        flagged_terms: payload.terms || [],
        severity: payload.severity || "medium"
      });
      if (result.error) throw result.error;
    },
    async updateMessage(classCode, id, patch) {
      const dbPatch: Record<string, unknown> = {};
      if ("readBy" in patch) dbPatch.read_by = patch.readBy;
      if ("starredBy" in patch) dbPatch.starred_by = patch.starredBy;
      if ("deletedBy" in patch) dbPatch.deleted_by = patch.deletedBy;
      if (!Object.keys(dbPatch).length) return;
      const result = await client.from("messages").update(dbPatch).eq("id", id).eq("class_code", classCode);
      if (result.error) throw result.error;
    },
    async deleteMessage(classCode, id) {
      const result = await client.from("messages").delete().eq("id", id).eq("class_code", classCode);
      if (result.error) throw result.error;
    },
    async saveDraft(classCode, uid, draft) {
      const payload = {
        recipient_text: draft.to,
        subject: draft.subject,
        body: draft.body,
        attachments: draft.attachments || []
      };
      let result: any;
      if (draft.id) {
        result = await client
          .from("drafts")
          .update(payload)
          .eq("id", draft.id)
          .eq("user_id", uid)
          .select()
          .single();
      } else {
        result = await client
          .from("drafts")
          .insert({ ...payload, class_code: classCode, user_id: uid })
          .select()
          .single();
      }
      if (result.error) throw result.error;
      return mapDraft(result.data);
    },
    async deleteDraft(classCode, uid, id) {
      const result = await client
        .from("drafts")
        .delete()
        .eq("id", id)
        .eq("user_id", uid)
        .eq("class_code", classCode);
      if (result.error) throw result.error;
    }
  };
}

export function createBackend(demoMode: boolean): BackendService {
  return demoMode ? createDemoBackend() : createSupabaseBackend();
}
