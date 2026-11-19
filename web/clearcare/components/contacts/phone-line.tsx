// components/contacts/phone-line.tsx
// A phone number on the Support Services page (CCARE-258): a phone icon and the number, underlined
// as a link like the email and website under it. In user testing (P2_1) the participant didn't like
// numbers that call as soon as they're tapped. A tel: link doesn't: a phone opens its dialler with
// the number filled in (an iPhone asks "Call …?" first), and a computer offers an app to call with,
// so the person still chooses to call. No Call button beside it; the icon says what it is.
import { Icon } from "@/components/ui/icons";

export function telHref(phone: string) {
  return `tel:${phone.replaceAll(" ", "")}`;
}

// who: the organisation or office, so a screen reader hears "Phone for HSE Live: 1800 700 700".
// 44px tall in the adult-centred design (WCAG 2.5.5), as the email and website links.
export function PhoneLine({ phone, who }: { phone: string; who: string }) {
  return (
    <a href={telHref(phone)} className="flex w-fit items-center gap-2 adult:min-h-11">
      <Icon name="phone" className="size-5 shrink-0 text-primary" />
      <span className="sr-only">Phone for {who}: </span>
      <span className="text-lg font-semibold tabular-nums">{phone}</span>
    </a>
  );
}
