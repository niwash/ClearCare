import { GuideHeader, guideMetadata } from "@/components/guide-header";
import { Placeholder } from "@/components/placeholder";
import { getGuide } from "@/lib/guides";

const guide = getGuide("reading-inspection-reports");

export const metadata = guideMetadata(guide);

export default function ReadingInspectionReportsGuide() {
  return (
    <>
      <GuideHeader guide={guide} />
      <p>
        <Placeholder>TODO</Placeholder>
      </p>
    </>
  );
}
