import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function readKey(jsonName: string, plainName: string, legacyName: string) {
  const raw = Deno.env.get(jsonName);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const preferred = (parsed as Record<string, unknown>).default;
        if (typeof preferred === "string" && preferred) return preferred;
        const first = Object.values(parsed)[0];
        if (typeof first === "string" && first) return first;
      }
    } catch (_error) {
      return raw;
    }
  }
  return Deno.env.get(plainName) || Deno.env.get(legacyName) || "";
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function hashHex(value: string) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 16777619);
    h2 = Math.imul(h2 + code, 2246822519);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

function emailFor(classCode: string, name: string) {
  const key = classCode + "|student|" + normalizeName(name);
  return "cm." + hashHex(key).slice(0, 16) + "@classroommail.school";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = readKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
  const secretKey = readKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return json({ error: "Missing Supabase configuration" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return json({ error: "You must be signed in" }, 401);
  }

  let payload: { studentId?: string; classCode?: string; newName?: string; newPassword?: string };
  try {
    payload = await req.json();
  } catch (_error) {
    return json({ error: "Invalid request" }, 400);
  }
  const studentId = payload.studentId;
  const classCode = String(payload.classCode || "").trim();
  const newName = payload.newName ? String(payload.newName).trim().replace(/\s+/g, " ") : "";
  const newPassword = payload.newPassword ? String(payload.newPassword) : "";
  if (!studentId || !classCode || (!newName && !newPassword)) {
    return json({ error: "A student, section, and at least one change are required" }, 400);
  }
  if (newName && (newName.length < 1 || newName.length > 60)) {
    return json({ error: "Name must be 1–60 characters" }, 400);
  }
  if (newPassword && newPassword.length < 6) {
    return json({ error: "Password must be at least 6 characters" }, 400);
  }

  const { data: teacherSection, error: teacherSectionError } = await userClient
    .from("teacher_sections")
    .select("class_code")
    .eq("teacher_id", authData.user.id)
    .eq("class_code", classCode)
    .maybeSingle();
  if (teacherSectionError) {
    return json({ error: "Could not verify teacher access" }, 500);
  }
  if (!teacherSection) {
    return json({ error: "Only a teacher of this section can edit student accounts" }, 403);
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false }
  });
  const { data: student, error: studentError } = await admin
    .from("members")
    .select("id, class_code, role")
    .eq("id", studentId)
    .eq("class_code", classCode)
    .eq("role", "student")
    .maybeSingle();
  if (studentError) {
    return json({ error: "Could not look up that student" }, 500);
  }
  if (!student) {
    return json({ error: "That student is not in this section" }, 404);
  }

  if (newName) {
    const lower = normalizeName(newName);
    const { data: existing, error: existingError } = await admin
      .from("members")
      .select("id")
      .eq("class_code", classCode)
      .eq("name_lower", lower)
      .eq("role", "student")
      .neq("id", studentId)
      .maybeSingle();
    if (existingError) {
      return json({ error: "Could not check that student name" }, 500);
    }
    if (existing) {
      return json({ error: "That name is already used in this section" }, 409);
    }
  }

  const attributes: {
    password?: string;
    email?: string;
    email_confirm?: boolean;
    user_metadata?: Record<string, unknown>;
  } = {};
  if (newPassword) attributes.password = newPassword;
  if (newName) {
    attributes.email = emailFor(classCode, newName);
    attributes.email_confirm = true;
    attributes.user_metadata = {
      class_code: classCode,
      display_name: newName,
      role: "student"
    };
  }
  const { error: updateError } = await admin.auth.admin.updateUserById(studentId, attributes);
  if (updateError) {
    return json({ error: "Could not update that account" }, 500);
  }

  if (newName) {
    const { error: memberError } = await admin
      .from("members")
      .update({ name: newName, name_lower: normalizeName(newName) })
      .eq("id", studentId);
    if (memberError) {
      return json({ error: "Could not update that student" }, 500);
    }
  }

  return json({ ok: true });
});
