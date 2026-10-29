import { AccountControlsView } from "@/components/auth/account-controls-view";
import { endSession, startSignIn, startSignUp } from "@/lib/auth-actions";
import { authRuntime } from "@/lib/auth";
import { authConfigured } from "@/lib/auth-config";

// Reads the ClearCare session on the server, so no token is ever handed to the browser, then
// renders the controls the page needs.
export async function AccountControls({
  variant,
}: {
  variant: "header" | "menu" | "nav";
}) {
  const configured = authConfigured();
  const session = configured ? await authRuntime().auth() : null;
  const email = session?.user?.email ?? null;

  return (
    <div
      className={
        variant === "header" ? "hidden sm:block" : variant === "menu" ? "" : "flex items-center"
      }
    >
      <AccountControlsView
        email={email}
        configured={configured}
        signInAction={startSignIn}
        signUpAction={startSignUp}
        signOutAction={endSession}
        variant={variant}
      />
    </div>
  );
}
