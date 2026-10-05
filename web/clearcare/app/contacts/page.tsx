import type { Metadata } from "next";
import Link from "next/link";
import { Placeholder } from "@/components/placeholder";
import { Section } from "@/components/section";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Contacts · ClearCare",
  description: "Who to contact about a nursing home in Ireland: regulators, funding, complaints and advocacy.",
};

type Contact = {
  name: string;
  purpose: string;
  website: string;
};

// Phone numbers and emails stay as placeholders until checked against each organisation's site.
const CONTACT_GROUPS: { title: string; contacts: Contact[] }[] = [
  {
    title: "Regulation and inspections",
    contacts: [
      {
        name: "HIQA (Health Information and Quality Authority)",
        purpose: "Registers and inspects nursing homes. Takes information about concerns, but can't resolve individual complaints.",
        website: "https://www.hiqa.ie",
      },
    ],
  },
  {
    title: "Funding and the Fair Deal scheme",
    contacts: [
      {
        name: "HSE Nursing Homes Support Scheme (Fair Deal)",
        purpose: "Runs Fair Deal applications through local Nursing Homes Support Offices.",
        website: "https://www2.hse.ie/services/schemes-allowances/fair-deal-scheme/",
      },
      {
        name: "Citizens Information",
        purpose: "Free, independent information on entitlements, including Fair Deal and long-term care.",
        website: "https://www.citizensinformation.ie",
      },
    ],
  },
  {
    title: "Advocacy and support",
    contacts: [
      {
        name: "Sage Advocacy",
        purpose: "Advocacy for older people and adults in residential care.",
        website: "https://www.sageadvocacy.ie",
      },
      {
        name: "ALONE",
        purpose: "Support and befriending services for older people.",
        website: "https://alone.ie",
      },
    ],
  },
];

export default function ContactsPage() {
  return (
    <>
      <div className="flex max-w-3xl flex-col gap-3">
        <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-5xl">Contacts</h1>
        <p className="text-ink-muted md:text-lg">
          Who to contact about a nursing home in Ireland. ClearCare isn&apos;t connected to any of these organisations.
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
                <dl className="grid grid-cols-[4rem_1fr] gap-x-2 gap-y-0.5 text-ink-muted">
                  <dt>Phone</dt>
                  <dd>
                    <Placeholder>phone</Placeholder>
                  </dd>
                  <dt>Email</dt>
                  <dd>
                    <Placeholder>email</Placeholder>
                  </dd>
                  <dt>Website</dt>
                  <dd className="min-w-0 truncate">
                    <a href={contact.website} target="_blank" rel="noopener noreferrer">
                      {new URL(contact.website).hostname.replace(/^www\d?\./, "")}
                    </a>
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Section title="Guides" description="Plain-language explainers.">
        <ul className="grid gap-2 sm:grid-cols-2">
          {GUIDES.map((guide) => (
            <li key={guide.slug} className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
              <Link href={`/guides/${guide.slug}`} className="font-semibold">
                {guide.title}
              </Link>
              <p className="mt-1 text-ink-muted">{guide.summary}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
