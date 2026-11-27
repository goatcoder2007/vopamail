import { expect, test, type Page } from "@playwright/test";

const classCode = "E2E101";

type SignInOptions = {
  name: string;
  password: string;
  teacher?: boolean;
};

async function signIn(page: Page, options: SignInOptions) {
  await page.goto("/?demo=1");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByLabel("Class code").fill(classCode);
  await page.getByLabel("Your name").fill(options.name);
  await page.getByLabel("Password", { exact: true }).fill(options.password);
  if (options.teacher) {
    await page.locator("#signInForm label").filter({ hasText: "Teacher" }).click();
  }
  await page.getByRole("button", { name: "Open mailbox" }).click();
  await expect(page.locator("#appShell")).toBeVisible();
}

test("password visibility toggle switches input type and icon", async ({ page }) => {
  await page.goto("/?demo=1");
  const password = page.getByLabel("Password", { exact: true });

  await expect(password).toHaveAttribute("type", "password");
  await expect(page.locator(".password-toggle .eye-open")).toBeVisible();
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(page.locator(".password-toggle .eye-closed")).toBeVisible();
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");
});

test("student can sign in, open a message, and send a new one", async ({ page }) => {
  await signIn(page, { name: "Ava Chen", password: "student123" });

  await expect(page.getByRole("button", { name: /Inbox 2/ })).toBeVisible();
  await page.getByRole("button", { name: /Reminder: bring your notebook/ }).click();
  await expect(page.getByRole("heading", { name: "Reminder: bring your notebook" })).toBeVisible();

  await page.getByRole("button", { name: "Compose" }).click();
  await page.getByRole("textbox", { name: "To" }).fill("Teacher");
  await page.getByRole("textbox", { name: "Subject" }).fill("Smoke test");
  await page.getByRole("textbox", { name: "Message" }).fill("This is an end-to-end smoke test.");
  await page.getByRole("button", { name: "Send", exact: true }).click();

  await expect(page.getByRole("alertdialog")).toContainText("Message sent");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByRole("button", { name: /Smoke test/ }).first()).toBeVisible();
});

test("teacher dashboard, roster, and assignments load", async ({ page }) => {
  await signIn(page, { name: "Teacher", password: "teacher123", teacher: true });

  await page.getByRole("button", { name: "All sections" }).click();
  await expect(page.getByText("Section overview")).toBeVisible();
  await expect(page.getByRole("heading", { name: classCode })).toBeVisible();

  await page.getByRole("button", { name: "Class roster" }).click();
  await expect(page.getByRole("heading", { name: "Class roster", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Add a student" })).toBeVisible();

  await page.getByRole("button", { name: "Assignments" }).click();
  await expect(page.getByRole("heading", { name: "Create an assignment" })).toBeVisible();
});

test("supports deep links and browser history", async ({ page }) => {
  await signIn(page, { name: "Ava Chen", password: "student123" });

  await page.goto("/mail/inbox/item/demo-message-2?demo=1");
  await expect(page.getByRole("heading", { name: "Reminder: bring your notebook" })).toBeVisible();
  expect(await page.locator("#sidebar img").evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/mail\/inbox\?demo=1/);

  await page.getByRole("button", { name: "Assignments" }).click();
  await expect(page).toHaveURL(/\/mail\/assignments/);

  await page.getByRole("button", { name: "Announcements" }).click();
  await expect(page).toHaveURL(/\/mail\/announcements/);
});
