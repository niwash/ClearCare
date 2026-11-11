// components/centre/nothing-to-flag.tsx
// What What to look at first and What happened next show when they have nothing on them (CCARE-212).
// Their tabs are always there, so a family finds the same four on every home and doesn't wonder where
// one went; the page then says why it's empty, briefly, in one of three ways:
//   - no reports: ClearCare has no inspection reports of the home yet;
//   - unread: the findings couldn't be read just now, so the page can't say whether anything stands
//     out, and says that rather than that nothing does;
//   - clear: the reports were read and no regulation met what What to look at first looks for. Shown
//     as the three checks it makes, ticked, so it reads at a glance and isn't taken for more than it
//     is; the links go to every judgement and the visit questions.
import { Icon, type IconName } from "@/components/ui/icons";
import Link from "next/link";
import type { ReactNode } from "react";
import { sectionCardClass } from "./section-icon";

export type EmptyReason = "no-reports" | "unread" | "clear";

export function emptyReason(hasReports: boolean, findingsRead: boolean): EmptyReason {
  if (!hasReports) return "no-reports";
  return findingsRead ? "clear" : "unread";
}

// What What to look at first checks each regulation for (addFindings, lib/findings.ts), as passed,
// and said as what was found rather than as what wasn't.
function checks(latestInspection: string | undefined, hasCompliancePlan: boolean) {
  return [
    // No regulation judged Not compliant; Substantially compliant ones may remain, hence "serious".
    // With the inspection's date, as a page with findings gives theirs (#170 review).
    `No serious problems found at the latest inspection${latestInspection ? `, ${latestInspection}` : ""}`,
    "No problem found again at a later inspection",
    // No compliance plan whose deadline a later inspection passed without judging the regulation
    // again (promiseNotRejudged). Not "no compliance plan", which a home with a recent one would
    // contradict; and not said at all of a home that never had one, where there was nothing to check.
    ...(hasCompliancePlan ? ["Every compliance plan checked once its deadline passed"] : []),
  ];
}

type NothingToFlagProps = {
  reason: EmptyReason;
  page: "look-first" | "next-steps";
  inspectionsHref: string;
  // What to ask, the questions to take on a visit.
  visitHref?: string;
  hiqaUrl: string;
  // For What to look at first's checks: the date of the latest inspection that judged regulations,
  // as shown, and whether any of the home's reports has a compliance plan.
  latestInspection?: string;
  hasCompliancePlan?: boolean;
};

export function NothingToFlag({ reason, page, inspectionsHref, visitHref, hiqaUrl, latestInspection, hasCompliancePlan = false }: NothingToFlagProps) {
  const history = <ActionLink href={inspectionsHref}>See inspection history</ActionLink>;

  if (reason === "no-reports") {
    return (
      <Card icon="report" title="No inspection reports yet">
        <p className="text-ink-muted">There&apos;s nothing to show until ClearCare has this home&apos;s reports.</p>
        <Actions>
          <a href={hiqaUrl} className={actionClass}>
            Check the HIQA website <span aria-hidden>→</span>
          </a>
        </Actions>
      </Card>
    );
  }
  if (reason === "unread") {
    return (
      <Card icon="info" title="We can't show this right now">
        <p className="text-ink-muted">Please try again in a little while.</p>
        <Actions>{history}</Actions>
      </Card>
    );
  }
  return (
    <Card icon="results" title={page === "look-first" ? "Nothing stands out" : "Nothing to follow up"}>
      {page === "look-first" ? (
        <ul className="flex flex-col gap-2">
          {checks(latestInspection, hasCompliancePlan).map((check) => (
            <li key={check} className="flex items-start gap-2.5">
              <Tick />
              {check}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">There&apos;s no issue here to follow from one inspection to the next.</p>
      )}
      {/* Said once, briefly, so a clear page isn't read as a clean bill of health. */}
      <p className="text-small text-ink-muted">Every home has room to improve, so it&apos;s still worth a look.</p>
      <Actions>
        {history}
        {visitHref && <ActionLink href={visitHref}>Questions to ask on a visit</ActionLink>}
      </Actions>
    </Card>
  );
}

function Card({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <div className={`${sectionCardClass} flex max-w-2xl flex-col gap-3 p-5 md:p-6`}>
      <h3 className="flex items-center gap-3 text-lg font-semibold text-ink">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-tint-sage text-on-tint-sage adult:bg-surface-muted adult:text-ink">
          <Icon name={icon} className="size-5" />
        </span>
        {title}
      </h3>
      {children}
    </div>
  );
}

// A green tick in a circle: passed. Decorative, as the words say the same.
function Tick() {
  return (
    <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-tint-sage text-on-tint-sage adult:bg-surface-muted adult:text-ink">
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

const actionClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink no-underline hover:border-primary adult:rounded-md adult:underline";

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-1 flex flex-wrap gap-2 print:hidden">{children}</div>;
}

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={actionClass}>
      {children} <span aria-hidden>→</span>
    </Link>
  );
}
