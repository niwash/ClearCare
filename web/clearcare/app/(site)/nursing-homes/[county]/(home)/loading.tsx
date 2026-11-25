// app/(site)/nursing-homes/[county]/(home)/loading.tsx
// Shown at once while a home's record loads, coming from search or anywhere else (CCARE-212). Above
// the record's layout, so it covers the name and tabs too, which wait on the same data. In the
// (home) group rather than beside the county's page, so a county's list (../page.tsx) doesn't show
// a home's outline while it loads.
import { RecordLoading } from "@/components/centre/record-loading";

export default function Loading() {
  return <RecordLoading />;
}
