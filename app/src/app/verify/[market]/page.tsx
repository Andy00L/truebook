import type { Metadata } from "next";
import {
  VerifyScreen,
  type VerifyScreenView,
} from "@/components/verify/VerifyScreen";
import { getVerifyMarket } from "@/lib/data/demoVerify";

type VerifyPageProps = {
  params: Promise<{ market: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
};

/** ?view= drives the judge-visible screen states (loading, error). */
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
  return (
    <VerifyScreen
      market={getVerifyMarket(marketSlug)}
      initialView={parseInitialView(view)}
    />
  );
}
