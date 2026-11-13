import type { Metadata } from "next";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import type { ReactNode } from "react";
import { GuidesBand } from "@/components/guides/guide-ending";
import { fullWidthClass, smallLinkButtonClass } from "@/components/ui/classes";
import { IconCircle, type Tint } from "@/components/ui/icon-circle";
import { OrganisationIcon, type OrganisationKind } from "@/components/ui/organisation-icon";
import { ICON_PATHS, Icon, type IconName } from "@/components/ui/icons";
import { Chevron } from "@/components/ui/chevron";
import { getGuide } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Contacts · ClearCare",
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

// A local HSE Nursing Homes Support Office, which handles Fair Deal applications for its area.
// Laid out like the HSE's own list: the address one line per row, then every phone line.
type FairDealOffice = {
  area: string;
  address?: string[];
  phones: string[];
  email?: string;
  hours?: string;
};

// The day the page's contacts were last checked against their sources, shown at the top of the
// page. Change it whenever they are checked again.
const LAST_CHECKED = { iso: "2026-11-13", label: "13 November 2026" };

const FAIR_DEAL_CONTACT_URL ="https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/contact/";

// From the HSE's Fair Deal contact page (FAIR_DEAL_CONTACT_URL), checked 13 Nov 2026. Phone numbers
// are spaced the same way throughout. Longford and Westmeath's listed address is a Tullamore street
// with a Tipperary Eircode, so it's left out.
const FAIR_DEAL_OFFICES: FairDealOffice[] = [
  {
    area: "Carlow and Kilkenny",
    address: ["Community Services", "James's Green", "Kilkenny", "R95 RP26"],
    phones: ["056 778 4761", "056 778 4763", "056 778 4709"],
  },
  {
    area: "Cavan and Monaghan",
    address: ["HSE Offices", "Town Hall Street", "Cavan", "H12 W3R2"],
    phones: ["049 437 7119", "049 437 7115", "049 437 7114", "049 437 7113"],
  },
  {
    area: "Cork and Kerry",
    address: ["Floor 1, Áras Sláinte", "Wilton Road", "Cork", "T12 XRR0"],
    phones: ["021 492 3536", "021 492 3537", "021 492 3538", "021 492 3539", "021 492 3540", "021 492 3541", "021 492 3542"],
  },
  {
    area: "Donegal",
    address: ["Donegal PCCC HQ", "St Joseph's Hospital", "Stranorlar, Lifford", "Co. Donegal", "F93 FCR6"],
    phones: ["074 919 1734", "074 919 1740", "074 919 1737"],
  },
  {
    area: "Dublin North City and County",
    address: ["Older Person Services", "Nexus Building, Units 4 & 5", "Blanchardstown Corporate Park", "Dublin 15", "D15 CF9K"],
    phones: ["01 897 6121"],
  },
  {
    area: "Dublin South, Wicklow and Kildare",
    address: ["Hawthorn House", "Millennium Park", "Naas, Co. Kildare", "W91 FY53"],
    phones: ["045 920 000"],
  },
  {
    area: "Galway",
    address: ["Lá Nua, Ballybane Neighbourhood Village", "Castlepark Road, Ballybane", "Galway", "H91 VE03"],
    phones: ["091 748 490"],
    email: "fairdeal.galway@hse.ie",
    hours: "Phones open 10am–12pm and 3–4pm, Monday to Friday",
  },
  {
    area: "Laois and Offaly",
    address: ["Bury Quay", "Tullamore", "Co. Offaly", "R35 NF29"],
    phones: ["057 935 9734", "057 932 7832"],
  },
  {
    area: "Limerick, Clare and North Tipperary",
    address: ["St Joseph's Hospital", "Mulgrave Street", "Limerick", "V94 C8DV"],
    phones: ["061 461 499"],
  },
  { area: "Longford and Westmeath", phones: ["044 939 4995"], email: "LPF.RespiteLW@hse.ie" },
  {
    area: "Louth and Meath",
    address: ["Unit 3, Ardee Business Park", "Hale Street, Ardee", "Co. Louth", "A92 VC53"],
    phones: ["041 687 1515", "041 687 1525"],
  },
  {
    area: "Mayo",
    address: ["St Mary's Headquarters", "Castlebar", "Co. Mayo", "F23 HP58"],
    phones: ["094 904 9176"],
  },
  {
    area: "Roscommon",
    address: ["Government Buildings", "Convent Road", "Roscommon", "F42 VX53"],
    phones: ["090 663 7561", "090 663 7546"],
  },
  {
    area: "Sligo and Leitrim",
    address: ["Markievicz House", "Barrack Street", "Sligo", "F91 XC84"],
    phones: ["071 932 1337"],
  },
  {
    // The HSE lists it as Tipperary South; North Tipperary is the Limerick office's.
    area: "South Tipperary",
    address: ["Community Care Centre", "Western Road, Clonmel", "Co. Tipperary", "E91 HT96"],
    phones: ["052 617 7283"],
  },
  {
    area: "Waterford",
    address: ["Waterford Community Services", "Cork Road", "Waterford", "X91 VX09"],
    phones: ["051 842 963"],
  },
  {
    area: "Wexford",
    address: ["Wexford Community Service", "Georges Street", "Wexford", "Y35 AW96"],
    phones: ["053 911 4316", "053 911 4315"],
  },
];

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

const INSPECTION_CONTACTS: Contact[] = [
  {
    name: "HIQA (Health Information and Quality Authority)",
    kind: "regulator",
    purpose: "Registers and inspects nursing homes, and takes concerns about them.",
    website: "https://www.hiqa.ie",
    phone: "021 240 9646",
    email: "concerns@hiqa.ie",
  },
];

// The groups after Fair Deal.
const CONTACT_GROUPS: { id: "dementia" | "support"; title: string; intro: string; icon: IconName; tint: Tint; contacts: Contact[] }[] = [
  {
    id: "dementia",
    title: "Dementia",
    intro: "Helplines, information and local services for people living with dementia and their families.",
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
    intro: "People who can listen, support you and speak up for the person moving.",
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
];

// Each contact link is its own 44px row in the adult-centred design (WCAG 2.5.5). truncate shortens
// long emails and addresses instead of letting them overflow the column.
const contactLinkClass = "adult:block adult:truncate adult:py-2.5";

type SectionId = "fair-deal" | "concerns" | "offices" | "dementia" | "support";

export default function ContactsPage() {
  return (
    <>
      <ContactsHero />

      {/* Every organisation in view, none behind a fold: there are nine, and a number that has to be
          looked for is a call not made. Two sections to a row from desktop width, so the page's whole
          width is used (CCARE-233). */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ContactSection
          id="fair-deal"
          title="Fair Deal"
          intro="Questions about paying for care, or help with the application form."
          icon="cost"
          tint="gold"
        >
          <ContactList contacts={FAIR_DEAL_CONTACTS} />
        </ContactSection>

        <ContactSection
          id="concerns"
          title="Inspections and Concerns"
          intro="Tell the regulator if something at a home worries you."
          icon="report"
          tint="blue"
        >
          <ContactList contacts={INSPECTION_CONTACTS} />
        </ContactSection>

        {/* The full width of the page: seventeen offices, three to a row on a wide screen. */}
        <ContactSection
          id="offices"
          title="Local Nursing Homes Support Offices"
          intro="Your local office handles Fair Deal applications for its area. Select your area for its address and phone numbers."
          icon="location"
          tint="sage"
          className="lg:col-span-2"
        >
          {/* One closed row per office, so a long entry like Cork's seven lines only shows when asked
              for. items-start: an open office grows without stretching the others in its row. */}
          <ul className="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FAIR_DEAL_OFFICES.map((office) => (
              <li key={office.area} className="rounded-md border border-line">
                <details className="group/office">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
                    <h3 className="font-semibold">{office.area}</h3>
                    <Chevron className="size-5 shrink-0 text-ink-muted group-open/office:rotate-90" />
                  </summary>
                  <div className="flex flex-col gap-2 px-3 pb-3 text-sm">
                    <div className="flex flex-col gap-1">
                      {office.address && (
                        <address className="not-italic text-ink-muted">
                          {office.address.map((line) => (
                            <span key={line} className="block">
                              {line}
                            </span>
                          ))}
                        </address>
                      )}
                      {office.hours && <p className="text-ink-muted">{office.hours}</p>}
                    </div>
                    <dl className="grid grid-cols-[5.5rem_1fr] content-start gap-x-2 gap-y-0.5 text-ink-muted adult:[&>dt]:py-2.5">
                      <dt className="flex items-center gap-1.5">
                        <Icon name="phone" />
                        Phone
                      </dt>
                      <dd className="flex flex-col">
                        {office.phones.map((phone) => (
                          <a key={phone} className={contactLinkClass} href={telHref(phone)}>
                            {phone}
                          </a>
                        ))}
                      </dd>
                      {office.email && (
                        <>
                          <dt className="flex items-center gap-1.5">
                            <Icon name="email" />
                            Email
                          </dt>
                          <dd className="min-w-0 truncate">
                            <a className={contactLinkClass} href={`mailto:${office.email}`}>
                              {office.email}
                            </a>
                          </dd>
                        </>
                      )}
                    </dl>
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">
            Source:{" "}
            <a href={FAIR_DEAL_CONTACT_URL} className="text-ink-muted adult:text-primary" target="_blank" rel="noopener noreferrer">
              HSE Fair Deal contacts
            </a>
            , checked 13 Nov 2026.
          </p>
        </ContactSection>

        {CONTACT_GROUPS.map((group) => (
          <ContactSection key={group.id} id={group.id} title={group.title} intro={group.intro} icon={group.icon} tint={group.tint}>
            <ContactList contacts={group.contacts} />
          </ContactSection>
        ))}
      </div>

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
        <Breadcrumb trail={[]} current="Contacts" />
        <h1 id="contacts-page-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Need to talk to someone?
        </h1>
        <p className="max-w-2xl text-ink-muted md:text-lg">
          These organisations can answer questions about Fair Deal, take a concern about a home, or support you and
          the person moving.
        </p>
      </div>
    </section>
  );
}

function telHref(phone: string) {
  return `tel:${phone.replaceAll(" ", "")}`;
}

// A section's card, open: an icon in a circle of its own soft colour, its heading, a line saying
// what the section is for, then its contacts. The id lets a link elsewhere point to the section;
// scroll-mt keeps the heading clear of the top of the window. Rounded and lifted off the page like
// the home page's cards; plain in the adult-centred design.
function ContactSection({
  id,
  title,
  intro,
  icon,
  tint,
  className = "",
  children,
}: {
  id: SectionId;
  title: string;
  intro: string;
  icon: IconName;
  tint: Tint;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className={`flex scroll-mt-6 flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm md:p-6 adult:rounded-lg adult:shadow-none ${className}`}
    >
      <div className="flex items-center gap-4">
        <IconCircle path={ICON_PATHS[icon]} size="large" tint={tint} />
        <div className="flex flex-col gap-0.5">
          <h2 id={`${id}-h`} className="font-heading text-xl font-semibold md:text-2xl">
            {title}
          </h2>
          <p className="text-ink-muted">{intro}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

// One way to reach an organisation, as a button: 44px tall, so it is easy to tap on a phone. A
// screen reader hears what it is ("Phone: 1800 700 700") as the icon is not read.
function ContactButton({ href, icon, label, external, children }: { href: string; icon: IconName; label: string; external?: boolean; children: ReactNode }) {
  return (
    <a href={href} className={`${smallLinkButtonClass} max-w-full`} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      <Icon name={icon} className="size-4 shrink-0 text-primary" />
      <span className="sr-only">{label}: </span>
      {/* A long email address is cut short rather than pushed out of its card. */}
      <span className="truncate">{children}</span>
    </a>
  );
}

// Inside a ContactSection's box, so the rows are divided but not boxed again. Each organisation is
// its name and what it is for, then a row of buttons: phone first, as most families call. The
// buttons wrap, so nothing has to line up in columns whatever the card's width.
function ContactList({ contacts }: { contacts: Contact[] }) {
  return (
    <ul className="divide-y divide-line-soft">
      {contacts.map((contact) => (
        <li key={contact.name} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
          <div className="flex flex-col gap-1">
            {/* The icon sits in a column as wide as the section's circle above it (w-12, gap-4), so it
                is centred under that circle and the name starts where the section's heading does.
                The words under the name start there too (pl-16). */}
            <h3 className="flex items-center gap-4 font-semibold">
              <span className="grid w-12 shrink-0 place-items-center">
                <OrganisationIcon kind={contact.kind} />
              </span>
              {contact.name}
            </h3>
            <p className="pl-16 text-sm text-ink-muted">{contact.purpose}</p>
            {contact.hours && <p className="pl-16 text-sm text-ink-muted">{contact.hours}</p>}
          </div>
          {/* The buttons keep the card's whole width on a phone, where a long email needs it. */}
          <div className="flex flex-wrap gap-2 sm:pl-16">
            {contact.phone && (
              <ContactButton href={telHref(contact.phone)} icon="phone" label="Phone">
                {contact.phone}
              </ContactButton>
            )}
            {contact.email && (
              <ContactButton href={`mailto:${contact.email}`} icon="email" label="Email">
                {contact.email}
              </ContactButton>
            )}
            <ContactButton href={contact.website} icon="website" label="Website" external>
              {new URL(contact.website).hostname.replace(/^www\d?\./, "")}
            </ContactButton>
          </div>
        </li>
      ))}
    </ul>
  );
}
