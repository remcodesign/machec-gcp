import { proxyCurrentUser } from "@/lib/authProxy";

export async function GET() {
  return proxyCurrentUser();
}
