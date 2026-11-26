import { FOLDERS } from "./constants";
import type { AppState } from "./selectors";
import type { Folder } from "./types";

export type ItemKind = "message" | "draft";

export interface AppRoute {
  folder: Folder;
  itemId: string | null;
  itemKind: ItemKind | null;
  selectedAssignmentId: string | null;
  selectedAnnouncementId: string | null;
  selectedStudentId: string | null;
  selectedClassmateId: string | null;
  sectionCode: string | null;
  query: string;
  filter: "all" | "unread";
  demo: boolean;
}

const folderSet = new Set<string>(FOLDERS);

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseRoute(pathname: string, search: string): AppRoute {
  const params = new URLSearchParams(search);
  const parts = pathname.split("/").filter(Boolean).map(safeDecode);
  const route: AppRoute = {
    folder: "inbox",
    itemId: null,
    itemKind: null,
    selectedAssignmentId: null,
    selectedAnnouncementId: null,
    selectedStudentId: null,
    selectedClassmateId: null,
    sectionCode: params.get("section") || null,
    query: params.get("q") || "",
    filter: params.get("filter") === "unread" ? "unread" : "all",
    demo: params.get("demo") === "1"
  };

  if (parts[0] === "mail" && folderSet.has(parts[1])) {
    route.folder = parts[1] as Folder;
    const id = parts[2] === "item" ? parts[3] : null;
    if (id) {
      if (route.folder === "drafts") {
        route.itemId = id;
        route.itemKind = "draft";
      } else if (route.folder === "assignments") {
        route.selectedAssignmentId = id;
      } else if (route.folder === "announcements") {
        route.selectedAnnouncementId = id;
      } else if (route.folder === "roster") {
        route.selectedStudentId = id;
      } else if (route.folder === "classmates") {
        route.selectedClassmateId = id;
      } else {
        route.itemId = id;
        route.itemKind = "message";
      }
    }
    return route;
  }

  const detailRoutes: Array<[string, keyof AppRoute, Folder]> = [
    ["assignments", "selectedAssignmentId", "assignments"],
    ["announcements", "selectedAnnouncementId", "announcements"],
    ["students", "selectedStudentId", "roster"],
    ["classmates", "selectedClassmateId", "classmates"]
  ];
  const detail = detailRoutes.find(([segment]) => segment === parts[0]);
  if (detail && parts[1]) {
    route.folder = detail[2];
    if (detail[1] === "selectedAssignmentId") route.selectedAssignmentId = parts[1];
    if (detail[1] === "selectedAnnouncementId") route.selectedAnnouncementId = parts[1];
    if (detail[1] === "selectedStudentId") route.selectedStudentId = parts[1];
    if (detail[1] === "selectedClassmateId") route.selectedClassmateId = parts[1];
  }

  return route;
}

export function buildRoute(route: AppRoute) {
  const params = new URLSearchParams();
  if (route.demo) params.set("demo", "1");
  if (route.sectionCode && route.folder === "dashboard") params.set("section", route.sectionCode);
  if (route.query) params.set("q", route.query);
  if (route.filter === "unread") params.set("filter", "unread");

  let path = "/mail/" + route.folder;
  if (route.itemId && route.itemKind) {
    path += "/item/" + encodeURIComponent(route.itemId);
  } else if (route.folder === "assignments" && route.selectedAssignmentId) {
    path = "/assignments/" + encodeURIComponent(route.selectedAssignmentId);
  } else if (route.folder === "announcements" && route.selectedAnnouncementId) {
    path = "/announcements/" + encodeURIComponent(route.selectedAnnouncementId);
  } else if (route.folder === "roster" && route.selectedStudentId) {
    path = "/students/" + encodeURIComponent(route.selectedStudentId);
  } else if (route.folder === "classmates" && route.selectedClassmateId) {
    path = "/classmates/" + encodeURIComponent(route.selectedClassmateId);
  }

  const search = params.toString();
  return path + (search ? "?" + search : "");
}

export function routeFromState(state: AppState, demo: boolean): AppRoute {
  return {
    folder: state.folder,
    itemId: state.openId,
    itemKind: state.openKind,
    selectedAssignmentId: state.folder === "assignments" ? state.selectedAssignmentId : null,
    selectedAnnouncementId: state.folder === "announcements" ? state.selectedAnnouncementId : null,
    selectedStudentId: state.folder === "roster" ? state.selectedStudentId : null,
    selectedClassmateId: state.folder === "classmates" ? state.selectedClassmateId : null,
    sectionCode:
      state.profile?.role === "teacher"
        ? state.folder === "dashboard"
          ? state.selectedAdminSection || state.profile.classCode
          : state.profile.classCode
        : null,
    query: state.query,
    filter: state.filter,
    demo
  };
}

export function sameRoute(a: AppRoute, b: AppRoute) {
  return buildRoute(a) === buildRoute(b);
}
