import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";

const clerkEnabled = (process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? "demo") === "clerk";

export default function SignInPage() {
  if (!clerkEnabled) redirect("/login");
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <SignIn />
    </div>
  );
}
