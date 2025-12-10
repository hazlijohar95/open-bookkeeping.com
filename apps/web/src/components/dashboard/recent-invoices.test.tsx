import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/test-utils";
import { RecentInvoices } from "./recent-invoices";

describe("RecentInvoices", () => {
  const mockInvoices = [
    {
      id: "1",
      serialNumber: "INV-001",
      customerName: "John Doe",
      total: 1500,
      currency: "MYR",
      status: "pending",
      date: new Date("2024-01-15"),
      dueDate: new Date("2024-02-15"),
    },
    {
      id: "2",
      serialNumber: "INV-002",
      customerName: "Jane Smith",
      total: 2500,
      currency: "MYR",
      status: "success",
      date: new Date("2024-01-10"),
      dueDate: new Date("2024-02-10"),
    },
    {
      id: "3",
      serialNumber: "INV-003",
      customerName: "Bob Wilson",
      total: 3500,
      currency: "MYR",
      status: "overdue",
      date: new Date("2024-01-05"),
      dueDate: new Date("2024-01-20"),
    },
  ];

  it("renders card with title", () => {
    render(<RecentInvoices invoices={mockInvoices} />);

    expect(screen.getByText("Recent Invoices")).toBeInTheDocument();
  });

  it("renders invoice serial numbers", () => {
    render(<RecentInvoices invoices={mockInvoices} />);

    expect(screen.getByText("INV-001")).toBeInTheDocument();
    expect(screen.getByText("INV-002")).toBeInTheDocument();
    expect(screen.getByText("INV-003")).toBeInTheDocument();
  });

  it("renders customer names", () => {
    render(<RecentInvoices invoices={mockInvoices} />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Wilson")).toBeInTheDocument();
  });

  it("renders status badges", () => {
    render(<RecentInvoices invoices={mockInvoices} />);

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<RecentInvoices invoices={[]} isLoading />);

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no invoices", () => {
    render(<RecentInvoices invoices={[]} />);

    expect(screen.getByText(/no invoices/i)).toBeInTheDocument();
  });

  it("renders view all link", () => {
    render(<RecentInvoices invoices={mockInvoices} />);

    const viewAllLink = screen.getByRole("link", { name: /view all/i });
    expect(viewAllLink).toBeInTheDocument();
    expect(viewAllLink).toHaveAttribute("href", "/invoices");
  });
});
