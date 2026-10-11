import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";

const clerkEnabled = (process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? "demo") === "clerk";

export default function SignUpPage() {
  if (!clerkEnabled) redirect("/login");
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <SignUp />
    </div>
  );
}
