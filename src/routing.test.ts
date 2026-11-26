import { describe, expect, it } from "vitest";
import { buildRoute, parseRoute, routeFromState } from "./routing";
import type { AppState } from "./selectors";

describe("routing", () => {
  it("parses folder, search, filter, and demo routes", () => {
    expect(parseRoute("/mail/inbox", "?demo=1&q=notebook&filter=unread")).toMatchObject({
      folder: "inbox",
      query: "notebook",
      filter: "unread",
      demo: true,
      itemId: null
    });
  });

  it("parses message, draft, assignment, and section details", () => {
    expect(parseRoute("/mail/inbox/item/m1", "")).toMatchObject({
      folder: "inbox",
      itemId: "m1",
      itemKind: "message"
    });
    expect(parseRoute("/mail/drafts/item/d1", "")).toMatchObject({
      folder: "drafts",
      itemId: "d1",
      itemKind: "draft"
    });
    expect(parseRoute("/assignments/a1", "")).toMatchObject({
      folder: "assignments",
      selectedAssignmentId: "a1"
    });
    expect(parseRoute("/mail/dashboard", "?section=Demo101")).toMatchObject({
      folder: "dashboard",
      sectionCode: "Demo101"
    });
  });

  it("builds canonical shareable URLs", () => {
    const base = parseRoute("/", "");
    expect(buildRoute({ ...base, demo: true })).toBe("/mail/inbox?demo=1");
    expect(buildRoute({ ...base, itemId: "m 1", itemKind: "message" })).toBe(
      "/mail/inbox/item/m%201"
    );
    expect(buildRoute({ ...base, folder: "dashboard", sectionCode: "Demo101" })).toBe(
      "/mail/dashboard?section=Demo101"
    );
    expect(buildRoute({ ...base, folder: "assignments", selectedAssignmentId: "a1" })).toBe(
      "/assignments/a1"
    );
  });

  it("derives the current route from app state", () => {
    const state = {
      folder: "announcements",
      openId: null,
      openKind: null,
      selectedAssignmentId: null,
      selectedAnnouncementId: "n1",
      selectedStudentId: null,
      selectedClassmateId: null,
      selectedAdminSection: "Demo101",
      query: "field trip",
      filter: "all",
      profile: { role: "teacher", classCode: "Demo101" }
    } as AppState;

    expect(buildRoute(routeFromState(state, true))).toBe(
      "/announcements/n1?demo=1&q=field+trip"
    );
  });
});
