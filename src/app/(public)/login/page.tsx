import { redirect } from "next/navigation";
import { LoginForm } from "@/components/dashboard/login-form";
import { getServerSession } from "@/lib/auth/session";

export default async function LoginPage() {
  const session = await getServerSession();

  if (session) {
    redirect(session.role === "PARENT" ? "/parent" : "/child");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10">
      <LoginForm />
    </main>
  );
}
