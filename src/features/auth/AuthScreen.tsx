import { useState } from "react";
import type { FormEvent } from "react";
import type { AppApi } from "../../app-api";
import { Icon } from "../shared/ui";

export function AuthScreen({ api }: { api: AppApi }) {
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const message = await api.actions.signIn({
      classCode: String(data.get("classCode") || "").trim(),
      name: String(data.get("displayName") || "").trim(),
      role: data.get("role") === "teacher" ? "teacher" : "student",
      password: String(data.get("password") || "")
    });
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <section id="authScreen" className="auth-screen">
      <div className="auth-art">
        <div className="brand brand-art">
          <span className="school-logo-wrap">
            <img src="valley-of-peace-logo.png" width="428" height="467" alt="Valley of Peace SDA Academy logo" />
          </span>
          <span className="brand-copy">
            <strong>Valley of Peace SDA Academy</strong>
            <small>Vopa Mail — Valley of Peace Academy Mail</small>
          </span>
        </div>
        <div className="art-copy">
          <p className="art-kicker">A safe place to practice</p>
          <h1>Write the message.<br />Learn the habit.</h1>
          <p>Students compose real emails to classmates and their teacher, then see how a mailbox works from the inside.</p>
        </div>
        <div className="art-demo" aria-hidden="true">
          <div className="art-row"><span className="art-avatar">TC</span><span className="art-lines"><i /><i /></span><span className="art-time">9:41</span></div>
          <div className="art-row"><span className="art-avatar">JL</span><span className="art-lines"><i /><i /></span><span className="art-time">9:38</span></div>
          <div className="art-row"><span className="art-avatar teacher">MR</span><span className="art-lines"><i /><i /></span><span className="art-time">8:12</span></div>
        </div>
        <p className="art-foot">Teacher can review every message in the class.</p>
      </div>

      <div className="auth-panel">
        <form id="signInForm" className="auth-card" onSubmit={submit}>
          <div className="brand brand-card">
            <span className="brand-mark small"><Icon name="envelope" /></span>
            <span>Vopa Mail</span>
          </div>
          <h2>Open your mailbox</h2>
          <p className="auth-subtitle">Use the class code your teacher gave you.</p>
          <div className="field">
            <label htmlFor="classCode">Class code</label>
            <input id="classCode" name="classCode" type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="e.g. Infotech101" required maxLength={24} />
          </div>
          <div className="field">
            <label htmlFor="displayName">Your name</label>
            <input id="displayName" name="displayName" type="text" autoComplete="name" placeholder="e.g. Ava Chen" required maxLength={60} />
          </div>
          <div className="field password-field">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrap">
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Your Vopa Mail password" required minLength={6} maxLength={72} />
              <button id="togglePasswordBtn" className="password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>
                <Icon name="eye" className={`icon ${showPassword ? "" : "eye-open"}`} />
                <Icon name="eye-off" className={`icon ${showPassword ? "eye-closed" : ""}`} />
              </button>
            </div>
          </div>
          <fieldset className="field role-field">
            <legend>Account type</legend>
            <div className="segmented">
              <label><input type="radio" name="role" value="student" defaultChecked /><span>Student</span></label>
              <label><input type="radio" name="role" value="teacher" /><span>Teacher</span></label>
            </div>
          </fieldset>
          <p id="authError" className="form-error" role="alert" hidden={!error}>{error}</p>
          <button id="signInBtn" className="btn primary full" type="submit" disabled={busy}>
            <span>{busy ? "Opening…" : "Open mailbox"}</span>
            <Icon name="arrow-right" />
          </button>
          <p id="authNote" className="auth-note">Use the password your teacher gave you. Teachers choose a password when they first create a class.</p>
        </form>
      </div>
    </section>
  );
}
