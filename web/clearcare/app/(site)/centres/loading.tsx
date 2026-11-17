// app/(site)/centres/loading.tsx
// Shown at once while a home's record loads, coming from search or anywhere else (CCARE-212). Above
// the record's layout, so it covers the name and tabs too, which wait on the same data.
import { RecordLoading } from "@/components/centre/record-loading";

export default function Loading() {
  return <RecordLoading />;
}
