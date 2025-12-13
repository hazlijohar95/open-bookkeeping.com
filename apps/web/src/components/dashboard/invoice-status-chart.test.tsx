import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/test-utils";
import { InvoiceStatusChart } from "./invoice-status-chart";

describe("InvoiceStatusChart", () => {
  const mockData = {
    pending: 10,
    paid: 25,
    overdue: 5,
    expired: 2,
    refunded: 1,
  };

  it("renders chart card with title", () => {
    render(<InvoiceStatusChart data={mockData} />);

    expect(screen.getByText("Invoice Status")).toBeInTheDocument();
  });

  it("renders description with total count", () => {
    render(<InvoiceStatusChart data={mockData} />);

    // Component shows "{totalInvoices} total invoices"
    expect(screen.getByText("43 total invoices")).toBeInTheDocument();
  });

  it("renders legend items with counts and percentages", () => {
    render(<InvoiceStatusChart data={mockData} />);

    // Legend shows format: "{label}: {count} ({percentage}%)"
    expect(screen.getByText(/Pending: 10/)).toBeInTheDocument();
    expect(screen.getByText(/Paid: 25/)).toBeInTheDocument();
    expect(screen.getByText(/Overdue: 5/)).toBeInTheDocument();
  });

  it("displays total count in center of chart", () => {
    render(<InvoiceStatusChart data={mockData} />);

    // Total is displayed in the center of the donut chart
    expect(screen.getByText("43")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    const emptyData = { pending: 0, paid: 0, overdue: 0, expired: 0, refunded: 0 };
    render(<InvoiceStatusChart data={emptyData} isLoading />);

    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders empty state when no invoices", () => {
    const emptyData = {
      pending: 0,
      paid: 0,
      overdue: 0,
      expired: 0,
      refunded: 0,
    };

    render(<InvoiceStatusChart data={emptyData} />);

    expect(screen.getByText("Invoice Status")).toBeInTheDocument();
    expect(screen.getByText("No invoices yet")).toBeInTheDocument();
  });
});
