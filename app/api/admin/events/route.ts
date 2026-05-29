import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidSession } from "@/lib/adminAuth";

const API = "https://api.airtable.com/v0";

async function requireAdmin() {
  const c = await cookies();
  return isValidSession(c.get(ADMIN_COOKIE)?.value);
}

// GET ?queue=pending|approved — lists events for the admin dashboard.
export async function GET(req: Request) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || "Events";
  if (!token || !base) return NextResponse.json({ events: [] });

  const queue = new URL(req.url).searchParams.get("queue") || "pending";
  const formula =
    queue === "approved"
      ? "{Approved}=1"
      : queue === "rejected"
      ? "{Rejected}=1"
      : "AND(NOT({Approved}),NOT({Rejected}))";

  try {
    const events: unknown[] = [];
    let offset: string | undefined;
    do {
      const url = new URL(`${API}/${base}/${encodeURIComponent(table)}`);
      url.searchParams.set("pageSize", "100");
      url.searchParams.set("filterByFormula", formula);
      url.searchParams.set("sort[0][field]", "Start");
      if (offset) url.searchParams.set("offset", offset);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Airtable ${res.status}`);
      const data = (await res.json()) as {
        records: { id: string; fields: Record<string, unknown> }[];
        offset?: string;
      };
      for (const r of data.records) {
        const f = r.fields;
        events.push({
          id: r.id,
          title: f.Title || "",
          venue: f.Venue || "",
          start: f.Start || "",
          neighborhood: f.Neighborhood || "",
          priceTier: f.PriceTier || "",
          ageTiers: f.AgeTiers || [],
          source: f.Source || "",
          url: f.Url || "",
          description: f.Description || "",
        });
      }
      offset = data.offset;
    } while (offset);
    return NextResponse.json({ events });
  } catch (err) {
    console.error("admin list error:", err);
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
