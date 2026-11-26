import { Fragment } from "react";
import type { AppApi } from "../../app-api";
import type { FileRef, MessageFileRow } from "../../types";
import { fileExt, fileKind } from "../../utils";

export function Sprite() {
  return (
    <svg className="svg-sprite" aria-hidden="true" focusable="false">
      <symbol id="i-envelope" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/></symbol>
      <symbol id="i-pencil" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></symbol>
      <symbol id="i-inbox" viewBox="0 0 24 24"><path d="M4 13h4l2 3h4l2-3h4"/><path d="M5.5 5h13l2.5 8v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Z"/></symbol>
      <symbol id="i-star" viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/></symbol>
      <symbol id="i-send" viewBox="0 0 24 24"><path d="m21 3-8.5 18-2.2-7.3L3 11.5Z"/><path d="m10.3 13.7 4.4-4.4"/></symbol>
      <symbol id="i-file" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></symbol>
      <symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 13h10l1-13"/><path d="M10 11v5M14 11v5"/></symbol>
      <symbol id="i-layers" viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/></symbol>
      <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></symbol>
      <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 4v7h-7"/></symbol>
      <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
      <symbol id="i-reply" viewBox="0 0 24 24"><path d="m9 10-5 5 5 5"/><path d="M4 15h10a6 6 0 0 0 6-6V5"/></symbol>
      <symbol id="i-back" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></symbol>
      <symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
      <symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>
      <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5"/><path d="M18 14.5a6 6 0 0 1 3 5.5"/></symbol>
      <symbol id="i-logout" viewBox="0 0 24 24"><path d="M10 17l5-5-5-5"/><path d="M15 12H4"/><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 13 4 4L19 7"/></symbol>
      <symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 4 2.5 20h19Z"/><path d="M12 10v4M12 17h.01"/></symbol>
      <symbol id="i-archive" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></symbol>
      <symbol id="i-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></symbol>
      <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></symbol>
      <symbol id="i-eye-off" viewBox="0 0 24 24"><path d="M4 4l16 16"/><path d="M9.6 6.1A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.4 3.2"/><path d="M6.3 8.3A16.8 16.8 0 0 0 2.5 12S6 18.5 12 18.5a9.8 9.8 0 0 0 3.1-.5"/><path d="M10 10a3 3 0 0 0 4 4"/></symbol>
    </svg>
  );
}

export function Icon({ name, className = "icon" }: { name: string; className?: string }) {
  return <svg className={className} aria-hidden="true"><use href={`#i-${name}`} /></svg>;
}

export function Linkify({ value }: { value: string }) {
  const text = String(value || "");
  const pattern = /(https?:\/\/[^\s]+|www\.[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
  return (
    <>
      {text.split(pattern).map((part, index) => {
        if (/^https?:\/\//i.test(part)) {
          return <a key={index} href={part} target="_blank" rel="noreferrer">{part}</a>;
        }
        if (/^www\./i.test(part)) {
          return <a key={index} href={`https://${part}`} target="_blank" rel="noreferrer">{part}</a>;
        }
        if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(part)) {
          return <a key={index} href={`mailto:${part}`}>{part}</a>;
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}

export function FileTile({
  file,
  imageSrc
}: {
  file: FileRef | MessageFileRow | { name?: string; path?: string; size?: number; type?: string };
  imageSrc?: string | null;
}) {
  const kind = fileKind(file);
  if (kind === "image" && imageSrc) {
    return <span className="file-tile is-image"><img className="file-tile-img" src={imageSrc} alt="" /></span>;
  }
  return (
    <span className={`file-tile is-${kind}`}>
      <span className="file-tile-sheet" />
      <span className="file-tile-ext">{fileExt(file)}</span>
    </span>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  body,
  detail = false
}: {
  icon?: string;
  title: string;
  body: string;
  detail?: boolean;
}) {
  return (
    <div className={`empty-state${detail ? " detail-empty" : ""}`}>
      <span className="empty-icon"><Icon name={icon} /></span>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

export function SkeletonList() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((index) => (
        <div className="skeleton-row" key={index}>
          <div className="skeleton-line skeleton-avatar" />
          <div className="skeleton-lines">
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </div>
        </div>
      ))}
    </>
  );
}

export function ViewedBy({
  api,
  itemType,
  itemId,
  authorId
}: {
  api: AppApi;
  itemType: "message" | "assignment" | "announcement";
  itemId: string;
  authorId: string;
}) {
  const { state } = api;
  const canView = state.profile?.role === "teacher" || (itemType === "message" && authorId === state.profile?.uid);
  if (!canView) return null;
  const names = state.itemViews
    .filter((view) => view.itemType === itemType && view.itemId === itemId)
    .map((view) => state.members.find((member) => member.uid === view.viewerId)?.name || "Someone");
  return (
    <div className="viewed-by">
      <Icon name="eye" />
      <strong>Viewed by</strong>
      {names.length ? (
        <span className="viewed-names">
          {names.map((name, index) => <span className="admin-pill muted" key={`${name}-${index}`}>{name}</span>)}
        </span>
      ) : (
        <span className="viewed-empty">Not viewed yet</span>
      )}
    </div>
  );
}
