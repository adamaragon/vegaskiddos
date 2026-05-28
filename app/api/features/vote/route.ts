import { NextResponse } from "next/server";

const API = "https://api.airtable.com/v0";

// POST { id, dir: 1 | -1 } — adjusts a feature's vote count. Double-vote
// prevention is handled client-side via localStorage (good enough for v1).
export async function POST(req: Request) {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const body = (await req.json().catch(() => ({}))) as { id?: string; dir?: number };
  const id = body.id;
  const dir = body.dir === -1 ? -1 : 1;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!token || !base) return NextResponse.json({ ok: true, votes: null });

  try {
    // read current count
    const getRes = await fetch(`${API}/${base}/Features/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!getRes.ok) throw new Error(`get ${getRes.status}`);
    const cur = (await getRes.json()) as { fields: { Votes?: number } };
    const next = Math.max(0, Number(cur.fields.Votes || 0) + dir);

    const patch = await fetch(`${API}/${base}/Features/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { Votes: next } }),
    });
    if (!patch.ok) throw new Error(`patch ${patch.status}`);
    return NextResponse.json({ ok: true, votes: next });
  } catch (err) {
    console.error("vote error:", err);
    return NextResponse.json({ error: "Vote failed" }, { status: 502 });
  }
}
