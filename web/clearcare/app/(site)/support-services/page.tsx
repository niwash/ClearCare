import type { Metadata } from "next";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import type { ReactNode } from "react";
import { GuidesBand } from "@/components/guides/guide-ending";
import { ExternalIcon } from "@/components/ui/external-icon";
import { OfficeFinder } from "@/components/contacts/office-finder";
import { PhoneLine } from "@/components/contacts/phone-line";
import { fullWidthClass } from "@/components/ui/classes";
import { IconCircle, type Tint } from "@/components/ui/icon-circle";
import { OrganisationIcon, type OrganisationKind } from "@/components/ui/organisation-icon";
import { ICON_PATHS, Icon, type IconName } from "@/components/ui/icons";
import { getGuide } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Support Services · ClearCare",
  description: "Who to contact about a nursing home in Ireland: regulators, funding, complaints and advocacy.",
};

type Contact = {
  name: string;
  kind: OrganisationKind;
  purpose: string;
  website: string;
  // Only set if there is one
  phone?: string;
  email?: string;
  hours?: string;
};

// The day the page's contacts were last checked against their sources, shown at the foot of the
// page. Change it whenever they are checked again.
const LAST_CHECKED = { iso: "2026-11-13", label: "13 November 2026" };

// General Fair Deal questions, before and alongside the local office.
const FAIR_DEAL_CONTACTS: Contact[] = [
  {
    name: "HSE Live",
    kind: "public-body",
    purpose: "General questions about Fair Deal and help with the form.",
    website: "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/",
    phone: "1800 700 700",
    hours: "Monday to Friday 8am–8pm, Saturday 9am–5pm",
  },
  {
    name: "Citizens Information",
    kind: "public-body",
    purpose: "Free information on entitlements, including Fair Deal.",
    website: "https://www.citizensinformation.ie",
    phone: "0818 07 4000",
    hours: "Monday to Friday 9am–8pm",
  },
];

// The sections after Fair Deal, in order. Inspections and Concerns last (CCARE-258).
const CONTACT_GROUPS: { id: SectionId; title: string; icon: IconName; tint: Tint; contacts: Contact[] }[] = [
  {
    id: "dementia",
    title: "Dementia",
    icon: "talk",
    tint: "rose",
    contacts: [
      {
        name: "The Alzheimer Society of Ireland",
    kind: "charity",
        purpose: "Dementia helpline, day care, carer training and support groups.",
        website: "https://alzheimer.ie",
        phone: "1800 341 341",
        email: "helpline@alzheimer.ie",
        hours: "Monday to Friday 10am–5pm, Saturday 10am–4pm",
      },
      {
        name: "Dementia: Understand Together",
    kind: "public-body",
        purpose: "HSE dementia information and a directory of local services.",
        website: "https://www.understandtogether.ie",
        email: "understandtogether@hse.ie",
      },
      {
        name: "Dementia Ireland",
    kind: "charity",
        purpose: "Campaigns for better dementia care. Runs training and conferences.",
        website: "https://dementiaireland.com",
        phone: "086 361 2907",
        email: "carmelg@dementiaireland.com",
      },
    ],
  },
  {
    id: "support",
    title: "Support and Advocacy",
    icon: "home",
    tint: "sage",
    contacts: [
      {
        name: "Family Carers Ireland",
    kind: "charity",
        purpose: "Support and a careline for family carers, including during a move into a nursing home.",
        website: "https://familycarers.ie",
        phone: "1800 24 07 24",
        hours: "Monday to Thursday 9am–5:30pm, Friday 9am–5pm",
      },
      {
        name: "Sage Advocacy",
    kind: "charity",
        purpose: "Advocacy for older people and adults in residential care.",
        website: "https://www.sageadvocacy.ie",
        phone: "01 536 7330",
        email: "info@sageadvocacy.ie",
      },
      {
        name: "ALONE",
    kind: "charity",
        purpose: "Support and befriending services for older people.",
        website: "https://alone.ie",
        phone: "0818 222 024",
        hours: "Every day 8am–8pm",
      },
    ],
  },
  {
    id: "concerns",
    title: "Inspections and Concerns",
    icon: "report",
    tint: "blue",
    contacts: [
      {
        name: "HIQA (Health Information and Quality Authority)",
    kind: "regulator",
        purpose: "Registers and inspects nursing homes, and takes concerns about them.",
        website: "https://www.hiqa.ie",
        phone: "021 240 9646",
        email: "concerns@hiqa.ie",
      },
    ],
  },
];

type SectionId = "fair-deal" | "concerns" | "dementia" | "support";

export default function ContactsPage() {
  return (
    <>
      <ContactsHero />

      {/* Section by section (CCARE-258): each one's heading in a column of its own on the left, its
          organisations on the right, two to a row, each read top to bottom. Not cards, so nothing is
          boxed twice. Fair Deal first, with the local offices inside it: in user testing (P2_1) the
          participant couldn't say what the offices did when they had a section of their own.
          Applications go to them, so they lead. Flush under the page's top band, cancelling the page's gap. */}
      <div className="-mt-6 flex flex-col md:-mt-8">
        <ContactSection
          id="fair-deal"
          title="Fair Deal"
          icon="cost"
          tint="gold"
        >
          <section id="offices" aria-labelledby="offices-h" className="scroll-mt-6">
            <OfficeFinder>
              <h3 id="offices-h" className="text-lg font-semibold">
                Apply through your local office
              </h3>
              <p className="text-sm text-ink-muted">
                Your local HSE Nursing Homes Support Office processes Fair Deal applications for your area.
              </p>
            </OfficeFinder>
          </section>
          {/* The general helplines, under a line; each one's own words say what it helps with. */}
          <div className="border-t border-line-soft pt-6">
            <ContactList contacts={FAIR_DEAL_CONTACTS} />
          </div>
        </ContactSection>

        {CONTACT_GROUPS.map((group) => (
          <ContactSection key={group.id} id={group.id} title={group.title} icon={group.icon} tint={group.tint}>
            <ContactList contacts={group.contacts} />
          </ContactSection>
        ))}
      </div>

      {/* The emergency numbers, after the organisations and over the note on when they were checked
          (CCARE-258). */}
      <EmergencyStrip />

      {/* When the details were last checked, so a reader knows how far to trust them. An "i" in a
          light amber box, as the notes in the guides (CCARE-233). */}
      <aside className="flex max-w-3xl items-start gap-3 rounded-lg border border-on-tint-gold/30 bg-tint-gold px-4 py-3 text-sm">
        <Icon name="info" className="size-5 shrink-0 text-on-tint-gold" />
        <p>
          <span className="font-semibold">
            Contacts last checked <time dateTime={LAST_CHECKED.iso}>{LAST_CHECKED.label}</time>.
          </span>{" "}
          Phone numbers and opening hours can change. If one doesn&apos;t work, check the organisation&apos;s website.
        </p>
      </aside>

      {/* So nobody leaves without knowing what to ask. The bottom margin cancels the page's padding,
          so it meets the footer. */}
      <GuidesBand
        id="contacts-guides-h"
        title="Know what to ask"
        intro="Our guides explain Fair Deal and inspection reports, and what to ask a nursing home."
        guides={CONTACTS_GUIDES}
        className="-mb-6 md:-mb-10"
      />
    </>
  );
}

// The guides that help most before a call, in the order a family needs them.
const CONTACTS_GUIDES = [getGuide("how-a-family-chooses"), getGuide("choosing-a-nursing-home"), getGuide("fair-deal")];

// The top of the page, flush under the header as on the resources page: the breadcrumb, the
// heading and a line of welcome on the soft welcome band (welcome-band, globals.css).
function ContactsHero() {
  return (
    <section aria-labelledby="contacts-page-h" className={`${fullWidthClass} welcome-band -mt-6 md:-mt-10`}>
      <div className="page-column flex flex-col items-start gap-3 px-4 py-6 md:px-8 md:py-8">
        <Breadcrumb trail={[]} current="Support Services" />
        <h1 id="contacts-page-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Need to talk to someone?
        </h1>
        <p className="max-w-2xl text-ink-muted md:text-lg">
          These organisations can help you apply for Fair Deal, support you and the person moving, or take a concern
          about a home.
        </p>
      </div>
    </section>
  );
}

// In an emergency, 999 or 112, the same service. A phone icon beside each, as every number on the
// page has (PhoneLine).
function EmergencyStrip() {
  return (
    <aside
      aria-labelledby="emergency-h"
      className="flex flex-col gap-3 rounded-lg border border-on-tint-rose/30 bg-tint-rose px-4 py-3 sm:w-fit sm:flex-row sm:items-center sm:gap-6"
    >
      <p id="emergency-h" className="font-semibold text-on-tint-rose">
        In an emergency, call
      </p>
      {/* Read as one sentence: "call 999 or 112", each number with its phone icon. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <PhoneLine phone="999" who="emergency services" />
        <span className="font-semibold text-on-tint-rose">or</span>
        <PhoneLine phone="112" who="emergency services" />
      </div>
    </aside>
  );
}

// A section: on the left from desktop width, an icon in a circle of its own soft colour with its
// heading, staying in view while its organisations scroll past
// on the right. Stacked on a phone. The id lets a link elsewhere point to the section; scroll-mt
// keeps the heading clear of the top of the window.
function ContactSection({
  id,
  title,
  icon,
  tint,
  children,
}: {
  id: SectionId;
  title: string;
  icon: IconName;
  tint: Tint;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={`${fullWidthClass} ${SECTION_BANDS[id]} scroll-mt-6 adult:border-line adult:not-first:border-t`}>
      <div className="page-column grid gap-6 px-4 py-8 md:px-8 md:py-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <div className="flex items-center gap-4 lg:sticky lg:top-[calc(var(--header-offset)+1.5rem)] lg:self-start">
          {/* On white, so it stands out from its band, which is near its own colour. */}
          <IconCircle path={ICON_PATHS[icon]} size="large" tint={tint} className="bg-surface!" />
          <h2 id={`${id}-h`} className="font-heading text-2xl font-semibold">
            {title}
          </h2>
        </div>
        <div className="flex flex-col gap-6">{children}</div>
      </div>
    </section>
  );
}

// Each section on a band the full width of the window, so one ends and the next begins without a
// line between them (CCARE-258). The soft wash of the page's top (welcome-band, globals.css), at
// the same angle, but between warm tints only, a different pair for each, each thinned to under
// half with the page's cream so the bands stay soft. Written out in full so
// Tailwind finds them. The adult-centred design turns the tints to its plain band colour, so there
// a line between sections keeps them apart (ContactSection).
const SECTION_BANDS: Record<SectionId, string> = {
  "fair-deal": "bg-[linear-gradient(120deg,color-mix(in_srgb,var(--tint-gold)_45%,var(--page)),color-mix(in_srgb,var(--warm)_45%,var(--page)))]",
  concerns: "bg-[linear-gradient(120deg,color-mix(in_srgb,var(--warm)_45%,var(--page)),color-mix(in_srgb,var(--tint-rose)_45%,var(--page)))]",
  dementia: "bg-[linear-gradient(120deg,color-mix(in_srgb,var(--tint-rose)_45%,var(--page)),color-mix(in_srgb,var(--tint-gold)_45%,var(--page)))]",
  support: "bg-[linear-gradient(120deg,color-mix(in_srgb,var(--warm)_45%,var(--page)),color-mix(in_srgb,var(--tint-gold)_45%,var(--page)))]",
};

// An email or website, as a line of its own under the phone number: its icon in the same column as
// the phone's, then the address as a link. 44px tall in the adult-centred design (WCAG 2.5.5). A
// screen reader hears what it is ("Email: ...") as the icon is not read.
function ContactLink({ href, icon, label, external, children }: { href: string; icon: IconName; label: string; external?: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      className="flex w-fit max-w-full items-center gap-2 font-medium adult:min-h-11"
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <Icon name={icon} className="size-5 shrink-0 text-primary" />
      <span className="sr-only">{label}: </span>
      {/* A long email address wraps rather than being pushed out of its column or cut short. */}
      <span className="min-w-0 wrap-anywhere">{children}</span>
      {/* Another website opens in a new tab: the arrow says so, as on the resources page. */}
      {external && (
        <>
          <span className="sr-only"> (opens in a new tab)</span>
          <ExternalIcon />
        </>
      )}
    </a>
  );
}

// The organisations, two to a row from tablet width, each read top to bottom: its name, what it is
// for and when it's open, then its phone number (PhoneLine, CCARE-258), email and website, one to
// a line, the same for every organisation however long its addresses are.
function ContactList({ contacts }: { contacts: Contact[] }) {
  return (
    <ul className={`grid gap-x-10 gap-y-8 ${contacts.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {contacts.map((contact) => (
        // Two columns: the organisation's icon in the first, everything else in the second, so its
        // name, the words under it and its contact lines all start at the same edge.
        <li key={contact.name} className="grid grid-cols-[2rem_minmax(0,1fr)] content-start gap-x-3 gap-y-3">
          <OrganisationIcon kind={contact.kind} />
          <div className="flex flex-col gap-1">
            <h3 className="flex min-h-8 items-center font-semibold">{contact.name}</h3>
            <p className="text-sm text-ink-muted">{contact.purpose}</p>
            {contact.hours && <p className="text-sm text-ink-muted">{contact.hours}</p>}
          </div>
          <div className="col-start-2 flex flex-col gap-1.5">
            {contact.phone && <PhoneLine phone={contact.phone} who={contact.name} />}
            {contact.email && (
              <ContactLink href={`mailto:${contact.email}`} icon="email" label="Email">
                {contact.email}
              </ContactLink>
            )}
            <ContactLink href={contact.website} icon="website" label="Website" external>
              {new URL(contact.website).hostname.replace(/^www\d?\./, "")}
            </ContactLink>
          </div>
        </li>
      ))}
    </ul>
  );
}
