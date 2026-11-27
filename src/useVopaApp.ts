import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createBackend, hasKeys } from "./backend";
import type { BackendService } from "./backend";
import { TEACHER_FOLDERS } from "./constants";
import { parseRoute } from "./routing";
import type { AppRoute } from "./routing";
import {
  adminSection,
  announcementsForList,
  assignmentsForList,
  currentClassmates,
  currentItems,
  emptyCopy,
  flaggedCount,
  mySubmission,
  resolveRecipients,
  unseenAnnouncementCount,
  unreadCount
} from "./selectors";
import type { AppState } from "./selectors";
import {
  clearSession,
  DEFAULT_SETTINGS,
  formatFullDate,
  friendlyError,
  isAllowedFileType,
  makeImageThumb,
  MAX_FILE_SIZE,
  normalizeName,
  readSession,
  readTextPreview,
  readSections,
  rememberSection,
  saveSession,
  scanModeration,
  validateClassCode
} from "./utils";
import type {
  Assignment,
  Announcement,
  FileRef,
  Folder,
  ItemView,
  Member,
  Message,
  MessageFileRow,
  Role,
  Submission,
  SubmissionFile
} from "./types";

export interface ComposeState {
  open: boolean;
  minimized: boolean;
  saving: boolean;
  draftId: string | null;
  title: string;
  to: string;
  subject: string;
  body: string;
  attachments: FileRef[];
  error: string;
}

export interface AlertState {
  message: string;
  type: "success" | "error" | "info";
}

export interface LightboxState {
  name: string;
  size: number;
  url: string;
}

export interface SignInInput {
  classCode: string;
  name: string;
  role: Role;
  password: string;
}

const initialState: AppState = {
  profile: null,
  members: [],
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
  settings: DEFAULT_SETTINGS,
  folder: "inbox",
  filter: "all",
  query: "",
  openId: null,
  openKind: null,
  selectedStudentId: null,
  selectedClassmateId: null,
  loading: false,
  sidebarOpen: false,
  knownSections: readSections(),
  adminOverview: null,
  selectedAdminSection: null,
  pendingOpenMessageId: null,
  pendingComposeTo: null,
  view: "list"
};

const initialCompose: ComposeState = {
  open: false,
  minimized: false,
  saving: false,
  draftId: null,
  title: "New message",
  to: "",
  subject: "",
  body: "",
  attachments: [],
  error: ""
};

export function useVopaApp() {
  const [state, setState] = useState<AppState>(initialState);
  const stateRef = useRef(state);
  const [compose, setCompose] = useState<ComposeState>(initialCompose);
  const composeRef = useRef(compose);
  const backendRef = useRef<BackendService | null>(null);
  const [demoMode, setDemoMode] = useState(
    () => new URLSearchParams(location.search).get("demo") === "1" || !hasKeys
  );
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const refreshRef = useRef<() => void>(() => {});

  const patch = useCallback((partial: Partial<AppState> | ((current: AppState) => Partial<AppState>)) => {
    const value = typeof partial === "function" ? partial(stateRef.current) : partial;
    const next = { ...stateRef.current, ...value };
    stateRef.current = next;
    setState(next);
  }, []);

  const patchCompose = useCallback(
    (partial: Partial<ComposeState> | ((current: ComposeState) => Partial<ComposeState>)) => {
      const value = typeof partial === "function" ? partial(composeRef.current) : partial;
      const next = { ...composeRef.current, ...value };
      composeRef.current = next;
      setCompose(next);
    },
    []
  );

  const showAlert = useCallback((message: string, type: AlertState["type"] = "info") => {
    setAlert({ message, type });
  }, []);

  const showToast = showAlert;

  const findMessage = useCallback((id: string) => stateRef.current.messages.find((item) => item.id === id) || null, []);
  const findDraft = useCallback((id: string) => stateRef.current.drafts.find((item) => item.id === id) || null, []);

  const closeSidebar = useCallback(() => patch({ sidebarOpen: false }), [patch]);
  const openSidebar = useCallback(() => patch({ sidebarOpen: true }), [patch]);

  const ensureSelection = useCallback(() => {
    const current = stateRef.current;
    const stillThere = currentItems(current).find(
      (item) => item.id === current.openId && item.kind === current.openKind
    );
    if (!stillThere) patch({ openId: null, openKind: null, messageFiles: [], view: "list" });
  }, [patch]);

  const markViewed = useCallback(
    async (itemType: ItemView["itemType"], itemId: string) => {
      const current = stateRef.current;
      const backend = backendRef.current;
      if (!current.profile || !itemId || !backend?.markItemViewed) return;
      if (
        current.itemViews.some(
          (view) => view.itemType === itemType && view.itemId === itemId && view.viewerId === current.profile!.uid
        )
      ) {
        return;
      }
      const view: ItemView = {
        itemType,
        itemId,
        classCode: current.profile.classCode,
        viewerId: current.profile.uid,
        viewedAt: Date.now()
      };
      patch((s) => ({ itemViews: [...s.itemViews, view] }));
      try {
        await backend.markItemViewed(current.profile.classCode, view);
      } catch (error) {
        patch((s) => ({ itemViews: s.itemViews.filter((entry) => entry !== view) }));
        showToast("Could not record view: " + friendlyError(error), "error");
      }
    },
    [patch, showToast]
  );

  const markRead = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const message = current.messages.find((item) => item.id === id);
      if (!current.profile || !message || !message.toUids.includes(current.profile.uid) || message.readBy.includes(current.profile.uid)) {
        return;
      }
      const readBy = message.readBy.concat([current.profile.uid]);
      patch((s) => ({
        messages: s.messages.map((item) => (item.id === id ? { ...item, readBy } : item))
      }));
      backendRef.current
        ?.updateMessage(current.profile.classCode, id, { readBy })
        .catch((error) => showToast(friendlyError(error), "error"));
    },
    [patch, showToast]
  );

  const loadMessageFiles = useCallback(
    async (messageId: string | null) => {
      patch({ messageFiles: [] });
      const current = stateRef.current;
      if (!messageId || !current.profile || !backendRef.current) return;
      try {
        const files = await backendRef.current.getMessageFiles(current.profile.classCode, messageId);
        const after = stateRef.current;
        if (after.openId !== messageId || after.openKind !== "message") return;
        patch({ messageFiles: files });
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    },
    [patch, showToast]
  );

  const selectItem = useCallback(
    (item: { id: string; kind: "message" | "draft" }) => {
      patch({ openId: item.id, openKind: item.kind, view: "detail" });
      if (item.kind === "message") {
        markRead(item.id);
        markViewed("message", item.id);
      }
      loadMessageFiles(item.kind === "message" ? item.id : null);
    },
    [patch, markRead, markViewed, loadMessageFiles]
  );

  const openCompose = useCallback(
    (options: Partial<ComposeState> = {}) => {
      patchCompose({
        open: true,
        minimized: false,
        draftId: options.draftId || null,
        title: options.title || "New message",
        to: options.to || "",
        subject: options.subject || "",
        body: options.body || "",
        attachments: (options.attachments || []).map((file) => ({ ...file })),
        error: ""
      });
      closeSidebar();
    },
    [patchCompose, closeSidebar]
  );

  const resetCompose = useCallback(() => patchCompose(initialCompose), [patchCompose]);

  const loadAll = useCallback(async () => {
    const current = stateRef.current;
    const backend = backendRef.current;
    if (!current.profile || !backend) return;
    patch({ loading: true });
    try {
      const code = current.profile.classCode;
      const uid = current.profile.uid;
      const [members, messages, drafts, settings, assignments, submissions, submissionFiles, announcements, itemViews] =
        await Promise.all([
          backend.getMembers(code),
          backend.getMessages(code),
          backend.getDrafts(code, uid),
          backend.getClassSettings(code).catch(() => DEFAULT_SETTINGS),
          backend.getAssignments(code).catch(() => [] as Assignment[]),
          backend.getSubmissions(code).catch(() => [] as Submission[]),
          backend.getSubmissionFiles(code).catch(() => [] as SubmissionFile[]),
          backend.getAnnouncements(code).catch((error) => {
            console.error("Could not load announcements", error);
            return [] as Announcement[];
          }),
          backend.getItemViews(code).catch(() => [] as ItemView[])
        ]);
      patch({
        members,
        messages,
        drafts,
        settings: settings || DEFAULT_SETTINGS,
        assignments,
        submissions,
        submissionFiles,
        announcements,
        itemViews,
        loading: false
      });
      ensureSelection();
      const after = stateRef.current;
      if (after.folder === "assignments" && after.selectedAssignmentId) {
        markViewed("assignment", after.selectedAssignmentId);
      }
      if (after.folder === "announcements" && after.selectedAnnouncementId) {
        markViewed("announcement", after.selectedAnnouncementId);
      }
      if (after.pendingOpenMessageId) {
        const id = after.pendingOpenMessageId;
        patch({ pendingOpenMessageId: null });
        const pending = findMessage(id);
        if (pending) selectItem({ ...pending, kind: "message" });
      }
      if (after.pendingComposeTo) {
        const to = after.pendingComposeTo;
        patch({ pendingComposeTo: null });
        openCompose({ to });
      }
    } catch (error) {
      showToast(friendlyError(error), "error");
      patch({ loading: false });
    }
  }, [patch, ensureSelection, markViewed, findMessage, selectItem, openCompose, showToast]);

  const loadSectionsRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const loadAdminOverview = useCallback(async () => {
    const current = stateRef.current;
    const backend = backendRef.current;
    if (!current.profile || current.profile.role !== "teacher" || !backend) return;
    patch({ loading: true });
    try {
      const overview = await backend.getAdminOverview(current.profile.uid);
      patch({
        adminOverview: overview,
        selectedAdminSection:
          overview.sections.find((section) => section.code === current.selectedAdminSection)?.code ||
          overview.sections[0]?.code ||
          null,
        loading: false
      });
      await loadSectionsRef.current();
    } catch (error) {
      showToast(friendlyError(error), "error");
      patch({ loading: false });
    }
  }, [patch, showToast]);

  const refresh = useCallback(() => {
    const activeForm = document.querySelector("#detailContent form");
    if (activeForm && activeForm.contains(document.activeElement)) return;
    if (stateRef.current.folder === "dashboard") loadAdminOverview();
    else loadAll();
  }, [loadAdminOverview, loadAll]);

  refreshRef.current = refresh;

  const loadSections = useCallback(async () => {
    const current = stateRef.current;
    if (!current.profile || current.profile.role !== "teacher" || !backendRef.current) return;
    try {
      const sections = await backendRef.current.getSections();
      patch({ knownSections: sections });
      rememberSection(current.profile.classCode);
    } catch {
      patch({ knownSections: [] });
    }
  }, [patch]);

  loadSectionsRef.current = loadSections;

  const setFolder = useCallback(
    (folder: Folder) => {
      const current = stateRef.current;
      if (TEACHER_FOLDERS.has(folder) && current.profile?.role !== "teacher") return;
      patch({
        folder,
        filter: "all",
        query: "",
        openId: null,
        openKind: null,
        messageFiles: [],
        selectedStudentId: null,
        selectedClassmateId: null,
        selectedAssignmentId: null,
        selectedAnnouncementId: null,
        workFormOpen: false,
        submissionDraftFor: null,
        submissionDraftBody: "",
        submissionDraftFiles: [],
        itemViews: [],
        view: "list"
      });
      closeSidebar();
      if (folder === "dashboard") loadAdminOverview();
      else loadAll();
    },
    [patch, closeSidebar, loadAdminOverview, loadAll]
  );

  const switchSection = useCallback(
    async (requestedCode: string | undefined, options: { keepFolder?: boolean } = {}) => {
      const current = stateRef.current;
      if (!current.profile || current.profile.role !== "teacher") return;
      let code: string;
      try {
        code = validateClassCode(requestedCode || "");
      } catch (error) {
        showToast(friendlyError(error), "error");
        return;
      }
      if (code === current.profile.classCode) {
        if (options.keepFolder) refresh();
        else if (current.folder === "dashboard") setFolder("inbox");
        else closeSidebar();
        return;
      }
      const profile = { ...current.profile, classCode: code };
      patch({ profile, view: "list" });
      saveSession(profile);
      rememberSection(code);
      if (options.keepFolder && current.folder !== "roster") {
        patch({
          openId: null,
          openKind: null,
          messageFiles: [],
          selectedStudentId: null,
          selectedClassmateId: null,
          selectedAssignmentId: null,
          selectedAnnouncementId: null,
          workFormOpen: false,
          submissionDraftFor: null,
          submissionDraftBody: "",
          submissionDraftFiles: [],
          itemViews: []
        });
        refresh();
      } else {
        setFolder("inbox");
      }
      loadSections();
    },
    [patch, showToast, refresh, setFolder, closeSidebar, loadSections]
  );

  const updateMessageLocally = useCallback(
    async (id: string, patchData: Partial<Pick<Message, "readBy" | "starredBy" | "deletedBy">>) => {
      const current = stateRef.current;
      if (!current.profile) return;
      patch((s) => ({
        messages: s.messages.map((item) => (item.id === id ? { ...item, ...patchData } : item))
      }));
      try {
        await backendRef.current?.updateMessage(current.profile.classCode, id, patchData);
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    },
    [patch, showToast]
  );

  const toggleStar = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const message = findMessage(id);
      if (!current.profile || !message) return;
      const me = current.profile.uid;
      const starred = message.starredBy.includes(me);
      updateMessageLocally(id, {
        starredBy: starred ? message.starredBy.filter((uid) => uid !== me) : message.starredBy.concat([me])
      });
    },
    [findMessage, updateMessageLocally]
  );

  const moveToTrash = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const message = findMessage(id);
      if (!current.profile || !message || message.deletedBy.includes(current.profile.uid)) return;
      updateMessageLocally(id, { deletedBy: message.deletedBy.concat([current.profile.uid]) });
      showToast("Message moved to Trash");
      if (current.folder !== "trash") {
        patch({ openId: null, openKind: null });
        ensureSelection();
      }
    },
    [findMessage, updateMessageLocally, showToast, patch, ensureSelection]
  );

  const restoreMessage = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const message = findMessage(id);
      if (!current.profile || !message) return;
      updateMessageLocally(id, { deletedBy: message.deletedBy.filter((uid) => uid !== current.profile!.uid) });
      showToast("Message moved back to Inbox", "success");
    },
    [findMessage, updateMessageLocally, showToast]
  );

  const destroyMessage = useCallback(
    async (id: string) => {
      const current = stateRef.current;
      if (!current.profile || !window.confirm("Delete this message forever?")) return;
      try {
        await backendRef.current?.deleteMessage(current.profile.classCode, id);
        patch((s) => ({
          messages: s.messages.filter((item) => item.id !== id),
          openId: null,
          openKind: null
        }));
        ensureSelection();
        showToast("Message deleted forever");
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    },
    [patch, ensureSelection, showToast]
  );

  const markUnread = useCallback(
    (id: string) => {
      const current = stateRef.current;
      const message = findMessage(id);
      if (!current.profile || !message) return;
      updateMessageLocally(id, { readBy: message.readBy.filter((uid) => uid !== current.profile!.uid) });
      showToast("Marked as unread");
    },
    [findMessage, updateMessageLocally, showToast]
  );

  const replyTo = useCallback(
    (id: string) => {
      const message = findMessage(id);
      if (!message || !stateRef.current.profile) return;
      const me = stateRef.current.profile.uid;
      const recipient = message.fromUid === me ? message.toNames[0] || "" : message.fromName;
      const subject = /^re:/i.test(message.subject) ? message.subject : "Re: " + (message.subject || "your message");
      const quoted = String(message.body || "")
        .split("\n")
        .slice(0, 6)
        .map((line) => "> " + line)
        .join("\n");
      openCompose({
        to: recipient,
        subject,
        body: "\n\nOn " + formatFullDate(message.createdAt) + ", " + message.fromName + " wrote:\n" + quoted
      });
    },
    [findMessage, openCompose]
  );

  const editDraft = useCallback(
    (id: string) => {
      const draft = findDraft(id);
      if (!draft) return;
      openCompose({
        draftId: draft.id,
        title: "Edit draft",
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
        attachments: draft.attachments || []
      });
    },
    [findDraft, openCompose]
  );

  const deleteDraftItem = useCallback(
    async (id: string) => {
      const current = stateRef.current;
      if (!current.profile || !window.confirm("Delete this draft?")) return;
      try {
        await backendRef.current?.deleteDraft(current.profile.classCode, current.profile.uid, id);
        patch((s) => ({ drafts: s.drafts.filter((item) => item.id !== id) }));
        if (composeRef.current.draftId === id) resetCompose();
        patch({ openId: null, openKind: null });
        ensureSelection();
        showToast("Draft deleted");
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    },
    [patch, resetCompose, ensureSelection, showToast]
  );

  const addAttachments = useCallback(
    async (files: FileList | File[]) => {
      const current = stateRef.current;
      if (!current.profile || !backendRef.current) return;
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          showToast(file.name + " is larger than 10 MB.", "error");
          continue;
        }
        if (!isAllowedFileType(file)) {
          showToast(file.name + " has an unsupported file type.", "error");
          continue;
        }
        try {
          const uploaded = await backendRef.current.uploadFile(current.profile.classCode, file);
          const thumb = await makeImageThumb(file);
          const preview = await readTextPreview(file);
          if (thumb) uploaded.thumb = thumb;
          if (preview) uploaded.preview = preview;
          patchCompose((c) => ({ attachments: [...c.attachments, uploaded] }));
        } catch (error) {
          showToast("Could not upload " + file.name + ": " + friendlyError(error), "error");
        }
      }
    },
    [showToast, patchCompose]
  );

  const removeAttachment = useCallback(
    (index: number) => patchCompose((c) => ({ attachments: c.attachments.filter((_, i) => i !== index) })),
    [patchCompose]
  );

  const saveDraft = useCallback(
    async (showNotice: boolean) => {
      const current = stateRef.current;
      const draft = composeRef.current;
      const backend = backendRef.current;
      if (!current.profile || !backend || draft.saving) return;
      if (!draft.to.trim() && !draft.subject.trim() && !draft.body.trim() && !draft.attachments.length && !draft.draftId) {
        return;
      }
      patchCompose({ saving: true });
      try {
        const saved = await backend.saveDraft(current.profile.classCode, current.profile.uid, {
          id: draft.draftId,
          to: draft.to,
          subject: draft.subject,
          body: draft.body,
          attachments: draft.attachments
        });
        patchCompose({ draftId: saved.id });
        patch((s) => {
          const index = s.drafts.findIndex((item) => item.id === saved.id);
          const drafts = [...s.drafts];
          if (index >= 0) drafts[index] = saved;
          else drafts.push(saved);
          drafts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          return { drafts };
        });
        ensureSelection();
        if (showNotice) showToast("Draft saved", "success");
      } catch (error) {
        showToast(friendlyError(error), "error");
      } finally {
        patchCompose({ saving: false });
      }
    },
    [patchCompose, patch, ensureSelection, showToast]
  );

  const closeComposePanel = useCallback(() => {
    const draft = composeRef.current;
    const hasContent = Boolean(
      draft.to.trim() || draft.subject.trim() || draft.body.trim() || draft.attachments.length
    );
    if (hasContent && !window.confirm("Discard this unsaved message?")) return;
    resetCompose();
  }, [resetCompose]);

  const discardCompose = useCallback(async () => {
    const current = stateRef.current;
    const draft = composeRef.current;
    const hasContent = Boolean(
      draft.to.trim() || draft.subject.trim() || draft.body.trim() || draft.attachments.length
    );
    if (!hasContent && !draft.draftId) {
      resetCompose();
      return;
    }
    if (!window.confirm("Discard this message?")) return;
    try {
      if (draft.draftId && current.profile) {
        await backendRef.current?.deleteDraft(current.profile.classCode, current.profile.uid, draft.draftId);
        patch((s) => ({ drafts: s.drafts.filter((item) => item.id !== draft.draftId) }));
      }
      resetCompose();
      ensureSelection();
      showToast("Draft discarded");
    } catch (error) {
      showToast(friendlyError(error), "error");
    }
  }, [patch, resetCompose, ensureSelection, showToast]);

  const sendMessage = useCallback(async () => {
    const current = stateRef.current;
    const draft = composeRef.current;
    const backend = backendRef.current;
    if (!current.profile || !backend) return;
    const to = draft.to.trim();
    const body = draft.body.trim();
    if (!to) {
      patchCompose({ error: "Add at least one classmate in the To field." });
      return;
    }
    if (!body) {
      patchCompose({ error: "Write a short message before sending." });
      return;
    }
    let recipients: Member[];
    try {
      recipients = resolveRecipients(current, to);
    } catch (error) {
      patchCompose({ error: friendlyError(error) });
      return;
    }
    const emailAll = ["/all", "all students", "all"].includes(normalizeName(to));
    const toNames = emailAll ? ["All students"] : recipients.map((member) => member.name);
    const moderationText = [draft.subject.trim(), body].join(" ");
    const moderation = scanModeration(moderationText);
    if (moderation.flagged) {
      const ok = window.confirm(
        "This message may include inappropriate language (" +
          moderation.terms.slice(0, 3).join(", ") +
          "). It will be flagged for teacher review. Send anyway?"
      );
      if (!ok) return;
    }
    patchCompose({ saving: true, error: "" });
    try {
      const created = await backend.createMessage(current.profile.classCode, {
        fromUid: current.profile.uid,
        fromName: current.profile.name,
        fromRole: current.profile.role,
        toUids: recipients.map((member) => member.uid),
        toNames,
        subject: draft.subject.trim() || "(no subject)",
        body,
        readBy: [current.profile.uid],
        starredBy: [],
        deletedBy: [],
        moderationStatus: moderation.flagged ? "flagged" : "clean",
        flaggedTerms: moderation.terms,
        flaggedAt: moderation.flagged ? Date.now() : null
      });
      if (moderation.flagged && backend.createModerationAlert) {
        backend
          .createModerationAlert({
            messageId: created.id,
            classCode: current.profile.classCode,
            fromId: current.profile.uid,
            fromName: current.profile.name,
            toNames,
            subject: draft.subject.trim() || "(no subject)",
            body,
            terms: moderation.terms,
            severity: moderation.severity
          })
          .catch(() => {});
      }
      if (draft.attachments.length) {
        const rows = draft.attachments.map((file) => ({
          message_id: created.id,
          class_code: current.profile!.classCode,
          from_id: current.profile!.uid,
          to_ids: recipients.map((member) => member.uid),
          file_name: file.name,
          storage_path: file.path,
          size_bytes: file.size,
          mime_type: file.type,
          thumb: demoMode ? file.thumb || null : undefined,
          preview: demoMode ? file.preview || null : undefined
        }));
        await backend.createMessageFiles(current.profile.classCode, rows);
      }
      if (draft.draftId) {
        await backend.deleteDraft(current.profile.classCode, current.profile.uid, draft.draftId);
        patch((s) => ({ drafts: s.drafts.filter((item) => item.id !== draft.draftId) }));
      }
      resetCompose();
      patch({ folder: "sent", filter: "all", openId: null, openKind: null, view: "list" });
      await loadAll();
      showToast("Message sent", "success");
    } catch (error) {
      showToast(friendlyError(error), "error");
    } finally {
      patchCompose({ saving: false });
    }
  }, [patchCompose, patch, demoMode, resetCompose, loadAll, showToast]);

  const setStudentMessaging = useCallback(
    async (enabled: boolean, code?: string) => {
      const current = stateRef.current;
      if (!current.profile || !backendRef.current) return;
      const target = code || current.profile.classCode;
      try {
        const settings = await backendRef.current.setClassSettings(target, { studentMessaging: enabled });
        if (target === current.profile.classCode) patch({ settings });
        if (current.adminOverview) {
          patch((s) => ({
            adminOverview: s.adminOverview
              ? {
                  ...s.adminOverview,
                  sections: s.adminOverview.sections.map((section) =>
                    section.code === target ? { ...section, studentMessaging: enabled } : section
                  )
                }
              : null
          }));
        }
        showToast(
          enabled
            ? code
              ? "Student-to-student mail enabled for " + code + "."
              : "Students can email classmates now."
            : code
              ? "Student-to-student mail off for " + code + "."
              : "Student-to-student mail is off."
        );
      } catch (error) {
        showToast("Could not save class settings: " + friendlyError(error), "error");
      }
    },
    [patch, showToast]
  );

  const deleteAssignmentItem = useCallback(
    async (id: string) => {
      const current = stateRef.current;
      if (!current.profile || !window.confirm("Delete this assignment and all of its submissions?")) return;
      try {
        await backendRef.current?.deleteAssignment(current.profile.classCode, id);
        patch({ selectedAssignmentId: null, workFormOpen: false });
        await loadAll();
        showToast("Assignment deleted", "success");
      } catch (error) {
        showToast("Could not delete assignment: " + friendlyError(error), "error");
      }
    },
    [patch, loadAll, showToast]
  );

  const deleteAnnouncementItem = useCallback(
    async (id: string) => {
      const current = stateRef.current;
      if (!current.profile || !window.confirm("Delete this announcement?")) return;
      try {
        await backendRef.current?.deleteAnnouncement(current.profile.classCode, id);
        patch({ selectedAnnouncementId: null, workFormOpen: false });
        await loadAll();
        showToast("Announcement deleted", "success");
      } catch (error) {
        showToast("Could not delete announcement: " + friendlyError(error), "error");
      }
    },
    [patch, loadAll, showToast]
  );

  const openStoredFile = useCallback(
    async (file: { path?: string; name?: string; size?: number; type?: string }) => {
      if (!file.path || file.path === "#") {
        showToast("File preview is not available in demo mode.");
        return;
      }
      try {
        const url = await backendRef.current?.fileUrl(file.path);
        if (!url) return;
        if (/^image\//i.test(file.type || "")) {
          setLightbox({ name: file.name || "File", size: file.size || 0, url });
        } else {
          window.open(url, "_blank", "noopener");
        }
      } catch (error) {
        showToast("Could not open file: " + friendlyError(error), "error");
      }
    },
    [showToast]
  );

  const openMessageFile = useCallback(
    (file: MessageFileRow, url: string | undefined) => {
      if (!url || url === "#") {
        showToast("Download is unavailable in demo mode.", "error");
        return;
      }
      if (fileKindIsImage(file)) {
        setLightbox({ name: file.file_name, size: file.size_bytes, url });
        return;
      }
      const link = document.createElement("a");
      link.href = url;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
    [showToast]
  );

  const addSubmissionFiles = useCallback(
    async (files: FileList | File[], assignmentId: string) => {
      const current = stateRef.current;
      if (!current.profile || !backendRef.current) return;
      if (current.submissionDraftFor !== assignmentId) {
        patch({ submissionDraftFor: assignmentId, submissionDraftFiles: [] });
      }
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          showToast(file.name + " is larger than 10 MB.", "error");
          continue;
        }
        if (!isAllowedFileType(file)) {
          showToast(file.name + " has an unsupported file type.", "error");
          continue;
        }
        try {
          const uploaded = await backendRef.current.uploadSubmissionFile(
            current.profile.classCode,
            current.profile.uid,
            file
          );
          patch((s) => ({ submissionDraftFiles: [...s.submissionDraftFiles, uploaded] }));
        } catch (error) {
          showToast("Could not upload " + file.name + ": " + friendlyError(error), "error");
        }
      }
    },
    [patch, showToast]
  );

  const removeSubmissionFile = useCallback(
    (index: number) => patch((s) => ({ submissionDraftFiles: s.submissionDraftFiles.filter((_, i) => i !== index) })),
    [patch]
  );

  const hydrateSubmissionDraft = useCallback(
    (assignmentId: string) => {
      const current = stateRef.current;
      if (current.submissionDraftFor === assignmentId) return;
      const submission = mySubmission(current, assignmentId);
      const files = submission
        ? current.submissionFiles
            .filter((file) => file.submissionId === submission.id)
            .map((file) => ({ name: file.name, path: file.path, size: file.size, type: file.type }))
        : [];
      patch({
        submissionDraftFor: assignmentId,
        submissionDraftBody: submission ? submission.body : "",
        submissionDraftFiles: files
      });
    },
    [patch]
  );

  const submitAssignmentForm = useCallback(
    async (form: HTMLFormElement) => {
      const current = stateRef.current;
      if (!current.profile || !backendRef.current) return;
      const data = new FormData(form);
      try {
        await backendRef.current.createAssignment(current.profile.classCode, current.profile.uid, {
          title: String(data.get("title") || "").trim(),
          instructions: String(data.get("instructions") || "").trim(),
          dueAt: data.get("dueAt") ? new Date(String(data.get("dueAt"))).toISOString() : null
        });
        patch({ workFormOpen: false });
        await loadAll();
        showToast("Assignment posted", "success");
      } catch (error) {
        showToast("Could not post assignment: " + friendlyError(error), "error");
      }
    },
    [patch, loadAll, showToast]
  );

  const submitAnnouncementForm = useCallback(
    async (form: HTMLFormElement) => {
      const current = stateRef.current;
      if (!current.profile || !backendRef.current || current.workSaving) return;
      const data = new FormData(form);
      patch({ workSaving: true });
      try {
        await backendRef.current.createAnnouncement(current.profile.classCode, current.profile.uid, {
          title: String(data.get("title") || "").trim(),
          body: String(data.get("body") || "").trim()
        });
        patch({ workFormOpen: false, workSaving: false });
        await loadAll();
        showToast("Announcement posted", "success");
      } catch (error) {
        patch({ workSaving: false });
        showToast("Could not post announcement: " + friendlyError(error), "error");
      }
    },
    [patch, loadAll, showToast]
  );

  const submitGradeForm = useCallback(
    async (form: HTMLFormElement) => {
      const current = stateRef.current;
      if (!current.profile || !backendRef.current) return;
      const data = new FormData(form);
      try {
        await backendRef.current.gradeSubmission(
          current.profile.classCode,
          form.dataset.id || "",
          String(data.get("grade") || "").trim(),
          String(data.get("feedback") || "").trim()
        );
        await loadAll();
        showToast("Feedback saved", "success");
      } catch (error) {
        showToast("Could not save feedback: " + friendlyError(error), "error");
      }
    },
    [loadAll, showToast]
  );

  const submitSubmissionForm = useCallback(
    async (form: HTMLFormElement) => {
      const current = stateRef.current;
      if (!current.profile || !backendRef.current) return;
      const data = new FormData(form);
      const body = String(data.get("body") || "").trim();
      if (!body && !current.submissionDraftFiles.length) {
        showToast("Write a response or attach a file before submitting.", "error");
        return;
      }
      try {
        await backendRef.current.saveSubmission(current.profile.classCode, {
          assignmentId: form.dataset.id || "",
          studentId: current.profile.uid,
          body,
          files: current.submissionDraftFiles.map((file) => ({
            name: file.name,
            path: file.path,
            size: file.size,
            type: file.type
          }))
        });
        patch({ submissionDraftFor: null, submissionDraftBody: "", submissionDraftFiles: [] });
        await loadAll();
        showToast("Submission turned in", "success");
      } catch (error) {
        showToast("Could not turn in work: " + friendlyError(error), "error");
      }
    },
    [patch, loadAll, showToast]
  );

  const submitAddStudentForm = useCallback(
    async (form: HTMLFormElement) => {
      const current = stateRef.current;
      if (!current.profile || !backendRef.current) return;
      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const password = String(data.get("password") || "");
      try {
        await backendRef.current.createStudent({ classCode: current.profile.classCode, name, password });
        await loadAll();
        const created = stateRef.current.members.find(
          (item) => item.role === "student" && item.nameLower === normalizeName(name)
        );
        if (created) patch({ selectedStudentId: created.uid });
        form.reset();
        showToast("Student account created", "success");
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    },
    [patch, loadAll, showToast]
  );

  const submitEditStudentForm = useCallback(
    async (form: HTMLFormElement) => {
      const current = stateRef.current;
      if (!current.profile || !backendRef.current || !current.selectedStudentId) return;
      const data = new FormData(form);
      try {
        await backendRef.current.updateStudent({
          classCode: current.profile.classCode,
          studentId: current.selectedStudentId,
          name: String(data.get("name") || "").trim().replace(/\s+/g, " "),
          password: String(data.get("password") || "")
        });
        await loadAll();
        showToast("Account updated", "success");
      } catch (error) {
        showToast(friendlyError(error), "error");
      }
    },
    [loadAll, showToast]
  );

  const handleDetailSubmit = useCallback(
    (event: FormEvent<HTMLDivElement>) => {
      const form = event.target as HTMLFormElement;
      const formKind = form.dataset.form || form.id;
      if (formKind === "assignment") void submitAssignmentForm(form);
      else if (formKind === "announcement") void submitAnnouncementForm(form);
      else if (formKind === "grade") void submitGradeForm(form);
      else if (formKind === "submission") void submitSubmissionForm(form);
      else if (formKind === "add-student") void submitAddStudentForm(form);
      else if (formKind === "edit-student") void submitEditStudentForm(form);
    },
    [
      submitAssignmentForm,
      submitAnnouncementForm,
      submitGradeForm,
      submitSubmissionForm,
      submitAddStudentForm,
      submitEditStudentForm
    ]
  );

  const signIn = useCallback(
    async (input: SignInInput) => {
      if (!backendRef.current) return "The mail service is not ready. Please reload.";
      try {
        const profile = await backendRef.current.signIn(input);
        patch({ profile });
        saveSession(profile);
        patch({ folder: "inbox", view: "list" });
        setFolder("inbox");
        loadSections();
        return null;
      } catch (error) {
        return friendlyError(error);
      }
    },
    [patch, setFolder, loadSections]
  );

  const showAuth = useCallback(() => {
    clearSession();
    setState(initialState);
    stateRef.current = initialState;
    setCompose(initialCompose);
    composeRef.current = initialCompose;
    setAlert(null);
    setLightbox(null);
  }, []);

  const signOut = useCallback(async () => {
    backendRef.current?.signOut().catch(() => {});
    showAuth();
  }, [showAuth]);

  const fileUrl = useCallback(async (path: string) => {
    if (!backendRef.current) return "#";
    return backendRef.current.fileUrl(path);
  }, []);

  const setQuery = useCallback((query: string) => patch({ query }), [patch]);
  const setFilter = useCallback(
    (filter: "all" | "unread") => patch({ filter, openId: null, openKind: null, view: "list" }),
    [patch]
  );
  const setView = useCallback((view: "list" | "detail") => patch({ view }), [patch]);
  const setWorkFormOpen = useCallback((workFormOpen: boolean) => patch({ workFormOpen }), [patch]);
  const setSubmissionDraftBody = useCallback(
    (submissionDraftBody: string) => patch({ submissionDraftBody }),
    [patch]
  );
  const setSelectedAdminSection = useCallback(
    (code: string | null) => patch({ selectedAdminSection: code, view: "detail" }),
    [patch]
  );
  const setSelectedClassmateId = useCallback((id: string) => patch({ selectedClassmateId: id }), [patch]);
  const setSelectedStudentId = useCallback((id: string) => patch({ selectedStudentId: id }), [patch]);
  const setSelectedAssignmentId = useCallback(
    (id: string) => {
      patch({
        selectedAssignmentId: id,
        workFormOpen: false,
        submissionDraftFor: null,
        submissionDraftBody: "",
        submissionDraftFiles: [],
        view: "detail"
      });
      markViewed("assignment", id);
    },
    [patch, markViewed]
  );
  const setSelectedAnnouncementId = useCallback(
    (id: string) => {
      patch({ selectedAnnouncementId: id, workFormOpen: false, view: "detail" });
      markViewed("announcement", id);
    },
    [patch, markViewed]
  );
  const setPendingOpenMessageId = useCallback(
    (id: string) => patch({ pendingOpenMessageId: id }),
    [patch]
  );
  const setPendingComposeTo = useCallback((to: string) => patch({ pendingComposeTo: to }), [patch]);

  const applyRoute = useCallback(
    (incoming: AppRoute) => {
      const current = stateRef.current;
      if (!current.profile) return;
      const route =
        TEACHER_FOLDERS.has(incoming.folder) && current.profile.role !== "teacher"
          ? { ...incoming, folder: "inbox" as Folder }
          : incoming;
      const hasDetail = Boolean(
        route.itemId ||
          route.selectedAssignmentId ||
          route.selectedAnnouncementId ||
          route.selectedStudentId ||
          route.selectedClassmateId
      );

      if (
        current.profile.role === "teacher" &&
        route.folder !== "dashboard" &&
        route.sectionCode &&
        route.sectionCode !== current.profile.classCode
      ) {
        switchSection(route.sectionCode, { keepFolder: true });
        return;
      }

      const needsLoad =
        route.folder === "dashboard" ? !current.adminOverview : !current.members.length;
      if (current.folder !== route.folder || needsLoad) {
        patch({
          folder: route.folder,
          filter: route.filter,
          query: route.query,
          openId: null,
          openKind: null,
          messageFiles: [],
          selectedStudentId: null,
          selectedClassmateId: null,
          selectedAssignmentId: null,
          selectedAnnouncementId: null,
          workFormOpen: false,
          submissionDraftFor: null,
          submissionDraftBody: "",
          submissionDraftFiles: [],
          itemViews: [],
          selectedAdminSection:
            route.folder === "dashboard" ? route.sectionCode || current.selectedAdminSection : current.selectedAdminSection,
          view: hasDetail ? "detail" : "list"
        });
        closeSidebar();
        if (route.folder === "dashboard") loadAdminOverview();
        else loadAll();
      } else {
        patch({ filter: route.filter, query: route.query });
        if (!hasDetail) {
          patch({
            openId: null,
            openKind: null,
            selectedStudentId: null,
            selectedClassmateId: null,
            selectedAssignmentId: null,
            selectedAnnouncementId: null,
            view: "list"
          });
        }
        if (route.folder === "dashboard" && route.sectionCode && route.sectionCode !== current.selectedAdminSection) {
          patch({ selectedAdminSection: route.sectionCode });
        }
      }

      if (route.itemId && route.itemKind) {
        const item =
          route.itemKind === "message" ? findMessage(route.itemId) : findDraft(route.itemId);
        if (item) selectItem({ id: route.itemId, kind: route.itemKind });
        else patch({ pendingOpenMessageId: route.itemId, view: "detail" });
      } else if (route.folder === "assignments" && route.selectedAssignmentId) {
        setSelectedAssignmentId(route.selectedAssignmentId);
      } else if (route.folder === "announcements" && route.selectedAnnouncementId) {
        setSelectedAnnouncementId(route.selectedAnnouncementId);
      } else if (route.folder === "roster" && route.selectedStudentId) {
        setSelectedStudentId(route.selectedStudentId);
        patch({ view: "detail" });
      } else if (route.folder === "classmates" && route.selectedClassmateId) {
        setSelectedClassmateId(route.selectedClassmateId);
        patch({ view: "detail" });
      }
    },
    [
      patch,
      closeSidebar,
      findMessage,
      findDraft,
      loadAdminOverview,
      loadAll,
      selectItem,
      setSelectedAssignmentId,
      setSelectedAnnouncementId,
      setSelectedStudentId,
      setSelectedClassmateId,
      switchSection
    ]
  );

  useEffect(() => {
    let cancelled = false;
    const bootstrapDemo = demoMode;
    try {
      backendRef.current = createBackend(bootstrapDemo);
    } catch (error) {
      setDemoMode(true);
      showToast(friendlyError(error), "error");
      backendRef.current = createBackend(true);
    }
    const saved = readSession();
    if (!saved) {
      showAuth();
      return () => {
        cancelled = true;
      };
    }
    backendRef.current
      ?.verifySession(saved)
      .then((valid) => {
        if (cancelled) return;
        if (valid) {
          const initialRoute = parseRoute(window.location.pathname, window.location.search);
          patch({ profile: saved });
          applyRoute({
            ...initialRoute,
            sectionCode: initialRoute.sectionCode || saved.classCode
          });
          loadSections();
        } else {
          showAuth();
        }
      })
      .catch(() => {
        if (!cancelled) showAuth();
      });
    return () => {
      cancelled = true;
    };
  }, [demoMode, patch, applyRoute, loadSections, showAuth, showToast]);

  useEffect(() => {
    if (!state.profile) return;
    const interval = window.setInterval(() => {
      if (!document.hidden) refreshRef.current();
    }, 20000);
    const onVisible = () => {
      if (!document.hidden) refreshRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state.profile]);

  useEffect(() => {
    document.body.classList.toggle("demo-banner-visible", demoMode);
    return () => document.body.classList.remove("demo-banner-visible");
  }, [demoMode]);

  const derived = {
    items: currentItems(state),
    currentItems: currentItems(state),
    empty: emptyCopy(state),
    unread: unreadCount(state),
    flagged: flaggedCount(state),
    classmates: currentClassmates(state),
    assignments: assignmentsForList(state),
    announcements: announcementsForList(state),
    unseenAnnouncements: unseenAnnouncementCount(state),
    adminSection: adminSection(state.adminOverview?.sections, state.selectedAdminSection)
  };

  return {
    state,
    compose,
    alert,
    lightbox,
    demoMode,
    derived,
    actions: {
      closeAlert: () => setAlert(null),
      closeLightbox: () => setLightbox(null),
      showAlert,
      showToast,
      closeSidebar,
      openSidebar,
      setQuery,
      setFilter,
      setView,
      setFolder,
      applyRoute,
      switchSection,
      refresh,
      signIn,
      signOut,
      showAuth,
      saveSession,
      openCompose,
      resetCompose,
      closeComposePanel,
      discardCompose,
      saveDraft,
      sendMessage,
      updateCompose: (partial: Partial<ComposeState>) => patchCompose(partial),
      addAttachments,
      removeAttachment,
      selectItem,
      setSelectedAdminSection,
      setSelectedClassmateId,
      setSelectedStudentId,
      setSelectedAssignmentId,
      setSelectedAnnouncementId,
      setPendingOpenMessageId,
      setPendingComposeTo,
      setWorkFormOpen,
      setSubmissionDraftBody,
      toggleStar,
      moveToTrash,
      restoreMessage,
      destroyMessage,
      markUnread,
      replyTo,
      editDraft,
      deleteDraftItem,
      setStudentMessaging,
      deleteAssignmentItem,
      deleteAnnouncementItem,
      openStoredFile,
      openMessageFile,
      addSubmissionFiles,
      removeSubmissionFile,
      hydrateSubmissionDraft,
      handleDetailSubmit,
      fileUrl,
      markViewed,
      loadMessageFiles,
      loadAll,
      ensureSelection
    }
  };
}

function fileKindIsImage(file: MessageFileRow) {
  const type = String(file.mime_type || "").toLowerCase();
  const name = String(file.file_name || "").toLowerCase();
  return type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(name);
}
