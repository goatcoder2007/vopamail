import type { AppApi } from "../../app-api";
import { formatDate } from "../../utils";
import { EmptyState, Icon, SkeletonList } from "../shared/ui";

export function AdminList({ api }: { api: AppApi }) {
  const overview = api.state.adminOverview;
  if (!overview) {
    return api.state.loading ? <SkeletonList /> : (
      <EmptyState icon="grid" title="No sections yet" body="Sections appear here once students are added." />
    );
  }
  const total = overview.totals;
  return (
    <>
      <div className="admin-summary">
        <span><strong>{total.sections}</strong><small>sections</small></span>
        <span><strong>{total.students}</strong><small>students</small></span>
        <span><strong>{total.messages}</strong><small>messages</small></span>
        <span><strong>{total.unread}</strong><small>unread to you</small></span>
      </div>
      {overview.sections.map((section) => (
        <button type="button" key={section.code} className={`admin-section-row${section.code === api.state.selectedAdminSection ? " active" : ""}`} data-action="select-admin-section" data-code={section.code}>
          <span className="admin-section-main">
            <strong>{section.code}</strong>
            <small>{section.students} students · {section.messages} messages{section.lastActivity ? ` · ${formatDate(section.lastActivity)}` : ""}</small>
          </span>
          <span className="admin-section-flags">
            {section.unread ? <span className="admin-pill" title="Unread messages to you">{section.unread} new</span> : null}
            {section.flagged ? <span className="admin-pill danger" title="Flagged messages">{section.flagged} flagged</span> : null}
            {section.studentMessaging ? null : <span className="admin-pill muted" title="Student-to-student mail is off">S2S off</span>}
          </span>
          <Icon name="arrow-right" className="icon admin-section-arrow" />
        </button>
      ))}
    </>
  );
}

export function AdminDetail({ api }: { api: AppApi }) {
  const section = api.derived.adminSection;
  if (!section) {
    return <EmptyState icon="grid" title="Select a section" body="Choose a section to see its students, messages, and settings." />;
  }
  return (
    <div className="admin-detail">
      <div className="admin-detail-head">
        <span className="admin-eyebrow">Section overview</span>
        <h1>{section.code}</h1>
        <p>Everything in this section, without leaving the dashboard.</p>
      </div>
      <div className="admin-stat-grid">
        <span><strong>{section.students}</strong><small>students</small></span>
        <span><strong>{section.messages}</strong><small>messages</small></span>
        <span><strong>{section.unread}</strong><small>unread to you</small></span>
        <span><strong>{section.flagged}</strong><small>flagged</small></span>
      </div>
      <div className="admin-actions">
        <button type="button" className="btn primary" data-action="admin-open-section" data-code={section.code}>Open section</button>
        <button type="button" className="btn ghost" data-action="admin-email-all" data-code={section.code}>Email all students</button>
      </div>
      <section className="admin-panel">
        <h2>Student-to-student mail</h2>
        <label className="admin-setting-row">
          <input type="checkbox" className="switch-input" data-action="admin-toggle-messaging" data-code={section.code} checked={section.studentMessaging} onChange={() => {}} />
          <span className="switch" aria-hidden="true" />
          <span className="admin-setting-copy"><strong>Allow students to email classmates</strong><small>Off means students can only email you.</small></span>
        </label>
      </section>
      <section className="admin-panel">
        <h2>Students</h2>
        <div className="admin-chip-list">
          {section.studentNames.length ? section.studentNames.map((name, index) => <span className="admin-name-chip" key={`${name}-${index}`}>{name}</span>) : <p className="admin-muted">No students yet.</p>}
        </div>
      </section>
      <section className="admin-panel">
        <h2>Recent messages</h2>
        <div className="admin-recent-list">
          {section.recentMessages.length ? section.recentMessages.map((message) => (
            <button type="button" className="admin-recent-row" key={message.id} data-action="admin-open-message" data-code={section.code} data-id={message.id}>
              <span className="admin-recent-copy"><strong>{message.subject}</strong><small>From {message.fromName} · To {message.toNames.join(", ") || "class"}</small></span>
              <time>{formatDate(message.createdAt)}</time>
            </button>
          )) : <p className="admin-muted">No messages yet.</p>}
        </div>
      </section>
    </div>
  );
}
