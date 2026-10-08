import { GuideHeader, guideMetadata } from "@/components/guides/guide-header";
import { Placeholder } from "@/components/placeholder/placeholder";
import { getGuide } from "@/lib/guides";

const guide = getGuide("choosing-a-nursing-home");

export const metadata = guideMetadata(guide);

export default function ChoosingANursingHomeGuide() {
  return (
    <>
      <GuideHeader guide={guide} />
      <p>
        <Placeholder>TODO</Placeholder>
      </p>
    </>
  );
}
