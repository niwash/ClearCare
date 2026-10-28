import { AccountControlsView } from "@/components/auth/account-controls-view";
import { endSession } from "@/lib/auth-actions";
import { authConfigured, authRuntime } from "@/lib/auth";

// Reads the ClearCare session on the server, so no token is ever handed to the browser, then
// renders the controls the page needs.
export async function AccountControls({ variant }: { variant: "header" | "menu" }) {
  const configured = authConfigured();
  const session = configured ? await authRuntime().auth() : null;
  const email = session?.user?.email ?? null;

  return (
    <div className={variant === "header" ? "hidden sm:block" : "border-t border-line px-4 py-3"}>
      <AccountControlsView
        email={email}
        configured={configured}
        signOutAction={endSession}
      />
    </div>
  );
}
