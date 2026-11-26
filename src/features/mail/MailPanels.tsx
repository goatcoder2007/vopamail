import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { AppApi } from "../../app-api";
import { FOLDER_LABELS } from "../../constants";
import type { MailItem } from "../../types";
import { createSnippet, displayEmail, fileExt, fileKind, formatDate, formatFileSize, formatFullDate, initials, toMs } from "../../utils";
import { AdminDetail, AdminList } from "../admin/AdminPanels";
import { ClassmateDetail, ClassmatesList, RosterDetail, RosterList } from "../people/PeoplePanels";
import { plural } from "../shared/format";
import { EmptyState, FileTile, Icon, Linkify, SkeletonList, ViewedBy } from "../shared/ui";
import { AnnouncementDetail, AnnouncementsList, AssignmentDetail, AssignmentsList } from "../work/WorkPanels";

export function ListPane({ api }: { api: AppApi }) {
  const { state, derived } = api;
  const isTeacher = state.profile?.role === "teacher";
  let title = FOLDER_LABELS[state.folder] || "Mail";
  let count = "";
  let hideFilters = false;
  let content: React.ReactNode;

  if (state.folder === "dashboard") {
    content = <AdminList api={api} />;
    hideFilters = true;
  } else if (state.folder === "classmates") {
    content = <ClassmatesList api={api} />;
    hideFilters = true;
    title = isTeacher ? "Students" : "Classmates";
    count = plural(derived.classmates.length, isTeacher ? "student" : "classmate");
  } else if (state.folder === "roster") {
    content = <RosterList api={api} />;
    hideFilters = true;
    count = plural(state.members.filter((member) => member.role === "student").length, "student");
  } else if (state.folder === "assignments") {
    content = <AssignmentsList api={api} />;
    hideFilters = true;
  } else if (state.folder === "announcements") {
    content = <AnnouncementsList api={api} />;
    hideFilters = true;
  } else {
    content = <MailItemList api={api} />;
    const noun = state.folder === "drafts" ? "draft" : "message";
    count = plural(derived.currentItems.length, noun);
    hideFilters = state.folder === "drafts" || state.folder === "trash" || state.folder === "starred" || state.folder === "sent";
  }

  return (
    <section id="listPane" className="list-pane" aria-label="Message list">
      <div className="list-head">
        <div>
          <h2 id="folderTitle">{title}</h2>
          <p id="folderCount">{count}</p>
        </div>
        <div id="filterChips" className="filter-chips" role="group" aria-label="Filter messages" hidden={hideFilters}>
          <button type="button" data-filter="all" className={`chip${state.filter === "all" ? " active" : ""}`} onClick={() => api.actions.setFilter("all")}>All</button>
          <button type="button" data-filter="unread" className={`chip${state.filter === "unread" ? " active" : ""}`} onClick={() => api.actions.setFilter("unread")}>Unread</button>
        </div>
      </div>
      <div id="messageList" className="message-list" role="list">{content}</div>
    </section>
  );
}

export function DetailPane({ api }: { api: AppApi }) {
  const submit = (event: FormEvent<HTMLDivElement>) => {
    event.preventDefault();
    api.actions.handleDetailSubmit(event);
  };

  const click = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as Element).closest<HTMLElement>("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id || "";
    if (action === "back") api.actions.setView("list");
    else if (action === "star") api.actions.toggleStar(id);
    else if (action === "trash") api.actions.moveToTrash(id);
    else if (action === "restore") api.actions.restoreMessage(id);
    else if (action === "destroy") void api.actions.destroyMessage(id);
    else if (action === "unread") api.actions.markUnread(id);
    else if (action === "reply") api.actions.replyTo(id);
    else if (action === "edit-draft") api.actions.editDraft(id);
    else if (action === "delete-draft") void api.actions.deleteDraftItem(id);
    else if (action === "select-classmate") api.actions.setSelectedClassmateId(id);
    else if (action === "email-classmate") api.actions.openCompose({ to: target.dataset.name || "" });
    else if (action === "select-student") api.actions.setSelectedStudentId(id);
    else if (action === "select-assignment") api.actions.setSelectedAssignmentId(id);
    else if (action === "select-announcement") api.actions.setSelectedAnnouncementId(id);
    else if (action === "select-admin-section") api.actions.setSelectedAdminSection(target.dataset.code || null);
    else if (action === "admin-open-section") void api.actions.switchSection(target.dataset.code);
    else if (action === "admin-email-all") {
      api.actions.setPendingComposeTo("/all");
      void api.actions.switchSection(target.dataset.code);
    }
    else if (action === "admin-open-message") {
      api.actions.setPendingOpenMessageId(id);
      void api.actions.switchSection(target.dataset.code);
    }
    else if (action === "new-assignment") api.actions.setWorkFormOpen(true);
    else if (action === "new-announcement") api.actions.setWorkFormOpen(true);
    else if (action === "delete-assignment") void api.actions.deleteAssignmentItem(id);
    else if (action === "delete-announcement") void api.actions.deleteAnnouncementItem(id);
    else if (action === "remove-submission-file") api.actions.removeSubmissionFile(Number(target.dataset.index || 0));
    else if (action === "open-submission-file") {
      void api.actions.openStoredFile({
        path: target.dataset.path,
        name: target.dataset.name,
        size: Number(target.dataset.size || 0),
        type: target.dataset.type
      });
    }
    else if (action === "copy-password") {
      void navigator.clipboard?.writeText(target.dataset.name || "");
    }
  };

  const change = (event: React.ChangeEvent<HTMLDivElement>) => {
    const target = event.target as HTMLInputElement;
    if (target.dataset.action === "admin-toggle-messaging") {
      void api.actions.setStudentMessaging(target.checked, target.dataset.code);
    }
  };

  return (
    <section id="detailPane" className="detail-pane" aria-label="Message detail">
      <div id="detailContent" onClick={click} onChange={change} onSubmit={submit}>
        <DetailContent api={api} />
      </div>
    </section>
  );
}

function DetailContent({ api }: { api: AppApi }) {
  const { state } = api;
  if (state.folder === "dashboard") return <AdminDetail api={api} />;
  if (state.folder === "classmates") return <ClassmateDetail api={api} />;
  if (state.folder === "roster") return <RosterDetail api={api} />;
  if (state.folder === "assignments") return <AssignmentDetail api={api} />;
  if (state.folder === "announcements") return <AnnouncementDetail api={api} />;
  const item = api.derived.currentItems.find((entry) => entry.id === state.openId && entry.kind === state.openKind);
  if (!item) return <EmptyState icon="envelope" title="Select a message" body="Choose a message from the list to read it here." />;
  return item.kind === "draft" ? <DraftDetail api={api} item={item} /> : <MessageDetail api={api} item={item} />;
}

function MessageDetail({ api, item }: { api: AppApi; item: MailItem & { kind: "message" } }) {
  const { state } = api;
  const me = state.profile!.uid;
  const inTrash = item.deletedBy.includes(me);
  const starred = item.starredBy.includes(me);
  const to = item.toNames.join(", ") || "class";
  return (
    <>
      <div className="detail-toolbar">
        <button type="button" className="icon-btn detail-back" data-action="back" aria-label="Back to list" onClick={() => api.actions.setView("list")}><Icon name="back" /></button>
        <button type="button" className={`icon-btn${starred ? " active" : ""}`} data-action="star" data-id={item.id} title={starred ? "Remove star" : "Star message"} aria-label={starred ? "Remove star" : "Star message"}>
          <Icon name="star" className={starred ? "icon starred" : "icon"} />
        </button>
        {inTrash ? (
          <>
            <button type="button" className="icon-btn" data-action="restore" data-id={item.id} title="Move to inbox" aria-label="Move to inbox"><Icon name="archive" /></button>
            <button type="button" className="icon-btn danger" data-action="destroy" data-id={item.id} title="Delete forever" aria-label="Delete forever"><Icon name="trash" /></button>
          </>
        ) : (
          <button type="button" className="icon-btn" data-action="trash" data-id={item.id} title="Delete" aria-label="Delete"><Icon name="trash" /></button>
        )}
        <button type="button" className="icon-btn" data-action="unread" data-id={item.id} title="Mark unread" aria-label="Mark unread"><Icon name="envelope" /></button>
        <span className="divider" />
        <button type="button" className="icon-btn" data-action="reply" data-id={item.id} title="Reply" aria-label="Reply"><Icon name="reply" /></button>
      </div>
      <div className="detail-wrap">
        <h1>{item.subject || "(no subject)"}</h1>
        {state.profile?.role === "teacher" && state.folder === "all" ? (
          <div className="oversight-note"><Icon name="layers" />Teacher view: you can review every message in this class.</div>
        ) : null}
        {item.moderationStatus === "flagged" && (state.profile?.role === "teacher" || item.fromUid === me) ? (
          <div className="moderation-note"><Icon name="alert" /><span><strong>Flagged for review.</strong> {item.flaggedTerms?.length ? `Detected: ${item.flaggedTerms.slice(0, 4).join(", ")}` : "Potentially inappropriate language detected."}</span></div>
        ) : null}
        <div className="message-meta">
          <span className={`avatar${item.fromRole === "teacher" ? " teacher" : ""}`}>{initials(item.fromName || "Unknown")}</span>
          <span className="meta-copy"><strong>{item.fromName || "Unknown"}</strong><span>{displayEmail(item.fromName || "Unknown")}</span><span>To {to}</span></span>
          <span className="meta-date">{formatFullDate(item.createdAt)}</span>
        </div>
        <ViewedBy api={api} itemType="message" itemId={item.id} authorId={item.fromUid} />
        <div className="message-body"><Linkify value={item.body} /></div>
        <MessageFiles api={api} />
        <div className="reply-box">
          <button type="button" className="btn primary" data-action="reply" data-id={item.id}><Icon name="reply" />Reply</button>
        </div>
      </div>
    </>
  );
}

function DraftDetail({ api, item }: { api: AppApi; item: MailItem & { kind: "draft" } }) {
  return (
    <>
      <div className="detail-toolbar">
        <button type="button" className="icon-btn detail-back" data-action="back" aria-label="Back to list" onClick={() => api.actions.setView("list")}><Icon name="back" /></button>
        <button type="button" className="btn ghost" data-action="edit-draft" data-id={item.id}>Edit draft</button>
        <button type="button" className="icon-btn danger" data-action="delete-draft" data-id={item.id} title="Delete draft" aria-label="Delete draft"><Icon name="trash" /></button>
      </div>
      <div className="detail-wrap">
        <h1>{item.subject || "(no subject)"}</h1>
        <div className="message-meta">
          <span className="avatar">{initials("Draft")}</span>
          <span className="meta-copy"><strong>Unsaved draft</strong><span>To {item.to || "no recipient yet"}</span></span>
          <span className="meta-date">{formatDate(item.updatedAt)}</span>
        </div>
        <div className="message-body"><Linkify value={item.body || "No message text yet."} /></div>
        <div className="draft-detail-actions">
          <button type="button" className="btn primary" data-action="edit-draft" data-id={item.id}>Continue editing</button>
          <button type="button" className="btn ghost" data-action="delete-draft" data-id={item.id}>Delete draft</button>
        </div>
      </div>
    </>
  );
}

function MessageFiles({ api }: { api: AppApi }) {
  const files = api.state.messageFiles;
  const fileUrl = api.actions.fileUrl;
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [previews, setPreviews] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    setUrls({});
    setPreviews({});
    files.forEach(async (file, index) => {
      try {
        const url = await fileUrl(file.storage_path);
        if (cancelled || !url || url === "#") return;
        setUrls((current) => ({ ...current, [index]: url }));
        if (fileKind(file) === "text" && !file.preview) {
          const text = await fetch(url).then((response) => response.text()).catch(() => "");
          if (!cancelled && text) setPreviews((current) => ({ ...current, [index]: String(text).trim().slice(0, 180) }));
        }
      } catch {
        return;
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fileUrl, files]);

  if (!files.length) return <div id="messageFiles" className="message-files" />;
  return (
    <div id="messageFiles" className="message-files">
      <div className="message-files-title">Attachments <span className="file-count">{files.length}</span></div>
      <div className="message-file-grid">
        {files.map((file, index) => {
          const url = urls[index] || file.thumb || undefined;
          const preview = previews[index] || file.preview;
          return (
            <button type="button" className="message-file-card" key={`${file.id || file.file_name}-${index}`} onClick={() => api.actions.openMessageFile(file, url)} aria-label={`Preview ${file.file_name}`}>
              <FileTile file={file} imageSrc={fileKind(file) === "image" ? url : file.thumb} />
              <span className="message-file-copy">
                <strong className="message-file-name" title={file.file_name}>{file.file_name}</strong>
                <span className="message-file-meta">{fileExt(file)} · {formatFileSize(file.size_bytes)}</span>
                {preview ? <span className="message-file-preview">{preview}</span> : null}
              </span>
              <span className="message-file-open" aria-hidden="true"><Icon name="arrow-right" className="icon icon-sm" /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MailItemList({ api }: { api: AppApi }) {
  const { state, derived } = api;
  if (state.loading && !state.messages.length && !state.drafts.length) return <SkeletonList />;
  const items = derived.currentItems;
  if (!items.length) {
    const icon = state.folder === "trash" ? "trash" : state.folder === "sent" ? "send" : state.folder === "drafts" ? "file" : "inbox";
    return <EmptyState icon={icon} title={derived.empty.title} body={derived.empty.body} />;
  }
  const me = state.profile!.uid;
  return (
    <>
      {items.map((item) => {
        const selected = item.id === state.openId && item.kind === state.openKind;
        const unread = item.kind === "message" && item.toUids.includes(me) && !item.readBy.includes(me);
        const starred = item.kind === "message" && item.starredBy.includes(me);
        const avatarName = item.kind === "draft" ? "Draft" : item.fromName;
        const lineOne = item.kind === "draft" ? "Draft" : state.folder === "sent" || (state.folder === "all" && item.fromUid === me) ? `To: ${item.toNames.join(", ")}` : item.fromName;
        const flagged = item.kind === "message" && item.moderationStatus === "flagged";
        const subject = item.subject || "(no subject)";
        const createdAt = "createdAt" in item ? item.createdAt : item.updatedAt;
        return (
          <div className={`message-row${unread ? " is-unread" : ""}${selected ? " is-open" : ""}`} role="listitem" key={`${item.kind}-${item.id}`}>
            {item.kind === "draft" ? (
              <span className="star-btn" aria-hidden="true"><Icon name="file" className="icon icon-sm" /></span>
            ) : (
              <button type="button" className={`star-btn${starred ? " active" : ""}`} data-action="star" data-id={item.id} aria-label={starred ? "Remove star" : "Star message"}><Icon name="star" className="icon icon-sm" /></button>
            )}
            <button type="button" className="row-main" data-action="open" data-kind={item.kind} data-id={item.id} onClick={() => api.actions.selectItem({ id: item.id, kind: item.kind })}>
              <span className={`avatar${item.kind === "message" && item.fromRole === "teacher" ? " teacher" : ""}`}>{initials(avatarName)}</span>
              <span className="row-body">
                <span className="row-top"><strong>{lineOne}</strong><time>{formatDate(toMs(createdAt))}</time></span>
                <span className="row-subject">
                  {item.kind === "draft" ? <span className="draft-tag">DRAFT</span> : null}
                  {flagged ? <span className="flag-tag">FLAGGED</span> : null}
                  {subject}
                </span>
                <span className="row-snippet">{createSnippet(item.body, 92)}</span>
              </span>
              {unread ? <span className="unread-flag" title="New message" aria-label="New message">!</span> : null}
            </button>
          </div>
        );
      })}
    </>
  );
}
