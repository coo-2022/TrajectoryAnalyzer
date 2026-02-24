# RL Training Analysis Interface - High-Fidelity Design Mockup

**Document Version:** 1.0
**Date:** 2026-02-04
**Status:** Design Specification (No Code Implementation)

---

## Table of Contents

1. [Design System Overview](#design-system-overview)
2. [Overall Layout](#overall-layout)
3. [Tab 1: Overview](#tab-1-overview)
4. [Tab 2: Training Progress]((#tab-2-training-progress-new)
5. [Tab 3: Training Comparison](#tab-3-training-comparison-new)
6. [Tab 4: Failure Analysis](#tab-4-failure-analysis-new)
7. [Tab 5: Tool Contexts](#tab-5-tool-contexts)
8. [Component Library Reference](#component-library-reference)
9. [Responsive Design](#responsive-design)
10. [Loading & Error States](#loading--error-states)

---

## Design System Overview

### Color Palette

Based on Tailwind CSS Slate + Semantic Colors

**Base Colors:**
- `slate-50`: #f8fafc (Background)
- `slate-100`: #f1f5f9 (Card alternative background)
- `slate-200`: #e2e8f0 (Borders)
- `slate-500`: #64748b (Secondary text)
- `slate-600`: #475569 (Primary text)
- `slate-800`: #1e293b (Headings)
- `white`: #ffffff (Card backgrounds)

**Semantic Colors:**
- `blue-50`: #eff6ff (Active tab background)
- `blue-600`: #2563eb (Primary actions, icons)
- `emerald-500`: #10b981 (Success, positive metrics)
- `amber-500`: #f59e0b (Warnings, partial success)
- `rose-500/600`: #ef4444 (Errors, failures, negative metrics)

### Typography

**Font Stack:** System font family (SF Pro, -apple-system, Segoe UI)

**Scale:**
- `text-xs`: 0.75rem (12px) - Labels, metadata
- `text-sm`: 0.875rem (14px) - Body text, button labels
- `text-lg`: 1.125rem (18px) - Card titles
- `text-xl`: 1.5rem (24px) - Page headers
- `text-2xl`: 1.5rem - Section headers

**Weights:**
- `font-medium`: 500 - Button labels, emphasized text
- `font-semibold`: 600 - Card titles, stats
- `font-bold`: 700 - Page headers

### Spacing System

- `p-4`: 1rem (16px) - Card padding
- `p-6`: 1.5rem (24px) - Page padding, large card padding
- `gap-4`: 1rem - Component spacing
- `gap-6`: 1.5rem - Section spacing
- `space-y-6`: 1.5rem - Vertical stacking

### Border Radius

- `rounded`: 0.25rem (4px) - Small elements
- `rounded-lg`: 0.5rem (8px) - Cards, buttons (primary)

### Shadows

- `shadow-sm`: 0 1px 2px rgba(0,0,0,0.05) - Cards

### Icons

**Library:** Lucide React
**Common Icons:**
- `BarChart3`: Analysis page icon
- `RefreshCw`: Refresh action
- `TrendingUp/TrendingDown`: Metric indicators
- `AlertCircle/AlertTriangle`: Warnings and errors
- `CheckCircle`: Success states
- `Clock`: Time-related data

---

## Overall Layout

### Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Header (White, border-b)                                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ [BarChart3] Trajectory Analysis           [Refresh]    │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ [Overview] [Training Progress] [Comparison] [Failures] │  │
│  │            [Tool Contexts]                             │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
│                                                               │
│  Main Content (Slate-50 background, p-6)                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  [Tab Content - Responsive Grid Layout]             │   │
│  │                                                     │   │
│  │  - 1-column on mobile (< 768px)                     │   │
│  │  - 2-column on tablet (768px - 1024px)              │   │
│  │  - 3-4 column on desktop (> 1024px)                 │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Header Component

**Layout:**
- Height: Auto (py-4 px-6)
- Background: White
- Border: `border-b border-slate-200`

**Elements:**
1. **Title Row:**
   - Icon: `BarChart3`, w-6 h-6, text-blue-600
   - Title: "Trajectory Analysis", text-xl font-bold, text-slate-800
   - Action: Refresh button (right-aligned)

2. **Tab Row (mt-4):**
   - 5 tabs in horizontal row
   - Active tab: `bg-blue-50 text-blue-700`
   - Inactive tab: `text-slate-600 hover:bg-slate-100`
   - All tabs: `px-4 py-2 text-sm font-medium rounded-lg transition-colors`

**Tab Names (5 total):**
1. Overview
2. Training Progress (NEW)
3. Training Comparison (NEW)
4. Failure Analysis (NEW)
5. Tool Contexts

---

## Tab 1: Overview

### Layout Annotation

```
┌─────────────────────────────────────────────────────────────┐
│  Tab 1: Overview                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Row 1: Two Cards Side-by-Side                              │
│  ┌──────────────────────────┐  ┌─────────────────────────┐  │
│  │ Termination Statistics   │  │ Reward Distribution     │  │
│  │ [Pie Chart + List]       │  │ [Bar Chart + Stats]     │  │
│  └──────────────────────────┘  └─────────────────────────┘  │
│  <─ grid-cols-1 lg:grid-cols-2 gap-6 ─>                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Row 2: Full-Width Card                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Tool Return Statistics                               │   │
│  │ [Pie Chart + Category Breakdown]                    │   │
│  └──────────────────────────────────────────────────────┘   │
│  <─ grid-cols-1 gap-6 ─>                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Row 3: Full-Width Card                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Process-Reward Correlation                           │   │
│  │ [Scatter Plot]                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│  <─ grid-cols-1 gap-6 ─>                                    │
└─────────────────────────────────────────────────────────────┘
```

### Existing Components (Reused)

**1. TerminationStatsCard**
- Header: Title + Total count
- Layout: 2-column grid (chart | breakdown)
- Chart: Pie chart (Recharts)
- Breakdown: Icon + Label + Count + Percentage

**2. RewardCategoryStatsCard**
- Header: Title + Total count
- Summary stats: Max/Avg/Min (3-column)
- Layout: 2-column grid (chart | breakdown)
- Chart: Bar chart (Recharts)
- Breakdown: Icon + Label + Count + Percentage

**3. ToolReturnStatsCard**
- Header: Title + Total tool calls
- Layout: 2-column grid (chart | breakdown)
- Chart: Pie chart (Recharts)
- Breakdown: Icon + Label + Count + Percentage
- Special: Unexpected returns summary card

**4. ProcessRewardCorrelationCard**
- Header: Title
- Chart: Scatter plot (Recharts)

---

## Tab 2: Training Progress (NEW)

### Purpose

Track training performance over time with epoch-level granularity. Monitor Pass@1, Pass@K, reward trends, and success rates across training runs and eras.

### Layout Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  Tab 2: Training Progress                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Control Bar (White Card, p-4, mb-6)                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Training: [Dropdown ▼]  Era: [Dropdown ▼]          │    │
│  │                                                      │    │
│  │ Selected: Training #3 - Era 5                       │    │
│  │ Epochs: 10 | Started: 2026-02-03 14:30 | Status: ●  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Metrics Summary (4-column)                                  │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                     │
│  │Pass@1│  │Pass@K│  │Reward│  │Success│                    │
│  │ 45.2%│  │67.8%│  │ 8.42 │  │ 78.3% │                     │
│  │ +5.3%│  │+3.1%│  │+0.87 │  │ +2.1% │                     │
│  └──────┘  └──────┘  └──────┘  └──────┘                     │
│  <─ grid-cols-2 md:grid-cols-4 gap-4 ─>                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Row 1: Pass Rate Charts (2-column)                          │
│  ┌─────────────────────────────┐  ┌─────────────────────┐   │
│  │ Pass@1 Over Epochs          │  │ Pass@K Over Epochs  │   │
│  │ [Line Chart]                │  │ [Line Chart]        │   │
│  │                             │  │                     │   │
│  │ 90% ──┐                     │  │ 100% ──┐            │   │
│  │      │ ╱╲                  │  │       │ ╱╲          │   │
│  │ 45% ─┼╱  ╲╱╲               │  │ 68% ─┼╱  ╲╱╲        │   │
│  │      ╱      ╲╱╲╱            │  │     ╱      ╲╱╲╱      │   │
│  │ 0% ───────────────────→     │  │ 0% ──────────────→   │   │
│  │     Epoch 1 3 5 7 9         │  │     Epoch 1 3 5 7 9  │   │
│  └─────────────────────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Row 2: Reward & Success Rate (2-column)                     │
│  ┌─────────────────────────────┐  ┌─────────────────────┐   │
│  │ Reward Trend                │  │ Success Rate Trend  │   │
│  │ [Line Chart]                │  │ [Line Chart]        │   │
│  │                             │  │                     │   │
│  │ 10 ──┐                     │  │ 100% ──┐            │   │
│  │     │ ╱╲                  │  │       │ ╱╲          │   │
│  │ 8.4 ─┼╱  ╲╱╲               │  │ 78% ─┼╱  ╲╱╲        │   │
│  │    ╱      ╲╱╲╱            │  │    ╱      ╲╱╲╱      │   │
│  │ 0 ───────────────────→     │  │ 0% ──────────────→   │   │
│  │   Epoch 1 3 5 7 9          │  │   Epoch 1 3 5 7 9    │   │
│  └─────────────────────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Row 3: Success Rate Breakdown (Full-width)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Success Rate Breakdown by Category                   │   │
│  │ [Stacked Bar Chart - 100% stacked]                  │   │
│  │                                                       │   │
│  │ 100% ┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃      │   │
│  │      ┃Perfect┃Partial┃Failure┃                      │   │
│  │       ┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃┃                          │   │
│  │ 0% ───┴───────┴───────┴───────┴─────────→             │   │
│  │     Epoch 1  2   3   4   5   6   7   8   9   10      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### 1. Control Bar

**Element:** TrainingProgressControls (NEW)

**Purpose:** Select training run and era to visualize

**Layout:**
- Container: White card, `p-4 mb-6`, `rounded-lg shadow-sm`
- Grid: 2 columns on desktop, 1 on mobile

**Elements:**

**Training Dropdown:**
- Label: "Training" (text-sm font-medium text-slate-700)
- Control: Custom dropdown component
  - Background: white, border `border-slate-200`
  - Padding: `px-3 py-2`
  - Items: "Training #1", "Training #2", "Training #3", etc.
  - Active item: `text-blue-600 bg-blue-50`

**Era Dropdown:**
- Label: "Era" (text-sm font-medium text-slate-700)
- Control: Same style as Training dropdown
- Items: "Era 1", "Era 2", "Era 3", etc.

**Selected Info Display:**
- Text: "Selected: {Training Name} - Era {N}"
- Metadata row (text-sm text-slate-500):
  - Epochs count
  - Start date/time
  - Status indicator (● green for active, ○ gray for complete)

#### 2. Metrics Summary Cards

**Element:** TrainingMetricsSummary (NEW)

**Purpose:** Display current epoch key metrics with delta from previous epoch

**Layout:**
- Grid: `grid-cols-2 md:grid-cols-4 gap-4`
- Card style: White card, `p-4 rounded-lg shadow-sm`

**Individual Metric Card:**

```
┌─────────────────┐
│ Pass@1          │  ← Label (text-xs text-slate-500 mb-1)
│ 45.2%           │  ← Value (text-2xl font-bold text-slate-800)
│ ↑ 5.3%          │  ← Delta (text-sm text-emerald-600 font-medium)
└─────────────────┘
```

**Delta Indicators:**
- Positive: `↑` + `text-emerald-600` (good improvement)
- Negative: `↓` + `text-rose-600` (regression)
- Neutral: `→` + `text-slate-500` (no change)

**Metrics:**
1. Pass@1 - Percentage
2. Pass@K - Percentage
3. Reward - Float (2 decimals)
4. Success Rate - Percentage

#### 3. Pass@1 Over Epochs Chart

**Element:** PassRateLineChart (NEW)

**Purpose:** Line chart showing Pass@1 across epochs

**Chart Configuration (Recharts):**
- Type: `LineChart`
- X-Axis: Epoch number (1, 2, 3, ...)
- Y-Axis: Pass@1 percentage (0-100%)
- Series: Single line (Pass@1)
- Color: `#3b82f6` (blue-500)
- Line props: `strokeWidth={2}, dot={{ r: 4 }}`

**Tooltip:**
- Custom tooltip showing:
  - Epoch: N
  - Pass@1: XX.X%
  - Timestamp: YYYY-MM-DD HH:MM

**Interactivity:**
- Hover: Show tooltip, highlight data point
- Click: Navigate to epoch details (future feature)

#### 4. Pass@K Over Epochs Chart

**Element:** PassKRateLineChart (NEW)

**Same as Pass@1 chart but:**
- Color: `#8b5cf6` (violet-500)
- Shows Pass@K values (typically K=5 or K=10)

#### 5. Reward Trend Chart

**Element:** RewardTrendLineChart (NEW)

**Purpose:** Line chart showing average reward per epoch

**Chart Configuration:**
- Type: `LineChart`
- X-Axis: Epoch number
- Y-Axis: Reward (0 to max_reward)
- Color: `#10b981` (emerald-500)
- Fill area under line with gradient (emerald-500 with opacity)

**Example Data Points:**
- Epoch 1: 2.3
- Epoch 3: 5.8
- Epoch 5: 7.2
- Epoch 7: 8.4
- Epoch 9: 9.1

#### 6. Success Rate Trend Chart

**Element:** SuccessRateLineChart (NEW)

**Purpose:** Line chart showing success rate percentage per epoch

**Chart Configuration:**
- Type: `LineChart`
- X-Axis: Epoch number
- Y-Axis: Success rate (0-100%)
- Color: `#f59e0b` (amber-500)
- Dashed line for target threshold (e.g., 80%)

**Target Line:**
- Horizontal reference line at 80%
- Style: `stroke="#94a3b8", strokeDasharray="5 5"`
- Label: "Target: 80%"

#### 7. Success Rate Breakdown Chart

**Element:** SuccessRateStackedBarChart (NEW)

**Purpose:** 100% stacked bar showing success categories over epochs

**Chart Configuration:**
- Type: `BarChart` (stacked)
- X-Axis: Epoch number
- Y-Axis: Percentage (0-100%)
- Stacks:
  - Perfect Score: `#10b981` (emerald-500)
  - Partial Success: `#f59e0b` (amber-500)
  - Complete Failure: `#ef4444` (rose-500)

**Legend:**
- Top-right corner
- Small colored dots + labels

**Tooltip:**
- Shows breakdown for hovered epoch:
  - Perfect: XX.X%
  - Partial: XX.X%
  - Failure: XX.X%

---

## Tab 3: Training Comparison (NEW)

### Purpose

Compare multiple training runs side-by-side to identify trends, improvements, and regressions. Visualize deltas between runs with clear indicators.

### Layout Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  Tab 3: Training Comparison                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Training Selection Bar (White Card, p-4, mb-6)              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Select Trainings to Compare:                        │    │
│  │                                                      │    │
│  │ [☑] Training #1 (2026-02-01)  [☑] Training #2 (02-02)│    │
│  │ [☑] Training #3 (2026-02-03)  [☐] Training #4 (02-04)│    │
│  │                                                      │    │
│  │ Selected: 3 trainings | [Clear All] [Select Latest 3]│    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Comparison Summary (Full-width)                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Final Metrics Comparison (Side-by-Side Table)        │   │
│  │                                                       │   │
│  │ ┌────────────┬─────────┬─────────┬─────────┬─────────┐ │   │
│  │ │ Metric     │ Train #1│ Train #2│ Train #3│  Delta  │ │   │
│  │ ├────────────┼─────────┼─────────┼─────────┼─────────┤ │   │
│  │ │ Pass@1     │  42.1%  │  45.2%  │  47.8%  │ ↑ +5.7% │ │   │
│  │ │ Pass@K     │  65.3%  │  67.8%  │  71.2%  │ ↑ +5.9% │ │   │
│  │ │ Avg Reward │   7.85  │   8.42  │   9.01  │ ↑ +1.16 │ │   │
│  │ │ Success %  │  75.1%  │  78.3%  │  82.1%  │ ↑ +7.0% │ │   │
│  │ │ Epochs     │    10   │    10   │    10   │   0     │ │   │
│  │ └────────────┴─────────┴─────────┴─────────┴─────────┘ │   │
│  │                                                       │   │
│  │ Delta = Latest - Earliest (Train #3 - Train #1)      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Row 1: Pass@1 & Pass@K Comparison (2-column)                │
│  ┌─────────────────────────────┐  ┌─────────────────────┐   │
│  │ Pass@1 Comparison           │  │ Pass@K Comparison   │   │
│  │ [Multi-Line Chart]          │  │ [Multi-Line Chart]  │   │
│  │                             │  │                     │   │
│  │ 100% ──┐                    │  │ 100% ──┐            │   │
│  │       │ ╲ #3 (blue)        │  │       │ ╲ #3        │   │
│  │ 50% ──┼──╲ #2 (violet)    │  │ 75% ──┼──╲ #2        │   │
│  │       │   ╲___ #1 (slate) │  │       │   ╲___ #1    │   │
│  │ 0% ────┴─────────────────→ │  │ 0% ────┴─────────→   │   │
│  │   Epoch 1 3 5 7 9          │  │   Epoch 1 3 5 7 9    │   │
│  │                             │  │                     │   │
│  │ ┌────────────────────────┐ │  │ ┌────────────────┐  │   │
│  │ │ #1 slate │ #2 violet   │ │  │ │ #1 #2 #3       │  │   │
│  │ └────────────────────────┘ │  │ └────────────────┘  │   │
│  └─────────────────────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Row 2: Reward & Success Rate (2-column)                     │
│  ┌─────────────────────────────┐  ┌─────────────────────┐   │
│  │ Avg Reward Comparison       │  │ Success Rate Comparison│  │
│  │ [Multi-Line Chart]          │  │ [Multi-Line Chart]  │   │
│  │ (Same style as Pass@1)      │  │ (Same style as Pass@1)│  │
│  └─────────────────────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Row 3: Category Distribution (Full-width)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Reward Category Distribution Over Trainings         │   │
│  │ [Grouped Bar Chart]                                 │   │
│  │                                                       │   │
│  │ 100 ┤                     ┌───┐                      │   │
│  │     │   ┌───┐             │   │   ┌───┐              │   │
│  │  50 ┤   │   │   ┌───┐     │   │   │   │              │   │
│  │     │   │   │   │   │     │   │   │   │              │   │
│  │   0 ┼───┴───┴───┴───┴─────┴───┴───┴───┴─────→       │   │
│  │     Perfect  Partial  Failure  Perfect  Partial  ...│   │
│  │        Train #1                  Train #2          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### 1. Training Selection Bar

**Element:** TrainingComparisonSelector (NEW)

**Purpose:** Select multiple trainings for comparison

**Layout:**
- Container: White card, `p-4 mb-6 rounded-lg shadow-sm`

**Selection Options:**
- Checkbox list of available trainings
- Each checkbox:
  - Label: "Training #{N} (YYYY-MM-DD)"
  - Color: Blue border when selected

**Action Buttons:**
- "Clear All": Deselect all
- "Select Latest 3": Auto-select most recent 3

**Status Display:**
- Text: "Selected: {N} trainings"
- Max selection: 5 (to prevent chart clutter)

#### 2. Comparison Summary Table

**Element:** ComparisonSummaryTable (NEW)

**Purpose:** Table comparing final metrics across selected trainings

**Layout:**
- Container: White card, `p-6 rounded-lg shadow-sm`
- Overflow-x: auto for mobile

**Table Structure:**
- Columns: Metric | Training #1 | Training #2 | Training #3 | Delta
- Delta column shows: Latest - Earliest
- Delta styling:
  - Positive: `↑ +X.XX` with `text-emerald-600`
  - Negative: `↓ -X.XX` with `text-rose-600`
  - Neutral: `→ 0` with `text-slate-500`

**Row Styling:**
- Header row: `bg-slate-50 text-slate-600 text-xs uppercase`
- Data rows: `border-t border-slate-200`
- Hover state: `bg-slate-50`

#### 3. Multi-Line Comparison Charts

**Element:** ComparisonLineChart (NEW - reusable for all 4 charts)

**Purpose:** Overlay multiple training lines on same chart

**Chart Configuration (Recharts):**
- Type: `LineChart`
- X-Axis: Epoch number
- Y-Axis: Metric value (percentage or float)
- Series: One line per selected training (max 5)

**Color Palette for Trainings:**
- Training 1: `#94a3b8` (slate-400) - reference
- Training 2: `#8b5cf6` (violet-500)
- Training 3: `#3b82f6` (blue-500) - latest
- Training 4: `#06b6d4` (cyan-500)
- Training 5: `#10b981` (emerald-500)

**Line Styling:**
- Stroke width: 2
- Dot radius: 3
- Active line (latest): Thicker (strokeWidth: 3)

**Legend:**
- Bottom of chart
- Colored line segment + training label
- Click to toggle visibility

**Tooltip:**
- Shows all training values for hovered epoch
- Format: "Training #{N}: XX.X"

#### 4. Grouped Bar Chart

**Element:** CategoryDistributionGroupedBar (NEW)

**Purpose:** Compare reward categories across trainings

**Chart Configuration:**
- Type: `BarChart` (grouped, not stacked)
- X-Axis: Training number
- Y-Axis: Count
- Groups: Perfect, Partial, Failure (3 bars per training)

**Colors:**
- Perfect: `#10b981` (emerald-500)
- Partial: `#f59e0b` (amber-500)
- Failure: `#ef4444` (rose-500)

**Legend:**
- Top-right corner
- Color key

---

## Tab 4: Failure Analysis (NEW)

### Purpose

Deep dive into failure patterns, categorization, and specific failure cases. Understand why trajectories fail and identify common failure modes.

### Layout Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  Tab 4: Failure Analysis                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Failure Overview (3-column summary)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │ Total    │  │ Top      │  │ Avg      │                    │
│  │ Failures │  │ Reason   │  │ Reward   │                    │
│  │   127    │  │ Timeout  │  │   2.15   │                    │
│  │  22.3%   │  │  45.7%   │  │  vs 8.42 │                    │
│  └──────────┘  └──────────┘  └──────────┘                    │
│  <─ grid-cols-1 md:grid-cols-3 gap-4 ─>                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Row 1: Failure Categorization (3-column)                    │
│  ┌─────────────────────┐  ┌───────────────────┐  ┌─────────┐ │
│  │ By Reason           │  │ By Reward Range   │  │ By Tool │ │
│  │ [Donut Chart]       │  │ [Donut Chart]     │  │ [Pie]   │ │
│  │                     │  │                   │  │         │ │
│  │      Timeout 45%    │  │    0-1    35%     │  │ Tool A  │ │
│  │    Truncation 28%   │  │    1-3    25%     │  │ Tool B  │ │
│  │     Unexpected 27%  │  │    3-5    20%     │  │ Tool C  │ │
│  │                     │  │    5+     20%     │  │         │ │
│  │                     │  │                   │  │         │ │
│  │ [Breakdown list]    │  │ [Breakdown list]  │  │ [List]  │ │
│  └─────────────────────┘  └───────────────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Failure Trend Over Epochs (Full-width)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Failure Rate Trend                                   │   │
│  │ [Line Chart - Dual Series]                           │   │
│  │                                                       │   │
│  │ 30% ──┐                                              │   │
│  │      │ ╱╲  Failure Rate (%)                          │   │
│  │ 15% ─┼╱  ╲╱╲                                        │   │
│  │     ╱      ╲╱╲╱                                     │   │
│  │ 0% ──┴─────────────────→                             │   │
│  │     Epoch 1 3 5 7 9                                  │   │
│  │                                                       │   │
│  │ 100 ──┐     ┃┃┃┃┃┃┃ Failure Count (bar)             │   │
│  │       │     ┃ ┃ ┃ ┃                                  │   │
│  │  50 ──┼     ┃ ┃ ┃ ┃                                  │   │
│  │       │     ┃ ┃ ┃ ┃                                  │   │
│  │   0 ───┴─────┴─┴─┴─┴──────→                         │   │
│  │        Epoch 1 3 5 7 9                               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Failure Cases (Expandable Cards)                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Failure Cases (127 total)  [Filter ▼] [Search...]   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [▶] Case #127 - Timeout - Reward: 0.12               │   │
│  │     Epoch: 10 | 2026-02-03 15:42                     │   │
│  │     Tools: search(3), calculate(2)                  │   │
│  │                                                       │   │
│  │     [▼ Expanded View]                                │   │
│  │     ┌─────────────────────────────────────────────┐ │   │
│  │     │ Reason: Timeout after 60s                    │ │   │
│  │     │ Last Action: Tool "calculate" returned       │ │   │
│  │     │ unexpected error                             │ │   │
│  │     │                                              │ │   │
│  │     │ Tool Usage:                                  │ │   │
│  │     │ • search: 3 calls (2 normal, 1 empty)       │ │   │
│  │     │ • calculate: 2 calls (1 timeout, 1 error)   │ │   │
│  │     │                                              │ │   │
│  │     │ Reward Breakdown:                            │ │   │
│  │     │ • Task completion: 0.0/5.0                   │ │   │
│  │     │ • Tool efficiency: 0.12/3.0                  │ │   │
│  │     │ • Time penalty: -1.0                         │ │   │
│  │     │                                              │ │   │
│  │     │ [View Full Trajectory →]                    │ │   │
│  │     └─────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [▶] Case #126 - Truncation - Reward: 1.85            │   │
│  │     Epoch: 10 | 2026-02-03 15:38                     │   │
│  │     Tools: parse(1), validate(1)                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [▶] Case #125 - Unexpected Tool - Reward: 0.45       │   │
│  │     ...                                               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  [Load More ↓]                                              │
└─────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### 1. Failure Overview Cards

**Element:** FailureOverviewCards (NEW)

**Purpose:** High-level failure metrics at a glance

**Layout:**
- Grid: `grid-cols-1 md:grid-cols-3 gap-4`

**Card 1: Total Failures**
- Label: "Total Failures" (text-xs text-slate-500)
- Count: "127" (text-2xl font-bold text-rose-600)
- Percentage: "22.3%" (text-sm text-slate-500)
- Background: `bg-rose-50` (light rose tint)

**Card 2: Top Reason**
- Label: "Top Reason" (text-xs text-slate-500)
- Reason: "Timeout" (text-xl font-bold text-slate-800)
- Percentage: "45.7%" (text-sm text-amber-600)
- Icon: Clock icon

**Card 3: Average Reward**
- Label: "Avg Reward" (text-xs text-slate-500)
- Value: "2.15" (text-2xl font-bold text-slate-800)
- Comparison: "vs 8.42 (all)" (text-sm text-slate-500)
- Background: `bg-slate-50`

#### 2. Failure Categorization Charts

**Element:** FailureCategorizationCharts (NEW - 3 instances)

**Chart 1: By Reason**

**Purpose:** Donut chart showing failure reasons

**Categories:**
- Timeout (45.7%) - `#ef4444` (rose-500)
- Truncation (28.3%) - `#f59e0b` (amber-500)
- Unexpected Tool (18.1%) - `#8b5cf6` (violet-500)
- Other (7.9%) - `#94a3b8` (slate-400)

**Chart 2: By Reward Range**

**Purpose:** Donut chart showing reward distribution of failures

**Categories:**
- 0-1 (35.4%) - `#ef4444` (rose-500)
- 1-3 (24.8%) - `#f97316` (orange-500)
- 3-5 (19.7%) - `#f59e0b` (amber-500)
- 5+ (20.1%) - `#eab308` (yellow-500)

**Chart 3: By Tool Usage**

**Purpose:** Pie chart showing most common tools in failures

**Categories (Top 5 + Other):**
- Tool A (e.g., "search") - 28%
- Tool B (e.g., "calculate") - 22%
- Tool C (e.g., "parse") - 18%
- Tool D (e.g., "validate") - 12%
- Tool E (e.g., "transform") - 8%
- Other - 12%

**Component Style:**
- Card: White, `p-6 rounded-lg shadow-sm`
- Layout: 2-column grid (chart | breakdown list)
- Breakdown list: Icon + Reason + Count + %

#### 3. Failure Trend Chart

**Element:** FailureTrendDualChart (NEW)

**Purpose:** Combined line + bar chart showing failure trends

**Chart Configuration:**
- Type: `ComposedChart` (Recharts)
- X-Axis: Epoch number
- Left Y-Axis: Failure rate percentage (0-100%)
- Right Y-Axis: Failure count (0 to max)

**Series:**
1. Line: Failure rate (%)
   - Color: `#ef4444` (rose-500)
   - Stroke width: 2

2. Bar: Failure count
   - Color: `#fca5a5` (rose-300)
   - Opacity: 0.6

**Grid Lines:**
- Horizontal only
- Dashed: `strokeDasharray="3 3"`

**Legend:**
- Top-right
- Line icon: "Failure Rate (%)"
- Bar icon: "Failure Count"

#### 4. Failure Cases List

**Element:** FailureCasesList (NEW)

**Purpose:** Paginated list of expandable failure case cards

**Filter Bar:**
- Left: "Failure Cases (127 total)"
- Right:
  - Filter dropdown: [All Reasons ▼], [Timeout ▼], etc.
  - Search input: Placeholder "Search by tool, reward..."
  - Sort dropdown: [Latest ▼], [Earliest ▼], [Lowest Reward ▼]

**Case Card (Collapsed):**

```
┌──────────────────────────────────────────────────────┐
│ [▶] Case #127 - Timeout - Reward: 0.12               │
│     Epoch: 10 | 2026-02-03 15:42                     │
│     Tools: search(3), calculate(2)                   │
└──────────────────────────────────────────────────────┘
```

**Styling:**
- Container: White, `p-4 mb-3 rounded-lg shadow-sm border-l-4`
- Border color: Based on severity
  - Critical (reward 0-1): `border-rose-500`
  - Warning (reward 1-3): `border-amber-500`
  - Moderate (reward 3+): `border-yellow-500`

**Interactivity:**
- Click card: Toggle expand/collapse
- Expand icon: `▶` → `▼`

**Case Card (Expanded):**

**Additional Content:**
- Reason details
- Last action context
- Tool usage breakdown
- Reward breakdown
- "View Full Trajectory" button (link to detail view)

**Internal Layout (Expanded):**
- Background: `bg-slate-50`
- Padding: `p-4 mt-3`
- Border top: `border-t border-slate-200`
- Grid layout for details

**Tool Usage Mini-Table:**
```
Tool         Calls   Normal   Empty   Timeout   Error
search         3        2       1        0        0
calculate      2        0       0        1        1
```

**Reward Breakdown Mini-Table:**
```
Component        Score    Max
Task Completion   0.0      5.0
Tool Efficiency   0.12     3.0
Time Penalty     -1.0      0.0
─────────────
Total            0.12
```

**Pagination:**
- Bottom: "Showing 1-10 of 127"
- Buttons: [Previous] [Next]
- Page selector: [1] [2] [3] ... [13]

---

## Tab 5: Tool Contexts

### Layout Annotation

```
┌─────────────────────────────────────────────────────────────┐
│  Tab 5: Tool Contexts                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Full-Width Existing Component                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ UnexpectedToolContextsView                           │   │
│  │ [Existing tool context analysis interface]           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Note

This tab reuses the existing `UnexpectedToolContextsView` component without modifications. It provides detailed analysis of unexpected tool usage patterns.

---

## Component Library Reference

### Existing Components (Reused)

1. **TerminationStatsCard** (`src/components/analysis/TerminationStatsCard.tsx`)
   - Pie chart + category breakdown
   - Icons: CheckCircle, StopCircle, Clock

2. **RewardCategoryStatsCard** (`src/components/analysis/RewardCategoryStatsCard.tsx`)
   - Bar chart + summary stats
   - Icons: TrendingUp, TrendingDown, Minus

3. **ToolReturnStatsCard** (`src/components/analysis/ToolReturnStatsCard.tsx`)
   - Pie chart + tool return categories

4. **ProcessRewardCorrelationCard** (`src/components/analysis/ProcessRewardCorrelationCard.tsx`)
   - Scatter plot

5. **UnexpectedToolContextsView** (`src/components/analysis/UnexpectedToolContextsView.tsx`)
   - Tool context analysis (Tab 5)

### New Components to Build

#### Tab 2 Components
1. `TrainingProgressControls` - Dropdown selectors for training/era
2. `TrainingMetricsSummary` - 4 metric cards with deltas
3. `PassRateLineChart` - Recharts line chart (Pass@1)
4. `PassKRateLineChart` - Recharts line chart (Pass@K)
5. `RewardTrendLineChart` - Recharts line chart with gradient fill
6. `SuccessRateLineChart` - Recharts line chart with target line
7. `SuccessRateStackedBarChart` - 100% stacked bar chart

#### Tab 3 Components
1. `TrainingComparisonSelector` - Multi-select checkboxes
2. `ComparisonSummaryTable` - Metrics comparison table
3. `ComparisonLineChart` - Multi-line overlay chart (reusable x4)
4. `CategoryDistributionGroupedBar` - Grouped bar chart

#### Tab 4 Components
1. `FailureOverviewCards` - 3 summary cards
2. `FailureCategorizationDonut` - Donut chart (reusable x3)
3. `FailureTrendDualChart` - Composed line + bar chart
4. `FailureCasesList` - Expandable case cards with pagination
5. `FailureCaseCard` - Individual expandable card component

### Shared Utilities

**Color Constants:**
```typescript
const TRAINING_COLORS = [
  '#94a3b8', // slate-400 (reference)
  '#8b5cf6', // violet-500
  '#3b82f6', // blue-500 (latest)
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
];

const FAILURE_COLORS = {
  timeout: '#ef4444',      // rose-500
  truncation: '#f59e0b',   // amber-500
  unexpected: '#8b5cf6',   // violet-500
  other: '#94a3b8',        // slate-400
};

const REWARD_RANGE_COLORS = {
  '0-1': '#ef4444',    // rose-500
  '1-3': '#f97316',    // orange-500
  '3-5': '#f59e0b',    // amber-500
  '5+': '#eab308',     // yellow-500
};
```

**Chart Tooltip Customization:**
- Custom tooltip component for consistent formatting
- Responsive to chart type (line, bar, pie)

---

## Responsive Design

### Breakpoints

- **Mobile:** < 768px
- **Tablet:** 768px - 1024px
- **Desktop:** > 1024px

### Tab 2: Training Progress

**Desktop (> 1024px):**
- Metrics: 4 columns
- Charts: 2 columns
- Control bar: Full width

**Tablet (768px - 1024px):**
- Metrics: 2 columns
- Charts: 2 columns
- Control bar: Stacked

**Mobile (< 768px):**
- Metrics: 2 columns (2x2 grid)
- Charts: 1 column (stacked)
- Control bar: Full width stacked
- Charts: Minimum height 200px

### Tab 3: Comparison

**Desktop:**
- Selection bar: 2 columns
- Table: Full width with scroll
- Charts: 2 columns

**Tablet:**
- Selection bar: 1 column stacked
- Charts: 1 column stacked

**Mobile:**
- Selection bar: Vertical stacked
- Table: Horizontal scroll
- Charts: 1 column stacked

### Tab 4: Failure Analysis

**Desktop:**
- Overview: 3 columns
- Categorization: 3 columns
- Cases: Full width

**Tablet:**
- Overview: 3 columns
- Categorization: 1 column stacked
- Cases: Full width

**Mobile:**
- Overview: 1 column stacked
- Categorization: 1 column stacked
- Cases: Compact view (hide tool counts on collapsed)

---

## Loading & Error States

### Loading State

**Skeleton Loader Pattern:**

```tsx
<div className="bg-white rounded-lg shadow-sm p-6">
  <h3 className="text-lg font-semibold text-slate-800 mb-4">
    {title}
  </h3>
  <div className="animate-pulse bg-slate-100 rounded h-64"></div>
</div>
```

**Apply to:**
- All chart cards
- Metrics summary cards
- Case list cards

**Spinner Alternative:**
- For quick loads (< 1s)
- Center in card
- Color: `text-blue-600`

### Error State

**Error Card Pattern:**

```tsx
<div className="bg-white rounded-lg shadow-sm p-6">
  <h3 className="text-lg font-semibold text-slate-800 mb-4">
    {title}
  </h3>
  <div className="flex flex-col items-center justify-center h-64">
    <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
    <p className="text-slate-600 mb-2">Failed to load data</p>
    <button
      onClick={onRetry}
      className="text-blue-600 hover:text-blue-700 font-medium"
    >
      Try Again
    </button>
  </div>
</div>
```

**Empty State Pattern:**

```tsx
<div className="bg-white rounded-lg shadow-sm p-6">
  <h3 className="text-lg font-semibold text-slate-800 mb-4">
    {title}
  </h3>
  <div className="flex flex-col items-center justify-center h-64">
    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
      <BarChart3 className="w-8 h-8 text-slate-400" />
    </div>
    <p className="text-slate-600 mb-1">No data available</p>
    <p className="text-sm text-slate-500">
      Import trajectories to see analysis
    </p>
  </div>
</div>
```

### Progress Indicator

**For Long-Loading Data:**

```tsx
<div className="flex items-center gap-3 text-slate-600">
  <RefreshCw className="w-5 h-5 animate-spin" />
  <span className="text-sm">Loading analysis data...</span>
</div>
```

**Apply to:**
- Initial page load
- Tab switch
- Refresh action
- Filter changes

---

## Data Flow Indicators

### API Endpoints (To Be Implemented)

**Tab 2 - Training Progress:**
- `GET /api/training/trainings` - List available trainings
- `GET /api/training/{training_id}/eras` - List eras for training
- `GET /api/training/{training_id}/era/{era_id}/metrics` - Epoch metrics
- `GET /api/training/{training_id}/era/{era_id}/pass-rate` - Pass@1/Pass@K over epochs
- `GET /api/training/{training_id}/era/{era_id}/reward-trend` - Reward over epochs
- `GET /api/training/{training_id}/era/{era_id}/success-rate` - Success rate over epochs
- `GET /api/training/{training_id}/era/{era_id}/success-breakdown` - Category breakdown

**Tab 3 - Comparison:**
- `GET /api/training/compare?ids={id1,id2,id3}` - Compare trainings
- `GET /api/training/{training_id}/metrics-summary` - Final metrics
- `GET /api/training/compare/pass-rate?ids={...}` - Pass rates comparison
- `GET /api/training/compare/reward?ids={...}` - Rewards comparison
- `GET /api/training/compare/success-rate?ids={...}` - Success rates comparison
- `GET /api/training/compare/categories?ids={...}` - Category distribution

**Tab 4 - Failure Analysis:**
- `GET /api/failures/summary` - Overview stats
- `GET /api/failures/by-reason` - Reason breakdown
- `GET /api/failures/by-reward-range` - Reward range breakdown
- `GET /api/failures/by-tool` - Tool usage breakdown
- `GET /api/failures/trend` - Failure trend over epochs
- `GET /api/failures/cases?page={n}&limit={10}` - Paginated case list
- `GET /api/failures/cases/{case_id}` - Individual case details

### Data Refresh Strategy

**Manual Refresh:**
- Header refresh button
- Increments `refreshKey` state
- Forces re-fetch of all tab data

**Auto-Refresh (Optional Future Enhancement):**
- Polling every 30s for active trainings
- WebSocket for real-time updates (advanced)

---

## User Interaction Points

### Tab 2 - Training Progress

**Training Dropdown:**
- Click → Open dropdown
- Select training → Update era dropdown + refresh charts
- Hover → Highlight selection

**Era Dropdown:**
- Click → Open dropdown (filtered by selected training)
- Select era → Update metrics + refresh charts

**Chart Interactions:**
- Hover → Show tooltip with epoch details
- Click data point → (Future) Navigate to epoch detail

**Metrics Cards:**
- Hover → Slight highlight (subtle)
- No click action (summary only)

### Tab 3 - Comparison

**Training Selection:**
- Click checkbox → Toggle selection
- "Clear All" → Deselect all
- "Select Latest 3" → Auto-select most recent 3
- Max 5 selections (enforced)

**Table Interactions:**
- Hover row → Highlight background
- Sort column → (Future) Click header to sort

**Chart Legend:**
- Click legend item → Toggle series visibility
- Hover → Highlight corresponding line

**Chart Hover:**
- Show tooltip with all training values at epoch

### Tab 4 - Failure Analysis

**Filter Bar:**
- Reason filter dropdown → Filter cases by reason
- Search input → Real-time filter by text
- Sort dropdown → Change sort order

**Case Card:**
- Click → Toggle expand/collapse
- Expanded view → Show detailed breakdown
- "View Full Trajectory" → Navigate to trajectory detail page

**Pagination:**
- Page numbers → Jump to page
- Previous/Next → Navigate pages

---

## Example Data (Realistic)

### Training Progress Example

**Training #3, Era 5:**
- Epochs: 10
- Start: 2026-02-03 14:30:00
- Status: Active

**Epoch Data:**
| Epoch | Pass@1 | Pass@K | Avg Reward | Success % | Perfect | Partial | Failure |
|-------|--------|--------|------------|-----------|---------|---------|---------|
| 1     | 32.1%  | 54.2%  | 4.12       | 62.3%     | 15      | 47      | 38      |
| 3     | 38.5%  | 61.8%  | 6.45       | 71.2%     | 22      | 49      | 29      |
| 5     | 42.3%  | 66.5%  | 7.82       | 76.8%     | 28      | 49      | 23      |
| 7     | 44.8%  | 68.9%  | 8.23       | 78.9%     | 31      | 48      | 21      |
| 9     | 45.2%  | 67.8%  | 8.42       | 78.3%     | 32      | 46      | 22      |

### Comparison Example

**3 Trainings Comparison:**

| Metric     | Train #1 | Train #2 | Train #3 | Delta   |
|------------|----------|----------|----------|---------|
| Pass@1     | 42.1%    | 45.2%    | 47.8%    | ↑ +5.7% |
| Pass@K     | 65.3%    | 67.8%    | 71.2%    | ↑ +5.9% |
| Avg Reward | 7.85     | 8.42     | 9.01     | ↑ +1.16 |
| Success %  | 75.1%    | 78.3%    | 82.1%    | ↑ +7.0% |
| Epochs     | 10       | 10       | 10       | 0       |

### Failure Analysis Example

**Overview:**
- Total Failures: 127 (22.3%)
- Top Reason: Timeout (45.7%)
- Avg Reward: 2.15 (vs 8.42 all trajectories)

**By Reason:**
- Timeout: 58 cases (45.7%)
- Truncation: 36 cases (28.3%)
- Unexpected Tool: 23 cases (18.1%)
- Other: 10 cases (7.9%)

**Sample Failure Case:**
```
Case #127
- Reason: Timeout after 60s
- Reward: 0.12
- Epoch: 10
- Timestamp: 2026-02-03 15:42:18
- Tools: search(3), calculate(2)

Tool Usage:
- search: 3 calls (2 normal, 1 empty)
- calculate: 2 calls (1 timeout, 1 error)

Reward Breakdown:
- Task completion: 0.0/5.0
- Tool efficiency: 0.12/3.0
- Time penalty: -1.0
- Total: 0.12
```

---

## Implementation Notes

### Phased Approach

**Phase 1: Tab 2 (Training Progress)**
- Build dropdown controls
- Implement metrics summary
- Create 4 chart types (line charts + stacked bar)
- API integration

**Phase 2: Tab 3 (Comparison)**
- Build multi-select interface
- Implement comparison table
- Reuse line chart component for overlays
- Add grouped bar chart

**Phase 3: Tab 4 (Failure Analysis)**
- Build overview cards
- Create 3 categorization donut charts
- Implement dual chart (line + bar)
- Build expandable case list with pagination

### Reusability

**Highly Reusable Components:**
- `ComparisonLineChart` - Used 4x in Tab 3
- `FailureCategorizationDonut` - Used 3x in Tab 4
- `MetricCard` - Used across all tabs (metrics summary)
- Custom tooltip component - All charts

**Chart Wrappers:**
Consider creating generic chart wrapper components:
- `LineChartWrapper` - Handles common line chart config
- `BarChartWrapper` - Handles common bar chart config
- `DonutChartWrapper` - Handles pie/donut charts

### Performance Considerations

**Data Fetching:**
- Implement React Query or SWR for caching
- Paginate failure cases (don't load all at once)
- Debounce search input (300ms)

**Chart Rendering:**
- Use `ResponsiveContainer` for all Recharts
- Limit data points (show max 50 epochs, aggregate older)
- Virtualize long lists (failure cases)

**State Management:**
- Local state for UI interactions (expand/collapse)
- Global state (Redux/Zustand) for shared selections if needed

---

## Accessibility

### Keyboard Navigation

- Tab through all interactive elements
- Enter/Space to activate buttons, toggle checkboxes
- Arrow keys for dropdown navigation
- Escape to close dropdowns/modals

### Screen Reader Support

- ARIA labels on all interactive elements
- Chart alt text: "Line chart showing Pass@1 over epochs"
- Table headers properly marked
- Focus indicators on all focusable elements

### Color Contrast

- All text meets WCAG AA standards (4.5:1)
- Chart colors distinguishable by color + pattern
- Delta indicators use icons (↑↓→) + color

---

## Conclusion

This design mockup provides a comprehensive specification for enhancing the RL Training Analysis Interface with 3 new tabs (Training Progress, Comparison, Failure Analysis) while preserving existing functionality (Overview, Tool Contexts).

**Key Design Principles:**
1. **Consistency** with existing design system (colors, typography, spacing)
2. **Reusability** of components across tabs
3. **Responsiveness** across mobile, tablet, desktop
4. **Performance** with pagination, caching, and lazy loading
5. **Accessibility** with keyboard navigation and screen reader support

**Next Steps:**
1. Review and approve design specification
2. Implement backend API endpoints
3. Build frontend components (phased approach)
4. Integration testing
5. User acceptance testing

**Estimated Complexity:**
- Tab 2: Medium (4 chart types, dropdown controls)
- Tab 3: Medium-High (multi-select, comparison logic)
- Tab 4: High (complex data aggregation, expandable cards)

**Total Estimated Implementation Time:** 2-3 weeks (including API work)
