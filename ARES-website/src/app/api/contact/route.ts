import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "contact-submissions.json");

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const required = ["name", "email", "message"];
    for (const key of required) {
      if (!payload?.[key]) {
        return NextResponse.json({ ok: false, error: `${key} is required.` }, { status: 400 });
      }
    }

    const entry = {
      id: crypto.randomUUID(),
      ...payload,
      receivedAt: new Date().toISOString()
    };

    ensureDataDir();

    let existing: any[] = [];
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      existing = raw ? JSON.parse(raw) : [];
    }
    existing.push(entry);
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Unable to save contact form." }, { status: 400 });
  }
}
