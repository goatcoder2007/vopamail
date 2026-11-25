(function () {
  "use strict";

  const CONFIG = window.CLASSROOM_MAIL_CONFIG || {};
  const publicKey = CONFIG.publishableKey || CONFIG.anonKey;
  const hasKeys =
    CONFIG.url &&
    publicKey &&
    !String(CONFIG.url).includes("YOUR_") &&
    !String(publicKey).includes("YOUR_");
  let demoMode = new URLSearchParams(location.search).get("demo") === "1" || !hasKeys;

  const SESSION_KEY = "classroomMail.session.v1";
  const SECTIONS_KEY = "classroomMail.sections.v1";
  const DEMO_PREFIX = "classroomMail.demo.v1.";
  const FOLDER_LABELS = {
    inbox: "Inbox",
    starred: "Starred",
    sent: "Sent",
    drafts: "Drafts",
    trash: "Trash",
    classmates: "Classmates",
    dashboard: "All sections",
    roster: "Class roster",
    all: "All class mail",
    flags: "Flagged messages"
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    demoBanner: $("demoBanner"),
    dismissDemoBanner: $("dismissDemoBanner"),
    authScreen: $("authScreen"),
    signInForm: $("signInForm"),
    classCode: $("classCode"),
    displayName: $("displayName"),
    password: $("password"),
    togglePasswordBtn: $("togglePasswordBtn"),
    authNote: $("authNote"),
    authError: $("authError"),
    signInBtn: $("signInBtn"),
    appShell: $("appShell"),
    sidebar: $("sidebar"),
    closeSidebar: $("closeSidebar"),
    sidebarScrim: $("sidebarScrim"),
    composeBtn: $("composeBtn"),
    folders: $("folders"),
    sectionSwitcher: $("sectionSwitcher"),
    sectionInput: $("sectionInput"),
    sectionOptions: $("sectionOptions"),
    sectionChips: $("sectionChips"),
    switchSectionBtn: $("switchSectionBtn"),
    unreadBadge: $("unreadBadge"),
    draftBadge: $("draftBadge"),
    classmateLabel: $("classmateLabel"),
    classmateBadge: $("classmateBadge"),
    flagBadge: $("flagBadge"),
    teacherBlock: $("teacherBlock"),
    teacherList: $("teacherList"),
    userAvatar: $("userAvatar"),
    userName: $("userName"),
    userEmail: $("userEmail"),
    userMeta: $("userMeta"),
    signOutBtn: $("signOutBtn"),
    menuBtn: $("menuBtn"),
    searchInput: $("searchInput"),
    clearSearch: $("clearSearch"),
    refreshBtn: $("refreshBtn"),
    topbarUser: $("topbarUser"),
    folderTitle: $("folderTitle"),
    folderCount: $("folderCount"),
    filterChips: $("filterChips"),
    messageList: $("messageList"),
    detailContent: $("detailContent"),
    composePanel: $("composePanel"),
    composeTitle: $("composeTitle"),
    composeForm: $("composeForm"),
    composeTo: $("composeTo"),
    composeSubject: $("composeSubject"),
    composeBody: $("composeBody"),
    composeError: $("composeError"),
    composeModeration: $("composeModeration"),
    recipientSuggestions: $("recipientSuggestions"),
    attachBtn: $("attachBtn"),
    fileInput: $("fileInput"),
    attachmentChips: $("attachmentChips"),
    sendBtn: $("sendBtn"),
    saveDraftBtn: $("saveDraftBtn"),
    discardBtn: $("discardBtn"),
    minimizeCompose: $("minimizeCompose"),
    closeCompose: $("closeCompose"),
    alertOverlay: $("alertOverlay"),
    alertIcon: $("alertIcon"),
    alertIconUse: $("alertIconUse"),
    alertTitle: $("alertTitle"),
    alertMessage: $("alertMessage"),
    alertOk: $("alertOk"),
    classSettings: $("classSettings"),
    studentMessagingToggle: $("studentMessagingToggle"),
    fileLightbox: $("fileLightbox"),
    lightboxClose: $("lightboxClose"),
    lightboxImage: $("lightboxImage"),
    lightboxName: $("lightboxName"),
    lightboxMeta: $("lightboxMeta"),
    lightboxDownload: $("lightboxDownload")
  };

  const state = {
    profile: null,
    members: [],
    messages: [],
    drafts: [],
    messageFiles: [],
    fileUrls: {},
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
    pendingComposeTo: null
  };

  let pollTimer = null;

  const compose = {
    open: false,
    minimized: false,
    saving: false,
    draftId: null,
    title: "New message",
    to: "",
    subject: "",
    body: "",
    attachments: []
  };

  let backend;
  let alertReturnFocus = null;
  let tempClient;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function linkify(value) {
    const text = String(value == null ? "" : value);
    const pattern = /(^|[\s(])((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
    let html = "";
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) {
      let url = match[2];
      let trailing = "";
      while (url && /[.,!?;:)\]]$/.test(url)) {
        const last = url.slice(-1);
        if (last === ")" && (url.match(/\)/g) || []).length <= (url.match(/\(/g) || []).length) break;
        if (last === "]" && (url.match(/\]/g) || []).length <= (url.match(/\[/g) || []).length) break;
        trailing = last + trailing;
        url = url.slice(0, -1);
      }
      html += escapeHtml(text.slice(lastIndex, match.index)) + escapeHtml(match[1]);
      if (url) {
        const href = /^www\./i.test(url) ? "https://" + url : url;
        html += '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(url) + "</a>";
      } else {
        html += escapeHtml(match[2]);
      }
      html += escapeHtml(trailing);
      lastIndex = match.index + match[0].length;
    }
    return html + escapeHtml(text.slice(lastIndex));
  }

  function hashHex(value) {
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

  function normalizeName(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function displayEmail(name) {
    const local = normalizeName(name).replace(/[^a-z0-9]/g, "") || "student";
    return local + "@vopamail.com";
  }

  function validatePassword(value) {
    if (String(value || "").length < 6) {
      throw new Error("Use a password with at least 6 characters.");
    }
  }

  const MODERATION_RULES = [
    { label: "strong profanity", severity: "high", words: ["fuck", "shit", "bitch", "asshole", "bastard", "dick", "pussy", "cunt", "motherfucker"] },
    { label: "slur/hate", severity: "high", words: ["nigger", "faggot", "retard"] },
    { label: "threat", severity: "high", words: ["kill you", "kill yourself", "kys", "shoot you", "stab you"] },
    { label: "profanity", severity: "medium", words: ["damn", "hell", "crap", "stupid", "idiot", "dumb", "shut up", "jerk", "loser"] }
  ];

  function normalizeModerationText(value) {
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

  function scanModeration(text) {
    const normalized = " " + normalizeModerationText(text) + " ";
    const hits = [];
    let severity = "clean";
    const rank = { clean: 0, medium: 1, high: 2 };
    MODERATION_RULES.forEach((rule) => {
      rule.words.forEach((word) => {
        const needle = " " + normalizeModerationText(word) + " ";
        if (needle.trim() && normalized.indexOf(needle) >= 0 && hits.indexOf(word) < 0) {
          hits.push(word);
          if (rank[rule.severity] > rank[severity]) severity = rule.severity;
        }
      });
    });
    return { flagged: hits.length > 0, severity, terms: hits };
  }

  function renderComposeModeration() {
    if (!els.composeModeration) return;
    const result = scanModeration([compose.subject, compose.body].join(" "));
    if (!result.flagged) {
      els.composeModeration.hidden = true;
      els.composeModeration.textContent = "";
      els.composeModeration.className = "compose-moderation";
      return;
    }
    els.composeModeration.hidden = false;
    els.composeModeration.className = "compose-moderation " + result.severity;
    els.composeModeration.textContent = result.severity === "high"
      ? "Warning: inappropriate language detected (" + result.terms.slice(0, 3).join(", ") + "). This message will be flagged for teacher review."
      : "Heads up: please keep language respectful (" + result.terms.slice(0, 3).join(", ") + ").";
    return result;
  }

  function initials(value) {
    const parts = normalizeName(value).split(" ").filter(Boolean);
    if (!parts.length) return "?";
    return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  }

  function toMs(value) {
    if (!value) return Date.now();
    if (typeof value === "number") return value;
    if (typeof value.toMillis === "function") return value.toMillis();
    const date = new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? Date.now() : time;
  }

  function formatDate(value) {
    const date = new Date(toMs(value));
    const now = new Date();
    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    if (sameDay) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
    return date.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" });
  }

  function formatFullDate(value) {
    return new Date(toMs(value)).toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function createSnippet(value, length) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= length) return text;
    return text.slice(0, length).trimEnd() + "…";
  }

  function showAlert(message, type) {
    const kind = type || "info";
    const titles = {
      success: "Success",
      error: "Something went wrong",
      info: "Notice"
    };
    const icons = {
      success: "#i-check",
      error: "#i-alert",
      info: "#i-envelope"
    };
    if (els.alertOverlay.hidden) alertReturnFocus = document.activeElement;
    els.alertOverlay.className = "alert-overlay " + (icons[kind] ? kind : "info");
    els.alertIconUse.setAttribute("href", icons[kind] || icons.info);
    els.alertTitle.textContent = titles[kind] || titles.info;
    els.alertMessage.textContent = message;
    els.alertOverlay.hidden = false;
    els.alertOk.focus();
  }

  function hideAlert() {
    if (els.alertOverlay.hidden) return;
    els.alertOverlay.hidden = true;
    if (alertReturnFocus && typeof alertReturnFocus.focus === "function") {
      alertReturnFocus.focus();
    }
    alertReturnFocus = null;
  }

  function showToast(message, type) {
    showAlert(message, type);
  }

  function setFieldError(element, message) {
    if (!message) {
      element.textContent = "";
      element.hidden = true;
      return;
    }
    element.textContent = message;
    element.hidden = false;
  }

  function friendlyError(error) {
    const code = error && error.code ? String(error.code) : "";
    const message = error && error.message ? String(error.message) : "Something went wrong. Please try again.";
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
    if (/supabase library/i.test(message)) {
      return "The Supabase library could not load. Check your connection and reload.";
    }
    return message;
  }

  function saveSession(profile) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
  }

  function readSession() {
    try {
      const value = localStorage.getItem(SESSION_KEY);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function readSections() {
    const value = readJson(SECTIONS_KEY, []);
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  }

  function rememberSection(code) {
    const clean = String(code || "").trim();
    if (!clean) return;
    const sections = readSections().filter((item) => item !== clean);
    sections.unshift(clean);
    localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections.slice(0, 12)));
  }

  function demoKey(classCode, suffix) {
    return DEMO_PREFIX + classCode + "." + suffix;
  }

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function makeId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function demoUid(classCode, name, role) {
    return "demo-" + hashHex(classCode + "|" + role + "|" + normalizeName(name)).slice(0, 16);
  }

  function seedDemo(classCode) {
    if (localStorage.getItem(demoKey(classCode, "seeded"))) return;
    const names = [
      { name: "Teacher", role: "teacher" },
      { name: "Ava Chen", role: "student" },
      { name: "Jordan Lee", role: "student" },
      { name: "Maya Patel", role: "student" }
    ];
    const members = names.map((item) => ({
      uid: demoUid(classCode, item.name, item.role),
      name: item.name,
      nameLower: normalizeName(item.name),
      role: item.role
    }));
    const passwords = {};
    members.forEach((member) => {
      passwords[member.uid] = member.role === "teacher" ? "teacher123" : "student123";
    });
    const byName = (name) => members.find((member) => member.name === name);
    const teacher = byName("Teacher");
    const ava = byName("Ava Chen");
    const jordan = byName("Jordan Lee");
    const maya = byName("Maya Patel");
    const now = Date.now();
    const messages = [
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
        createdAt: now - 1000 * 60 * 60 * 26
      }
    ];
    writeJson(demoKey(classCode, "members"), members);
    writeJson(demoKey(classCode, "passwords"), passwords);
    writeJson(demoKey(classCode, "messages"), messages);
    writeJson(demoKey(classCode, "drafts.placeholder"), []);
    localStorage.setItem(demoKey(classCode, "seeded"), "1");
  }

  function createDemoBackend() {
    return {
      async signIn(input) {
        seedDemo(input.classCode);
        validatePassword(input.password);
        const uid = demoUid(input.classCode, input.name, input.role);
        const members = readJson(demoKey(input.classCode, "members"), []);
        const passwords = readJson(demoKey(input.classCode, "passwords"), {});
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
        const members = readJson(demoKey(input.classCode, "members"), []);
        if (members.some((item) => item.role === "student" && item.nameLower === lower)) {
          throw new Error("That student name is already used in this class.");
        }
        const uid = demoUid(input.classCode, name, "student");
        members.push({ uid, name, nameLower: lower, role: "student" });
        const passwords = readJson(demoKey(input.classCode, "passwords"), {});
        passwords[uid] = input.password;
        writeJson(demoKey(input.classCode, "members"), members);
        writeJson(demoKey(input.classCode, "passwords"), passwords);
      },
      async updateStudent(input) {
        const lower = normalizeName(input.name || "");
        const members = readJson(demoKey(input.classCode, "members"), []);
        const member = members.find((item) => item.uid === input.studentId);
        if (!member) throw new Error("That student is not in this class.");
        if (lower && members.some((item) => item.uid !== input.studentId && item.nameLower === lower)) {
          throw new Error("That name is already used in this class.");
        }
        if (lower) {
          member.name = input.name.trim().replace(/\s+/g, " ");
          member.nameLower = lower;
        }
        if (input.password) validatePassword(input.password);
        if (input.password) {
          const passwords = readJson(demoKey(input.classCode, "passwords"), {});
          passwords[input.studentId] = input.password;
          writeJson(demoKey(input.classCode, "passwords"), passwords);
        }
        writeJson(demoKey(input.classCode, "members"), members);
      },
      async resetStudentPassword(input) {
        await this.updateStudent({ classCode: input.classCode, studentId: input.studentId, name: "", password: input.password });
      },
      async verifySession() {
        return true;
      },
      async signOut() {},
      async getMembers(classCode) {
        return readJson(demoKey(classCode, "members"), []);
      },
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
            members: await this.getMembers(code),
            messages: await this.getMessages(code),
            settings: await this.getClassSettings(code).catch(() => ({ studentMessaging: true }))
          }))
        );
        return buildAdminOverview(sections, teacherUid);
      },
      async getMessages(classCode) {
        return readJson(demoKey(classCode, "messages"), []);
      },
      async getDrafts(classCode, uid) {
        return readJson(demoKey(classCode, "drafts." + uid), []);
      },
      async createMessage(classCode, message) {
        const messages = readJson(demoKey(classCode, "messages"), []);
        const row = Object.assign({}, message, { id: makeId("msg"), createdAt: Date.now() });
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
        const all = readJson(demoKey(classCode, "files"), {});
        rows.forEach((row) => {
          if (!all[row.message_id]) all[row.message_id] = [];
          all[row.message_id].push(row);
        });
        writeJson(demoKey(classCode, "files"), all);
      },
      async getMessageFiles(classCode, messageId) {
        const all = readJson(demoKey(classCode, "files"), {});
        return all[messageId] || [];
      },
      async fileUrl(_path) {
        return "#";
      },
      async getClassSettings(classCode) {
        const saved = readJson(demoKey(classCode, "settings"), {});
        return { studentMessaging: saved.studentMessaging !== false };
      },
      async setClassSettings(classCode, patch) {
        const settings = Object.assign({ studentMessaging: true }, readJson(demoKey(classCode, "settings"), {}), patch);
        writeJson(demoKey(classCode, "settings"), settings);
        return { studentMessaging: settings.studentMessaging !== false };
      },
      async createModerationAlert(payload) {
        const key = demoKey(payload.classCode, "moderation");
        const rows = readJson(key, []);
        rows.unshift(Object.assign({ id: makeId("mod"), createdAt: Date.now() }, payload));
        writeJson(key, rows.slice(0, 200));
      },
      async updateMessage(classCode, id, patch) {
        const messages = readJson(demoKey(classCode, "messages"), []);
        const index = messages.findIndex((item) => item.id === id);
        if (index >= 0) {
          messages[index] = Object.assign({}, messages[index], patch);
          writeJson(demoKey(classCode, "messages"), messages);
        }
      },
      async deleteMessage(classCode, id) {
        const messages = readJson(demoKey(classCode, "messages"), []);
        writeJson(
          demoKey(classCode, "messages"),
          messages.filter((item) => item.id !== id)
        );
      },
      async saveDraft(classCode, uid, draft) {
        const drafts = readJson(demoKey(classCode, "drafts." + uid), []);
        let row = draft.id ? drafts.find((item) => item.id === draft.id) : null;
        if (!row) {
          row = Object.assign({}, draft, { id: makeId("draft"), updatedAt: Date.now() });
          drafts.push(row);
        } else {
          Object.assign(row, draft, { updatedAt: Date.now() });
        }
        writeJson(demoKey(classCode, "drafts." + uid), drafts);
        return row;
      },
      async deleteDraft(classCode, uid, id) {
        const drafts = readJson(demoKey(classCode, "drafts." + uid), []);
        writeJson(
          demoKey(classCode, "drafts." + uid),
          drafts.filter((item) => item.id !== id)
        );
      }
    };
  }

  function mapMember(row) {
    return {
      uid: row.id,
      name: row.name,
      nameLower: row.name_lower,
      role: row.role
    };
  }

  function mapMessage(row) {
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
      flaggedAt: row.flagged_at ? toMs(row.flagged_at) : null,
      createdAt: toMs(row.created_at)
    };
  }

  function mapDraft(row) {
    return {
      id: row.id,
      to: row.recipient_text || "",
      subject: row.subject || "",
      body: row.body || "",
      attachments: row.attachments || []
    };
  }

  function buildAdminOverview(sections, teacherUid) {
    const rows = sections
      .map((section) => {
        const messages = section.messages || [];
        const students = (section.members || []).filter((member) => member.role === "student");
        const unread = messages.filter((message) => {
          return (
            message.toUids.indexOf(teacherUid) >= 0 &&
            message.readBy.indexOf(teacherUid) < 0 &&
            message.deletedBy.indexOf(teacherUid) < 0
          );
        }).length;
        const flagged = messages.filter((message) => message.moderationStatus === "flagged" && message.deletedBy.indexOf(teacherUid) < 0).length;
        return {
          code: section.code,
          students: students.length,
          studentNames: students.map((member) => member.name),
          messages: messages.length,
          unread,
          flagged,
          lastActivity: messages.reduce((max, message) => Math.max(max, toMs(message.createdAt)), 0),
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

  function createSupabaseBackend() {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase library did not load.");
    }
    const client = window.supabase.createClient(CONFIG.url, publicKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });

    function emailFor(classCode, name, role) {
      const authClass = role === "teacher" ? CONFIG.teacherHomeClassCode || classCode : classCode;
      const key = authClass + "|" + role + "|" + normalizeName(name);
      return "cm." + hashHex(key).slice(0, 16) + "@classroommail.school";
    }

    function classCodeVariants(code) {
      const original = String(code || "").trim();
      const lower = original.toLowerCase();
      const title = lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
      return Array.from(new Set([original, original.toUpperCase(), lower, title])).filter(Boolean);
    }

    function temporaryClient() {
      if (!tempClient) {
        tempClient = window.supabase.createClient(CONFIG.url, publicKey, {
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

    async function teacherExists(classCode) {
      const result = await client.rpc("teacher_exists", { code: classCode });
      if (result.error) throw result.error;
      return Boolean(result.data);
    }

    async function insertMember(profile) {
      const inserted = await client.from("members").insert({
        id: profile.uid,
        class_code: profile.classCode,
        name: profile.name,
        name_lower: normalizeName(profile.name),
        role: profile.role
      });
      if (inserted.error) throw inserted.error;
    }

    async function memberProfile(uid, fallback) {
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

    return {
      async signIn(input) {
        validatePassword(input.password);
        const email = emailFor(input.classCode, input.name, input.role);
        const variants = input.role === "teacher" ? [input.classCode] : classCodeVariants(input.classCode);
        let result = null;
        for (const variant of variants) {
          result = await client.auth.signInWithPassword({
            email: emailFor(variant, input.name, input.role),
            password: input.password
          });
          if (!result.error) break;
        }
        if (result.error) {
          if (input.role !== "teacher") {
            throw new Error("We could not open that account. Check your name and password, or ask your teacher for access.");
          }
          if (await teacherExists(input.classCode)) {
            throw new Error("A teacher account already exists. Check the name or password.");
          }
          const signup = await client.auth.signUp({
            email,
            password: input.password,
            options: {
              data: {
                class_code: input.classCode,
                display_name: input.name,
                role: "teacher"
              }
            }
          });
          if (signup.error) throw signup.error;
          if (!signup.data || !signup.data.session) {
            throw new Error("Email confirmation is on in Supabase. Turn it off in Auth settings, then try again.");
          }
          const teacher = {
            uid: signup.data.user.id,
            classCode: input.classCode,
            name: input.name,
            nameLower: normalizeName(input.name),
            role: "teacher"
          };
          await insertMember(teacher);
          return teacher;
        }
        const existing = await memberProfile(result.data.user.id);
        if (!existing || existing.role !== input.role) {
          throw new Error("That account is not set up for this class. Ask your teacher to check the roster.");
        }
        if (existing.role === "teacher") {
          const home = CONFIG.teacherHomeClassCode || input.classCode;
          const activeCode = input.classCode.toLowerCase() === String(home).toLowerCase() ? home : input.classCode;
          return Object.assign({}, existing, { classCode: activeCode });
        }
        return existing;
      },
      async createStudent(input) {
        validatePassword(input.password);
        const name = input.name.trim().replace(/\s+/g, " ");
        if (!name || name.length > 60) throw new Error("Enter a student name using 1–60 characters.");
        const members = await this.getMembers(input.classCode);
        if (members.some((item) => item.role === "student" && item.nameLower === normalizeName(name))) {
          throw new Error("That student name is already used in this class.");
        }
        const signup = await temporaryClient().auth.signUp({
          email: emailFor(input.classCode, name, "student"),
          password: input.password,
          options: {
            data: {
              class_code: input.classCode,
              display_name: name,
              role: "student"
            }
          }
        });
        if (signup.error) {
          if (/already registered|already exists|user already/i.test(signup.error.message)) {
            throw new Error("That student name is already registered. Ask them to sign in, or reset their password.");
          }
          throw signup.error;
        }
        if (!signup.data || !signup.data.user) {
          throw new Error("The student account could not be created.");
        }
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
        if (name && (name.length < 1 || name.length > 60)) {
          throw new Error("Enter a name using 1–60 characters.");
        }
        if (input.password) validatePassword(input.password);
        const body = { studentId: input.studentId, classCode: input.classCode };
        if (name) body.newName = name;
        if (input.password) body.newPassword = input.password;
      const response = await client.functions.invoke("set-user-password", { body });
      if (response.error) throw new Error(response.error.message || "The account could not be updated.");
      if (response.data && response.data.error) throw new Error(response.data.error);
      },
      async resetStudentPassword(input) {
        await this.updateStudent({ classCode: input.classCode, studentId: input.studentId, name: "", password: input.password });
      },
      async verifySession(profile) {
        const result = await client.auth.getSession();
        return Boolean(result.data && result.data.session && result.data.session.user.id === profile.uid);
      },
      async signOut() {
        await client.auth.signOut({ scope: "local" });
      },
      async getMembers(classCode) {
        const result = await client.from("members").select("*").eq("class_code", classCode);
        if (result.error) throw result.error;
        return (result.data || []).map(mapMember);
      },
      async getSections() {
        const result = await client.from("members").select("class_code");
        if (result.error) throw result.error;
        return Array.from(new Set((result.data || []).map((row) => row.class_code))).filter(Boolean);
      },
      async getAdminOverview(teacherUid) {
        const codes = await this.getSections();
        const sections = await Promise.all(
          codes.map(async (code) => ({
            code,
            members: await this.getMembers(code),
            messages: await this.getMessages(code),
            settings: await this.getClassSettings(code).catch(() => ({ studentMessaging: true }))
          }))
        );
        return buildAdminOverview(sections, teacherUid);
      },
      async getMessages(classCode) {
        const result = await client
          .from("messages")
          .select("*")
          .eq("class_code", classCode)
          .order("created_at", { ascending: false });
        if (result.error) throw result.error;
        return (result.data || []).map(mapMessage);
      },
      async getDrafts(classCode, uid) {
        const result = await client
          .from("drafts")
          .select("*")
          .eq("class_code", classCode)
          .eq("user_id", uid)
          .order("updated_at", { ascending: false });
        if (result.error) throw result.error;
        return (result.data || []).map(mapDraft);
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
        const { error } = await client.storage
          .from("class-files")
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false
          });
        if (error) throw error;
        return { name: file.name, path, size: file.size, type: file.type || "application/octet-stream" };
      },
      async createMessageFiles(classCode, rows) {
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
        return result.data || [];
      },
      async fileUrl(path) {
        const { data, error } = await client.storage
          .from("class-files")
          .createSignedUrl(path, 3600);
        if (error) throw error;
        return data.signedUrl;
      },
      async getClassSettings(classCode) {
        const result = await client
          .from("class_settings")
          .select("student_messaging")
          .eq("class_code", classCode)
          .maybeSingle();
        if (result.error) throw result.error;
        return { studentMessaging: result.data ? result.data.student_messaging !== false : true };
      },
      async setClassSettings(classCode, patch) {
        const result = await client
          .from("class_settings")
          .upsert({
            class_code: classCode,
            student_messaging: Boolean(patch.studentMessaging),
            updated_at: new Date().toISOString()
          }, { onConflict: "class_code" });
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
        const dbPatch = {};
        if ("readBy" in patch) dbPatch.read_by = patch.readBy;
        if ("starredBy" in patch) dbPatch.starred_by = patch.starredBy;
        if ("deletedBy" in patch) dbPatch.deleted_by = patch.deletedBy;
        if (!Object.keys(dbPatch).length) return;
        const result = await client
          .from("messages")
          .update(dbPatch)
          .eq("id", id)
          .eq("class_code", classCode);
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
        let result;
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
            .insert(Object.assign(payload, { class_code: classCode, user_id: uid }))
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

  function updateDemoBannerHeight() {
    if (!els.demoBanner.hidden) {
      document.body.style.setProperty("--demo-banner-height", els.demoBanner.offsetHeight + "px");
    }
  }

  function showDemoBanner() {
    els.demoBanner.hidden = false;
    document.body.classList.add("demo-banner-visible");
    updateDemoBannerHeight();
    requestAnimationFrame(updateDemoBannerHeight);
  }

  function hideDemoBanner() {
    els.demoBanner.hidden = true;
    document.body.classList.remove("demo-banner-visible");
  }

  function currentItems() {
    if (!state.profile || state.folder === "roster" || state.folder === "dashboard") return [];
    const me = state.profile.uid;
    let items = [];
    if (state.folder === "drafts") {
      items = state.drafts.map((draft) => Object.assign({}, draft, { kind: "draft" }));
    } else {
      items = state.messages
        .filter((message) => {
          const deleted = message.deletedBy.indexOf(me) >= 0;
          if (state.folder === "inbox") {
            return message.toUids.indexOf(me) >= 0 && !deleted;
          }
          if (state.folder === "sent") {
            return message.fromUid === me && !deleted;
          }
          if (state.folder === "starred") {
            return message.starredBy.indexOf(me) >= 0 && !deleted;
          }
          if (state.folder === "trash") {
            return deleted;
          }
          if (state.folder === "all") {
            return state.profile.role === "teacher";
          }
          if (state.folder === "flags") {
            return state.profile.role === "teacher" && message.moderationStatus === "flagged" && !deleted;
          }
          return false;
        })
        .map((message) => Object.assign({}, message, { kind: "message" }));
    }

    const query = state.query.trim().toLowerCase();
    if (query) {
      items = items.filter((item) => {
        const haystack = item.kind === "draft"
          ? [item.to, item.subject, item.body].join(" ").toLowerCase()
          : [item.fromName, (item.toNames || []).join(" "), item.subject, item.body].join(" ").toLowerCase();
        return haystack.indexOf(query) >= 0;
      });
    }

    if (state.folder !== "drafts" && state.filter === "unread") {
      items = items.filter((item) => {
        return item.toUids.indexOf(me) >= 0 && item.readBy.indexOf(me) < 0;
      });
    }

    return items.sort((a, b) => toMs(b.createdAt || b.updatedAt) - toMs(a.createdAt || a.updatedAt));
  }

  function unreadCount() {
    if (!state.profile) return 0;
    const me = state.profile.uid;
    return state.messages.filter((message) => {
      return (
        message.toUids.indexOf(me) >= 0 &&
        message.readBy.indexOf(me) < 0 &&
        message.deletedBy.indexOf(me) < 0
      );
    }).length;
  }

  function flaggedCount() {
    if (!state.profile || state.profile.role !== "teacher") return 0;
    return state.messages.filter((message) => message.moderationStatus === "flagged" && message.deletedBy.indexOf(state.profile.uid) < 0).length;
  }

  function resolveRecipients(text) {
    const parts = String(text || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.length) throw new Error("Add at least one classmate in the To field.");
    const resolved = [];
    const seen = {};
    const add = (member) => {
      if (!seen[member.uid]) {
        seen[member.uid] = true;
        resolved.push(member);
      }
    };
    parts.forEach((part) => {
      const key = normalizeName(part);
      if (key === "/all" || key === "all students" || key === "all") {
        if (state.profile.role !== "teacher") {
          throw new Error("Only the teacher can use /all to email all students.");
        }
        const students = state.members.filter((item) => item.role === "student");
        if (!students.length) throw new Error("There are no students in this section yet.");
        students.forEach(add);
        return;
      }
      const member = state.members.find((item) => item.nameLower === key);
      if (!member) {
        throw new Error('No one named "' + part + '" is in this class. Choose a name from the suggestions.');
      }
      if (state.profile.role === "student" && member.role === "student" && state.settings.studentMessaging === false) {
        throw new Error("Your teacher has turned off student-to-student mail. You can still email your teacher.");
      }
      add(member);
    });
    return resolved;
  }

  function renderSidebar() {
    if (!state.profile) return;
    const me = state.profile.uid;
    els.userAvatar.textContent = initials(state.profile.name);
    els.userName.textContent = state.profile.name;
    els.userEmail.textContent = displayEmail(state.profile.name);
    els.userMeta.textContent = state.profile.classCode + " • " + state.profile.role;
    els.topbarUser.textContent = initials(state.profile.name);

    const isTeacher = state.profile.role === "teacher";
    els.appShell.classList.toggle("teacher-shell", isTeacher);
    els.sectionSwitcher.hidden = !isTeacher;
    if (isTeacher) {
      rememberSection(state.profile.classCode);
      if (document.activeElement !== els.sectionInput) {
        els.sectionInput.value = state.profile.classCode;
      }
      const overviewCodes = state.adminOverview ? state.adminOverview.sections.map((section) => section.code) : [];
      const sections = Array.from(new Set([state.profile.classCode].concat(state.knownSections, overviewCodes))).filter(Boolean);
      els.sectionOptions.innerHTML = sections
        .map((code) => '<option value="' + escapeHtml(code) + '"></option>')
        .join("");
      els.sectionChips.innerHTML = sections
        .slice(0, 8)
        .map((code) => {
          const active = code === state.profile.classCode;
          return (
            '<button type="button" class="section-chip' + (active ? " active" : "") + '" data-section="' + escapeHtml(code) + '" title="Switch to ' + escapeHtml(code) + '">' +
              escapeHtml(code) +
            "</button>"
          );
        })
        .join("");
    }

    els.folders.querySelectorAll("[data-folder]").forEach((button) => {
      const folder = button.getAttribute("data-folder");
      const active = folder === state.folder;
      button.classList.toggle("active", active);
      button.title = FOLDER_LABELS[folder] || folder;
      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    els.classmateLabel.textContent = isTeacher ? "Students" : "Classmates";
    const classmateButton = els.folders.querySelector('[data-folder="classmates"]');
    if (classmateButton) classmateButton.title = isTeacher ? "Students" : "Classmates";

    const teacherFolders = els.folders.querySelectorAll(".teacher-only");
    teacherFolders.forEach((button) => {
      button.hidden = state.profile.role !== "teacher";
    });

    const unread = unreadCount();
    els.unreadBadge.textContent = String(unread);
    els.unreadBadge.hidden = unread === 0;
    els.draftBadge.textContent = String(state.drafts.length);
    els.draftBadge.hidden = state.drafts.length === 0;
    const flagged = flaggedCount();
    if (els.flagBadge) {
      els.flagBadge.textContent = String(flagged);
      els.flagBadge.hidden = flagged === 0;
    }

    els.teacherBlock.hidden = isTeacher;
    const others = state.members.filter((member) => member.uid !== me);
    const teachers = others
      .filter((member) => member.role === "teacher")
      .sort((a, b) => a.nameLower.localeCompare(b.nameLower));
    const classmates = state.members
      .filter((member) => member.role === "student" && (isTeacher || member.uid !== me))
      .sort((a, b) => a.nameLower.localeCompare(b.nameLower));
    els.classmateBadge.textContent = String(classmates.length);
    els.classmateBadge.hidden = classmates.length === 0;
    els.classSettings.hidden = !isTeacher;
    if (isTeacher) {
      els.studentMessagingToggle.checked = state.settings.studentMessaging !== false;
    } else {
      const classmatesButton = els.folders.querySelector('[data-folder="classmates"]');
      if (classmatesButton) classmatesButton.hidden = state.settings.studentMessaging === false;
      renderContactGroup(els.teacherList, teachers, "No teacher yet.");
    }
    renderSuggestions();
  }

  function renderContactGroup(container, members, emptyText) {
    if (!members.length) {
      container.innerHTML = '<p class="contacts-empty">' + escapeHtml(emptyText) + "</p>";
      return;
    }
    container.innerHTML = members
      .map((member) => {
        return (
          '<button type="button" class="contact" data-contact="' + escapeHtml(member.name) + '">' +
            '<span class="avatar' + (member.role === "teacher" ? " teacher" : "") + '">' + escapeHtml(initials(member.name)) + "</span>" +
            '<span class="contact-copy"><span class="contact-name">' + escapeHtml(member.name) + "</span>" +
              '<span class="contact-email">' + escapeHtml(displayEmail(member.name)) + "</span></span>" +
            '<span class="contact-role">' + escapeHtml(member.role) + "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function recipientMatchRank(member, query) {
    const name = normalizeName(member.name);
    const email = normalizeName(displayEmail(member.name));
    const local = email.split("@")[0];
    if (name.startsWith(query)) return 0;
    if (name.split(" ").some((part) => part.startsWith(query))) return 1;
    if (local.startsWith(query)) return 2;
    if (email.startsWith(query)) return 3;
    return -1;
  }

  function renderSuggestions() {
    if (!state.profile || !compose.open) {
      els.recipientSuggestions.innerHTML = "";
      return;
    }
    const parts = compose.to.split(",");
    const query = normalizeName(parts[parts.length - 1]);
    if (!query) {
      els.recipientSuggestions.innerHTML = "";
      return;
    }
    const contacts = state.members
      .filter((member) => member.uid !== state.profile.uid)
      .filter((member) => state.profile.role === "teacher" || member.role !== "student" || state.settings.studentMessaging !== false)
      .map((member) => ({ member, rank: recipientMatchRank(member, query) }))
      .filter((item) => item.rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.member.nameLower.localeCompare(b.member.nameLower))
      .slice(0, 6)
      .map((item) => item.member);
    let html = "";
    const isTeacher = state.profile.role === "teacher";
    if (isTeacher && "email all students".startsWith(query)) {
      const count = state.members.filter((member) => member.role === "student").length;
      html +=
        '<button type="button" class="suggestion suggestion-all" data-suggest="All students" title="Send one message to every student in this section">' +
          "Email all students (" + count + ")" +
        "</button>";
    }
    if (isTeacher && ("/all".startsWith(query) || query === "all")) {
      html +=
        '<button type="button" class="suggestion suggestion-all" data-suggest="/all" title="Send one message to every student in this section">' +
          "/all" +
        "</button>";
    }
    html += contacts
      .map((member) => {
        return (
          '<button type="button" class="suggestion" data-suggest="' + escapeHtml(member.name) + '" title="' + escapeHtml(displayEmail(member.name) + " · " + member.role) + '">' +
            escapeHtml(member.name) +
          "</button>"
        );
      })
      .join("");
    if (!html) html = '<span class="suggestion suggestion-empty">No matching person</span>';
    els.recipientSuggestions.innerHTML = html;
  }

  function skeletonList() {
    let html = "";
    for (let i = 0; i < 5; i += 1) {
      html +=
        '<div class="skeleton-row">' +
          '<div class="skeleton-line skeleton-avatar"></div>' +
          '<div class="skeleton-lines">' +
            '<div class="skeleton-line"></div>' +
            '<div class="skeleton-line short"></div>' +
          "</div>" +
        "</div>";
    }
    return html;
  }

  function emptyCopy() {
    if (state.query) {
      return {
        title: "No matches",
        body: "Nothing in " + FOLDER_LABELS[state.folder] + ' matches "' + state.query + '".'
      };
    }
    if (state.filter === "unread" && state.folder === "inbox") {
      return { title: "All caught up", body: "You have no unread messages in your inbox." };
    }
    const copy = {
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

  function currentClassmates() {
    const isTeacher = state.profile && state.profile.role === "teacher";
    const query = state.query.trim().toLowerCase();
    return state.members
      .filter((member) => member.role === "student" && (isTeacher || member.uid !== state.profile.uid))
      .filter((member) => isTeacher || state.settings.studentMessaging !== false)
      .filter((member) => !query || member.nameLower.includes(query) || displayEmail(member.name).includes(query))
      .sort((a, b) => a.nameLower.localeCompare(b.nameLower));
  }

  function renderClassmatesList() {
    const students = currentClassmates();
    if (!students.some((student) => student.uid === state.selectedClassmateId)) {
      state.selectedClassmateId = students.length ? students[0].uid : null;
    }
    const isTeacher = state.profile && state.profile.role === "teacher";
    const personNoun = isTeacher ? "student" : "classmate";
    els.folderTitle.textContent = isTeacher ? "Students" : "Classmates";
    els.folderCount.textContent = students.length + " " + personNoun + (students.length === 1 ? "" : "s");
    els.filterChips.hidden = true;
    if (!students.length) {
      els.messageList.innerHTML =
        '<div class="empty-state">' +
          '<span class="empty-icon"><svg class="icon" aria-hidden="true"><use href="#i-users"></use></svg></span>' +
          "<strong>" + (state.query ? "No " + personNoun + "s found" : "No " + personNoun + "s yet") + "</strong>" +
          "<p>" + (state.query ? "Try a different name or email." : "Students in this section will appear here.") + "</p>" +
        "</div>";
      return;
    }
    els.messageList.innerHTML = students
      .map((student) => {
        const active = student.uid === state.selectedClassmateId;
        return (
          '<button type="button" class="roster-row' + (active ? " active" : "") + '" data-action="select-classmate" data-id="' + escapeHtml(student.uid) + '">' +
            '<span class="avatar">' + escapeHtml(initials(student.name)) + "</span>" +
            '<span class="roster-copy"><strong>' + escapeHtml(student.name) + "</strong><small>" + escapeHtml(displayEmail(student.name)) + "</small></span>" +
          "</button>"
        );
      })
      .join("");
  }

  function renderClassmatesDetail() {
    const student = currentClassmates().find((item) => item.uid === state.selectedClassmateId);
    if (!student) {
      els.detailContent.innerHTML =
        '<div class="empty-state detail-empty">' +
          '<span class="empty-icon"><svg class="icon" aria-hidden="true"><use href="#i-users"></use></svg></span>' +
          "<strong>Choose a classmate</strong>" +
          "<p>Select someone from the list to see their details.</p>" +
        "</div>";
      return;
    }
    els.detailContent.innerHTML =
      '<div class="detail-toolbar"><span class="toolbar-title">Classmate</span></div>' +
      '<div class="detail-wrap">' +
        '<div class="classmate-card">' +
          '<span class="avatar large">' + escapeHtml(initials(student.name)) + "</span>" +
          "<h1>" + escapeHtml(student.name) + "</h1>" +
          '<p class="classmate-email">' + escapeHtml(displayEmail(student.name)) + "</p>" +
          '<p class="classmate-meta">' + escapeHtml(state.profile.classCode) + " • student</p>" +
          '<button class="btn primary" type="button" data-action="email-classmate" data-name="' + escapeHtml(student.name) + '">Email ' + escapeHtml(student.name.split(" ")[0]) + "</button>" +
        "</div>" +
      "</div>";
  }

  function renderRosterList() {
    const students = state.members
      .filter((member) => member.role === "student")
      .sort((a, b) => a.nameLower.localeCompare(b.nameLower));
    if (!state.selectedStudentId && students.length) {
      state.selectedStudentId = students[0].uid;
    }
    els.folderTitle.textContent = "Class roster";
    els.folderCount.textContent = students.length + " student" + (students.length === 1 ? "" : "s");
    els.filterChips.hidden = true;
    if (!students.length) {
      els.messageList.innerHTML =
        '<div class="empty-state">' +
          '<span class="empty-icon"><svg class="icon" aria-hidden="true"><use href="#i-users"></use></svg></span>' +
          "<strong>No students yet</strong>" +
          "<p>Add a student from the roster panel to create their account.</p>" +
        "</div>";
      return;
    }
    els.messageList.innerHTML = students
      .map((student) => {
        const active = student.uid === state.selectedStudentId;
        return (
          '<button type="button" class="roster-row' + (active ? " active" : "") + '" data-action="select-student" data-id="' + escapeHtml(student.uid) + '">' +
            '<span class="avatar">' + escapeHtml(initials(student.name)) + "</span>" +
            '<span class="roster-copy"><strong>' + escapeHtml(student.name) + "</strong><small>" + escapeHtml(displayEmail(student.name)) + "</small></span>" +
          "</button>"
        );
      })
      .join("");
  }

  function renderAdminList() {
    const overview = state.adminOverview;
    els.folderTitle.textContent = "All sections";
    els.filterChips.hidden = true;
    if (!overview) {
      els.folderCount.textContent = state.loading ? "Loading…" : "";
      els.messageList.innerHTML = state.loading
        ? skeletonList()
        : '<div class="empty-state">' +
            '<span class="empty-icon"><svg class="icon" aria-hidden="true"><use href="#i-grid"></use></svg></span>' +
            "<strong>No sections yet</strong>" +
            "<p>Sections appear here once students are added.</p>" +
          "</div>";
      return;
    }
    const total = overview.totals;
    els.folderCount.textContent = total.sections + " section" + (total.sections === 1 ? "" : "s");
    const summary =
      '<div class="admin-summary">' +
        '<span><strong>' + total.sections + "</strong><small>sections</small></span>" +
        '<span><strong>' + total.students + "</strong><small>students</small></span>" +
        '<span><strong>' + total.messages + "</strong><small>messages</small></span>" +
        '<span><strong>' + total.unread + "</strong><small>unread to you</small></span>" +
      "</div>";
    const rows = overview.sections
      .map((section) => {
        const active = section.code === state.selectedAdminSection;
        const flags =
          (section.unread ? '<span class="admin-pill" title="Unread messages to you">' + section.unread + " new</span>" : "") +
          (section.flagged ? '<span class="admin-pill danger" title="Flagged messages">' + section.flagged + " flagged</span>" : "") +
          (section.studentMessaging ? "" : '<span class="admin-pill muted" title="Student-to-student mail is off">S2S off</span>');
        return (
          '<button type="button" class="admin-section-row' + (active ? " active" : "") + '" data-action="select-admin-section" data-code="' + escapeHtml(section.code) + '">' +
            '<span class="admin-section-main">' +
              '<strong>' + escapeHtml(section.code) + "</strong>" +
              '<small>' + section.students + " students · " + section.messages + " messages" +
                (section.lastActivity ? " · " + escapeHtml(formatDate(section.lastActivity)) : "") + "</small>" +
            "</span>" +
            (flags ? '<span class="admin-section-flags">' + flags + "</span>" : "") +
            '<svg class="icon admin-section-arrow" aria-hidden="true"><use href="#i-arrow-right"></use></svg>' +
          "</button>"
        );
      })
      .join("");
    els.messageList.innerHTML = summary + rows;
  }

  function renderAdminDetail() {
    const overview = state.adminOverview;
    const section = overview && overview.sections.find((item) => item.code === state.selectedAdminSection);
    if (!section) {
      state.messageFiles = [];
      els.detailContent.innerHTML =
        '<div class="empty-state">' +
          '<span class="empty-icon"><svg class="icon" aria-hidden="true"><use href="#i-grid"></use></svg></span>' +
          "<strong>Select a section</strong>" +
          "<p>Choose a section to see its students, messages, and settings.</p>" +
        "</div>";
      return;
    }
    const roster = section.studentNames.length
      ? section.studentNames.map((name) => '<span class="admin-name-chip">' + escapeHtml(name) + "</span>").join("")
      : '<p class="admin-muted">No students yet.</p>';
    const recent = section.recentMessages.length
      ? section.recentMessages
          .map((message) => {
            return (
              '<button type="button" class="admin-recent-row" data-action="admin-open-message" data-code="' + escapeHtml(section.code) + '" data-id="' + escapeHtml(message.id) + '">' +
                '<span class="admin-recent-copy"><strong>' + escapeHtml(message.subject) + "</strong><small>From " + escapeHtml(message.fromName) + " · To " + escapeHtml((message.toNames || []).join(", ") || "class") + "</small></span>" +
                "<time>" + escapeHtml(formatDate(message.createdAt)) + "</time>" +
              "</button>"
            );
          })
          .join("")
      : '<p class="admin-muted">No messages yet.</p>';
    els.detailContent.innerHTML =
      '<div class="admin-detail">' +
        '<div class="admin-detail-head">' +
          '<span class="admin-eyebrow">Section overview</span>' +
          "<h1>" + escapeHtml(section.code) + "</h1>" +
          "<p>Everything in this section, without leaving the dashboard.</p>" +
        "</div>" +
        '<div class="admin-stat-grid">' +
          '<span><strong>' + section.students + "</strong><small>students</small></span>" +
          '<span><strong>' + section.messages + "</strong><small>messages</small></span>" +
          '<span><strong>' + section.unread + "</strong><small>unread to you</small></span>" +
          '<span><strong>' + section.flagged + "</strong><small>flagged</small></span>" +
        "</div>" +
        '<div class="admin-actions">' +
          '<button type="button" class="btn primary" data-action="admin-open-section" data-code="' + escapeHtml(section.code) + '">Open section</button>' +
          '<button type="button" class="btn ghost" data-action="admin-email-all" data-code="' + escapeHtml(section.code) + '">Email all students</button>' +
        "</div>" +
        '<section class="admin-panel">' +
          "<h2>Student-to-student mail</h2>" +
          '<label class="admin-setting-row">' +
            '<input type="checkbox" class="switch-input" data-action="admin-toggle-messaging" data-code="' + escapeHtml(section.code) + '"' + (section.studentMessaging ? " checked" : "") + ">" +
            '<span class="switch" aria-hidden="true"></span>' +
            '<span class="admin-setting-copy"><strong>Allow students to email classmates</strong><small>Off means students can only email you.</small></span>' +
          "</label>" +
        "</section>" +
        '<section class="admin-panel">' +
          "<h2>Students</h2>" +
          '<div class="admin-chip-list">' + roster + "</div>" +
        "</section>" +
        '<section class="admin-panel">' +
          "<h2>Recent messages</h2>" +
          '<div class="admin-recent-list">' + recent + "</div>" +
        "</section>" +
      "</div>";
  }

  function renderList() {
    if (state.folder === "dashboard") {
      renderAdminList();
      return;
    }
    if (state.folder === "classmates") {
      renderClassmatesList();
      return;
    }
    if (state.folder === "roster") {
      renderRosterList();
      return;
    }
    const items = currentItems();
    els.folderTitle.textContent = FOLDER_LABELS[state.folder] || "Mail";
    const noun = state.folder === "drafts" ? "draft" : "message";
    els.folderCount.textContent = items.length + " " + noun + (items.length === 1 ? "" : "s");
    els.filterChips.hidden = state.folder === "drafts" || state.folder === "trash" || state.folder === "starred" || state.folder === "sent";
    els.filterChips.querySelectorAll("[data-filter]").forEach((chip) => {
      chip.classList.toggle("active", chip.getAttribute("data-filter") === state.filter);
    });

    if (state.loading && !state.messages.length && !state.drafts.length) {
      els.messageList.innerHTML = skeletonList();
      return;
    }

    if (!items.length) {
      const copy = emptyCopy();
      els.messageList.innerHTML =
        '<div class="empty-state">' +
          '<span class="empty-icon"><svg class="icon" aria-hidden="true"><use href="#i-' +
            (state.folder === "trash" ? "trash" : state.folder === "sent" ? "send" : state.folder === "drafts" ? "file" : "inbox") +
          '"></use></svg></span>' +
          "<strong>" + escapeHtml(copy.title) + "</strong>" +
          "<p>" + escapeHtml(copy.body) + "</p>" +
        "</div>";
      return;
    }

    const me = state.profile.uid;
    els.messageList.innerHTML = items
      .map((item) => {
        const selected = item.id === state.openId && item.kind === state.openKind;
        const unread = item.kind === "message" && item.toUids.indexOf(me) >= 0 && item.readBy.indexOf(me) < 0;
        const starred = item.kind === "message" && item.starredBy.indexOf(me) >= 0;
        const avatarName = item.kind === "draft" ? "Draft" : item.fromName;
        const lineOne = item.kind === "draft" ? "Draft" :
          (state.folder === "sent" || (state.folder === "all" && item.fromUid === me))
            ? "To: " + (item.toNames || []).join(", ")
            : item.fromName;
        const flagged = item.kind === "message" && item.moderationStatus === "flagged";
        const subject = item.subject || "(no subject)";
        const bodyText = item.body || "";
        const date = toMs(item.createdAt || item.updatedAt);
        return (
          '<div class="message-row' + (unread ? " is-unread" : "") + (selected ? " is-open" : "") + '" role="listitem">' +
            (item.kind === "draft"
              ? '<span class="star-btn" aria-hidden="true"><svg class="icon icon-sm"><use href="#i-file"></use></svg></span>'
              : '<button type="button" class="star-btn' + (starred ? " active" : "") + '" data-action="star" data-id="' + escapeHtml(item.id) + '" aria-label="' + (starred ? "Remove star" : "Star message") + '"><svg class="icon icon-sm" aria-hidden="true"><use href="#i-star"></use></svg></button>') +
            '<button type="button" class="row-main" data-action="open" data-kind="' + item.kind + '" data-id="' + escapeHtml(item.id) + '">' +
              '<span class="avatar' + (item.fromRole === "teacher" ? " teacher" : "") + '">' + escapeHtml(initials(avatarName)) + "</span>" +
              '<span class="row-body">' +
                '<span class="row-top"><strong>' + escapeHtml(lineOne) + "</strong><time>" + escapeHtml(formatDate(date)) + "</time></span>" +
                '<span class="row-subject">' + (item.kind === "draft" ? '<span class="draft-tag">DRAFT</span>' : "") + (flagged ? '<span class="flag-tag">FLAGGED</span>' : "") + escapeHtml(subject) + "</span>" +
                '<span class="row-snippet">' + escapeHtml(createSnippet(bodyText, 92)) + "</span>" +
              "</span>" +
               (unread ? '<span class="unread-flag" title="New message" aria-label="New message">!</span>' : "") +

            "</button>" +
          "</div>"
        );
      })
      .join("");
  }

  function detailToolbar(item) {
    if (item.kind === "draft") {
      return (
        '<div class="detail-toolbar">' +
          '<button type="button" class="icon-btn detail-back" data-action="back" aria-label="Back to list"><svg class="icon" aria-hidden="true"><use href="#i-back"></use></svg></button>' +
          '<button type="button" class="btn ghost" data-action="edit-draft" data-id="' + escapeHtml(item.id) + '">Edit draft</button>' +
          '<button type="button" class="icon-btn danger" data-action="delete-draft" data-id="' + escapeHtml(item.id) + '" title="Delete draft" aria-label="Delete draft"><svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg></button>' +
        "</div>"
      );
    }
    const me = state.profile.uid;
    const inTrash = item.deletedBy.indexOf(me) >= 0;
    const starred = item.starredBy.indexOf(me) >= 0;
    return (
      '<div class="detail-toolbar">' +
        '<button type="button" class="icon-btn detail-back" data-action="back" aria-label="Back to list"><svg class="icon" aria-hidden="true"><use href="#i-back"></use></svg></button>' +
        '<button type="button" class="icon-btn' + (starred ? " active" : "") + '" data-action="star" data-id="' + escapeHtml(item.id) + '" title="' + (starred ? "Remove star" : "Star message") + '" aria-label="' + (starred ? "Remove star" : "Star message") + '"><svg class="icon"' + (starred ? ' style="fill:currentColor;color:var(--amber)"' : "") + ' aria-hidden="true"><use href="#i-star"></use></svg></button>' +
        (inTrash
          ? '<button type="button" class="icon-btn" data-action="restore" data-id="' + escapeHtml(item.id) + '" title="Move to inbox" aria-label="Move to inbox"><svg class="icon" aria-hidden="true"><use href="#i-archive"></use></svg></button>' +
            '<button type="button" class="icon-btn danger" data-action="destroy" data-id="' + escapeHtml(item.id) + '" title="Delete forever" aria-label="Delete forever"><svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg></button>'
          : '<button type="button" class="icon-btn" data-action="trash" data-id="' + escapeHtml(item.id) + '" title="Delete" aria-label="Delete"><svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg></button>') +
        '<button type="button" class="icon-btn" data-action="unread" data-id="' + escapeHtml(item.id) + '" title="Mark unread" aria-label="Mark unread"><svg class="icon" aria-hidden="true"><use href="#i-envelope"></use></svg></button>' +
        '<span class="divider"></span>' +
        '<button type="button" class="icon-btn" data-action="reply" data-id="' + escapeHtml(item.id) + '" title="Reply" aria-label="Reply"><svg class="icon" aria-hidden="true"><use href="#i-reply"></use></svg></button>' +
      "</div>"
    );
  }

  function renderRosterDetail() {
    const student = state.members.find((item) => item.uid === state.selectedStudentId && item.role === "student");
    els.detailContent.innerHTML =
      '<div class="detail-toolbar"><span class="toolbar-title">Manage student accounts</span></div>' +
      '<div class="detail-wrap">' +
        "<h1>Class roster</h1>" +
        '<p class="roster-intro">Create accounts for your students and change their name or password here any time.</p>' +
        '<form id="addStudentForm" class="roster-form">' +
          "<h2>Add a student</h2>" +
          '<div class="roster-fields">' +
            '<label>Name<input id="newStudentName" type="text" maxlength="60" placeholder="e.g. Ava Chen" required></label>' +
            '<label>Password<input id="newStudentPassword" type="text" minlength="6" maxlength="72" placeholder="At least 6 characters" required></label>' +
          "</div>" +
          '<p class="roster-hint">Passwords appear in plain text here so you can share them with students.</p>' +
          '<button class="btn primary" type="submit">Create account</button>' +
        "</form>" +
        (student
          ? '<form id="editStudentForm" class="roster-form">' +
              "<h2>Edit account</h2>" +
              '<p class="roster-hint">Change the name or password for <strong>' + escapeHtml(student.name) + "</strong>. Leave password blank to keep the current one.</p>" +
              '<div class="roster-fields">' +
                '<label>Name<input id="editStudentName" type="text" maxlength="60" value="' + escapeHtml(student.name) + '" required></label>' +
                '<label>New password<input id="editStudentPassword" type="text" minlength="6" maxlength="72" placeholder="Leave blank to keep current"></label>' +
              "</div>" +
              '<div class="roster-actions">' +
                '<button class="btn primary" type="submit">Save changes</button>' +
                '<button class="btn ghost" type="button" data-action="copy-password" data-name="' + escapeHtml(student.name) + '">Copy name</button>' +
              "</div>" +
            "</form>"
          : '<div class="empty-state"><strong>Select a student</strong><p>Choose a student on the left to edit their account.</p></div>') +
      "</div>";
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_FILE_TYPES = [
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "application/pdf", "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ];

  function formatFileSize(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) return size + " B";
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
    return (size / (1024 * 1024)).toFixed(1) + " MB";
  }

  function fileKind(file) {
    const type = String(file && (file.type || file.mime_type) || "").toLowerCase();
    const name = String(file && (file.name || file.file_name) || "").toLowerCase();
    if (type.indexOf("image/") === 0 || /\.(png|jpe?g|gif|webp)$/i.test(name)) return "image";
    if (type === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
    if (type === "text/plain" || /\.txt$/i.test(name)) return "text";
    if (/word|docx?/i.test(type + " " + name)) return "word";
    if (/excel|spreadsheet|xlsx?/i.test(type + " " + name)) return "sheet";
    return "file";
  }

  function fileExt(file) {
    const name = String(file && (file.name || file.file_name) || "");
    const dot = name.lastIndexOf(".");
    return dot > -1 ? name.slice(dot + 1).toUpperCase().slice(0, 4) : "FILE";
  }

  function fileTileHtml(file, imageSrc) {
    const kind = fileKind(file);
    if (kind === "image" && imageSrc) {
      return '<span class="file-tile is-image"><img class="file-tile-img" src="' + escapeHtml(imageSrc) + '" alt=""></span>';
    }
    return '<span class="file-tile is-' + kind + '"><span class="file-tile-sheet"></span><span class="file-tile-ext">' + escapeHtml(fileExt(file)) + "</span></span>";
  }

  function makeImageThumb(file) {
    if (!/^image\//i.test(file.type || "")) return Promise.resolve(null);
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        const max = 180;
        const scale = Math.min(max / img.width, max / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        try {
          resolve(canvas.toDataURL("image/jpeg", 0.72));
        } catch (error) {
          resolve(null);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  function readTextPreview(file) {
    if (fileKind(file) !== "text" || typeof file.text !== "function") return Promise.resolve(null);
    return file.slice(0, 4096).text().then((text) => String(text || "").trim().slice(0, 180)).catch(() => null);
  }

  function openLightbox(name, size, url) {
    if (!els.fileLightbox || !url || url === "#") return;
    els.lightboxImage.src = url;
    els.lightboxImage.alt = name;
    els.lightboxName.textContent = name;
    els.lightboxMeta.textContent = formatFileSize(size);
    els.lightboxDownload.href = url;
    els.lightboxDownload.setAttribute("download", name);
    els.fileLightbox.hidden = false;
    els.lightboxClose.focus();
  }

  function closeLightbox() {
    if (!els.fileLightbox || els.fileLightbox.hidden) return;
    els.fileLightbox.hidden = true;
    els.lightboxImage.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  }

  function renderMessageFiles() {
    const container = $("messageFiles");
    if (!container) return;
    const files = state.messageFiles || [];
    state.fileUrls = {};
    if (!files.length) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML =
      '<div class="message-files-title">Attachments <span class="file-count">' + files.length + "</span></div>" +
      '<div class="message-file-grid">' +
        files.map((file, index) => {
          const preview = file.preview
            ? '<span class="message-file-preview">' + escapeHtml(file.preview) + "</span>"
            : "";
          return '<button type="button" class="message-file-card" data-file-index="' + index + '" aria-label="Preview ' + escapeHtml(file.file_name) + '">' +
            fileTileHtml(file, file.thumb) +
            '<span class="message-file-copy">' +
              '<strong class="message-file-name" title="' + escapeHtml(file.file_name) + '">' + escapeHtml(file.file_name) + "</strong>" +
              '<span class="message-file-meta">' + escapeHtml(fileExt(file)) + " · " + escapeHtml(formatFileSize(file.size_bytes)) + "</span>" +
              preview +
            "</span>" +
            '<span class="message-file-open" aria-hidden="true"><svg class="icon icon-sm"><use href="#i-arrow-right"></use></svg></span>' +
          "</button>";
        }).join("") +
      "</div>";
    files.forEach((file, index) => {
      const card = container.querySelector('[data-file-index="' + index + '"]');
      if (!card) return;
      const kind = fileKind(file);
      backend.fileUrl(file.storage_path).then((url) => {
        if (url && url !== "#") state.fileUrls[index] = url;
        if (kind === "image") {
          const urlToUse = url && url !== "#" ? url : file.thumb;
          if (!urlToUse) return;
          const img = document.createElement("img");
          img.className = "file-tile-img";
          img.alt = "";
          img.src = urlToUse;
          const tile = card.querySelector(".file-tile");
          if (tile) tile.replaceWith(img);
        } else if (kind === "text" && !file.preview && url && url !== "#") {
          fetch(url).then((response) => response.text()).then((text) => {
            const copy = card.querySelector(".message-file-copy");
            if (!copy || !text) return;
            const node = document.createElement("span");
            node.className = "message-file-preview";
            node.textContent = String(text).trim().slice(0, 180);
            copy.appendChild(node);
          }).catch(() => {});
        }
      }).catch(() => {});
    });
  }

  function handleMessageFileClick(event) {
    const card = event.target.closest("[data-file-index]");
    if (!card) return;
    const index = Number(card.getAttribute("data-file-index"));
    const file = state.messageFiles[index];
    if (!file) return;
    const url = state.fileUrls[index] || file.thumb;
    if (fileKind(file) === "image" && url) {
      openLightbox(file.file_name, file.size_bytes, url);
      return;
    }
    if (url && url !== "#") {
      const link = document.createElement("a");
      link.href = url;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      showToast("Download is unavailable in demo mode.", "error");
    }
  }

  async function loadMessageFiles(messageId) {
    state.messageFiles = [];
    if (!messageId || !state.profile) {
      renderMessageFiles();
      return;
    }
    try {
      const files = await backend.getMessageFiles(state.profile.classCode, messageId);
      if (state.openId !== messageId || state.openKind !== "message") return;
      state.messageFiles = files;
      renderMessageFiles();
    } catch (error) {
      showToast(friendlyError(error), "error");
    }
  }

  function renderDetail() {
    if (state.folder === "dashboard") {
      renderAdminDetail();
      return;
    }
    if (state.folder === "classmates") {
      renderClassmatesDetail();
      return;
    }
    if (state.folder === "roster") {
      renderRosterDetail();
      return;
    }
    const items = currentItems();
    const item = items.find((entry) => entry.id === state.openId && entry.kind === state.openKind);
    if (!item) {
      state.messageFiles = [];
      els.detailContent.innerHTML =
        '<div class="empty-state">' +
          '<span class="empty-icon"><svg class="icon" aria-hidden="true"><use href="#i-envelope"></use></svg></span>' +
          "<strong>Select a message</strong>" +
          "<p>Choose a message from the list to read it here.</p>" +
        "</div>";
      return;
    }

    if (item.kind === "draft") {
      state.messageFiles = [];
      els.detailContent.innerHTML =
        detailToolbar(item) +
        '<div class="detail-wrap">' +
          "<h1>" + escapeHtml(item.subject || "(no subject)") + "</h1>" +
          '<div class="message-meta">' +
            '<span class="avatar">' + escapeHtml(initials("Draft")) + "</span>" +
            '<span class="meta-copy"><strong>Unsaved draft</strong><span>To ' + escapeHtml(item.to || "no recipient yet") + "</span></span>" +
            '<span class="meta-date">' + escapeHtml(formatDate(item.updatedAt)) + "</span>" +
          "</div>" +
          '<div class="message-body">' + linkify(item.body || "No message text yet.") + "</div>" +
          '<div class="draft-detail-actions">' +
            '<button type="button" class="btn primary" data-action="edit-draft" data-id="' + escapeHtml(item.id) + '">Continue editing</button>' +
            '<button type="button" class="btn ghost" data-action="delete-draft" data-id="' + escapeHtml(item.id) + '">Delete draft</button>' +
          "</div>" +
        "</div>";
      return;
    }

    const from = item.fromName || "Unknown";
    const to = (item.toNames || []).join(", ") || "class";
    els.detailContent.innerHTML =
      detailToolbar(item) +
      '<div class="detail-wrap">' +
        "<h1>" + escapeHtml(item.subject || "(no subject)") + "</h1>" +
        (state.profile.role === "teacher" && state.folder === "all"
          ? '<div class="oversight-note"><svg class="icon" aria-hidden="true"><use href="#i-layers"></use></svg>Teacher view: you can review every message in this class.</div>'
          : "") +
        (item.moderationStatus === "flagged" && (state.profile.role === "teacher" || item.fromUid === state.profile.uid)
          ? '<div class="moderation-note"><svg class="icon" aria-hidden="true"><use href="#i-alert"></use></svg><span><strong>Flagged for review.</strong> ' + escapeHtml(item.flaggedTerms && item.flaggedTerms.length ? "Detected: " + item.flaggedTerms.slice(0, 4).join(", ") : "Potentially inappropriate language detected.") + '</span></div>'
          : "") +
        '<div class="message-meta">' +
          '<span class="avatar' + (item.fromRole === "teacher" ? " teacher" : "") + '">' + escapeHtml(initials(from)) + "</span>" +
          '<span class="meta-copy"><strong>' + escapeHtml(from) + "</strong><span>" + escapeHtml(displayEmail(from)) + "</span><span>To " + escapeHtml(to) + "</span></span>" +
          '<span class="meta-date">' + escapeHtml(formatFullDate(item.createdAt)) + "</span>" +
        "</div>" +
        '<div class="message-body">' + linkify(item.body) + "</div>" +
        '<div id="messageFiles" class="message-files"></div>' +
        '<div class="reply-box"><button type="button" class="btn primary" data-action="reply" data-id="' + escapeHtml(item.id) + '"><svg class="icon" aria-hidden="true"><use href="#i-reply"></use></svg>Reply</button></div>' +
      "</div>";
    renderMessageFiles();
  }

  function syncComposeInputs() {
    els.composeTo.value = compose.to;
    els.composeSubject.value = compose.subject;
    els.composeBody.value = compose.body;
    setFieldError(els.composeError, "");
    renderComposeModeration();
  }

  function renderCompose() {
    els.composePanel.hidden = !compose.open;
    els.composePanel.classList.toggle("minimized", compose.minimized);
    els.composeTitle.textContent = compose.title;
    els.composeTo.placeholder = state.profile && state.profile.role === "teacher"
      ? "Name, or /all to email all students"
      : "Classmate name";
  }

  function renderAll() {
    renderSidebar();
    renderList();
    renderDetail();
    renderCompose();
  }

  function findMessage(id) {
    return state.messages.find((item) => item.id === id) || null;
  }

  function findDraft(id) {
    return state.drafts.find((item) => item.id === id) || null;
  }

  function markRead(id) {
    const message = findMessage(id);
    const me = state.profile.uid;
    if (!message || message.toUids.indexOf(me) < 0 || message.readBy.indexOf(me) >= 0) return;
    message.readBy = message.readBy.concat([me]);
    renderList();
    renderSidebar();
    backend
      .updateMessage(state.profile.classCode, id, { readBy: message.readBy })
      .catch((error) => showToast(friendlyError(error), "error"));
  }

  function selectItem(item) {
    state.openId = item.id;
    state.openKind = item.kind;
    if (item.kind === "message") markRead(item.id);
    els.appShell.setAttribute("data-view", "detail");
    renderList();
    renderDetail();
    loadMessageFiles(item.kind === "message" ? item.id : null);
  }

  function ensureSelection() {
    const items = currentItems();
    const stillThere = items.find((item) => item.id === state.openId && item.kind === state.openKind);
    if (!stillThere) {
      state.openId = null;
      state.openKind = null;
      state.messageFiles = [];
      els.appShell.setAttribute("data-view", "list");
    }
  }

  async function loadAll() {
    if (!state.profile) return;
    state.loading = true;
    renderList();
    try {
      const code = state.profile.classCode;
      const [members, messages, drafts, settings] = await Promise.all([
        backend.getMembers(code),
        backend.getMessages(code),
        backend.getDrafts(code, state.profile.uid),
        backend.getClassSettings(code).catch(() => ({ studentMessaging: true }))
      ]);
      state.members = members;
      state.messages = messages;
      state.drafts = drafts;
      state.settings = settings || { studentMessaging: true };
      ensureSelection();
      renderAll();
      if (state.pendingOpenMessageId) {
        const pendingId = state.pendingOpenMessageId;
        state.pendingOpenMessageId = null;
        const pending = findMessage(pendingId);
        if (pending) selectItem(Object.assign({}, pending, { kind: "message" }));
      }
      if (state.pendingComposeTo) {
        const to = state.pendingComposeTo;
        state.pendingComposeTo = null;
        openCompose({ to });
      }
    } catch (error) {
      showToast(friendlyError(error), "error");
    } finally {
      state.loading = false;
      renderList();
    }
  }

  async function loadAdminOverview() {
    if (!state.profile || state.profile.role !== "teacher") return;
    state.loading = true;
    renderAdminList();
    try {
      const overview = await backend.getAdminOverview(state.profile.uid);
      state.adminOverview = overview;
      if (!overview.sections.some((section) => section.code === state.selectedAdminSection)) {
        state.selectedAdminSection = overview.sections.length ? overview.sections[0].code : null;
      }
      renderSidebar();
      renderAdminList();
      renderAdminDetail();
    } catch (error) {
      showToast(friendlyError(error), "error");
    } finally {
      state.loading = false;
      renderAdminList();
    }
  }

  function refresh() {
    if (state.folder === "dashboard") loadAdminOverview();
    else loadAll();
  }

  function closeSidebar() {
    state.sidebarOpen = false;
    els.appShell.classList.remove("sidebar-open");
    els.sidebarScrim.hidden = true;
  }

  function openSidebar() {
    state.sidebarOpen = true;
    els.appShell.classList.add("sidebar-open");
    els.sidebarScrim.hidden = false;
  }

  function setFolder(folder) {
    if ((folder === "all" || folder === "dashboard" || folder === "flags") && state.profile.role !== "teacher") return;
    state.folder = folder;
    state.filter = "all";
    state.query = "";
    state.openId = null;
    state.openKind = null;
    state.messageFiles = [];
    state.selectedStudentId = null;
    state.selectedClassmateId = null;
    els.searchInput.value = "";
    els.clearSearch.hidden = true;
    els.appShell.setAttribute("data-view", "list");
    closeSidebar();
    renderSidebar();
    refresh();
  }

  function switchSection(requestedCode, options) {
    if (!state.profile || state.profile.role !== "teacher") return;
    const code = typeof requestedCode === "string" ? requestedCode.trim() : els.sectionInput.value.trim();
    const opts = options || {};
    if (!/^[A-Za-z0-9-]{3,24}$/.test(code)) {
      showToast("Use a section code with 3–24 letters, numbers, or dashes.", "error");
      return;
    }
    if (code === state.profile.classCode) {
      if (opts.keepFolder) {
        closeSidebar();
        refresh();
      } else if (state.folder === "dashboard") {
        setFolder("inbox");
      } else {
        closeSidebar();
      }
      return;
    }
    state.profile = Object.assign({}, state.profile, { classCode: code });
    saveSession(state.profile);
    rememberSection(code);
    els.sectionInput.value = code;
    if (opts.keepFolder && state.folder !== "roster") {
      state.openId = null;
      state.openKind = null;
      state.messageFiles = [];
      state.selectedStudentId = null;
      state.selectedClassmateId = null;
      els.appShell.setAttribute("data-view", "list");
      renderSidebar();
      refresh();
    } else {
      setFolder("inbox");
    }
    loadSections();
  }

  async function loadSections() {
    if (!state.profile || state.profile.role !== "teacher") return;
    try {
      state.knownSections = await backend.getSections();
      renderSidebar();
      if (state.folder === "dashboard") loadAdminOverview();
    } catch (_error) {
      state.knownSections = [];
    }
  }

  async function updateMessageLocally(id, patch) {
    const message = findMessage(id);
    if (!message) return;
    Object.assign(message, patch);
    renderList();
    renderDetail();
    try {
      await backend.updateMessage(state.profile.classCode, id, patch);
    } catch (error) {
      showToast(friendlyError(error), "error");
    }
  }

  function toggleStar(id) {
    const message = findMessage(id);
    if (!message) return;
    const me = state.profile.uid;
    const starred = message.starredBy.indexOf(me) >= 0;
    const starredBy = starred
      ? message.starredBy.filter((uid) => uid !== me)
      : message.starredBy.concat([me]);
    updateMessageLocally(id, { starredBy });
  }

  function moveToTrash(id) {
    const message = findMessage(id);
    if (!message) return;
    const me = state.profile.uid;
    if (message.deletedBy.indexOf(me) < 0) {
      updateMessageLocally(id, { deletedBy: message.deletedBy.concat([me]) });
      showToast("Message moved to Trash");
      if (state.folder !== "trash") {
        state.openId = null;
        state.openKind = null;
        ensureSelection();
        renderList();
        renderDetail();
      }
    }
  }

  function restoreMessage(id) {
    const message = findMessage(id);
    if (!message) return;
    const me = state.profile.uid;
    updateMessageLocally(id, {
      deletedBy: message.deletedBy.filter((uid) => uid !== me)
    });
    showToast("Message moved back to Inbox", "success");
  }

  async function destroyMessage(id) {
    if (!window.confirm("Delete this message forever?")) return;
    try {
      await backend.deleteMessage(state.profile.classCode, id);
      state.messages = state.messages.filter((item) => item.id !== id);
      state.openId = null;
      state.openKind = null;
      ensureSelection();
      renderAll();
      showToast("Message deleted forever");
    } catch (error) {
      showToast(friendlyError(error), "error");
    }
  }

  function markUnread(id) {
    const message = findMessage(id);
    if (!message) return;
    const me = state.profile.uid;
    updateMessageLocally(id, {
      readBy: message.readBy.filter((uid) => uid !== me)
    });
    showToast("Marked as unread");
  }

  function replyTo(id) {
    const message = findMessage(id);
    if (!message) return;
    const me = state.profile.uid;
    const recipient =
      message.fromUid === me
        ? (message.toNames || [])[0] || ""
        : message.fromName;
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
  }

  function isAllowedFileType(file) {
    const type = String(file.type || "").toLowerCase();
    if (!type || type === "application/octet-stream") {
      return /\.(pdf|txt|doc|docx|xls|xlsx|png|jpe?g|gif|webp)$/i.test(file.name || "");
    }
    return ALLOWED_FILE_TYPES.indexOf(type) >= 0;
  }

  function renderAttachmentChips() {
    if (!els.attachmentChips) return;
    const files = compose.attachments || [];
    if (!files.length) {
      els.attachmentChips.innerHTML = "";
      return;
    }
    els.attachmentChips.innerHTML = files.map((file, index) => {
      const preview = file.preview
        ? '<span class="attachment-preview">' + escapeHtml(file.preview) + "</span>"
        : "";
      return '<div class="attachment-card" data-file-index="' + index + '">' +
        fileTileHtml(file, file.thumb) +
        '<span class="attachment-info">' +
          '<strong class="attachment-name" title="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + "</strong>" +
          '<span class="attachment-meta">' + escapeHtml(fileExt(file)) + " · " + escapeHtml(formatFileSize(file.size)) + "</span>" +
          preview +
        "</span>" +
        '<button type="button" class="attachment-remove" data-remove-file="' + index + '" aria-label="Remove ' + escapeHtml(file.name) + '">' +
          '<svg class="icon icon-sm" aria-hidden="true"><use href="#i-close"></use></svg>' +
        "</button>" +
      "</div>";
    }).join("");
  }

  async function handleFileSelect(event) {
    const input = event.target;
    const files = Array.from(input.files || []);
    input.value = "";
    if (!files.length || !state.profile) return;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        showToast(file.name + " is larger than 10 MB.", "error");
        continue;
      }
      if (!isAllowedFileType(file)) {
        showToast(file.name + " has an unsupported file type.", "error");
        continue;
      }
      try {
        const uploaded = await backend.uploadFile(state.profile.classCode, file);
        const thumb = await makeImageThumb(file);
        const preview = await readTextPreview(file);
        if (thumb) uploaded.thumb = thumb;
        if (preview) uploaded.preview = preview;
        compose.attachments.push(uploaded);
      } catch (error) {
        showToast("Could not upload " + file.name + ": " + friendlyError(error), "error");
      }
    }
    renderAttachmentChips();
  }

  function handleAttachmentClick(event) {
    const button = event.target.closest("[data-remove-file]");
    if (!button) return;
    const index = Number(button.getAttribute("data-remove-file"));
    if (!Number.isInteger(index) || index < 0 || index >= compose.attachments.length) return;
    compose.attachments.splice(index, 1);
    renderAttachmentChips();
  }

  function openCompose(options) {
    compose.open = true;
    compose.minimized = false;
    compose.draftId = options.draftId || null;
    compose.title = options.title || "New message";
    compose.to = options.to || "";
    compose.subject = options.subject || "";
    compose.body = options.body || "";
    compose.attachments = (options.attachments || []).map((file) => Object.assign({}, file));
    syncComposeInputs();
    renderCompose();
    renderAttachmentChips();
    renderSuggestions();
    closeSidebar();
    setTimeout(() => {
      (compose.to ? els.composeBody : els.composeTo).focus();
    }, 0);
  }

  function hasComposeContent() {
    return Boolean(compose.to.trim() || compose.subject.trim() || compose.body.trim() || compose.attachments.length);
  }

  function resetCompose() {
    compose.open = false;
    compose.minimized = false;
    compose.draftId = null;
    compose.title = "New message";
    compose.to = "";
    compose.subject = "";
    compose.body = "";
    compose.attachments = [];
    syncComposeInputs();
    renderCompose();
    renderAttachmentChips();
  }

  async function saveDraft(showNotice) {
    if (!state.profile || compose.saving) return;
    if (!hasComposeContent() && !compose.draftId) return;
    compose.saving = true;
    try {
      const saved = await backend.saveDraft(state.profile.classCode, state.profile.uid, {
        id: compose.draftId,
        to: compose.to,
        subject: compose.subject,
        body: compose.body,
        attachments: compose.attachments
      });
      compose.draftId = saved.id;
      const index = state.drafts.findIndex((item) => item.id === saved.id);
      if (index >= 0) {
        state.drafts[index] = saved;
      } else {
        state.drafts.push(saved);
      }
      state.drafts.sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));
      ensureSelection();
      renderSidebar();
      renderList();
      renderDetail();
      if (showNotice) showToast("Draft saved", "success");
    } catch (error) {
      showToast(friendlyError(error), "error");
    } finally {
      compose.saving = false;
    }
  }

  function closeComposePanel() {
    if (hasComposeContent() && !window.confirm("Discard this unsaved message?")) return;
    resetCompose();
  }

  async function discardCompose() {
    if (!hasComposeContent() && !compose.draftId) {
      resetCompose();
      return;
    }
    if (!window.confirm("Discard this message?")) return;
    try {
      if (compose.draftId) {
        await backend.deleteDraft(state.profile.classCode, state.profile.uid, compose.draftId);
        state.drafts = state.drafts.filter((item) => item.id !== compose.draftId);
      }
      resetCompose();
      ensureSelection();
      renderAll();
      showToast("Draft discarded");
    } catch (error) {
      showToast(friendlyError(error), "error");
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    setFieldError(els.composeError, "");
    const to = compose.to.trim();
    const body = compose.body.trim();
    if (!to) {
      setFieldError(els.composeError, "Add at least one classmate in the To field.");
      els.composeTo.focus();
      return;
    }
    if (!body) {
      setFieldError(els.composeError, "Write a short message before sending.");
      els.composeBody.focus();
      return;
    }
    let recipients;
    try {
      recipients = resolveRecipients(to);
    } catch (error) {
      setFieldError(els.composeError, error.message);
      return;
    }
    const emailAll = ["/all", "all students", "all"].indexOf(normalizeName(to)) >= 0;
    const toNames = emailAll ? ["All students"] : recipients.map((member) => member.name);
    const moderation = scanModeration([compose.subject.trim(), body].join(" "));
    if (moderation.flagged) {
      const ok = window.confirm("This message may include inappropriate language (" + moderation.terms.slice(0, 3).join(", ") + "). It will be flagged for teacher review. Send anyway?");
      if (!ok) return;
    }

    els.sendBtn.disabled = true;
    try {
      const created = await backend.createMessage(state.profile.classCode, {
        fromUid: state.profile.uid,
        fromName: state.profile.name,
        fromRole: state.profile.role,
        toUids: recipients.map((member) => member.uid),
        toNames: toNames,
        subject: compose.subject.trim() || "(no subject)",
        body,
        readBy: [state.profile.uid],
        starredBy: [],
        deletedBy: [],
        moderationStatus: moderation.flagged ? "flagged" : "clean",
        flaggedTerms: moderation.terms,
        flaggedAt: moderation.flagged ? Date.now() : null
      });
      if (moderation.flagged && backend.createModerationAlert) {
        backend.createModerationAlert({
          messageId: created.id,
          classCode: state.profile.classCode,
          fromId: state.profile.uid,
          fromName: state.profile.name,
          toNames,
          subject: compose.subject.trim() || "(no subject)",
          body,
          terms: moderation.terms,
          severity: moderation.severity
        }).catch(() => {});
      }
      if (compose.attachments.length) {
        const fileRows = compose.attachments.map((file) => {
          const row = {
            message_id: created.id,
            class_code: state.profile.classCode,
            from_id: state.profile.uid,
            to_ids: recipients.map((member) => member.uid),
            file_name: file.name,
            storage_path: file.path,
            size_bytes: file.size,
            mime_type: file.type
          };
          if (demoMode) {
            row.thumb = file.thumb || null;
            row.preview = file.preview || null;
          }
          return row;
        });
        await backend.createMessageFiles(state.profile.classCode, fileRows);
      }
      if (compose.draftId) {
        await backend.deleteDraft(state.profile.classCode, state.profile.uid, compose.draftId);
        state.drafts = state.drafts.filter((item) => item.id !== compose.draftId);
      }
      resetCompose();
      state.folder = "sent";
      state.filter = "all";
      state.openId = null;
      state.openKind = null;
      els.appShell.setAttribute("data-view", "list");
      renderSidebar();
      await loadAll();
      showToast("Message sent", "success");
    } catch (error) {
      showToast(friendlyError(error), "error");
    } finally {
      els.sendBtn.disabled = false;
    }
  }

  function editDraft(id) {
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
  }

  async function deleteDraftItem(id) {
    if (!window.confirm("Delete this draft?")) return;
    try {
      await backend.deleteDraft(state.profile.classCode, state.profile.uid, id);
      state.drafts = state.drafts.filter((item) => item.id !== id);
      if (compose.draftId === id) resetCompose();
      state.openId = null;
      state.openKind = null;
      ensureSelection();
      renderAll();
      showToast("Draft deleted");
    } catch (error) {
      showToast(friendlyError(error), "error");
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => {
      if (!document.hidden && state.profile) refresh();
    }, 20000);
  }

  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function showApp(profile) {
    state.profile = profile;
    saveSession(profile);
    els.authScreen.hidden = true;
    els.appShell.hidden = false;
    els.appShell.setAttribute("data-view", "list");
    renderSidebar();
    setFolder("inbox");
    startPolling();
    loadSections();
  }

  function setPasswordVisible(visible) {
    els.password.type = visible ? "text" : "password";
    const field = els.togglePasswordBtn.closest(".password-field");
    if (field) field.classList.toggle("password-visible", visible);
    els.togglePasswordBtn.setAttribute("aria-pressed", String(visible));
    els.togglePasswordBtn.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    els.togglePasswordBtn.title = visible ? "Hide password" : "Show password";
  }

  function showAuth() {
    stopPolling();
    clearSession();
    state.profile = null;
    state.members = [];
    state.messages = [];
    state.drafts = [];
    state.openId = null;
    state.openKind = null;
    state.adminOverview = null;
    state.selectedAdminSection = null;
    state.pendingOpenMessageId = null;
    state.pendingComposeTo = null;
    els.appShell.hidden = true;
    els.authScreen.hidden = false;
    closeSidebar();
    resetCompose();
    els.displayName.value = "";
    els.password.value = "";
    setPasswordVisible(false);
    const studentRadio = document.querySelector('input[name="role"][value="student"]');
    if (studentRadio) studentRadio.checked = true;
    setFieldError(els.authError, "");
    setTimeout(() => els.classCode.focus(), 0);
  }

  async function handleSignIn(event) {
    event.preventDefault();
    setFieldError(els.authError, "");
    const classCode = els.classCode.value.trim().replace(/\s+/g, "-");
    const name = els.displayName.value.trim().replace(/\s+/g, " ");
    const password = els.password.value;
    const roleInput = document.querySelector('input[name="role"]:checked');
    const role = roleInput ? roleInput.value : "student";

    if (!/^[A-Za-z0-9-]{3,24}$/.test(classCode)) {
      setFieldError(els.authError, "Use a class code with 3–24 letters, numbers, or dashes.");
      return;
    }
    if (!name || name.length > 60) {
      setFieldError(els.authError, "Enter your name using 1–60 characters.");
      return;
    }
    if (password.length < 6) {
      setFieldError(els.authError, "Use a password with at least 6 characters.");
      return;
    }

    els.signInBtn.disabled = true;
    try {
      const profile = await backend.signIn({ classCode, name, role, password });
      showApp(profile);
    } catch (error) {
      setFieldError(els.authError, friendlyError(error));
    } finally {
      els.signInBtn.disabled = false;
    }
  }

  function handleMessageListClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.getAttribute("data-action");
    const id = button.getAttribute("data-id");
    if (action === "select-admin-section") {
      state.selectedAdminSection = button.getAttribute("data-code");
      renderAdminList();
      renderAdminDetail();
      els.appShell.setAttribute("data-view", "detail");
      return;
    }
    if (action === "select-classmate") {
      state.selectedClassmateId = id;
      renderClassmatesList();
      renderClassmatesDetail();
      return;
    }
    if (action === "select-student") {
      state.selectedStudentId = id;
      renderRosterList();
      renderRosterDetail();
      return;
    }
    if (action === "star") {
      toggleStar(id);
      return;
    }
    if (action === "open") {
      const kind = button.getAttribute("data-kind");
      const item = kind === "draft" ? findDraft(id) : findMessage(id);
      if (item) selectItem(Object.assign({}, item, { kind }));
    }
  }

  function handleDetailClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.getAttribute("data-action");
    const id = button.getAttribute("data-id");
    if (action === "admin-open-section") {
      switchSection(button.getAttribute("data-code"));
      return;
    }
    if (action === "admin-email-all") {
      const code = button.getAttribute("data-code");
      if (code === state.profile.classCode) {
        openCompose({ to: "/all" });
      } else {
        state.pendingComposeTo = "/all";
        switchSection(code, { keepFolder: true });
      }
      return;
    }
    if (action === "admin-open-message") {
      const code = button.getAttribute("data-code");
      state.pendingOpenMessageId = id;
      if (state.profile.classCode === code) setFolder("inbox");
      else switchSection(code);
      return;
    }
    if (action === "admin-toggle-messaging") return;
    if (action === "back") {
      els.appShell.setAttribute("data-view", "list");
      return;
    }
    if (action === "select-student") {
      state.selectedStudentId = id;
      renderRosterList();
      renderRosterDetail();
      return;
    }
    if (action === "email-classmate") {
      openCompose({ to: button.getAttribute("data-name") || "" });
      return;
    }
    if (action === "copy-password") {
      const name = button.getAttribute("data-name") || "";
      if (navigator.clipboard) navigator.clipboard.writeText(name).catch(() => {});
      showToast("Student name copied");
      return;
    }
    if (action === "star") toggleStar(id);
    if (action === "trash") moveToTrash(id);
    if (action === "restore") restoreMessage(id);
    if (action === "destroy") destroyMessage(id);
    if (action === "unread") markUnread(id);
    if (action === "reply") replyTo(id);
    if (action === "edit-draft") editDraft(id);
    if (action === "delete-draft") deleteDraftItem(id);
  }

  async function handleRosterSubmit(event) {
    event.preventDefault();
    const form = event.target;
    if (form.id === "addStudentForm") {
      const name = $("newStudentName").value.trim();
      const password = $("newStudentPassword").value;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await backend.createStudent({ classCode: state.profile.classCode, name, password });
        await loadAll();
        const lower = normalizeName(name);
        const created = state.members.find((item) => item.role === "student" && item.nameLower === lower);
        if (created) state.selectedStudentId = created.uid;
        renderRosterList();
        renderRosterDetail();
        form.reset();
        showToast("Student account created", "success");
      } catch (error) {
        showToast(friendlyError(error), "error");
      } finally {
        button.disabled = false;
      }
      return;
    }
    if (form.id === "editStudentForm") {
      const name = $("editStudentName").value.trim().replace(/\s+/g, " ");
      const password = $("editStudentPassword").value;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await backend.updateStudent({
          classCode: state.profile.classCode,
          studentId: state.selectedStudentId,
          name,
          password
        });
        await loadAll();
        renderRosterList();
        renderRosterDetail();
        showToast("Account updated", "success");
      } catch (error) {
        showToast(friendlyError(error), "error");
      } finally {
        button.disabled = false;
      }
    }
  }

  function handleSuggestionClick(event) {
    const button = event.target.closest("[data-suggest]");
    if (!button) return;
    const name = button.getAttribute("data-suggest");
    const key = normalizeName(name);
    if (key === "all students" || key === "all" || key === "/all") {
      compose.to = key === "all students" ? "All students" : "/all";
      els.composeTo.value = compose.to;
      setFieldError(els.composeError, "");
      renderSuggestions();
      els.composeBody.focus();
      return;
    }
    const current = compose.to.split(",").map((part) => part.trim()).filter(Boolean);
    if (!current.some((item) => normalizeName(item) === normalizeName(name))) {
      current.push(name);
    }
    compose.to = current.join(", ");
    els.composeTo.value = compose.to;
    setFieldError(els.composeError, "");
    renderSuggestions();
    els.composeBody.focus();
  }

  function handleContactClick(event) {
    const button = event.target.closest("[data-contact]");
    if (!button) return;
    openCompose({ to: button.getAttribute("data-contact") });
  }

  function bindEvents() {
    els.alertOk.addEventListener("click", hideAlert);
    els.alertOverlay.addEventListener("click", (event) => {
      if (event.target === els.alertOverlay) hideAlert();
    });

    els.lightboxClose.addEventListener("click", closeLightbox);
    els.fileLightbox.addEventListener("click", (event) => {
      if (event.target === els.fileLightbox) closeLightbox();
    });

    els.studentMessagingToggle.addEventListener("change", async () => {
      const enabled = els.studentMessagingToggle.checked;
      try {
        state.settings = await backend.setClassSettings(state.profile.classCode, { studentMessaging: enabled });
        renderSidebar();
        showToast(enabled ? "Students can email classmates now." : "Student-to-student mail is off.");
      } catch (error) {
        els.studentMessagingToggle.checked = !enabled;
        showToast("Could not save class settings: " + friendlyError(error), "error");
      }
    });

    els.detailContent.addEventListener("change", async (event) => {
      const input = event.target.closest('[data-action="admin-toggle-messaging"]');
      if (!input) return;
      const code = input.getAttribute("data-code");
      const enabled = input.checked;
      const section = state.adminOverview && state.adminOverview.sections.find((item) => item.code === code);
      if (!section) return;
      try {
        await backend.setClassSettings(code, { studentMessaging: enabled });
        section.studentMessaging = enabled;
        renderAdminList();
        renderAdminDetail();
        if (code === state.profile.classCode) {
          state.settings = { studentMessaging: enabled };
          renderSidebar();
        }
        showToast(enabled ? "Student-to-student mail enabled for " + code + "." : "Student-to-student mail off for " + code + ".");
      } catch (error) {
        input.checked = !enabled;
        showToast("Could not save settings for " + code + ": " + friendlyError(error), "error");
      }
    });

    els.signInForm.addEventListener("submit", handleSignIn);
    els.togglePasswordBtn.addEventListener("click", () => setPasswordVisible(els.password.type !== "text"));
    els.signOutBtn.addEventListener("click", () => {
      if (backend) backend.signOut().catch(() => {});
      showAuth();
    });

    els.folders.addEventListener("click", (event) => {
      const button = event.target.closest("[data-folder]");
      if (button) setFolder(button.getAttribute("data-folder"));
    });

    els.teacherList.addEventListener("click", handleContactClick);
    els.composeBtn.addEventListener("click", () => openCompose({}));
    els.menuBtn.addEventListener("click", openSidebar);
    els.closeSidebar.addEventListener("click", closeSidebar);
    els.sidebarScrim.addEventListener("click", closeSidebar);
    els.refreshBtn.addEventListener("click", refresh);

    els.searchInput.addEventListener("input", () => {
      state.query = els.searchInput.value;
      els.clearSearch.hidden = !state.query;
      renderList();
      renderDetail();
    });
    els.clearSearch.addEventListener("click", () => {
      state.query = "";
      els.searchInput.value = "";
      els.clearSearch.hidden = true;
      renderList();
      renderDetail();
      els.searchInput.focus();
    });

    els.filterChips.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-filter]");
      if (!chip) return;
      state.filter = chip.getAttribute("data-filter");
      state.openId = null;
      state.openKind = null;
      ensureSelection();
      renderAll();
    });

    els.messageList.addEventListener("click", handleMessageListClick);
    els.detailContent.addEventListener("click", handleDetailClick);
    els.detailContent.addEventListener("submit", handleRosterSubmit);
    els.detailContent.addEventListener("click", (event) => {
      if (event.target.closest("#messageFiles")) handleMessageFileClick(event);
    });
    els.recipientSuggestions.addEventListener("click", handleSuggestionClick);

    [els.composeTo, els.composeSubject, els.composeBody].forEach((input) => {
      input.addEventListener("input", () => {
        compose.to = els.composeTo.value;
        compose.subject = els.composeSubject.value;
        compose.body = els.composeBody.value;
        setFieldError(els.composeError, "");
        renderComposeModeration();
        if (input === els.composeTo) renderSuggestions();
      });
    });

    els.composeTo.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const first = els.recipientSuggestions.querySelector("button[data-suggest]");
      if (!first) return;
      event.preventDefault();
      handleSuggestionClick({ target: first });
    });

    els.switchSectionBtn.addEventListener("click", switchSection);
    els.sectionChips.addEventListener("click", (event) => {
      const button = event.target.closest("[data-section]");
      if (button) switchSection(button.getAttribute("data-section"));
    });
    els.sectionInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        switchSection();
      }
    });
    els.composeForm.addEventListener("submit", sendMessage);
    els.attachBtn.addEventListener("click", () => els.fileInput.click());
    els.fileInput.addEventListener("change", handleFileSelect);
    els.attachmentChips.addEventListener("click", handleAttachmentClick);
    els.saveDraftBtn.addEventListener("click", () => saveDraft(true));
    els.discardBtn.addEventListener("click", discardCompose);
    els.closeCompose.addEventListener("click", closeComposePanel);
    els.minimizeCompose.addEventListener("click", () => {
      compose.minimized = !compose.minimized;
      renderCompose();
    });

    els.dismissDemoBanner.addEventListener("click", hideDemoBanner);

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!els.fileLightbox.hidden) {
        closeLightbox();
        return;
      }
      if (!els.alertOverlay.hidden) {
        hideAlert();
        return;
      }
      if (compose.open && !compose.minimized) {
        closeComposePanel();
      } else if (state.sidebarOpen) {
        closeSidebar();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && state.profile) refresh();
    });

    window.addEventListener("resize", () => {
      updateDemoBannerHeight();
      if (window.innerWidth > 720 && state.sidebarOpen) closeSidebar();
    });
  }

  function init() {
    bindEvents();
    if (demoMode) {
      showDemoBanner();
      els.authNote.textContent = "Demo accounts: Teacher / teacher123, Ava Chen / student123, Jordan Lee / student123.";
    } else {
      hideDemoBanner();
    }
    try {
      backend = demoMode ? createDemoBackend() : createSupabaseBackend();
    } catch (error) {
      demoMode = true;
      showDemoBanner();
      showToast(friendlyError(error), "error");
      backend = createDemoBackend();
    }

    const saved = readSession();
    if (!saved) {
      showAuth();
      return;
    }
    backend
      .verifySession(saved)
      .then((valid) => {
        if (valid) showApp(saved);
        else showAuth();
      })
      .catch(() => showAuth());
  }

  init();
})();
