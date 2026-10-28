import type { Metadata } from "next";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import type { ReactNode } from "react";
import { GuidesBand } from "@/components/guides/guide-ending";
import { fullWidthClass } from "@/components/ui/classes";
import { OrganisationIcon, type OrganisationKind } from "@/components/ui/organisation-icon";
import { Icon } from "@/components/ui/icons";
import { Chevron, ShowHide } from "@/components/ui/chevron";
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

const FAIR_DEAL_CONTACT_URL = "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/contact/";

// From the HSE's Fair Deal contact page (FAIR_DEAL_CONTACT_URL), checked 19 Oct 2026. Phone numbers
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
    area: "Tipperary",
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
  },
];

const INSPECTION_CONTACTS: Contact[] = [
  {
    name: "HIQA (Health Information and Quality Authority)",
    kind: "regulator",
    purpose: "Registers and inspects nursing homes. Takes concerns, but can't resolve complaints.",
    website: "https://www.hiqa.ie",
    phone: "021 240 9646",
    email: "concerns@hiqa.ie",
  },
];

// The groups after Fair Deal.
const CONTACT_GROUPS: { title: string; contacts: Contact[] }[] = [
  {
    title: "Dementia",
    contacts: [
      {
        name: "The Alzheimer Society of Ireland",
        kind: "charity",
        purpose: "Dementia helpline, day care, carer training and support groups.",
        website: "https://alzheimer.ie",
        phone: "1800 341 341",
        email: "helpline@alzheimer.ie",
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
    title: "Support and Advocacy",
    contacts: [
      {
        name: "Family Carers Ireland",
        kind: "charity",
        purpose: "Support and a careline for family carers, including during a move into a nursing home.",
        website: "https://familycarers.ie",
        phone: "1800 24 07 24",
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
      },
    ],
  },
];

// Each contact link is its own 44px row in the adult-centred design (WCAG 2.5.5). truncate shortens
// long emails and addresses instead of letting them overflow the column.
const contactLinkClass = "adult:block adult:truncate adult:py-2.5";

export default function ContactsPage() {
  return (
    <>
      <ContactsHero />

      <div className="flex max-w-4xl flex-col gap-3">
        <ContactSection title="Inspections and Concerns">
          <ContactList contacts={INSPECTION_CONTACTS} />
        </ContactSection>

        <ContactSection title="Local Nursing Homes Support Offices">
          {/* One closed row per office, so a long entry like Cork's seven lines only shows when asked for. */}
          <ul className="divide-y divide-line rounded-md border border-line">
            {FAIR_DEAL_OFFICES.map((office) => (
              <li key={office.area}>
                <details className="group/office">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
                    <h3 className="font-semibold">{office.area}</h3>
                    <Chevron className="size-5 text-ink-muted group-open/office:rotate-90" />
                  </summary>
                  <div className="flex flex-col gap-2 px-3 pb-3 text-sm md:grid md:grid-cols-[1fr_14rem] md:gap-x-6">
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
            , checked 19 Oct 2026.
          </p>
        </ContactSection>

        <ContactSection title="Fair Deal">
          <ContactList contacts={FAIR_DEAL_CONTACTS} />
        </ContactSection>

        {CONTACT_GROUPS.map((group) => (
          <ContactSection key={group.title} title={group.title}>
            <ContactList contacts={group.contacts} />
          </ContactSection>
        ))}
      </div>

      {/* So nobody leaves without knowing what to ask. The bottom margin cancels the page's padding,
          so it meets the footer. */}
      <GuidesBand
        id="contacts-guides-h"
        title="Before you call"
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
// heading and a line of welcome on a band of brand colour (brand-band, globals.css).
function ContactsHero() {
  return (
    <section aria-labelledby="contacts-page-h" className={`${fullWidthClass} brand-band -mt-6 md:-mt-10`}>
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-6 md:px-8 md:py-8">
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

// A section that starts closed, so the page opens as a short list of topics. The same
// <details> pattern as the guides: no script, "Show" or "Hide" as well as the arrow so it is clear
// it opens, and the browser's find-in-page still opens it.
function ContactSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border border-line bg-surface hover:border-primary open:border-primary">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 md:px-6 [&::-webkit-details-marker]:hidden">
        <h2 className="font-heading text-xl font-semibold md:text-2xl">{title}</h2>
        <ShowHide />
      </summary>
      <div className="flex flex-col gap-3 border-t border-line px-4 py-4 md:px-6">{children}</div>
    </details>
  );
}

// Inside a ContactSection's box, so the rows are divided but not boxed again.
function ContactList({ contacts }: { contacts: Contact[] }) {
  return (
    <ul className="divide-y divide-line">
      {contacts.map((contact) => (
        <li key={contact.name} className="flex flex-col gap-1 py-3 text-sm first:pt-0 md:grid md:grid-cols-[1fr_14rem] md:gap-x-6">
          <div className="flex flex-col gap-1">
            <h3 className="flex items-center gap-2 font-semibold">
              <OrganisationIcon kind={contact.kind} />
              {contact.name}
            </h3>
            <p className="text-ink-muted">{contact.purpose}</p>
            {contact.hours && <p className="text-ink-muted">{contact.hours}</p>}
          </div>
          <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-0.5 text-ink-muted adult:[&>dt]:py-2.5">
            {contact.phone && (
              <>
                <dt className="flex items-center gap-1.5">
                  <Icon name="phone" />
                  Phone
                </dt>
                <dd>
                  <a className={contactLinkClass} href={telHref(contact.phone)}>{contact.phone}</a>
                </dd>
              </>
            )}
            {contact.email && (
              <>
                <dt className="flex items-center gap-1.5">
                  <Icon name="email" />
                  Email
                </dt>
                <dd className="min-w-0 truncate">
                  <a className={contactLinkClass} href={`mailto:${contact.email}`}>{contact.email}</a>
                </dd>
              </>
            )}
            <dt className="flex items-center gap-1.5">
              <Icon name="website" />
              Website
            </dt>
            <dd className="min-w-0 truncate">
              <a href={contact.website} className={contactLinkClass} target="_blank" rel="noopener noreferrer">
                {new URL(contact.website).hostname.replace(/^www\d?\./, "")}
              </a>
            </dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}
