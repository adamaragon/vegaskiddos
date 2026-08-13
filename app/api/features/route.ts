import { NextResponse } from "next/server";
import { allowRequest } from "@/lib/rateLimit";

const API = "https://api.airtable.com/v0";
function cfg() {
  return {
    token: process.env.AIRTABLE_TOKEN,
    base: process.env.AIRTABLE_BASE_ID,
  };
}

export interface FeatureDTO {
  id: string;
  title: string;
  description: string;
  votes: number;
  status: string;
  featured: boolean;
}

// GET: list feature ideas sorted by votes (highest first).
export async function GET() {
  const { token, base } = cfg();
  if (!token || !base) return NextResponse.json({ features: [] });
  try {
    const url = `${API}/${base}/Features?pageSize=100&sort%5B0%5D%5Bfield%5D=Votes&sort%5B0%5D%5Bdirection%5D=desc`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 30 },
    });
    if (!res.ok) throw new Error(`Airtable ${res.status}`);
    const data = (await res.json()) as {
      records: { id: string; fields: Record<string, unknown> }[];
    };
    const features: FeatureDTO[] = data.records.map((r) => ({
      id: r.id,
      title: String(r.fields.Title || ""),
      description: String(r.fields.Description || ""),
      votes: Number(r.fields.Votes || 0),
      status: String(r.fields.Status || "idea"),
      featured: Boolean(r.fields.Featured),
    }));
    // Let the CDN serve repeat visitors without re-invoking this function: the
    // feature list changes rarely, so a 60s shared cache + stale-while-revalidate
    // keeps the public /features page off the hot path. Votes still write
    // through POST, and a fresh value appears within the window.
    return NextResponse.json(
      { features },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
    );
  } catch (err) {
    console.error("features list error:", err);
    return NextResponse.json({ features: [] });
  }
}

// POST: submit a new feature idea (starts at 1 vote, status "idea").
export async function POST(req: Request) {
  if (!allowRequest(req, "feature-submit", 8, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }
  const { token, base } = cfg();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = String(body.title || "").trim();
  if (title.length < 3) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (!token || !base) return NextResponse.json({ ok: true, stored: "log" });
  try {
    const res = await fetch(`${API}/${base}/Features`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        records: [{
          fields: {
            Title: title.slice(0, 120),
            Description: String(body.description || "").slice(0, 600),
            Votes: 1,
            Status: "idea",
          },
        }],
        typecast: true,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return NextResponse.json({ ok: true, id: data.records[0].id });
  } catch (err) {
    console.error("feature submit error:", err);
    return NextResponse.json({ error: "Store failed" }, { status: 502 });
  }
}
