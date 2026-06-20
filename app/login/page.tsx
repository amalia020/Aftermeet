import { LoginForm } from "@/components/LoginForm";
import { isSupabaseConfigured } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm configured={isSupabaseConfigured()} />;
}
