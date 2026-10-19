import type { Metadata } from "next";
import { Section } from "@/components/layout/section";

export const metadata: Metadata = {
  title: "Contacts · ClearCare",
  description: "Who to contact about a nursing home in Ireland: regulators, funding, complaints and advocacy.",
};

type Contact = {
  name: string;
  purpose: string;
  website: string;
  // Only set if there is one
  phone?: string;
  email?: string;
};

const CONTACT_GROUPS: { title: string; contacts: Contact[] }[] = [
  {
    title: "Inspections",
    contacts: [
      {
        name: "HIQA (Health Information and Quality Authority)",
        purpose: "Registers and inspects nursing homes. Takes concerns, but can't resolve complaints.",
        website: "https://www.hiqa.ie",
        phone: "021 240 9646",
        email: "concerns@hiqa.ie",
      },
    ],
  },
  {
    title: "Funding and the Fair Deal Scheme",
    contacts: [
      {
        name: "HSE Nursing Homes Support Scheme (Fair Deal)",
        purpose: "Runs Fair Deal applications through local Nursing Homes Support Offices.",
        website: "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/",
        phone: "1800 700 700",
      },
      {
        name: "Citizens Information",
        purpose: "Free information on entitlements, including Fair Deal.",
        website: "https://www.citizensinformation.ie",
        phone: "0818 07 4000",
      },
    ],
  },
  {
    title: "Dementia",
    contacts: [
      {
        name: "The Alzheimer Society of Ireland",
        purpose: "Dementia helpline, day care, carer training and support groups.",
        website: "https://alzheimer.ie",
        phone: "1800 341 341",
        email: "helpline@alzheimer.ie",
      },
      {
        name: "Dementia: Understand Together",
        purpose: "HSE dementia information and a directory of local services.",
        website: "https://www.understandtogether.ie",
        email: "understandtogether@hse.ie",
      },
      {
        name: "Dementia Ireland",
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
        purpose: "Support and a careline for family carers, including during a move into a nursing home.",
        website: "https://familycarers.ie",
        phone: "1800 24 07 24",
      },
      {
        name: "Sage Advocacy",
        purpose: "Advocacy for older people and adults in residential care.",
        website: "https://www.sageadvocacy.ie",
        phone: "01 536 7330",
        email: "info@sageadvocacy.ie",
      },
      {
        name: "ALONE",
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
      <div className="flex max-w-3xl flex-col gap-3">
        <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-5xl">Contacts</h1>
        <p className="text-ink-muted md:text-lg">
          Who to contact about a nursing home. ClearCare isn&apos;t linked to these organisations.
        </p>
      </div>

      {CONTACT_GROUPS.map((group) => (
        <Section key={group.title} title={group.title}>
          <ul className="divide-y divide-line-soft rounded-lg border border-line bg-surface">
            {group.contacts.map((contact) => (
              <li key={contact.name} className="flex flex-col gap-1 px-4 py-3 text-sm md:grid md:grid-cols-[1fr_14rem] md:gap-x-6">
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold">{contact.name}</h3>
                  <p className="text-ink-muted">{contact.purpose}</p>
                </div>
                <dl className="grid grid-cols-[4rem_1fr] gap-x-2 gap-y-0.5 text-ink-muted adult:[&>dt]:py-2.5">
                  {contact.phone && (
                    <>
                      <dt>Phone</dt>
                      <dd>
                        <a className={contactLinkClass} href={`tel:${contact.phone.replaceAll(" ", "")}`}>{contact.phone}</a>
                      </dd>
                    </>
                  )}
                  {contact.email && (
                    <>
                      <dt>Email</dt>
                      <dd className="min-w-0 truncate">
                        <a className={contactLinkClass} href={`mailto:${contact.email}`}>{contact.email}</a>
                      </dd>
                    </>
                  )}
                  <dt>Website</dt>
                  <dd className="min-w-0 truncate">
                    <a href={contact.website} className={contactLinkClass} target="_blank" rel="noopener noreferrer">
                      {new URL(contact.website).hostname.replace(/^www\d?\./, "")}
                    </a>
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </>
  );
}
