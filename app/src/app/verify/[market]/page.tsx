import type { Metadata } from "next";
import {
  VerifyScreen,
  type VerifyDataSource,
  type VerifyScreenView,
} from "@/components/verify/VerifyScreen";
import { getVerifyMarket } from "@/lib/data/demoVerify";
import { truncateMiddle } from "@/lib/format";

type VerifyPageProps = {
  params: Promise<{ market: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
};

function resolveDataSource(): VerifyDataSource {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "chain" ? "chain" : "demo";
}

/** ?view= drives the judge-visible screen states (demo source only). */
function parseInitialView(
  viewParam: string | string[] | undefined,
): VerifyScreenView {
  const viewValue = Array.isArray(viewParam) ? viewParam[0] : viewParam;
  switch (viewValue) {
    case "loading":
      return "loading";
    case "error":
      return "error";
    default:
      return "resolved";
  }
}

export async function generateMetadata({
  params,
}: VerifyPageProps): Promise<Metadata> {
  const { market: marketSlug } = await params;
  if (resolveDataSource() === "chain") {
    // The chain view fetches client-side; a devnet read here would tie page
    // metadata to RPC availability.
    return { title: `Verify ${truncateMiddle(marketSlug, 4, 4)}` };
  }
  const market = getVerifyMarket(marketSlug);
  return {
    title: market
      ? `Verify ${market.marketName} · ${market.fixtureName}`
      : "Verify",
  };
}

export default async function VerifyPage({
  params,
  searchParams,
}: VerifyPageProps) {
  const { market: marketSlug } = await params;
  const { view } = await searchParams;
  const dataSource = resolveDataSource();
  return (
    <VerifyScreen
      dataSource={dataSource}
      marketAddress={marketSlug}
      market={dataSource === "chain" ? null : getVerifyMarket(marketSlug)}
      initialView={parseInitialView(view)}
    />
  );
}
