import type { AppApi } from "../../app-api";
import { FOLDER_LABELS } from "../../constants";
import type { Folder } from "../../types";
import { displayEmail, initials } from "../../utils";
import { Icon } from "../shared/ui";

export function Sidebar({ api }: { api: AppApi }) {
  const { state, derived } = api;
  if (!state.profile) return null;
  const isTeacher = state.profile.role === "teacher";
  const teachers = state.members
    .filter((member) => member.uid !== state.profile!.uid && member.role === "teacher")
    .sort((a, b) => a.nameLower.localeCompare(b.nameLower));
  const unread = derived.unread;
  const flagged = derived.flagged;

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = (event.target as Element).closest<HTMLElement>("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "folder") api.actions.setFolder(target.dataset.folder as Folder);
    else if (action === "contact") api.actions.openCompose({ to: target.dataset.name || "" });
    else if (action === "sign-out") void api.actions.signOut();
  };

  const folderRows: Array<{
    folder: Folder;
    icon: string;
    label: string;
    badge?: number;
    badgeId?: string;
    teacherOnly?: boolean;
    extraClass?: string;
  }> = [
    { folder: "inbox", icon: "inbox", label: "Inbox", badge: unread, badgeId: "unreadBadge" },
    { folder: "starred", icon: "star", label: "Starred" },
    { folder: "sent", icon: "send", label: "Sent" },
    { folder: "drafts", icon: "file", label: "Drafts", badge: state.drafts.length, badgeId: "draftBadge" },
    { folder: "trash", icon: "trash", label: "Trash" },
    { folder: "assignments", icon: "file", label: "Assignments" },
    { folder: "announcements", icon: "layers", label: "Announcements" },
    { folder: "classmates", icon: "users", label: isTeacher ? "Students" : "Classmates", badge: derived.classmates.length, badgeId: "classmateBadge" },
    { folder: "dashboard", icon: "grid", label: "All sections", teacherOnly: true, extraClass: "admin-folder" },
    { folder: "roster", icon: "users", label: "Class roster", teacherOnly: true },
    { folder: "all", icon: "layers", label: "All class mail", teacherOnly: true },
    { folder: "flags", icon: "alert", label: "Flagged", badge: flagged, badgeId: "flagBadge", teacherOnly: true }
  ];

  return (
    <>
      <aside id="sidebar" className={`sidebar${state.sidebarOpen ? " open" : ""}`}>
        <div className="sidebar-head">
          <div className="brand">
            <span className="brand-mark small school-mark">
              <img src="/valley-of-peace-logo.png" width="428" height="467" alt="Valley of Peace SDA Academy logo" />
            </span>
            <span>Vopa Mail</span>
          </div>
          <button id="closeSidebar" className="icon-btn close-sidebar" type="button" aria-label="Close menu" onClick={api.actions.closeSidebar}>
            <Icon name="close" />
          </button>
        </div>

        <button id="composeBtn" className="compose-btn" type="button" onClick={() => api.actions.openCompose()}>
          <Icon name="pencil" />
          <span>Compose</span>
        </button>

        <nav id="folders" className="folders" aria-label="Mail folders" onClick={handleClick}>
          {folderRows.map((row) => (
            <button
              type="button"
              key={row.folder}
              data-action="folder"
              data-folder={row.folder}
              className={`folder${state.folder === row.folder ? " active" : ""}${row.teacherOnly ? " teacher-only" : ""}${row.extraClass ? ` ${row.extraClass}` : ""}`}
              aria-current={state.folder === row.folder ? "page" : undefined}
              title={FOLDER_LABELS[row.folder]}
              hidden={row.teacherOnly && !isTeacher}
            >
              <Icon name={row.icon} />
              <span id={row.folder === "classmates" ? "classmateLabel" : undefined}>{row.label}</span>
              {row.badgeId ? <em id={row.badgeId} className="badge" hidden={!row.badge}>{row.badge}</em> : null}
            </button>
          ))}
        </nav>

        <div id="teacherBlock" className="contacts-block" hidden={isTeacher}>
          <h2><Icon name="star" /> ME</h2>
          <div id="teacherList" className="contacts-list" onClick={handleClick}>
            {teachers.length ? teachers.map((teacher) => (
              <button type="button" className="contact" data-action="contact" data-name={teacher.name} key={teacher.uid}>
                <span className={`avatar${teacher.role === "teacher" ? " teacher" : ""}`}>{initials(teacher.name)}</span>
                <span className="contact-copy"><span className="contact-name">{teacher.name}</span><span className="contact-email">{displayEmail(teacher.name)}</span></span>
                <span className="contact-role">{teacher.role}</span>
              </button>
            )) : <p className="contacts-empty">No teacher yet.</p>}
          </div>
        </div>

        <div id="classSettings" className="class-settings" hidden={!isTeacher}>
          <div className="class-settings-head"><Icon name="layers" /><span>Class settings</span></div>
          <label className="setting-row" htmlFor="studentMessagingToggle">
            <span className="setting-copy"><strong>Student-to-student mail</strong><small>Let students email classmates</small></span>
            <input id="studentMessagingToggle" className="switch-input" type="checkbox" checked={state.settings.studentMessaging !== false} onChange={(event) => void api.actions.setStudentMessaging(event.target.checked)} />
            <span className="switch" aria-hidden="true" />
          </label>
        </div>

        <div className="sidebar-foot">
          <span id="userAvatar" className="avatar">{initials(state.profile.name)}</span>
          <span className="user-copy"><strong id="userName">{state.profile.name}</strong><small id="userEmail">{displayEmail(state.profile.name)}</small><small id="userMeta">{state.profile.classCode} • {state.profile.role}</small></span>
          <button id="signOutBtn" className="icon-btn" type="button" title="Sign out" aria-label="Sign out" data-action="sign-out" onClick={handleClick}>
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      <div id="sidebarScrim" className="sidebar-scrim" hidden={!state.sidebarOpen} onClick={api.actions.closeSidebar} />
    </>
  );
}
