import { describe, expect, it } from "vitest";
import {
  assignmentStatus,
  currentItems,
  flaggedCount,
  resolveRecipients,
  unreadCount
} from "./selectors";
import type { AppState } from "./selectors";
import type { Assignment, Member, Message, Profile, Submission } from "./types";

const student: Profile = {
  uid: "ava",
  classCode: "Demo101",
  name: "Ava Chen",
  nameLower: "ava chen",
  role: "student"
};

const teacher: Profile = {
  uid: "teacher",
  classCode: "Demo101",
  name: "Teacher",
  nameLower: "teacher",
  role: "teacher"
};

const members: Member[] = [
  { uid: teacher.uid, name: teacher.name, nameLower: teacher.nameLower, role: "teacher" },
  { uid: student.uid, name: student.name, nameLower: student.nameLower, role: "student" },
  { uid: "jordan", name: "Jordan Lee", nameLower: "jordan lee", role: "student" }
];

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    profile: student,
    members,
    messages: [],
    drafts: [],
    messageFiles: [],
    fileUrls: {},
    assignments: [],
    submissions: [],
    submissionFiles: [],
    announcements: [],
    itemViews: [],
    selectedAssignmentId: null,
    selectedAnnouncementId: null,
    workFormOpen: false,
    workSaving: false,
    submissionDraftFor: null,
    submissionDraftBody: "",
    submissionDraftFiles: [],
    settings: { studentMessaging: true },
    folder: "inbox",
    filter: "all",
    query: "",
    openId: null,
    openKind: null,
    selectedStudentId: null,
    selectedClassmateId: null,
    loading: false,
    sidebarOpen: false,
    knownSections: [],
    adminOverview: null,
    selectedAdminSection: null,
    pendingOpenMessageId: null,
    pendingComposeTo: null,
    view: "list",
    offline: false,
    offlineSavedAt: null,
    ...overrides
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "m1",
    fromUid: teacher.uid,
    fromName: teacher.name,
    fromRole: "teacher",
    toUids: [student.uid],
    toNames: [student.name],
    subject: "Reminder",
    body: "Bring your notebook.",
    readBy: [],
    starredBy: [],
    deletedBy: [],
    moderationStatus: "clean",
    flaggedTerms: [],
    flaggedAt: null,
    createdAt: 100,
    ...overrides
  };
}

describe("selectors", () => {
  it("returns inbox messages newest first and excludes deleted and sent mail", () => {
    const state = makeState({
      messages: [
        makeMessage({ id: "old", createdAt: 100, body: "Bring your pen." }),
        makeMessage({ id: "new", createdAt: 300, subject: "Notebook check" }),
        makeMessage({ id: "deleted", createdAt: 400, deletedBy: [student.uid] }),
        makeMessage({ id: "sent", createdAt: 200, fromUid: student.uid, toUids: [teacher.uid] })
      ]
    });

    expect(currentItems(state).map((item) => item.id)).toEqual(["new", "old"]);
    expect(currentItems(makeState({ ...state, filter: "unread" })).map((item) => item.id)).toEqual([
      "new",
      "old"
    ]);
    expect(currentItems(makeState({ ...state, query: "notebook" })).map((item) => item.id)).toEqual([
      "new"
    ]);
  });

  it("counts unread messages and teacher flags", () => {
    const state = makeState({
      messages: [
        makeMessage({ id: "unread", readBy: [] }),
        makeMessage({ id: "read", readBy: [student.uid] }),
        makeMessage({ id: "deleted", readBy: [], deletedBy: [student.uid] }),
        makeMessage({
          id: "flagged",
          moderationStatus: "flagged",
          toUids: [teacher.uid],
          readBy: []
        })
      ]
    });

    expect(unreadCount(state)).toBe(1);
    expect(flaggedCount(state)).toBe(0);
    expect(flaggedCount(makeState({ ...state, profile: teacher }))).toBe(1);
  });

  it("resolves /all for teachers and blocks disabled student-to-student mail", () => {
    const teacherState = makeState({ profile: teacher });
    expect(resolveRecipients(teacherState, "/all").map((member) => member.uid)).toEqual([
      student.uid,
      "jordan"
    ]);

    const blocked = makeState({
      settings: { studentMessaging: false },
      members: [student, members[2]]
    });
    expect(() => resolveRecipients(blocked, "Jordan Lee")).toThrow(/turned off/);
    expect(() => resolveRecipients(blocked, "Teacher")).toThrow();
  });

  it("reports assignment status for teachers and students", () => {
    const assignment: Assignment = {
      id: "a1",
      classCode: "Demo101",
      teacherId: teacher.uid,
      title: "Essay",
      instructions: "Write an essay.",
      dueAt: Date.now() + 60_000,
      createdAt: Date.now() - 60_000
    };
    const submission: Submission = {
      id: "s1",
      assignmentId: assignment.id,
      classCode: "Demo101",
      studentId: student.uid,
      body: "Done.",
      grade: "A",
      feedback: "Nice work.",
      gradedAt: Date.now(),
      submittedAt: Date.now(),
      createdAt: Date.now()
    };

    expect(assignmentStatus(makeState({ profile: teacher }), assignment)).toEqual({
      label: "No submissions",
      tone: "muted"
    });
    expect(
      assignmentStatus(makeState({ profile: teacher, submissions: [submission] }), assignment)
    ).toEqual({ label: "1/1 graded", tone: "good" });
    expect(assignmentStatus(makeState({ submissions: [submission] }), assignment)).toEqual({
      label: "Graded",
      tone: "good"
    });
  });
});
