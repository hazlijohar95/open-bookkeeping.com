import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/test-utils";
import { StatCard } from "./stat-card";
import { CurrencyDollarIcon } from "@/components/ui/icons";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Total Revenue" value="$10,000" />);

    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("$10,000")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <StatCard
        label="Total Revenue"
        value="$10,000"
        description="From 50 invoices"
      />
    );

    expect(screen.getByText("From 50 invoices")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(
      <StatCard
        label="Total Revenue"
        value="$10,000"
        icon={<CurrencyDollarIcon data-testid="icon" />}
      />
    );

    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders positive trend indicator", () => {
    render(
      <StatCard
        label="Total Revenue"
        value="$10,000"
        trend={{ value: 12.5, direction: "up" }}
        description="vs last month"
      />
    );

    expect(screen.getByText("+12.5%")).toBeInTheDocument();
    expect(screen.getByText("vs last month")).toBeInTheDocument();
  });

  it("renders negative trend indicator", () => {
    render(
      <StatCard
        label="Total Revenue"
        value="$10,000"
        trend={{ value: 5.2, direction: "down" }}
      />
    );

    expect(screen.getByText("5.2%")).toBeInTheDocument();
  });

  it("shows loading skeleton when isLoading is true", () => {
    render(<StatCard label="Total Revenue" value="$10,000" isLoading />);

    // When loading, should show skeleton
    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("formats numeric values", () => {
    render(<StatCard label="Count" value={1234567} />);

    expect(screen.getByText("1234567")).toBeInTheDocument();
  });
});
