import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidSession } from "@/lib/adminAuth";

const API = "https://api.airtable.com/v0";

async function requireAdmin() {
  const c = await cookies();
  return isValidSession(c.get(ADMIN_COOKIE)?.value);
}

// PATCH { action: "approve" | "reject" | "unapprove" } or { fields: {...} }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || "Events";
  if (!token || !base)
    return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    fields?: Record<string, unknown>;
  };

  let fields: Record<string, unknown> = {};
  if (body.action === "approve") fields = { Approved: true, Rejected: false };
  else if (body.action === "reject") fields = { Approved: false, Rejected: true };
  else if (body.action === "unapprove") fields = { Approved: false };
  else if (body.fields) fields = body.fields;
  else return NextResponse.json({ error: "No action" }, { status: 400 });

  try {
    const res = await fetch(`${API}/${base}/${encodeURIComponent(table)}/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields, typecast: true }),
    });
    if (!res.ok) throw new Error(await res.text());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin patch error:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 502 });
  }
}
