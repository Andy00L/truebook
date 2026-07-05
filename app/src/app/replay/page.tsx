import type { Metadata } from "next";
import {
  ReplayScreen,
  type ReplayScreenView,
} from "@/components/replay/ReplayScreen";

export const metadata: Metadata = {
  title: "Replay",
};

type ReplayPageProps = {
  searchParams: Promise<{ view?: string | string[] }>;
};

/** ?view= drives the judge-visible screen states (loading, empty, error). */
function parseInitialView(
  viewParam: string | string[] | undefined,
): ReplayScreenView {
  const viewValue = Array.isArray(viewParam) ? viewParam[0] : viewParam;
  switch (viewValue) {
    case "loading":
      return "loading";
    case "empty":
      return "empty";
    case "error":
      return "error";
    default:
      return "replay";
  }
}

export default async function ReplayPage({ searchParams }: ReplayPageProps) {
  const { view } = await searchParams;
  return <ReplayScreen initialView={parseInitialView(view)} />;
}
