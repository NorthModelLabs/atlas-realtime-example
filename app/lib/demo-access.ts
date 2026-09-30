import { NextResponse } from "next/server";
import { token, valid } from "./demo-capability.mjs";
const secret = () => process.env.DEMO_ACCESS_SECRET || "";
export function creationGuard(req: Request): NextResponse | null {
  if (secret().length < 32) return NextResponse.json({error: "Demo is not configured"}, {status: 503});
  const origins = new Set([process.env.DEMO_PUBLIC_ORIGIN || "https://demo.northmodellabs.com", ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [])]);
  let origin = req.headers.get("origin") || "";
  if (!origin && req.method === "GET") { try { origin = new URL(req.headers.get("referer") || "").origin; } catch {} }
  if (!origins.has(origin)) return NextResponse.json({error: "Request origin rejected"}, {status: 403});
  return null;
}
export function accessGuard(req: Request, kind: string, id: string): NextResponse | null {
  if (!["GET", "HEAD"].includes(req.method)) {
    const denied = creationGuard(req); if (denied) return denied;
  }
  const name = `atlas_demo_${kind}_${id}`;
  const value = (req.headers.get("cookie") || "").split(";").map(x => x.trim()).find(x => x.startsWith(name + "="))?.slice(name.length + 1);
  return valid(value, kind, id, secret()) ? null : NextResponse.json({error: "Resource not available in this browser"}, {status: 403});
}
export function grant(response: NextResponse, kind: string, id: string): NextResponse {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new Error("Invalid resource reference");
  response.cookies.set(`atlas_demo_${kind}_${id}`, token(kind, id, secret()), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
    maxAge: 3600, path: kind === "job" ? `/api/jobs/${id}` : `/api/session/${id}`,
  });
  return response;
}
