import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ExternalIcon } from "@/components/ui/external-icon";
import { fullWidthClass } from "@/components/ui/classes";

export const metadata: Metadata = {
  title: "Survey · ClearCare",
  description: "Tell us how easy ClearCare was to use. The survey takes about 5–10 minutes and is anonymous.",
};

// The ClearCare Usability Survey on Microsoft Forms. The embed URL is the one Forms gives under
// Collect responses › Embed. Without embed=true the same form opens as a full page.
const SURVEY_ID = "yxdjdkjpX06M7Nq8ji_V2qWNisTdy2NDgyiB-fzNP15UMVNGOVlFRFdMQVVLVkE0Vk9USEtMNjZaTS4u";
const SURVEY_URL = `https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=${SURVEY_ID}`;
const SURVEY_EMBED_URL = `${SURVEY_URL}&embed=true`;

export default function SurveyPage() {
  return (
    <>
      <SurveyHero />

      <section aria-labelledby="survey-form-h" className="flex flex-col gap-3">
        <h2 id="survey-form-h" className="sr-only">
          Survey form
        </h2>
        <p className="max-w-3xl md:text-lg">
          Your answers help us find what&apos;s unclear or hard to use, so we can make ClearCare better for families
          choosing a nursing home.
        </p>
        <p className="text-ink-muted">
          The survey runs on Microsoft Forms, so your answers go to Microsoft.{" "}
          <Link href="/privacy#survey">How we handle survey answers</Link>
        </p>
        {/* Above the form, so someone who can't see it or struggles with it finds the way out first. */}
        <p className="text-ink-muted">
          Can&apos;t see the form, or finding it hard to answer?{" "}
          <a href={SURVEY_URL} className="inline-flex items-center gap-1 adult:py-2.5" target="_blank" rel="noopener noreferrer">
            Open the survey in a new tab instead
            <ExternalIcon />
          </a>
        </p>
        {/* The form keeps Microsoft's own styling, so Easier to read and dark mode don't reach inside
            it. It scrolls within the frame, which is capped at the window's height. */}
        <iframe
          src={SURVEY_EMBED_URL}
          title="ClearCare Usability Survey"
          className="h-[80vh] max-h-screen min-h-[32rem] w-full rounded-lg border border-line bg-white"
          allowFullScreen
        />
      </section>
    </>
  );
}

// The top of the page, flush under the header, on the soft band every page opens with: the
// breadcrumb, the heading and what to expect.
function SurveyHero() {
  return (
    <section aria-labelledby="survey-page-h" className={`${fullWidthClass} welcome-band -mt-6 md:-mt-10`}>
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-6 md:px-8 md:py-8">
        <Breadcrumb trail={[]} current="Survey" />
        <h1 id="survey-page-h" className="font-heading text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          How easy was ClearCare to use?
        </h1>
        <p className="max-w-2xl text-ink-muted md:text-lg">
          The survey takes about 5–10 minutes, and all answers are anonymous.
        </p>
      </div>
    </section>
  );
}
