import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/dashboard/register-form";
import { getServerSession } from "@/lib/auth/session";

function getRoleHomePath(role: "PARENT" | "CHILD" | "SUPER_ADMIN"): "/parent" | "/child" | "/provider" {
  if (role === "SUPER_ADMIN") {
    return "/provider";
  }

  return role === "PARENT" ? "/parent" : "/child";
}

export default async function RegisterPage() {
  const session = await getServerSession();

  if (session) {
    redirect(getRoleHomePath(session.role) as never);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10">
      <RegisterForm />
    </main>
  );
}
