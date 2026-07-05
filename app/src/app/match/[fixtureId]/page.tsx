import type { Metadata } from "next";
import { MatchScreen } from "@/components/match/MatchScreen";
import { getDemoFixture } from "@/lib/data/demoFixtures";
import type { MatchScreenView } from "@/lib/data/useDemoMatch";

type MatchPageProps = {
  params: Promise<{ fixtureId: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
};

/**
 * ?view= drives the judge-visible screen states (loading, post, error);
 * without it the screen opens on the live board.
 */
function parseInitialView(
  viewParam: string | string[] | undefined,
): MatchScreenView {
  const viewValue = Array.isArray(viewParam) ? viewParam[0] : viewParam;
  switch (viewValue) {
    case "loading":
      return "loading";
    case "post":
      return "postMatch";
    case "error":
      return "oddsError";
    default:
      return "live";
  }
}

export async function generateMetadata({
  params,
}: MatchPageProps): Promise<Metadata> {
  const { fixtureId } = await params;
  const fixture = getDemoFixture(fixtureId);
  return {
    title: fixture
      ? `${fixture.homeTeam} vs ${fixture.awayTeam}`
      : "Match",
  };
}

export default async function MatchPage({
  params,
  searchParams,
}: MatchPageProps) {
  const { fixtureId } = await params;
  const { view } = await searchParams;
  return (
    <MatchScreen fixtureId={fixtureId} initialView={parseInitialView(view)} />
  );
}
