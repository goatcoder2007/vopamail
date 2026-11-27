import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_KEY,
  SECTIONS_KEY,
  clearSession,
  createSnippet,
  displayEmail,
  fileExt,
  fileKind,
  formatFileSize,
  hashHex,
  initials,
  isAllowedFileType,
  normalizeName,
  readJson,
  readSections,
  readSession,
  rememberSection,
  saveSession,
  scanModeration,
  validateClassCode,
  validatePassword
} from "./utils";

function createStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    }
  };
}

describe("utils", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes names into predictable email addresses and initials", () => {
    expect(normalizeName("  Ava   CHEN ")).toBe("ava chen");
    expect(displayEmail("  Ava   Chen! ")).toBe("avachen@vopamail.com");
    expect(initials("  ava chen ")).toBe("AC");
    expect(initials("")).toBe("?");
  });

  it("validates the minimum password length", () => {
    expect(() => validatePassword("12345")).toThrow(/at least 6 characters/);
    expect(() => validatePassword("123456")).not.toThrow();
  });

  it("validates section codes", () => {
    expect(validateClassCode("  IT101  ")).toBe("IT101");
    expect(() => validateClassCode("AB")).toThrow(/3–24 letters/);
    expect(() => validateClassCode("bad_code")).toThrow(/3–24 letters/);
  });

  it("hashes consistently and distinguishes different values", () => {
    expect(hashHex("Demo101")).toBe(hashHex("Demo101"));
    expect(hashHex("Demo101")).not.toBe(hashHex("Demo102"));
    expect(hashHex("Demo101")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("creates clean snippets", () => {
    expect(createSnippet("  A   long\n message ", 40)).toBe("A long message");
    expect(createSnippet("abcdefghij", 4)).toBe("abcd…");
  });

  it("detects moderated language with common obfuscation", () => {
    expect(scanModeration("This is clean.")).toEqual({ flagged: false, severity: "clean", terms: [] });
    const medium = scanModeration("That was stupid.");
    expect(medium.flagged).toBe(true);
    expect(medium.severity).toBe("medium");
    const high = scanModeration("sh1t");
    expect(high.flagged).toBe(true);
    expect(high.severity).toBe("high");
  });

  it("classifies allowed files and formats sizes", () => {
    const file = (name: string, type = "") => ({ name, type }) as File;
    expect(isAllowedFileType(file("notes.TXT"))).toBe(true);
    expect(isAllowedFileType(file("virus.exe"))).toBe(false);
    expect(fileKind({ name: "essay.docx" })).toBe("word");
    expect(fileKind({ type: "application/pdf" })).toBe("pdf");
    expect(fileExt({ name: "essay.DOCX" })).toBe("DOCX");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });

  it("stores sessions and remembers sections without duplicates", () => {
    const profile = {
      uid: "u1",
      classCode: "Demo101",
      name: "Ava Chen",
      nameLower: "ava chen",
      role: "student" as const
    };
    saveSession(profile);
    expect(readSession()).toEqual(profile);
    clearSession();
    expect(readSession()).toBeNull();

    rememberSection("Demo101");
    rememberSection("Demo102");
    rememberSection("Demo101");
    expect(readSections()).toEqual(["Demo101", "Demo102"]);

    for (let index = 0; index < 15; index += 1) rememberSection("Section" + index);
    expect(readSections()).toHaveLength(12);
    expect(SESSION_KEY).toBe("classroomMail.session.v1");
    expect(SECTIONS_KEY).toBe("classroomMail.sections.v1");
  });

  it("falls back when stored JSON is invalid", () => {
    localStorage.setItem("broken", "{not json");
    expect(readJson("broken", ["fallback"])).toEqual(["fallback"]);
  });
});
