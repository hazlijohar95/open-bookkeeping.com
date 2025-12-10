# shadcn/ui Knowledge Base

This document captures the shadcn/ui patterns and configuration used in this project.

## Table of Contents
1. [Theming](#theming)
2. [Dark Mode](#dark-mode)
3. [Components.json Configuration](#componentsjson-configuration)
4. [Forms with React Hook Form](#forms-with-react-hook-form)
5. [Blocks](#blocks)

---

## Theming

### CSS Variables Approach (Recommended)

shadcn/ui uses CSS variables for theming. Set `"cssVariables": true` in `components.json`.

#### Color Convention
- `background` and `foreground` pattern
- `bg-primary` applies `var(--primary)`
- `text-primary-foreground` applies text color for primary backgrounds

#### Available CSS Variables

```css
/* Layout */
--radius
--background
--foreground

/* Components */
--card / --card-foreground
--popover / --popover-foreground
--primary / --primary-foreground
--secondary / --secondary-foreground
--muted / --muted-foreground
--accent / --accent-foreground

/* UI Elements */
--border
--input
--ring

/* Special */
--destructive / --destructive-foreground
--chart-1 through --chart-5

/* Sidebar */
--sidebar / --sidebar-foreground
--sidebar-primary / --sidebar-primary-foreground
--sidebar-accent / --sidebar-accent-foreground
--sidebar-border
--sidebar-ring
```

### Adding Custom Colors

Define in `:root` and `.dark`, then use `@theme inline`:

```css
:root {
  --warning: oklch(0.84 0.16 84);
  --success: oklch(0.72 0.19 142);
  --info: oklch(0.62 0.21 262);
}

.dark {
  --warning: oklch(0.41 0.11 46);
  --success: oklch(0.60 0.15 142);
  --info: oklch(0.50 0.18 262);
}

@theme inline {
  --color-warning: var(--warning);
  --color-success: var(--success);
  --color-info: var(--info);
}
```

### Base Color Options
- Neutral (default)
- Stone
- Zinc
- Gray
- Slate

---

## Dark Mode

### For Vite/React Apps

#### 1. Tailwind Configuration
Add dark mode support in CSS:
```css
.dark, :root[class~="dark"] { ... }
```

#### 2. Theme Provider
Create a theme context with system preference detection:

```typescript
// lib/theme-provider.tsx
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: "system", setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) || "system"
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

#### 3. Mode Toggle Component
```typescript
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/lib/theme-provider";

export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## Components.json Configuration

The `components.json` file configures the shadcn CLI. Initialize with:
```bash
pnpm dlx shadcn@latest init
```

### Full Configuration Reference

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

### Key Options

| Option | Description | Notes |
|--------|-------------|-------|
| `style` | Component design style | Only `"new-york"` available (default deprecated) |
| `rsc` | React Server Components | Adds `"use client"` directives when false |
| `tsx` | TypeScript support | Set false for .jsx files |
| `tailwind.baseColor` | Base color palette | Cannot change after init |
| `tailwind.cssVariables` | Use CSS variables | Cannot change after init |
| `tailwind.prefix` | Utility class prefix | e.g., `"tw-"` |

### Path Aliases
Must match `tsconfig.json` paths:
```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Forms with React Hook Form

### Setup

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
```

### Schema Definition

```typescript
const formSchema = z.object({
  title: z.string()
    .min(5, "Title must be at least 5 characters.")
    .max(32, "Title must be at most 32 characters."),
  email: z.string().email("Invalid email address"),
  amount: z.coerce.number().positive("Must be positive"),
});

type FormValues = z.infer<typeof formSchema>;
```

### Form Instance

```typescript
const form = useForm<FormValues>({
  resolver: zodResolver(formSchema),
  defaultValues: {
    title: "",
    email: "",
    amount: 0,
  },
  mode: "onBlur", // Validation trigger
});
```

### Validation Modes

| Mode | Behavior |
|------|----------|
| `"onChange"` | Validates on every change |
| `"onBlur"` | Validates on blur |
| `"onSubmit"` | Validates on submit (default) |
| `"onTouched"` | First blur, then every change |
| `"all"` | Blur and change |

### Field Components

#### Input Field
```tsx
<Controller
  control={form.control}
  name="title"
  render={({ field, fieldState }) => (
    <div>
      <Label>Title</Label>
      <Input {...field} aria-invalid={fieldState.invalid} />
      {fieldState.error && (
        <p className="text-destructive text-sm">{fieldState.error.message}</p>
      )}
    </div>
  )}
/>
```

#### Select Field
```tsx
<Controller
  control={form.control}
  name="category"
  render={({ field }) => (
    <Select value={field.value} onValueChange={field.onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">Option A</SelectItem>
        <SelectItem value="b">Option B</SelectItem>
      </SelectContent>
    </Select>
  )}
/>
```

### Dynamic Array Fields

```typescript
const { fields, append, remove } = useFieldArray({
  control: form.control,
  name: "items",
});

// In render:
{fields.map((field, index) => (
  <div key={field.id}>
    <Input {...form.register(`items.${index}.name`)} />
    <Button onClick={() => remove(index)}>Remove</Button>
  </div>
))}
<Button onClick={() => append({ name: "" })}>Add Item</Button>
```

---

## Blocks

### What Are Blocks?

Blocks are reusable component compositions - from single variations to complex dashboards with multiple interdependent parts including components, hooks, and utilities.

### Installing Blocks

```bash
npx shadcn@latest add dashboard-01
npx shadcn@latest add login-01
npx shadcn@latest add sidebar-01
```

### Available Block Categories

- **Dashboard**: `dashboard-01`, `dashboard-02`, etc.
- **Authentication**: `login-01`, `signup-01`
- **Sidebar**: `sidebar-01`, `sidebar-02`
- **Charts**: Various chart compositions

### Block Structure

A typical block like `dashboard-01` includes:
- Main page file
- Component subfolder with multiple components
- Custom hooks directory
- Utility functions
- Registry dependencies (input, button, card, etc.)

### Using Blocks

After installation, blocks are placed in your components directory. Import and use them:

```typescript
import { SectionCards } from "@/components/section-cards";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";

export function Dashboard() {
  return (
    <div>
      <SectionCards />
      <ChartAreaInteractive />
    </div>
  );
}
```

---

## Quick Reference

### CLI Commands

```bash
# Initialize shadcn
npx shadcn@latest init

# Add a component
npx shadcn@latest add button

# Add multiple components
npx shadcn@latest add button card input

# Add a block
npx shadcn@latest add dashboard-01

# Add with overwrite
npx shadcn@latest add button --overwrite

# Diff check
npx shadcn@latest diff
```

### Component Import Pattern

```typescript
// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Form Components
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

// Icons (lucide-react)
import { ChevronDown, Check, X, Plus, Minus } from "lucide-react";
```

### CSS Variable Usage

```tsx
// Background colors
<div className="bg-background" />      // Main background
<div className="bg-card" />            // Card background
<div className="bg-muted" />           // Muted/subtle background
<div className="bg-primary" />         // Primary action background

// Text colors
<p className="text-foreground" />       // Main text
<p className="text-muted-foreground" /> // Subtle text
<p className="text-primary" />          // Primary color text

// Border
<div className="border-border" />       // Standard border
<div className="border-input" />        // Input border

// Focus ring
<div className="ring-ring" />           // Focus ring color
```
