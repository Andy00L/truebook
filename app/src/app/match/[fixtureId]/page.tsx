import type { Metadata } from "next";
import {
  MatchScreen,
  type MatchDataSource,
} from "@/components/match/MatchScreen";
import { getDemoFixture } from "@/lib/data/demoFixtures";
import { getFixtureNames } from "@/lib/chain/fixtureNames";
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
  const demoFixture = getDemoFixture(fixtureId);
  if (demoFixture) {
    return { title: `${demoFixture.homeTeam} vs ${demoFixture.awayTeam}` };
  }
  const chainNames = getFixtureNames(fixtureId);
  return {
    title: chainNames.awayTeam
      ? `${chainNames.homeTeam} vs ${chainNames.awayTeam}`
      : "Match",
  };
}

export default async function MatchPage({
  params,
  searchParams,
}: MatchPageProps) {
  const { fixtureId } = await params;
  const { view } = await searchParams;
  // Flip to the live devnet market with NEXT_PUBLIC_DATA_SOURCE=chain.
  const dataSource: MatchDataSource =
    process.env.NEXT_PUBLIC_DATA_SOURCE === "chain" ? "chain" : "demo";
  return (
    <MatchScreen
      fixtureId={fixtureId}
      initialView={parseInitialView(view)}
      dataSource={dataSource}
    />
  );
}
