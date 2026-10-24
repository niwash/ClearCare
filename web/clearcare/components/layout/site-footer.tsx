// Where the floating menu button shows (phones and tablets, standard design), the text keeps clear
// of the bottom-right corner it sits in, rather than the page leaving room for it below the footer.
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <p className="mx-auto max-w-6xl py-4 pl-4 pr-24 text-xs text-ink-muted md:pl-8 lg:px-8 adult:px-4 md:adult:px-8">
        Contains information from HIQA
      </p>
    </footer>
  );
}
