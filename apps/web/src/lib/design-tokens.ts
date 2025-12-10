/**
 * Design Tokens
 * Centralized design system constants for consistent styling across the app.
 * These match the sidebar "vibes" - clean, interactive, responsive.
 */

// ============================================================================
// SPACING SCALE
// Use Tailwind spacing utilities (p-*, m-*, gap-*) with these values as reference
// ============================================================================
export const spacing = {
  xs: "1", // 4px - tight spacing (icon gaps)
  sm: "2", // 8px - compact spacing (button padding)
  md: "4", // 16px - standard spacing (section gaps)
  lg: "6", // 24px - comfortable spacing (card padding)
  xl: "8", // 32px - generous spacing (page sections)
  "2xl": "12", // 48px - large spacing (major sections)
} as const;

// ============================================================================
// TYPOGRAPHY CLASSES
// Pre-built class combinations for consistent text styling
// ============================================================================
export const typography = {
  // Display - for hero sections and major headings
  display: "font-['Instrument_Serif'] text-4xl font-bold tracking-tight",

  // Headings - using Urbanist for UI
  h1: "text-2xl font-semibold tracking-tight",
  h2: "text-xl font-semibold tracking-tight",
  h3: "text-lg font-medium",
  h4: "text-base font-medium",

  // Body text
  body: "text-base",
  bodySmall: "text-sm",
  bodyMuted: "text-sm text-muted-foreground",

  // Labels and captions
  label: "text-sm font-medium",
  caption: "text-xs text-muted-foreground",

  // Mono - for technical content
  mono: "font-mono text-sm",
  monoSmall: "font-mono text-xs",

  // Sidebar-specific (matching existing patterns)
  sidebarItem: "text-[13px] font-medium tracking-tighter",
  sidebarLabel: "text-xs font-medium",
} as const;

// ============================================================================
// ANIMATION TOKENS
// Consistent timing and easing for all animations
// ============================================================================
export const animation = {
  // Duration in milliseconds
  duration: {
    fast: 150,
    default: 200,
    slow: 300,
    slower: 500,
  },

  // Framer Motion spring config (matching sidebar)
  spring: {
    type: "spring" as const,
    stiffness: 400,
    damping: 25,
  },

  // Framer Motion variants for common patterns
  springGentle: {
    type: "spring" as const,
    stiffness: 300,
    damping: 30,
  },

  // CSS transition classes
  transition: {
    default: "transition-all duration-200 ease-out",
    fast: "transition-all duration-150 ease-out",
    slow: "transition-all duration-300 ease-out",
    colors: "transition-colors duration-200 ease-out",
    transform: "transition-transform duration-200 ease-out",
  },
} as const;

// ============================================================================
// BORDER RADIUS
// Consistent corner rounding matching sidebar style
// ============================================================================
export const radius = {
  sm: "rounded-md", // 6px - buttons, inputs
  md: "rounded-lg", // 8px - cards, modals
  lg: "rounded-xl", // 12px - larger cards, containers
  full: "rounded-full", // pills, avatars
} as const;

// ============================================================================
// SHADOWS
// Subtle shadows for depth (dark mode compatible)
// ============================================================================
export const shadows = {
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  // Card shadows
  card: "shadow-sm",
  cardHover: "shadow-md",
  // Elevated elements
  elevated: "shadow-lg",
} as const;

// ============================================================================
// COMPONENT SIZE GUIDELINES
// Standard sizes for consistent component heights
// ============================================================================
export const componentSizes = {
  // Input/Button heights
  inputSm: "h-8", // 32px
  inputMd: "h-9", // 36px
  inputLg: "h-10", // 40px

  // Icon button sizes
  iconSm: "size-8", // 32px
  iconMd: "size-9", // 36px
  iconLg: "size-10", // 40px

  // Avatar sizes
  avatarSm: "size-6", // 24px
  avatarMd: "size-8", // 32px
  avatarLg: "size-10", // 40px
  avatarXl: "size-16", // 64px
} as const;

// ============================================================================
// SKELETON PRESETS
// Pre-built skeleton configurations for common content types
// ============================================================================
export const skeletonPresets = {
  // Text skeletons
  textLine: "h-4 w-full",
  textLineShort: "h-4 w-3/4",
  textLineMedium: "h-4 w-1/2",

  // Heading skeletons
  heading: "h-6 w-1/3",
  headingLarge: "h-8 w-1/4",

  // Table skeletons
  tableCell: "h-4 w-full",
  tableRow: "h-12 w-full",

  // Card skeletons
  card: "h-32 w-full",
  cardSm: "h-24 w-full",

  // Avatar skeletons
  avatar: "size-8 rounded-full",
  avatarLg: "size-10 rounded-full",

  // Button skeletons
  button: "h-9 w-24",
  buttonIcon: "size-9",
} as const;

// ============================================================================
// INTERACTIVE STATES
// Consistent hover/focus/active state classes
// ============================================================================
export const interactiveStates = {
  // Hover backgrounds (matching sidebar)
  hover: "hover:bg-accent hover:text-accent-foreground",
  hoverSubtle: "hover:bg-accent/50",

  // Focus rings
  focus: "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  focusWithin: "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",

  // Active states
  active: "active:bg-accent active:text-accent-foreground",

  // Disabled states
  disabled: "disabled:pointer-events-none disabled:opacity-50",

  // Combined interactive
  interactive: "hover:bg-accent hover:text-accent-foreground active:bg-accent/80 transition-colors duration-200",
} as const;

// ============================================================================
// PAGE LAYOUT
// Consistent page structure classes
// ============================================================================
export const pageLayout = {
  // Page container
  container: "flex w-full flex-col",
  containerPadded: "flex w-full flex-col p-6",

  // Content widths
  contentFull: "w-full",
  contentConstrained: "max-w-7xl mx-auto w-full",

  // Section spacing
  sectionGap: "space-y-6",
  sectionGapLarge: "space-y-8",

  // Header patterns
  pageHeader: "flex items-center justify-between mb-6",
  sectionHeader: "flex items-center justify-between mb-4",
} as const;

// ============================================================================
// FRAMER MOTION VARIANTS
// Reusable animation variants
// ============================================================================
export const motionVariants = {
  // Page transition
  pageEnter: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.2 },
  },

  // Fade in
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.2 },
  },

  // Scale in (for modals, popovers)
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.15 },
  },

  // Slide up (for sheets, dropdowns)
  slideUp: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2 },
  },

  // Stagger children (for lists)
  staggerContainer: {
    animate: {
      transition: {
        staggerChildren: 0.05,
      },
    },
  },

  staggerItem: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
  },
} as const;

// ============================================================================
// TAILWIND CLASS HELPERS
// Common class combinations
// ============================================================================
export const tw = {
  // Card styles matching sidebar cleanliness
  card: "bg-card text-card-foreground rounded-xl border shadow-sm",
  cardInteractive: "bg-card text-card-foreground rounded-xl border shadow-sm hover:shadow-md transition-shadow duration-200",

  // Input styles
  input: "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",

  // Badge styles
  badge: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",

  // Divider
  divider: "border-t border-border",

  // Centered content
  center: "flex items-center justify-center",
  centerColumn: "flex flex-col items-center justify-center",
} as const;
