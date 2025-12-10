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

  it("renders description", () => {
    render(<InvoiceStatusChart data={mockData} />);

    expect(screen.getByText(/distribution/i)).toBeInTheDocument();
  });

  it("renders legend items", () => {
    render(<InvoiceStatusChart data={mockData} />);

    // Check for status labels in legend
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("displays counts for each status", () => {
    render(<InvoiceStatusChart data={mockData} />);

    // Check that counts are displayed
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    const emptyData = { pending: 0, paid: 0, overdue: 0, expired: 0, refunded: 0 };
    render(<InvoiceStatusChart data={emptyData} isLoading />);

    const skeleton = document.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("renders with empty data", () => {
    const emptyData = {
      pending: 0,
      paid: 0,
      overdue: 0,
      expired: 0,
      refunded: 0,
    };

    render(<InvoiceStatusChart data={emptyData} />);

    expect(screen.getByText("Invoice Status")).toBeInTheDocument();
  });
});
