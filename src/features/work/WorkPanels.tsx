import { useEffect } from "react";
import type { AppApi } from "../../app-api";
import { announcementsForList, assignmentStatus, mySubmission } from "../../selectors";
import type { Assignment, Submission } from "../../types";
import { createSnippet, formatDate, formatFileSize, formatFullDate, initials } from "../../utils";
import { EmptyState, FileTile, Icon, Linkify, ViewedBy } from "../shared/ui";

function dueLabel(assignment: Assignment) {
  return assignment.dueAt ? `Due ${formatFullDate(assignment.dueAt)}` : "No due date";
}

export function AssignmentsList({ api }: { api: AppApi }) {
  const items = api.derived.assignments;
  useEffect(() => {
    if (!api.state.workFormOpen && items.length && !items.some((item) => item.id === api.state.selectedAssignmentId)) {
      api.actions.setSelectedAssignmentId(items[0].id);
    }
  }, [api.actions, api.state.selectedAssignmentId, api.state.workFormOpen, items]);
  if (!items.length) {
    return <EmptyState icon="file" title={api.state.query ? "No assignments found" : "No assignments yet"} body={api.state.profile?.role === "teacher" ? "Create the first assignment for this section." : "Your teacher has not posted an assignment yet."} />;
  }
  return (
    <>
      {items.map((assignment) => {
        const status = assignmentStatus(api.state, assignment);
        const active = !api.state.workFormOpen && assignment.id === api.state.selectedAssignmentId;
        return (
          <button type="button" key={assignment.id} className={`work-row${active ? " active" : ""}`} data-action="select-assignment" data-id={assignment.id}>
            <span className="work-mark"><Icon name="file" /></span>
            <span className="work-copy"><strong>{assignment.title}</strong><small>{dueLabel(assignment)}</small></span>
            <span className={`admin-pill ${status.tone}`}>{status.label}</span>
          </button>
        );
      })}
    </>
  );
}

export function AnnouncementsList({ api }: { api: AppApi }) {
  const items = announcementsForList(api.state);
  useEffect(() => {
    if (!api.state.workFormOpen && items.length && !items.some((item) => item.id === api.state.selectedAnnouncementId)) {
      api.actions.setSelectedAnnouncementId(items[0].id);
    }
  }, [api.actions, api.state.selectedAnnouncementId, api.state.workFormOpen, items]);
  if (!items.length) {
    return <EmptyState icon="layers" title={api.state.query ? "No announcements found" : "No announcements yet"} body={api.state.profile?.role === "teacher" ? "Post an update for this section." : "Your teacher has not posted an update yet."} />;
  }
  return (
    <>
      {items.map((announcement) => (
        <button type="button" key={announcement.id} className={`work-row${announcement.id === api.state.selectedAnnouncementId && !api.state.workFormOpen ? " active" : ""}`} data-action="select-announcement" data-id={announcement.id}>
          <span className="work-mark"><Icon name="layers" /></span>
          <span className="work-copy"><strong>{announcement.title}</strong><small>{createSnippet(announcement.body, 72)}</small></span>
          <time>{formatDate(announcement.createdAt)}</time>
        </button>
      ))}
    </>
  );
}

export function AssignmentDetail({ api }: { api: AppApi }) {
  const { state } = api;
  const isTeacher = state.profile?.role === "teacher";
  const assignment = state.workFormOpen ? null : state.assignments.find((item) => item.id === state.selectedAssignmentId) || null;
  const hydrate = api.actions.hydrateSubmissionDraft;
  useEffect(() => {
    if (!isTeacher && assignment && state.submissionDraftFor !== assignment.id) hydrate(assignment.id);
  }, [assignment, hydrate, isTeacher, state.submissionDraftFor]);

  if (!assignment) {
    if (!isTeacher) return <EmptyState icon="file" title="Choose an assignment" body="Select an assignment to see what is due and turn in your work." detail />;
    return (
      <>
        <div className="detail-toolbar"><span className="toolbar-title">New assignment</span></div>
        <div className="detail-wrap">
          <h1>Create an assignment</h1>
          <p className="roster-intro">Post the task, add a due date, and students can turn in their work right here.</p>
          <form id="assignmentForm" data-form="assignment" className="roster-form">
            <div className="roster-fields">
              <label>Title<input name="title" type="text" maxLength={100} placeholder="e.g. Chapter 5 questions" required /></label>
              <label>Due date<input name="dueAt" type="datetime-local" /></label>
            </div>
            <label className="work-field">Instructions<textarea name="instructions" rows={6} placeholder="What should students do?" /></label>
            <button className="btn primary" type="submit">Post assignment</button>
          </form>
        </div>
      </>
    );
  }

  const submissions = state.submissions
    .filter((item) => item.assignmentId === assignment.id)
    .sort((a, b) => b.submittedAt - a.submittedAt);
  const mine = isTeacher ? null : mySubmission(state, assignment.id);
  let body: React.ReactNode;
  if (isTeacher) {
    body = (
      <section className="work-section">
        <div className="work-section-head"><h2>Submissions</h2><span>{submissions.length} turned in</span></div>
        {submissions.length ? submissions.map((submission) => (
          <SubmissionCard key={submission.id} api={api} assignment={assignment} submission={submission} />
        )) : <EmptyState icon="file" title="No submissions yet" body="Student work will appear here as it is turned in." />}
      </section>
    );
  } else if (mine && mine.gradedAt != null) {
    body = (
      <section className="work-section">
        <div className="work-section-head"><h2>Your submission</h2><span className="admin-pill good">Graded</span></div>
        <div className="message-body"><Linkify value={mine.body || "No written response."} /></div>
        <SubmissionFiles api={api} submission={mine} />
        <div className="work-feedback">
          <strong>Teacher feedback</strong>
          <p>{mine.grade ? `Grade: ${mine.grade}` : "Returned"}</p>
          <div className="message-body"><Linkify value={mine.feedback || "No written feedback."} /></div>
        </div>
      </section>
    );
  } else {
    body = (
      <section className="work-section">
        <div className="work-section-head"><h2>{mine ? "Update your submission" : "Turn in your work"}</h2></div>
        <form id="submitForm" data-form="submission" className="roster-form" data-id={assignment.id}>
          <label className="work-field">Your response<textarea name="body" rows={6} placeholder="Write your answer here" value={state.submissionDraftBody} onChange={(event) => api.actions.setSubmissionDraftBody(event.target.value)} /></label>
          <label className="btn ghost work-upload">Attach files<input type="file" multiple hidden data-action="submission-files" onChange={(event) => {
            if (event.target.files) void api.actions.addSubmissionFiles(event.target.files, assignment.id);
            event.target.value = "";
          }} /></label>
          {state.submissionDraftFiles.length ? (
            <div className="draft-files">
              {state.submissionDraftFiles.map((file, index) => (
                <div className="attachment-card" key={`${file.path}-${index}`}>
                  <FileTile file={file} imageSrc={file.thumb} />
                  <span className="attachment-info"><strong className="attachment-name">{file.name}</strong><span className="attachment-meta">{formatFileSize(file.size)}</span></span>
                  <button type="button" className="attachment-remove" data-action="remove-submission-file" data-index={index} aria-label={`Remove ${file.name}`}><Icon name="close" className="icon icon-sm" /></button>
                </div>
              ))}
            </div>
          ) : null}
          <button className="btn primary" type="submit">{mine ? "Update submission" : "Submit assignment"}</button>
        </form>
      </section>
    );
  }

  return (
    <>
      <div className="detail-toolbar">
        <span className="toolbar-title">Assignment</span>
        <div className="work-actions">
          {isTeacher ? (
            <>
              <button className="btn ghost" type="button" data-action="new-assignment">New assignment</button>
              <button className="btn ghost danger" type="button" data-action="delete-assignment" data-id={assignment.id}>Delete</button>
            </>
          ) : null}
          <button className="btn ghost" type="button" data-action="back">Back</button>
        </div>
      </div>
      <div className="detail-wrap work-detail">
        <div className="work-head">
          <h1>{assignment.title}</h1>
          <p className="work-meta">{dueLabel(assignment)} · {formatFullDate(assignment.createdAt)}</p>
          <div className="message-body"><Linkify value={assignment.instructions || "No extra instructions."} /></div>
        </div>
        <ViewedBy api={api} itemType="assignment" itemId={assignment.id} authorId={assignment.teacherId} />
        {body}
      </div>
    </>
  );
}

function SubmissionCard({ api, assignment, submission }: { api: AppApi; assignment: Assignment; submission: Submission }) {
  const student = api.state.members.find((member) => member.uid === submission.studentId);
  const name = student?.name || "Student";
  return (
    <article className="submission-card">
      <div className="submission-head">
        <span className="avatar">{initials(name)}</span>
        <span><strong>{name}</strong><small>{formatFullDate(submission.submittedAt)}</small></span>
        <span className={`admin-pill ${submission.gradedAt != null ? "good" : "progress"}`}>{submission.gradedAt != null ? "Graded" : "Submitted"}</span>
      </div>
      <div className="message-body"><Linkify value={submission.body || "No written response."} /></div>
      <SubmissionFiles api={api} submission={submission} />
      <form id="gradeForm" data-form="grade" className="grade-form" data-id={submission.id}>
        <div className="roster-fields">
          <label>Grade<input name="grade" type="text" maxLength={24} defaultValue={submission.grade} placeholder="e.g. A or 92" /></label>
          <label>Feedback<input name="feedback" type="text" maxLength={160} defaultValue={submission.feedback} placeholder="One short note" /></label>
        </div>
        <button className="btn ghost" type="submit">Save feedback</button>
      </form>
      <span className="sr-only">{assignment.title}</span>
    </article>
  );
}

function SubmissionFiles({ api, submission }: { api: AppApi; submission: Submission }) {
  const files = api.state.submissionFiles.filter((file) => file.submissionId === submission.id);
  if (!files.length) return <p className="roster-hint">No files attached.</p>;
  return (
    <div className="submission-files">
      {files.map((file) => (
        <button type="button" className="submission-file" key={file.id} data-action="open-submission-file" data-path={file.path} data-name={file.name} data-size={file.size} data-type={file.type}>
          <FileTile file={file} />
          <span><strong>{file.name}</strong><small>{formatFileSize(file.size)}</small></span>
        </button>
      ))}
    </div>
  );
}

export function AnnouncementDetail({ api }: { api: AppApi }) {
  const { state } = api;
  const isTeacher = state.profile?.role === "teacher";
  const announcement = state.workFormOpen ? null : state.announcements.find((item) => item.id === state.selectedAnnouncementId) || null;
  if (!announcement) {
    if (!isTeacher) return <EmptyState icon="layers" title="Choose an announcement" body="Select an update to read it here." detail />;
    return (
      <>
        <div className="detail-toolbar"><span className="toolbar-title">New announcement</span></div>
        <div className="detail-wrap">
          <h1>Post an announcement</h1>
          <p className="roster-intro">Share one update with everyone in this section.</p>
          <form id="announcementForm" data-form="announcement" className="roster-form">
            <div className="roster-fields">
              <label>Title<input name="title" type="text" maxLength={100} placeholder="e.g. Friday lab moved" required /></label>
            </div>
            <label className="work-field">Message<textarea name="body" rows={7} placeholder="What does the class need to know?" /></label>
            <button className="btn primary" type="submit">Post announcement</button>
          </form>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="detail-toolbar">
        <span className="toolbar-title">Announcement</span>
        <div className="work-actions">
          {isTeacher ? (
            <>
              <button className="btn ghost" type="button" data-action="new-announcement">New announcement</button>
              <button className="btn ghost danger" type="button" data-action="delete-announcement" data-id={announcement.id}>Delete</button>
            </>
          ) : null}
          <button className="btn ghost" type="button" data-action="back">Back</button>
        </div>
      </div>
      <div className="detail-wrap work-detail">
        <article className="announcement-card">
          <div className="announcement-meta">{formatFullDate(announcement.createdAt)}</div>
          <h1>{announcement.title}</h1>
          <div className="message-body"><Linkify value={announcement.body || "No message text."} /></div>
          <ViewedBy api={api} itemType="announcement" itemId={announcement.id} authorId={announcement.authorId} />
        </article>
      </div>
    </>
  );
}
