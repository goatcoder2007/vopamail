import { useRef } from "react";
import type { AppApi } from "../../app-api";
import type { Member } from "../../types";
import { displayEmail, formatFileSize, normalizeName, scanModeration } from "../../utils";
import { FileTile, Icon } from "../shared/ui";

export function ComposePanel({ api }: { api: AppApi }) {
  const { compose, state } = api;
  const fileInput = useRef<HTMLInputElement>(null);
  if (!state.profile) return null;
  const moderation = scanModeration([compose.subject, compose.body].join(" "));
  const parts = compose.to.split(",");
  const query = normalizeName(parts[parts.length - 1] || "");
  const suggestions: Array<{ label: string; title: string }> = [];
  const isTeacher = state.profile.role === "teacher";
  if (isTeacher && "email all students".startsWith(query)) {
    suggestions.push({ label: "Email all students (" + state.members.filter((member) => member.role === "student").length + ")", title: "Send one message to every student in this section" });
  }
  if (isTeacher && ("/all".startsWith(query) || query === "all")) {
    suggestions.push({ label: "/all", title: "Send one message to every student in this section" });
  }
  const contacts = state.members
    .filter((member) => member.uid !== state.profile?.uid)
    .filter((member) => isTeacher || member.role !== "student" || state.settings.studentMessaging !== false)
    .map((member) => ({ member, rank: recipientRank(member, query) }))
    .filter((item) => item.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.member.nameLower.localeCompare(b.member.nameLower))
    .slice(0, 6);
  contacts.forEach((item) => suggestions.push({ label: item.member.name, title: `${displayEmail(item.member.name)} · ${item.member.role}` }));

  return (
    <section id="composePanel" className={`compose-panel${compose.minimized ? " minimized" : ""}`} hidden={!compose.open} aria-label="Compose message">
      <header className="compose-head">
        <h2 id="composeTitle">{compose.title}</h2>
        <div className="compose-head-actions">
          <button id="minimizeCompose" className="icon-btn" type="button" aria-label="Minimize compose" onClick={() => api.actions.updateCompose({ minimized: !compose.minimized })}><Icon name="minus" /></button>
          <button id="closeCompose" className="icon-btn" type="button" aria-label="Close compose" onClick={api.actions.closeComposePanel}><Icon name="close" /></button>
        </div>
      </header>
      <form id="composeForm" className="compose-form" onSubmit={(event) => {
        event.preventDefault();
        void api.actions.sendMessage();
      }}>
        <div className="compose-field compose-field-recipient">
          <label htmlFor="composeTo">To</label>
          <input id="composeTo" type="text" placeholder={isTeacher ? "Name, or /all to email all students" : "Classmate name"} autoComplete="off" value={compose.to} onChange={(event) => api.actions.updateCompose({ to: event.target.value })} />
          <div id="recipientSuggestions" className="recipient-suggestions">
            {query ? suggestions.length ? suggestions.map((suggestion, index) => (
              <button type="button" className={`suggestion${suggestion.label.startsWith("/") || suggestion.label.startsWith("Email all") ? " suggestion-all" : ""}`} key={`${suggestion.label}-${index}`} data-suggest={suggestion.label} title={suggestion.title} onClick={() => {
                const previous = parts.slice(0, -1).filter(Boolean).join(", ");
                const next = previous ? `${previous}, ${suggestion.label.replace(/^Email all students \(.*\)$/, "All students")}` : suggestion.label.replace(/^Email all students \(.*\)$/, "All students");
                api.actions.updateCompose({ to: next });
              }}>{suggestion.label}</button>
            )) : <span className="suggestion suggestion-empty">No matching person</span> : null}
          </div>
        </div>
        <div className="compose-field">
          <label htmlFor="composeSubject">Subject</label>
          <input id="composeSubject" type="text" placeholder="What is this about?" value={compose.subject} onChange={(event) => api.actions.updateCompose({ subject: event.target.value })} />
        </div>
        <label className="sr-only" htmlFor="composeBody">Message</label>
        <textarea id="composeBody" placeholder="Write your message…" value={compose.body} onChange={(event) => api.actions.updateCompose({ body: event.target.value })} />
        <div id="composeModeration" className="compose-moderation" role="status" aria-live="polite" hidden={!moderation.flagged}>
          Flagged words: {moderation.terms.slice(0, 4).join(", ")}
        </div>
        <div id="attachmentChips" className="attachment-chips">
          {compose.attachments.map((file, index) => (
            <div className="attachment-card" key={`${file.path}-${index}`}>
              <FileTile file={file} imageSrc={file.thumb} />
              <span className="attachment-info"><strong className="attachment-name">{file.name}</strong><span className="attachment-meta">{formatFileSize(file.size)}</span></span>
              <button type="button" className="attachment-remove" aria-label={`Remove ${file.name}`} onClick={() => api.actions.removeAttachment(index)}><Icon name="close" className="icon icon-sm" /></button>
            </div>
          ))}
        </div>
        <p id="composeError" className="form-error" role="alert" hidden={!compose.error}>{compose.error}</p>
        <footer className="compose-actions">
          <input id="fileInput" ref={fileInput} type="file" multiple hidden onChange={(event) => {
            if (event.target.files) void api.actions.addAttachments(event.target.files);
            event.target.value = "";
          }} />
          <button id="attachBtn" className="btn ghost" type="button" onClick={() => fileInput.current?.click()}>Attach files</button>
          <button id="sendBtn" className="btn primary" type="submit" disabled={compose.saving}>
            <span>{compose.saving ? "Sending…" : "Send"}</span>
            <Icon name="send" />
          </button>
          <button id="saveDraftBtn" className="btn ghost" type="button" onClick={() => void api.actions.saveDraft(true)} disabled={compose.saving}>Save draft</button>
          <button id="discardBtn" className="icon-btn danger" type="button" title="Discard" aria-label="Discard message" onClick={() => void api.actions.discardCompose()}><Icon name="trash" /></button>
        </footer>
      </form>
    </section>
  );
}

function recipientRank(member: Member, query: string) {
  const name = normalizeName(member.name);
  const email = normalizeName(displayEmail(member.name));
  const local = email.split("@")[0];
  if (name.startsWith(query)) return 0;
  if (name.split(" ").some((part) => part.startsWith(query))) return 1;
  if (local.startsWith(query)) return 2;
  if (email.startsWith(query)) return 3;
  return -1;
}
