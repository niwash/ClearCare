// app/(site)/alerts/page.tsx
// Your alerts (CCARE-271): the homes, counties and "every report" an account follows, each with
// Stop. Alerts are started where their target is, not here. The list is read on the server, as the saved search is
// (ADR-0025): the API's token never reaches the browser, and the page cannot name another account's
// subscriptions.
//
// The titles the API returns name the package ("Alerts for a nursing home"), not the target, so a
// home's own name is read from its record here. A handful of homes is a handful of reads, and
// getCentre is cached for the request.
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AlertsList, type AlertRow } from "@/components/alerts/alerts-list";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { fullWidthClass } from "@/components/ui/classes";
import { alertsConfigured, listAlerts } from "@/lib/alerts-api";
import { countyName, type AlertSubscription } from "@/lib/alerts";
import { authRuntime } from "@/lib/auth";
import { authConfigured, sessionSubject } from "@/lib/auth-config";
import { startSignIn } from "@/lib/auth-actions";
import { getCentre } from "@/lib/centres";
import { countyPath, homePath } from "@/lib/home-address";

export const metadata: Metadata = {
  title: "Your alerts · ClearCare",
  description: "The nursing homes, counties and reports you get an email about.",
  // A visitor's own list, as the unsubscribe page is: nothing for a search engine to hold (CCARE-297).
  robots: { index: false, follow: false },
};

const PRIMARY_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover adult:rounded-md";

export default async function AlertsPage() {
  const sub = authConfigured() ? sessionSubject(await authRuntime().auth()) : null;
  const configured = alertsConfigured();

  // Nothing is read for a visitor who is not signed in, or on a deployment without the API.
  const answer = sub && configured ? await listAlerts(sub) : null;
  const rows = answer?.ok ? await rowsFor(answer.subscriptions) : [];

  return (
    <>
      <section aria-labelledby="alerts-h" className={`${fullWidthClass} welcome-band -mt-6 md:-mt-10`}>
        <div className="page-column flex flex-col items-start gap-3 px-4 py-6 md:px-8 md:py-8">
          <Breadcrumb trail={[]} current="Your alerts" />
          <h1 id="alerts-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            Your alerts
          </h1>
          <p className="max-w-2xl text-ink-muted md:text-lg">
            We email you when a new inspection report is added that matches one of your alerts below.
            You can stop any alert at any time, and the emails will stop straight away.
          </p>
        </div>
      </section>

      {!authConfigured() ? (
        <Notice title="Accounts aren't available yet">
          This site can&apos;t offer accounts, so it can&apos;t keep alerts either. You can still search for homes and read
          their reports.
        </Notice>
      ) : !configured ? (
        <Notice title="Alerts aren't available yet">
          This site can&apos;t keep alerts just now. Nothing has changed for the homes you follow.
        </Notice>
      ) : !sub ? (
        <section className="flex max-w-3xl flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-6 adult:rounded-lg">
          <h2 className="font-heading text-xl font-semibold md:text-2xl">Sign in to see your alerts</h2>
          <p className="text-ink-muted">
            Alerts are kept with your account, so you can follow a home on one visit and read the email on another.
          </p>
          <form action={startSignIn}>
            <button type="submit" className={PRIMARY_CLASS}>
              Log in
            </button>
          </form>
          <p className="text-sm text-ink-muted">
            No account yet?{" "}
            <Link href="/privacy" className="text-ink">
              What we keep, and why
            </Link>
            .
          </p>
        </section>
      ) : answer && !answer.ok ? (
        <Notice title="We couldn't read your alerts">
          {answer.detail} Nothing has changed for the alerts you already follow.
        </Notice>
      ) : (
        <AlertsList initial={rows} />
      )}
    </>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex max-w-3xl flex-col gap-2 rounded-2xl border border-line bg-surface p-6 adult:rounded-lg">
      <h2 className="font-heading text-xl font-semibold md:text-2xl">{title}</h2>
      <p className="text-ink-muted">{children}</p>
    </section>
  );
}

// The API's rows as the list shows them: a home by its name, a county by its name, and the
// every-report package as it reads on the site.
async function rowsFor(subscriptions: AlertSubscription[]): Promise<AlertRow[]> {
  const centreIds = [...new Set(subscriptions.filter((row) => row.scope === "CENTRE").map((row) => row.centreId as string))];
  const named = await Promise.all(
    centreIds.map(async (id) => {
      const found = await getCentre(id);
      return [id, found.status === "found" ? found.centre : null] as const;
    }),
  );
  const centres = new Map(named);

  return subscriptions.map((row): AlertRow => {
    if (row.scope === "CENTRE") {
      const id = row.centreId as string;
      const centre = centres.get(id);
      return {
        id: row.id,
        kind: "centre",
        label: centre?.centre_name ?? `Nursing home ${id}`,
        caption: "New reports for this home",
        // A home that couldn't be read goes by its old address, which finds it once it can be.
        href: centre ? homePath(centre) : `/centres/${id}`,
      };
    }
    if (row.scope === "COUNTY") {
      const name = countyName(row.countyId);
      return {
        id: row.id,
        kind: "county",
        label: name ? `Co. ${name}` : "A county",
        caption: "New reports for any home in this county",
        href: name ? countyPath(name) : null,
      };
    }
    return { id: row.id, kind: "all", label: "Every report", caption: "Any new report on the site", href: null };
  });
}
