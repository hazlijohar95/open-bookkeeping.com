# Monk.com Design System Analysis

> **Purpose**: Reference document for UI migration/revamp inspiration
> **Captured**: December 2024
> **Website**: https://monk.com/

---

## 1. Brand Identity

### Logo
- **Style**: Custom wordmark with flame/wave icon
- **Icon**: Orange gradient flame symbol (3 curved lines forming "W" or flame shape)
- **Typography**: "monk" in lowercase, clean sans-serif
- **Usage**: Orange icon on light backgrounds, white/orange on dark backgrounds

### Brand Voice
- Professional but approachable
- Bold statements: "Manual AR is death by a thousand cuts"
- Benefit-focused: "Save time. Get paid much faster"

---

## 2. Color Palette

### Primary Colors
```
Charcoal (Dark):     #272725 / rgb(39, 39, 37)
Off-White (Light):   #FBFBF9 / rgb(251, 251, 249)
Monk Orange:         #EE5F00 / rgb(238, 95, 0)
```

### Secondary/Accent Colors
```
Warm Beige (Cards):  #F5F3EF / rgb(245, 243, 239)
Yellow Highlight:    #FFF5B8 / rgba(255, 245, 184, 1)
Muted Brown Text:    #8B7355 / approximate
```

### Usage Patterns
| Element | Color |
|---------|-------|
| CTA Buttons | Monk Orange (#EE5F00) |
| Primary Text | Charcoal (#272725) |
| Secondary Text | Muted gray/brown |
| Card Backgrounds | Warm Beige (#F5F3EF) |
| Highlighted Terms | Yellow (#FFF5B8) |
| Dark Sections | Charcoal (#272725) |
| Light Sections | Off-White (#FBFBF9) |

---

## 3. Typography

### Font Families
```css
/* Headlines - Elegant Serif */
font-family: 'Instrument Serif', serif;

/* Body & UI - Clean Sans */
font-family: 'Inter', sans-serif;
```

### Type Scale (Observed)
| Element | Font | Size | Weight | Style |
|---------|------|------|--------|-------|
| Hero H1 | Instrument Serif | ~56-72px | 400 | Italic |
| Section H2 | Instrument Serif | ~40-48px | 400 | Regular/Italic |
| Card Titles | Inter | ~18-20px | 500-600 | Regular |
| Body Text | Inter | ~16px | 400 | Regular |
| Small/Labels | Inter | ~12-14px | 500 | Uppercase tracking |
| Stats Numbers | Instrument Serif | ~80-120px | 400 | Regular |

### Typography Patterns
1. **Serif for emotion**: Headlines use Instrument Serif for elegance and trust
2. **Sans for clarity**: All UI and body text uses Inter
3. **Stat highlights**: Large serif numbers with smaller sans-serif units (e.g., "18hrs", "$22m")
4. **Section labels**: Small uppercase with letter-spacing (e.g., "FAQ", "Foundation", "Exceptions")

---

## 4. Layout System

### Container Widths
```
Max-width: ~1200-1400px (centered)
Side padding: ~24-48px (responsive)
```

### Grid Patterns
| Layout | Usage |
|--------|-------|
| 2-column split | Hero (text left, product right) |
| 3-column grid | Feature cards, stats |
| 2-column offset | FAQ section (title left, content right) |
| Full-width | Dark CTA sections |

### Section Structure
```
[Announcement Bar - Dark]
[Navigation - Light/Transparent]
[Hero - Light with product preview]
[Feature Section - Light]
[Product Demo - Light with beige cards]
[Exceptions/Cards - Light with mixed card colors]
[Stats Section - Beige background]
[FAQ Section - Light]
[CTA Section - Dark]
[Footer - Dark]
```

---

## 5. Component Patterns

### Navigation
- **Style**: Minimal, horizontal
- **Items**: Logo | Platform v | Partnerships v | Security | Resources v | [CTA Button]
- **CTA**: Orange button with arrow icon "REQUEST DEMO →"
- **Behavior**: Sticky, transitions to dark on scroll past certain sections

### Announcement Bar
- **Position**: Fixed top
- **Style**: Dark background (#272725), white text
- **Content**: Customer success story with play icon
- **Height**: ~40px

### Hero Section
```
+------------------------------------------+
|  [Headline - Serif Italic]               |
|  Save time                               |
|  Get paid much faster                    |
|                                          |
|  [Subtext - Sans regular]                |
|  Process the most complex contracts...   |
|                                          |
|  [CTA Button - Orange]                   |
|  REQUEST DEMO →                          |
+------------------------------------------+
|                    |  [Product Preview]  |
|  [Chart/Graph]     |  - Dashboard UI     |
|  Billed vs         |  - Table view       |
|  Collected         |  - Stats cards      |
+------------------------------------------+
```

### Feature Cards (Exceptions Section)
```
+---------------------------+
| [Title]        [Icon]     |  <- Title + icon top row
|                           |
| [Description text]        |  <- Description below
|                           |
+---------------------------+

Variants:
- Light beige background (default)
- Yellow highlight background (emphasis)
- All have consistent padding and rounded corners (subtle)
```

### Stats Display
```
+-------------+  +-------------+  +-------------+
|   +37%      |  |   18hrs     |  |   $22m      |
|             |  |             |  |             |
| [Label]     |  | [Label]     |  | [Label]     |
| Average     |  | Time saved  |  | Collected   |
| increase... |  |             |  | in Q2 CY25  |
|             |  |             |  |             |
| [Detail     |  | [Detail     |  | [Detail     |
|  text]      |  |  text]      |  |  text]      |
+-------------+  +-------------+  +-------------+

- Large serif numbers (mixed with unit in smaller text)
- Bold label below
- Muted detail paragraph
- Thin top border separator
```

### Product Preview Cards
```
+----------------------------------------+
| [Reports Sidebar]  |  [Chart Area]     |
| - Revenue          |  Cash Collected   |
| - Waterfall        |  [Bar Chart]      |
| - Aging Report     |                   |
| - Forecasting      |  [Invoice Cards]  |
+----------------------------------------+
|                    |  [Summary Panel]  |
|                    |  Cash: $56,920    |
|                    |  $163,935 +10%    |
+----------------------------------------+
```

### FAQ Accordion
```
+------------------------------------------+
| FAQ (label)           |                  |
|                       |                  |
| Answers to questions  | What is Monk?  [-]|
| you may have          | [Answer text]    |
| (Serif headline)      |------------------|
|                       | Question 2?    [+]|
|                       |------------------|
|                       | Question 3?    [+]|
+------------------------------------------+

- Left column: Section label + headline
- Right column: Expandable items
- Collapse icon: − (minus) / + (plus)
- Clean horizontal dividers
```

### Email Capture (CTA Section)
```
+------------------------------------------+
|     Manual AR is death by a thousand     |
|              cuts (Serif)                |
|                                          |
|     Deploy the Monk platform on your     |
|         toughest AR problems.            |
|                                          |
|  +----------------------------------+    |
|  | Your email          [REQUEST DEMO →]  |
|  +----------------------------------+    |
+------------------------------------------+

- Dark background
- White text
- Inline email input + orange button
- Dramatic serif headline
```

### Footer
```
+------------------------------------------+
| [Logo]     PLATFORM    PARTNERSHIPS  ... |
|            - AR Auto   - PE & VC         |
|            - Collect   - Accounting      |
|            - Integr    ...               |
|                                          |
|  [X] [LinkedIn]              [SOC Badge] |
|                                          |
|  Built in New York    © 2025 Monk...     |
+------------------------------------------+

- 4-5 column link layout
- Social icons (X, LinkedIn)
- SOC 2 compliance badge
- "Built in New York" branding
```

---

## 6. Visual Elements

### Icons
- **Style**: Line icons, consistent stroke weight (~1.5-2px)
- **Color**: Brown/charcoal, matching text
- **Examples**: Coffee cup, X mark, Globe, Chat bubble, Hourglass, Warning triangle

### Illustrations
- **Coin/Medal graphics**: Vintage-style engraved coin illustrations
- **Decorative leaf**: Detailed line-art leaf/feather (top right of "Why we exist")
- **Style**: Detailed, etched/engraved aesthetic (not flat/minimal)

### Data Visualizations
- **Bar charts**: Orange/coral gradient bars with subtle shadows
- **Area charts**: Yellow/orange gradient fills with data points
- **Style**: Clean, minimal axes, clear labels

### Yellow Highlights
- Used to emphasize key terms in product screenshots
- Appears as text highlight (marker-style)
- Examples: "Commercial terms: $500/seat, monthly", "Payment terms: NET 30"

---

## 7. Animation & Interactions

### Observed Animations
1. **Auto-advancing tabs**: Product demos cycle every 4-6 seconds
2. **Scroll-triggered**: Elements fade/slide in on scroll
3. **Button hover**: Arrow icon animates right
4. **FAQ accordion**: Smooth expand/collapse
5. **Marquee**: Logo carousel with continuous scroll

### Transitions
```css
/* Typical transition */
transition: all 0.3s ease;

/* Button hover */
transform: translateX(4px); /* Arrow movement */
```

---

## 8. Responsive Behavior

### Breakpoints (from CSS analysis)
```
Desktop:        > 1280px
Small Desktop:  991-1280px
Tablet:         768-991px
Mobile Large:   480-767px
Mobile:         < 480px
```

### Mobile Adaptations
- Single column layouts
- Hamburger menu
- Stacked cards
- Smaller type scale
- Full-width CTAs

---

## 9. Key Design Principles

### 1. Contrast & Hierarchy
- Dark/light section alternation creates rhythm
- Large serif headlines vs small sans labels
- Orange only for primary actions

### 2. Trust & Professionalism
- SOC 2 badge prominently displayed
- Customer logos in marquee
- Specific metrics (+37%, $22M, 18hrs)
- "Built in New York" location credibility

### 3. Warmth in B2B
- Warm beige instead of cold gray
- Orange accent instead of blue
- Serif typography adds approachability
- Vintage illustration style

### 4. Product-Forward
- Real UI screenshots (not mockups)
- Feature demonstrations integrated into design
- Data visualizations as design elements

---

## 10. Comparison with Current Invoicely Design

| Aspect | Monk | Current Invoicely | Opportunity |
|--------|------|-------------------|-------------|
| Color | Orange + Warm neutrals | Blue + Cool grays | Consider warmer palette |
| Typography | Serif + Sans pairing | Sans only | Add serif for headlines |
| Cards | Warm beige backgrounds | White/gray | Warmer card backgrounds |
| Stats | Large serif numbers | Standard display | Hero stat treatment |
| CTA | Orange with arrow | Blue buttons | More distinctive CTAs |
| Sections | Dark/light alternation | Mostly light | Section contrast |
| Icons | Detailed line art | Lucide icons | Custom icon style |

---

## 11. Implementation Notes

### If Adopting This Style:

**Typography**
```css
/* Add to project */
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');

.heading-serif {
  font-family: 'Instrument Serif', serif;
}
```

**Color Variables**
```css
:root {
  --monk-charcoal: #272725;
  --monk-offwhite: #FBFBF9;
  --monk-orange: #EE5F00;
  --monk-beige: #F5F3EF;
  --monk-yellow: #FFF5B8;
}
```

**Stat Component Pattern**
```tsx
<div className="border-t pt-6">
  <div className="font-serif text-6xl">+37%</div>
  <div className="mt-4 font-medium">Average increase in cash on hand</div>
  <p className="mt-2 text-muted-foreground text-sm">
    Monk AI delivers 24% higher response rate...
  </p>
</div>
```

---

## 12. Screenshots Reference

| Screenshot | Content |
|------------|---------|
| 01 - Hero | Split layout: headline + product preview |
| 02 - Foundation | "Why we exist" + contract demo |
| 03 - Reports | Real-time reports + dashboard UI |
| 04 - Exceptions | Feature cards grid (6 cards) |
| 05 - Results | Stats section (+37%, 18hrs, $22m) |
| 06 - FAQ | Accordion layout |
| 07 - Footer | Dark CTA + footer links |

---

*Document created for internal reference. Not affiliated with Monk.*
