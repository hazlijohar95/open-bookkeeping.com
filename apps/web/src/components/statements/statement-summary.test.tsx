import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/test-utils";
import { StatementSummary } from "./statement-summary";

describe("StatementSummary", () => {
  const mockSummary = {
    openingBalance: 1000,
    totalDebits: 5000,
    totalCredits: 3000,
    closingBalance: 3000,
  };

  it("renders card with title", () => {
    render(
      <StatementSummary
        summary={mockSummary}
        currency="MYR"
        variant="customer"
      />
    );

    expect(screen.getByText("Statement Summary")).toBeInTheDocument();
  });

  it("displays opening balance", () => {
    render(
      <StatementSummary
        summary={mockSummary}
        currency="MYR"
        variant="customer"
      />
    );

    expect(screen.getByText("Opening Balance")).toBeInTheDocument();
  });

  it("displays total debits", () => {
    render(
      <StatementSummary
        summary={mockSummary}
        currency="MYR"
        variant="customer"
      />
    );

    expect(screen.getByText("Total Debits")).toBeInTheDocument();
  });

  it("displays total credits", () => {
    render(
      <StatementSummary
        summary={mockSummary}
        currency="MYR"
        variant="customer"
      />
    );

    expect(screen.getByText("Total Credits")).toBeInTheDocument();
  });

  it("displays closing balance", () => {
    render(
      <StatementSummary
        summary={mockSummary}
        currency="MYR"
        variant="customer"
      />
    );

    expect(screen.getByText("Closing Balance")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(
      <StatementSummary
        summary={mockSummary}
        currency="MYR"
        variant="customer"
        isLoading
      />
    );

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("handles vendor variant", () => {
    render(
      <StatementSummary
        summary={mockSummary}
        currency="MYR"
        variant="vendor"
      />
    );

    // Should render without errors for vendor variant
    expect(screen.getByText("Statement Summary")).toBeInTheDocument();
  });
});
