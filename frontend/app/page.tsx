import type { Metadata } from "next";
import { AgentDemoConsole } from "@/components/agent-demo-console";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSiteOrigin } from "@/lib/site-url";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

const siteOrigin = getSiteOrigin();

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Cerul",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  description:
    "Video understanding search API for AI agents. Search what is shown in videos, not just what is said.",
  url: siteOrigin,
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <SiteHeader currentPath="/" />

        <main className="flex flex-1 items-center py-10 sm:py-12">
          <AgentDemoConsole />
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
