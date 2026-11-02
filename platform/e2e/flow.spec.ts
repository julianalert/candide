import { expect, test, type Browser } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

// Teacher starts a session, kid joins, sends a message, pins the reply, teacher sees it
// in the gallery. Needs a Supabase project with the migrations and seed applied, and the
// dev server running with AI_MOCK=1 IMAGE_PROVIDER=mock (playwright.config does this).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
test.skip(!url || !serviceKey, "Supabase credentials are required for the end-to-end flow");

const db = () => createClient(url!, serviceKey!, { auth: { persistSession: false } });
const stamp = Date.now();
const teacherEmail = `e2e-teacher-${stamp}@example.com`;
let schoolId: string;
let userId: string;

test.beforeAll(async () => {
  const client = db();
  const { data: school, error } = await client.from("schools").insert({ name: `E2E School ${stamp}`, country: "QA" }).select().single();
  if (error) throw error;
  schoolId = school.id;
  const { data: user, error: userError } = await client.auth.admin.createUser({
    email: teacherEmail,
    email_confirm: true,
    user_metadata: { school_id: schoolId, role: "admin", display_name: "E2E Teacher" },
  });
  if (userError) throw userError;
  userId = user.user.id;
});

test.afterAll(async () => {
  const client = db();
  await client.from("schools").delete().eq("id", schoolId);
  if (userId) await client.auth.admin.deleteUser(userId);
});

async function signInTeacher(browser: Browser, baseURL: string) {
  const { data, error } = await db().auth.admin.generateLink({ type: "magiclink", email: teacherEmail });
  if (error) throw error;
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseURL}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=/teacher`);
  await expect(page.getByRole("heading", { name: "Your classes" })).toBeVisible();
  return { context, page };
}

test("teacher launches, kid builds and pins, gallery shows it", async ({ browser, baseURL }) => {
  const base = baseURL ?? "http://localhost:3000";
  const teacher = await signInTeacher(browser, base);

  // Create a class and read its code.
  await teacher.page.getByLabel("Class name").fill("E2E Dolphins");
  await teacher.page.getByRole("button", { name: "Create class" }).click();
  await expect(teacher.page.getByRole("heading", { name: "E2E Dolphins" })).toBeVisible();
  const code = (await teacher.page.locator(".mono").first().innerText()).trim();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

  // Pick mission 2 and start the session.
  await teacher.page.getByRole("link", { name: "Start a mission" }).click();
  await teacher.page.getByRole("link", { name: /Invent a Creature/ }).click();
  await teacher.page.getByRole("button", { name: "Start session" }).click();
  await expect(teacher.page.locator(".launch-code")).toHaveText(code);
  await expect(teacher.page.getByText(/kids? ha(s|ve) joined/)).toBeVisible();

  // Kid joins in a separate browser context.
  const kidContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const kid = await kidContext.newPage();
  await kid.goto(`${base}/join`);
  await kid.getByLabel("Class code").fill(code);
  await kid.getByLabel("Your first name").fill("Sam");
  await kid.getByRole("button", { name: "Join my class" }).click();
  await expect(kid.getByRole("heading", { name: "Invent a Creature" })).toBeVisible();
  await expect(kid.locator(".kicker")).toHaveText("Sam");

  // Send a message and get the (mock) streamed reply, then pin it.
  await kid.getByLabel("Message your helper").fill("My creature is a frog with wings called Zib");
  await kid.getByRole("button", { name: "Send" }).click();
  const reply = kid.locator(".msg-ai .bubble").filter({ hasText: "frog with wings" });
  await expect(reply).toBeVisible({ timeout: 20_000 });
  await kid.getByRole("button", { name: "Pin", exact: true }).first().click();
  await expect(kid.getByRole("button", { name: "Pinned" })).toBeVisible();
  await expect(kid.getByText("1 pinned")).toBeVisible();

  // A blocked message gets the soft block and nothing else.
  await kid.getByLabel("Message your helper").fill("What is my teacher's phone number");
  await kid.getByRole("button", { name: "Send" }).click();
  await expect(kid.getByText("Let’s keep it about the mission. Try another way?")).toBeVisible({ timeout: 20_000 });

  // Make a picture (mock provider) and pin it.
  await kid.getByRole("button", { name: "Make a picture" }).click();
  await kid.getByLabel("Describe the picture you want").fill("a green frog with butterfly wings in a swamp");
  await kid.getByRole("button", { name: "Make it" }).click();
  await expect(kid.locator("img.picture")).toBeVisible({ timeout: 30_000 });
  await kid.getByRole("button", { name: "Pin", exact: true }).first().click();
  await expect(kid.getByText("2 pinned")).toBeVisible();

  // Teacher sees both pins in the gallery, then the public mirror works too.
  await teacher.page.getByRole("link", { name: "Gallery" }).click();
  await expect(teacher.page.getByRole("heading", { name: "Sam" })).toBeVisible();
  await expect(teacher.page.locator(".gallery-item")).toHaveCount(2);
  await teacher.page.getByRole("link", { name: "Launch page" }).click();

  // End the session: the kid's workspace turns read-only.
  teacher.page.once("dialog", (dialog) => dialog.accept());
  await teacher.page.getByRole("button", { name: "End session" }).click();
  await expect(teacher.page.getByText("This session has ended")).toBeVisible();
  await kid.reload();
  await expect(kid.getByText("Your class gallery →")).toBeVisible();

  await kidContext.close();
  await teacher.context.close();
});
