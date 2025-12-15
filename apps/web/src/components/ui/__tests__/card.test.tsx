import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/test-utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "../card";

describe("Card", () => {
  describe("Card component", () => {
    it("renders children correctly", () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText("Card content")).toBeInTheDocument();
    });

    it("has data-slot attribute", () => {
      render(<Card data-testid="card">Content</Card>);
      expect(screen.getByTestId("card")).toHaveAttribute("data-slot", "card");
    });

    it("applies default variant styles", () => {
      render(<Card data-testid="card">Content</Card>);
      const card = screen.getByTestId("card");
      expect(card).toHaveClass("bg-card");
      expect(card).toHaveClass("border");
    });

    it("applies interactive variant styles", () => {
      render(
        <Card variant="interactive" data-testid="card">
          Content
        </Card>
      );
      const card = screen.getByTestId("card");
      expect(card).toHaveClass("hover:bg-accent/50");
      expect(card).toHaveClass("cursor-pointer");
    });

    it("applies ghost variant styles", () => {
      render(
        <Card variant="ghost" data-testid="card">
          Content
        </Card>
      );
      const card = screen.getByTestId("card");
      expect(card).toHaveClass("border-transparent");
      expect(card).toHaveClass("bg-transparent");
    });

    it("applies default padding", () => {
      render(<Card data-testid="card">Content</Card>);
      const card = screen.getByTestId("card");
      expect(card).toHaveClass("py-6");
      expect(card).toHaveClass("gap-6");
    });

    it("applies compact padding", () => {
      render(
        <Card padding="compact" data-testid="card">
          Content
        </Card>
      );
      const card = screen.getByTestId("card");
      expect(card).toHaveClass("py-4");
      expect(card).toHaveClass("gap-4");
    });

    it("applies no padding", () => {
      render(
        <Card padding="none" data-testid="card">
          Content
        </Card>
      );
      const card = screen.getByTestId("card");
      expect(card).not.toHaveClass("py-6");
      expect(card).not.toHaveClass("py-4");
    });

    it("merges custom className", () => {
      render(
        <Card className="custom-class" data-testid="card">
          Content
        </Card>
      );
      expect(screen.getByTestId("card")).toHaveClass("custom-class");
    });
  });

  describe("CardHeader", () => {
    it("renders children correctly", () => {
      render(<CardHeader>Header content</CardHeader>);
      expect(screen.getByText("Header content")).toBeInTheDocument();
    });

    it("has data-slot attribute", () => {
      render(<CardHeader data-testid="header">Header</CardHeader>);
      expect(screen.getByTestId("header")).toHaveAttribute(
        "data-slot",
        "card-header"
      );
    });

    it("applies grid layout styles", () => {
      render(<CardHeader data-testid="header">Header</CardHeader>);
      expect(screen.getByTestId("header")).toHaveClass("grid");
    });

    it("merges custom className", () => {
      render(
        <CardHeader className="custom-class" data-testid="header">
          Header
        </CardHeader>
      );
      expect(screen.getByTestId("header")).toHaveClass("custom-class");
    });
  });

  describe("CardTitle", () => {
    it("renders children correctly", () => {
      render(<CardTitle>Title</CardTitle>);
      expect(screen.getByText("Title")).toBeInTheDocument();
    });

    it("has data-slot attribute", () => {
      render(<CardTitle data-testid="title">Title</CardTitle>);
      expect(screen.getByTestId("title")).toHaveAttribute(
        "data-slot",
        "card-title"
      );
    });

    it("applies font styles", () => {
      render(<CardTitle data-testid="title">Title</CardTitle>);
      expect(screen.getByTestId("title")).toHaveClass("font-semibold");
    });

    it("merges custom className", () => {
      render(
        <CardTitle className="text-xl" data-testid="title">
          Title
        </CardTitle>
      );
      expect(screen.getByTestId("title")).toHaveClass("text-xl");
    });
  });

  describe("CardDescription", () => {
    it("renders children correctly", () => {
      render(<CardDescription>Description text</CardDescription>);
      expect(screen.getByText("Description text")).toBeInTheDocument();
    });

    it("has data-slot attribute", () => {
      render(<CardDescription data-testid="desc">Description</CardDescription>);
      expect(screen.getByTestId("desc")).toHaveAttribute(
        "data-slot",
        "card-description"
      );
    });

    it("applies muted text styles", () => {
      render(<CardDescription data-testid="desc">Description</CardDescription>);
      expect(screen.getByTestId("desc")).toHaveClass("text-muted-foreground");
      expect(screen.getByTestId("desc")).toHaveClass("text-sm");
    });
  });

  describe("CardContent", () => {
    it("renders children correctly", () => {
      render(<CardContent>Content goes here</CardContent>);
      expect(screen.getByText("Content goes here")).toBeInTheDocument();
    });

    it("has data-slot attribute", () => {
      render(<CardContent data-testid="content">Content</CardContent>);
      expect(screen.getByTestId("content")).toHaveAttribute(
        "data-slot",
        "card-content"
      );
    });

    it("applies horizontal padding", () => {
      render(<CardContent data-testid="content">Content</CardContent>);
      expect(screen.getByTestId("content")).toHaveClass("px-6");
    });
  });

  describe("CardFooter", () => {
    it("renders children correctly", () => {
      render(<CardFooter>Footer content</CardFooter>);
      expect(screen.getByText("Footer content")).toBeInTheDocument();
    });

    it("has data-slot attribute", () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>);
      expect(screen.getByTestId("footer")).toHaveAttribute(
        "data-slot",
        "card-footer"
      );
    });

    it("applies flex styles", () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>);
      expect(screen.getByTestId("footer")).toHaveClass("flex");
      expect(screen.getByTestId("footer")).toHaveClass("items-center");
    });
  });

  describe("CardAction", () => {
    it("renders children correctly", () => {
      render(<CardAction>Action button</CardAction>);
      expect(screen.getByText("Action button")).toBeInTheDocument();
    });

    it("has data-slot attribute", () => {
      render(<CardAction data-testid="action">Action</CardAction>);
      expect(screen.getByTestId("action")).toHaveAttribute(
        "data-slot",
        "card-action"
      );
    });

    it("applies grid positioning styles", () => {
      render(<CardAction data-testid="action">Action</CardAction>);
      expect(screen.getByTestId("action")).toHaveClass("col-start-2");
      expect(screen.getByTestId("action")).toHaveClass("row-span-2");
    });
  });

  describe("Composition", () => {
    it("renders full card composition correctly", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card description text</CardDescription>
            <CardAction>
              <button>Action</button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p>Card content paragraph</p>
          </CardContent>
          <CardFooter>
            <button>Footer Action</button>
          </CardFooter>
        </Card>
      );

      expect(screen.getByText("Card Title")).toBeInTheDocument();
      expect(screen.getByText("Card description text")).toBeInTheDocument();
      expect(screen.getByText("Card content paragraph")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Footer Action" })
      ).toBeInTheDocument();
    });
  });
});
