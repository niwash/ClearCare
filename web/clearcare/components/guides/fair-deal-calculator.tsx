"use client";
// components/guides/fair-deal-calculator.tsx
// The Fair Deal calculator (CCARE-237): the figures a family enters, and beside them an estimate of
// the weekly contribution for the first three years in care and after, worked out as they type by
// lib/fair-deal.ts. Nothing entered leaves the browser: there is no form to send and nothing is
// stored. The disclaimer is on the page (app/(site)/guides/fair-deal/calculator/page.tsx), and the
// result repeats its gist, so a reader who only looks at the figure still sees it.
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { textInputClass } from "@/components/ui/classes";
import { estimateFairDeal, FAIR_DEAL_RULES, type FairDealPeriod, type FairDealStatus } from "@/lib/fair-deal";

type Fields = {
  weeklyIncome: string;
  weeklyDeductions: string;
  savings: string;
  homeValue: string;
  otherPropertyValue: string;
  weeklyCareCost: string;
};

const EMPTY: Fields = {
  weeklyIncome: "",
  weeklyDeductions: "",
  savings: "",
  homeValue: "",
  otherPropertyValue: "",
  weeklyCareCost: "",
};

const euro = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euroWhole = (value: number) => euro.format(Math.round(value));

// What a box holds as a number: "12,500" and "€12,500" are read as 12500; anything else as nothing.
function toNumber(text: string): number {
  const value = Number(text.replace(/[€,\s]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

export function FairDealCalculator() {
  const [status, setStatus] = useState<FairDealStatus>("single");
  const [fields, setFields] = useState<Fields>(EMPTY);

  const estimate = estimateFairDeal({
    status,
    weeklyIncome: toNumber(fields.weeklyIncome),
    weeklyDeductions: toNumber(fields.weeklyDeductions),
    savings: toNumber(fields.savings),
    homeValue: toNumber(fields.homeValue),
    otherPropertyValue: toNumber(fields.otherPropertyValue),
    weeklyCareCost: toNumber(fields.weeklyCareCost),
  });
  const rules = FAIR_DEAL_RULES[status];
  const couple = status === "couple";
  const anything = Object.values(fields).some((value) => toNumber(value) > 0);

  const set = (name: keyof Fields) => (value: string) => setFields((current) => ({ ...current, [name]: value }));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      {/* No action and no submit button: the result follows the boxes as they change. Enter in a box
          would otherwise reload the page. */}
      <form className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-5 md:p-6" onSubmit={(event) => event.preventDefault()}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">Who is applying?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <StatusChoice value="single" current={status} onChange={setStatus} label="A single person" hint="Single, widowed, separated or divorced" />
            <StatusChoice value="couple" current={status} onChange={setStatus} label="One of a couple" hint="Married, civil partners, or living together for 3 years" />
          </div>
        </fieldset>

        <MoneyField
          label={couple ? "The couple's weekly income" : "Weekly income"}
          hint="After income tax, PRSI and USC. Add up pensions, earnings, rental income and any other income."
          suffix="a week"
          value={fields.weeklyIncome}
          onChange={set("weeklyIncome")}
        />
        <MoneyField
          label="Allowable deductions (optional)"
          hint="Weekly amounts the HSE may take off income, such as health expenses, interest on a loan on the home, or maintenance paid to someone else. Leave blank if unsure."
          suffix="a week"
          value={fields.weeklyDeductions}
          onChange={set("weeklyDeductions")}
        />
        <MoneyField
          label={couple ? "The couple's savings and investments" : "Savings and investments"}
          hint="Bank, credit union and An Post accounts, shares and other investments."
          value={fields.savings}
          onChange={set("savings")}
        />
        <MoneyField
          label="Value of the home"
          hint="The home the person lived in before care, at what it would sell for. Counted for the first 3 years only. Leave blank if they don't own one."
          value={fields.homeValue}
          onChange={set("homeValue")}
        />
        <MoneyField
          label="Value of any other property or land (optional)"
          hint="Such as a holiday home or a house that is let. This has no 3-year limit."
          value={fields.otherPropertyValue}
          onChange={set("otherPropertyValue")}
        />
        <MoneyField
          label="The nursing home's weekly charge (optional)"
          hint="From the home's price list, to see how much the HSE would pay. It doesn't change the person's own contribution."
          suffix="a week"
          value={fields.weeklyCareCost}
          onChange={set("weeklyCareCost")}
        />

        <button
          type="button"
          onClick={() => setFields(EMPTY)}
          className="w-fit text-sm font-semibold text-primary underline-offset-2 hover:underline tap-target"
        >
          Clear the figures
        </button>
      </form>

      {/* Announced as it changes, politely, so a screen reader hears the new estimate after typing. Beside
          the form on a wide screen, it sticks below the navigation band (--header-offset, CCARE-296). */}
      <section
        aria-labelledby="estimate-h"
        aria-live="polite"
        className="flex flex-col gap-4 rounded-lg bg-band p-5 md:p-6 lg:sticky lg:top-[calc(var(--header-offset)+1.5rem)] adult:border adult:border-line"
      >
        <h2 id="estimate-h" className="font-heading text-2xl font-semibold tracking-tight">
          Estimated weekly contribution
        </h2>

        {anything ? (
          <>
            <Period
              title={estimate.ownsHome ? "Years 1 to 3 in care" : "Each week in care"}
              period={estimate.firstYears}
              couple={couple}
              rate={rules.assetRate}
            />
            {estimate.ownsHome && (
              <Period title="From year 4" note="The home is no longer counted." period={estimate.laterYears} couple={couple} rate={rules.assetRate} />
            )}
            {estimate.firstYears.property > 0 && (
              <p className="text-sm">
                The part from property can be paid later through the optional{" "}
                <Link href="/guides/fair-deal#nursing-home-loan">nursing home loan</Link>, repaid from the estate.
              </p>
            )}
          </>
        ) : (
          <p className="text-ink-muted">Enter some figures to see an estimate.</p>
        )}
      </section>
    </div>
  );
}

function StatusChoice({
  value,
  current,
  onChange,
  label,
  hint,
}: {
  value: FairDealStatus;
  current: FairDealStatus;
  onChange: (value: FairDealStatus) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 has-checked:border-primary has-checked:bg-surface-muted has-focus-visible:ring-2 has-focus-visible:ring-primary">
      <input
        type="radio"
        name="status"
        value={value}
        checked={current === value}
        onChange={() => onChange(value)}
        className="mt-1 size-4 accent-primary"
      />
      <span className="flex flex-col">
        <span className="font-semibold">{label}</span>
        <span className="text-sm text-ink-muted">{hint}</span>
      </span>
    </label>
  );
}

function MoneyField({
  label,
  hint,
  suffix,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  suffix?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <span id={`${id}-hint`} className="text-sm text-ink-muted">
        {hint}
      </span>
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-ink-muted">
          €
        </span>
        {/* Text with a numeric keyboard rather than type="number", which drops "12,500" and changes
            the value on a scroll of the mouse wheel. */}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-describedby={`${id}-hint`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${textInputClass} w-full max-w-56`}
        />
        {suffix && <span className="text-sm text-ink-muted">{suffix}</span>}
      </div>
    </div>
  );
}

function Period({
  title,
  note,
  period,
  couple,
  rate,
}: {
  title: string;
  note?: string;
  period: FairDealPeriod;
  couple: boolean;
  rate: number;
}) {
  const assetPercent = `${(rate * 100).toLocaleString("en-IE")}%`;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
      <h3 className="font-semibold">{title}</h3>
      {note && <p className="text-sm text-ink-muted">{note}</p>}
      <p className="flex items-baseline gap-2">
        <span className="font-heading text-4xl font-semibold text-primary">{euroWhole(period.pays)}</span>
        <span className="text-ink-muted">a week</span>
      </p>
      <p className="text-sm text-ink-muted">About {euroWhole(period.pays * FAIR_DEAL_RULES.weeksInYear)} a year</p>
      <dl className="flex flex-col gap-1 border-t border-line-soft pt-2 text-sm">
        <Line label={`Income (${couple ? "40" : "80"}%)`}>{euroWhole(period.income)}</Line>
        <Line label={`Savings above the disregard (${assetPercent} a year)`}>{euroWhole(period.savings)}</Line>
        <Line label={`Property (${assetPercent} a year)`}>{euroWhole(period.property)}</Line>
        {period.hsePays > 0 && <Line label="The HSE pays the rest">{euroWhole(period.hsePays)}</Line>}
      </dl>
      {period.cappedAtCost && (
        <p className="text-sm">
          The sum comes to {euroWhole(period.total)}, more than the nursing home&apos;s charge, and no one pays more
          than the cost of their care.
        </p>
      )}
    </div>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{children}</dd>
    </div>
  );
}
