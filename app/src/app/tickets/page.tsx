import type { Metadata } from "next";
import {
  TicketsScreen,
  type TicketsDataSource,
  type TicketsScreenView,
} from "@/components/tickets/TicketsScreen";

export const metadata: Metadata = {
  title: "Tickets",
};

type TicketsPageProps = {
  searchParams: Promise<{ view?: string | string[] }>;
};

/** ?view= drives the judge-visible screen states (loading, empty, error). */
function parseInitialView(
  viewParam: string | string[] | undefined,
): TicketsScreenView {
  const viewValue = Array.isArray(viewParam) ? viewParam[0] : viewParam;
  switch (viewValue) {
    case "loading":
      return "loading";
    case "empty":
      return "empty";
    case "error":
      return "error";
    default:
      return "tickets";
  }
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const { view } = await searchParams;
  // Flip to the connected wallet's tickets with NEXT_PUBLIC_DATA_SOURCE=chain.
  const dataSource: TicketsDataSource =
    process.env.NEXT_PUBLIC_DATA_SOURCE === "chain" ? "chain" : "demo";
  return (
    <TicketsScreen initialView={parseInitialView(view)} dataSource={dataSource} />
  );
}
