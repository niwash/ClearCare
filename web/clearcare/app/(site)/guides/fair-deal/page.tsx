import { GuideEnding } from "@/components/guides/guide-ending";
import { guideMetadata } from "@/components/guides/guide-header";
import { GuideHero } from "@/components/guides/guide-hero";
import { Placeholder } from "@/components/placeholder/placeholder";
import { getGuide } from "@/lib/guides";

const guide = getGuide("fair-deal");

export const metadata = guideMetadata(guide);

export default function FairDealGuide() {
  return (
    <>
      <GuideHero guide={guide} />
      <p>
        <Placeholder>TODO</Placeholder>
      </p>
      <GuideEnding current={guide} />
    </>
  );
}
