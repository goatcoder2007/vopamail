import { useEffect } from "react";
import type { AppApi } from "../../app-api";
import { displayEmail, initials } from "../../utils";
import { EmptyState } from "../shared/ui";

export function ClassmatesList({ api }: { api: AppApi }) {
  const students = api.derived.classmates;
  useEffect(() => {
    if (students.length && !students.some((student) => student.uid === api.state.selectedClassmateId)) {
      api.actions.setSelectedClassmateId(students[0].uid);
    }
  }, [api.actions, api.state.selectedClassmateId, students]);
  if (!students.length) {
    const noun = api.state.profile?.role === "teacher" ? "student" : "classmate";
    return <EmptyState icon="users" title={api.state.query ? `No ${noun}s found` : `No ${noun}s yet`} body={api.state.query ? "Try a different name or email." : "Students in this section will appear here."} />;
  }
  return (
    <>
      {students.map((student) => (
        <button type="button" key={student.uid} className={`roster-row${student.uid === api.state.selectedClassmateId ? " active" : ""}`} data-action="select-classmate" data-id={student.uid}>
          <span className="avatar">{initials(student.name)}</span>
          <span className="roster-copy"><strong>{student.name}</strong><small>{displayEmail(student.name)}</small></span>
        </button>
      ))}
    </>
  );
}

export function ClassmateDetail({ api }: { api: AppApi }) {
  const student = api.derived.classmates.find((item) => item.uid === api.state.selectedClassmateId);
  if (!student) return <EmptyState icon="users" title="Choose a classmate" body="Select someone from the list to see their details." detail />;
  return (
    <>
      <div className="detail-toolbar"><span className="toolbar-title">Classmate</span></div>
      <div className="detail-wrap">
        <div className="classmate-card">
          <span className="avatar large">{initials(student.name)}</span>
          <h1>{student.name}</h1>
          <p className="classmate-email">{displayEmail(student.name)}</p>
          <p className="classmate-meta">{api.state.profile?.classCode} • student</p>
          <button className="btn primary" type="button" data-action="email-classmate" data-name={student.name}>Email {student.name.split(" ")[0]}</button>
        </div>
      </div>
    </>
  );
}

export function RosterList({ api }: { api: AppApi }) {
  const students = api.state.members.filter((member) => member.role === "student").sort((a, b) => a.nameLower.localeCompare(b.nameLower));
  useEffect(() => {
    if (students.length && !students.some((student) => student.uid === api.state.selectedStudentId)) {
      api.actions.setSelectedStudentId(students[0].uid);
    }
  }, [api.actions, api.state.selectedStudentId, students]);
  if (!students.length) return <EmptyState icon="users" title="No students yet" body="Add a student from the roster panel to create their account." />;
  return (
    <>
      {students.map((student) => (
        <button type="button" key={student.uid} className={`roster-row${student.uid === api.state.selectedStudentId ? " active" : ""}`} data-action="select-student" data-id={student.uid}>
          <span className="avatar">{initials(student.name)}</span>
          <span className="roster-copy"><strong>{student.name}</strong><small>{displayEmail(student.name)}</small></span>
        </button>
      ))}
    </>
  );
}

export function RosterDetail({ api }: { api: AppApi }) {
  const student = api.state.members.find((item) => item.uid === api.state.selectedStudentId && item.role === "student");
  return (
    <>
      <div className="detail-toolbar"><span className="toolbar-title">Manage student accounts</span></div>
      <div className="detail-wrap">
        <h1>Class roster</h1>
        <p className="roster-intro">Create accounts for your students and change their name or password here any time.</p>
        <form id="addStudentForm" data-form="add-student" className="roster-form">
          <h2>Add a student</h2>
          <div className="roster-fields">
            <label>Name<input id="newStudentName" name="name" type="text" maxLength={60} placeholder="e.g. Ava Chen" required /></label>
            <label>Password<input id="newStudentPassword" name="password" type="text" minLength={6} maxLength={72} placeholder="At least 6 characters" required /></label>
          </div>
          <p className="roster-hint">Passwords appear in plain text here so you can share them with students.</p>
          <button className="btn primary" type="submit">Create account</button>
        </form>
        {student ? (
          <form id="editStudentForm" key={student.uid} data-form="edit-student" className="roster-form">
            <h2>Edit account</h2>
            <p className="roster-hint">Change the name or password for <strong>{student.name}</strong>. Leave password blank to keep the current one.</p>
            <div className="roster-fields">
              <label>Name<input id="editStudentName" name="name" type="text" maxLength={60} defaultValue={student.name} required /></label>
              <label>New password<input id="editStudentPassword" name="password" type="text" minLength={6} maxLength={72} placeholder="Leave blank to keep current" /></label>
            </div>
            <div className="roster-actions">
              <button className="btn primary" type="submit">Save changes</button>
              <button className="btn ghost" type="button" data-action="copy-password" data-name={student.name}>Copy name</button>
            </div>
          </form>
        ) : (
          <div className="empty-state"><strong>Select a student</strong><p>Choose a student on the left to edit their account.</p></div>
        )}
      </div>
    </>
  );
}
