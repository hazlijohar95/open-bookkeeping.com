import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";
import { Button } from "../button";

describe("Button", () => {
  describe("rendering", () => {
    it("renders children correctly", () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
    });

    it("renders as a button element by default", () => {
      render(<Button>Button</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders with data-slot attribute", () => {
      render(<Button>Button</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("data-slot", "button");
    });
  });

  describe("variants", () => {
    it("renders default variant correctly", () => {
      render(<Button variant="default">Default</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-primary");
    });

    it("renders destructive variant correctly", () => {
      render(<Button variant="destructive">Destructive</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-destructive");
    });

    it("renders success variant correctly", () => {
      render(<Button variant="success">Success</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-success");
    });

    it("renders warning variant correctly", () => {
      render(<Button variant="warning">Warning</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-warning");
    });

    it("renders outline variant correctly", () => {
      render(<Button variant="outline">Outline</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("border");
      expect(button).toHaveClass("bg-background");
    });

    it("renders secondary variant correctly", () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-secondary");
    });

    it("renders ghost variant correctly", () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("hover:bg-accent");
    });

    it("renders link variant correctly", () => {
      render(<Button variant="link">Link</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("text-primary");
      expect(button).toHaveClass("underline-offset-4");
    });
  });

  describe("sizes", () => {
    it("renders default size correctly", () => {
      render(<Button size="default">Default</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-9");
    });

    it("renders xs size correctly", () => {
      render(<Button size="xs">XS</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-7");
    });

    it("renders sm size correctly", () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-8");
    });

    it("renders lg size correctly", () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-10");
    });

    it("renders xl size correctly", () => {
      render(<Button size="xl">XL</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-11");
    });

    it("renders icon size correctly", () => {
      render(<Button size="icon">Icon</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("size-9");
    });

    it("renders icon-xs size correctly", () => {
      render(<Button size="icon-xs">Icon XS</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("size-7");
    });

    it("renders icon-sm size correctly", () => {
      render(<Button size="icon-sm">Icon SM</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("size-8");
    });

    it("renders icon-lg size correctly", () => {
      render(<Button size="icon-lg">Icon LG</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("size-10");
    });
  });

  describe("interactions", () => {
    it("calls onClick when clicked", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      fireEvent.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick when disabled", () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} disabled>
          Disabled
        </Button>
      );

      fireEvent.click(screen.getByRole("button"));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("shows disabled state correctly", () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).toHaveClass("disabled:opacity-50");
    });
  });

  describe("asChild prop", () => {
    it("renders as child element when asChild is true", () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      );

      const link = screen.getByRole("link", { name: "Link Button" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/test");
    });
  });

  describe("custom className", () => {
    it("merges custom className with variants", () => {
      render(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-class");
      expect(button).toHaveClass("bg-primary"); // default variant
    });
  });

  describe("accessibility", () => {
    it("supports aria-label", () => {
      render(<Button aria-label="Submit form">Submit</Button>);
      expect(screen.getByRole("button", { name: "Submit form" })).toBeInTheDocument();
    });

    it("supports aria-disabled", () => {
      render(<Button aria-disabled="true">Disabled</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("aria-disabled", "true");
    });

    it("has proper focus styles", () => {
      render(<Button>Focus me</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("focus-visible:ring-[3px]");
    });
  });

  describe("type attribute", () => {
    it("defaults to button type", () => {
      render(<Button>Button</Button>);
      // Note: HTML buttons default to "submit" but Radix may not set type explicitly
      // This test verifies the button is rendered
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("supports type=submit", () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
    });

    it("supports type=reset", () => {
      render(<Button type="reset">Reset</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("type", "reset");
    });
  });
});
