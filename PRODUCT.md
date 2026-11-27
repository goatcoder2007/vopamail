# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Teachers managing one or more class sections.
- Students in a section reading class updates, completing assigned work, and messaging their teacher/classmates.

## Product Purpose

Vopa Mail is a class-section workspace for school communication and coursework. It lets a teacher run a section, share updates, assign work, receive submissions, and give feedback in one place. Success means less scattered communication and a clear record of what a class needs to do and what students have turned in.

## Positioning

Each section is a self-contained classroom with its own membership, mail, files, moderation, assignments, and announcements. Roles and section membership control what people can see and do.

## Operating Context

- Users sign in to a class section and work in that section.
- Teachers use an all-sections admin view to review granted sections.
- Teachers can toggle student-to-student messaging per section; students can still email the teacher.
- Teachers use `/all` or the “Email all students” action to message the whole section.
- Attachments and assignment submissions use shared class file storage.
- The app is deployed as a static web frontend backed by Supabase.

## Capabilities and Constraints

- Existing: section-scoped mail, drafts, contacts, file attachments, moderation alerts, class settings, and admin overview.
- New: assignment hub with the full loop — teacher creates an assignment with title, instructions, and due date; students submit with optional files; teacher grades and returns feedback.
- New: announcement board — teacher-only posts visible to everyone in that section.
- Assignments and announcements are scoped to the active class section, never global.
- Student-to-student mail rules do not determine assignment visibility or announcement reading.
- Announcements are read-only for students.
- Existing implementation is plain HTML/CSS/JavaScript in `public`, with Supabase tables and policies in `supabase`, deployed through Vercel.

## Brand Commitments

- Product name: Vopa Mail.
- Voice: plain, school-friendly, and direct.
- Existing section codes such as IT101 and IT202 are real class identifiers and must remain meaningful.

## Evidence on Hand

- `public/app.js`: app state, backend adapter, mail/compose/section workflows.
- `public/index.html` and `public/partials/`: current interface structure.
- `public/styles.css`: incumbent visual language.
- `supabase/schema.sql`, `supabase/file-sharing.sql`, `supabase/moderation.sql`, `supabase/class-settings.sql`: backend schema and policies.
- No testimonials, benchmarks, or external proof assets are available.

## Product Principles

- Section first: every meaningful object belongs to a class section.
- Role clarity: teachers publish and grade; students consume and submit.
- Keep the full loop visible: assigned, submitted, graded.
- Reuse existing course infrastructure instead of creating a second identity or storage system.
- Preserve simple, legible school language over productivity-app jargon.

## Accessibility & Inclusion

- Interface must work on typical school Chromebooks and phones.
- Keyboard and mouse paths should both be usable.
