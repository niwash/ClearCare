// app/(site)/alerts/unsubscribe/page.tsx
// The page an alert email's unsubscribe link opens (CCARE-271). It is public: no session, no site
// token, only the capability in the address (ADR-0034). The page itself changes nothing — it hands
// the token to a button, and the POST that stops every alert is sent when the visitor presses it.
//
// No search engine should hold this address, so it is noindex. The token is read here and passed
// down; it is never rendered.
import type { Metadata } from "next";

import { UnsubscribeConfirm } from "@/components/alerts/unsubscribe-confirm";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { unsubscribeToken } from "@/lib/alerts";

export const metadata: Metadata = {
  title: "Stop alerts · ClearCare",
  description: "Stop every ClearCare alert for this email address.",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parameters = await searchParams;
  const raw = Array.isArray(parameters.token) ? parameters.token[0] : parameters.token;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="w-full max-w-xl">
        <Breadcrumb trail={[]} current="Stop alerts" />
      </div>
      <UnsubscribeConfirm token={unsubscribeToken(raw)} />
    </div>
  );
}
