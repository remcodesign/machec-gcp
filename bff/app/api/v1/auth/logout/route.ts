import { proxyAuthRequest } from "@/lib/authProxy";

export async function POST() {
  return proxyAuthRequest("/api/v1/auth/logout");
}
