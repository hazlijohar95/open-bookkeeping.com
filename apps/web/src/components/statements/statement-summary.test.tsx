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

    expect(screen.getByText("Summary")).toBeInTheDocument();
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

  it("displays total invoiced for customer variant", () => {
    render(
      <StatementSummary
        summary={mockSummary}
        currency="MYR"
        variant="customer"
      />
    );

    expect(screen.getByText("Total Invoiced (Debit)")).toBeInTheDocument();
  });

  it("displays total payments for customer variant", () => {
    render(
      <StatementSummary
        summary={mockSummary}
        currency="MYR"
        variant="customer"
      />
    );

    expect(screen.getByText("Total Payments (Credit)")).toBeInTheDocument();
  });

  it("displays closing balance label for customer variant", () => {
    render(
      <StatementSummary
        summary={mockSummary}
        currency="MYR"
        variant="customer"
      />
    );

    // When closingBalance > 0 for customer, shows "Amount Owed by Customer"
    expect(screen.getByText("Amount Owed by Customer")).toBeInTheDocument();
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

  it("handles vendor variant with correct labels", () => {
    render(
      <StatementSummary
        summary={mockSummary}
        currency="MYR"
        variant="vendor"
      />
    );

    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getByText("Total Billed (Credit)")).toBeInTheDocument();
    expect(screen.getByText("Total Paid (Debit)")).toBeInTheDocument();
    // When closingBalance > 0 for vendor, shows "Amount Owed to Vendor"
    expect(screen.getByText("Amount Owed to Vendor")).toBeInTheDocument();
  });
});
