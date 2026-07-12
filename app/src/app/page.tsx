import {
  LobbyScreen,
  type LobbyDataSource,
  type LobbyScreenView,
} from "@/components/lobby/LobbyScreen";

type LobbyPageProps = {
  searchParams: Promise<{
    view?: string | string[];
    faucet?: string | string[];
    judge?: string | string[];
  }>;
};

/**
 * ?view= drives the judge-visible screen states (loading, empty, error);
 * ?faucet=fail forces the judge panel faucet error for review.
 */
function parseInitialView(
  viewParam: string | string[] | undefined,
): LobbyScreenView {
  const viewValue = Array.isArray(viewParam) ? viewParam[0] : viewParam;
  switch (viewValue) {
    case "loading":
      return "loading";
    case "empty":
      return "empty";
    case "error":
      return "error";
    default:
      return "fixtures";
  }
}

export default async function LobbyPage({ searchParams }: LobbyPageProps) {
  const { view, faucet, judge } = await searchParams;
  const faucetValue = Array.isArray(faucet) ? faucet[0] : faucet;
  const judgeValue = Array.isArray(judge) ? judge[0] : judge;
  // Flip to the live devnet board with NEXT_PUBLIC_DATA_SOURCE=chain.
  const dataSource: LobbyDataSource =
    process.env.NEXT_PUBLIC_DATA_SOURCE === "chain" ? "chain" : "demo";
  return (
    <LobbyScreen
      initialView={parseInitialView(view)}
      initialJudgeOpen={judgeValue === "open"}
      judgeFaucetFails={faucetValue === "fail"}
      dataSource={dataSource}
    />
  );
}
