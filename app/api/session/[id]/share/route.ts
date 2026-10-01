import { NextResponse } from "next/server";
import { accessGuard } from "@/app/lib/demo-access";
import { token } from "@/app/lib/demo-capability.mjs";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = accessGuard(req, "session", id); if (denied) return denied;
  if (!/^ses_[a-f0-9]{20}$/.test(id)) return NextResponse.json({error: "Invalid session"}, {status: 400});
  const capability = token("viewer", id, process.env.DEMO_ACCESS_SECRET || "");
  return NextResponse.json({path: `/watch/${id}#view=${capability}`}, {headers: {"Cache-Control": "no-store"}});
}
