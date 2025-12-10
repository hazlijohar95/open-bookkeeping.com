import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/test-utils";
import { TopCustomers } from "./top-customers";

describe("TopCustomers", () => {
  const mockCustomers = [
    { name: "Acme Corp", email: "acme@example.com", revenue: 50000, invoiceCount: 10 },
    { name: "Tech Inc", email: "tech@example.com", revenue: 35000, invoiceCount: 7 },
    { name: "Global Ltd", email: "global@example.com", revenue: 25000, invoiceCount: 5 },
  ];

  it("renders card with title", () => {
    render(<TopCustomers customers={mockCustomers} currency="MYR" />);

    expect(screen.getByText("Top Customers")).toBeInTheDocument();
  });

  it("renders customer names", () => {
    render(<TopCustomers customers={mockCustomers} currency="MYR" />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Tech Inc")).toBeInTheDocument();
    expect(screen.getByText("Global Ltd")).toBeInTheDocument();
  });

  it("renders customer emails", () => {
    render(<TopCustomers customers={mockCustomers} currency="MYR" />);

    expect(screen.getByText("acme@example.com")).toBeInTheDocument();
    expect(screen.getByText("tech@example.com")).toBeInTheDocument();
  });

  it("displays invoice counts", () => {
    render(<TopCustomers customers={mockCustomers} currency="MYR" />);

    expect(screen.getByText("10 invoices")).toBeInTheDocument();
    expect(screen.getByText("7 invoices")).toBeInTheDocument();
    expect(screen.getByText("5 invoices")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<TopCustomers customers={[]} currency="MYR" isLoading />);

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no customers", () => {
    render(<TopCustomers customers={[]} currency="MYR" />);

    expect(screen.getByText(/no customers/i)).toBeInTheDocument();
  });

  it("renders progress bars", () => {
    render(<TopCustomers customers={mockCustomers} currency="MYR" />);

    // Check for progress elements
    const progressBars = document.querySelectorAll('[role="progressbar"]');
    expect(progressBars.length).toBeGreaterThan(0);
  });
});
