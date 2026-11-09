// components/centre/centre-photo.tsx
// Where a photo of the home goes, on the overview of its record (CCARE-212): next to the details on
// wide screens, above them on phones, so it is one of the first things a family sees. ClearCare has
// no photos of homes yet; adding them is niwash's task this sprint. Until then the space shows a
// placeholder of the same size, so the layout doesn't jump when photos arrive.
//
// TODO (photos task): take the home's photo(s) as a prop and show them here, with alt text that
// says what each shows. Keep the 4:3 frame, so a missing photo and a real one take the same room.
import { Icon } from "@/components/ui/icons";

export function CentrePhoto({ className = "" }: { className?: string }) {
  return (
    // Not an image yet, so nothing for screen readers to describe: the words say what will be here.
    <div
      className={`flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface-muted p-4 text-center text-ink-muted adult:rounded-lg ${className}`}
    >
      <Icon name="home" className="size-10" />
      <p className="text-sm">Photos of this home are coming soon</p>
    </div>
  );
}
