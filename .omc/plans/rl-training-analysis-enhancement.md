# RL Training Analysis Interface Enhancement Plan

## Context

### Original Request
Enhance the RL training analysis interface to support:
1. **Pass@1 / Pass@K (Success Rate)** - Primary success metric tracking
2. **Failure Case Analysis** - Deep dive into failed trajectories
3. **Tool Usage / Termination Distribution** - Behavior pattern analysis
4. **Epoch-to-Epoch Comparison** - Within same training run
5. **Cross-Training Comparison** - Different training runs comparison
6. **Advanced Filtering** - By reward, termination reason, tool usage patterns

### Pre-Gathered Codebase Context

**Frontend Structure:**
- `/frontend/src/views/AnalysisView.tsx` - Main analysis view with 2 tabs (Overview, Tool Contexts)
- `/frontend/src/components/analysis/` - Analysis cards using Recharts:
  - `TerminationStatsCard.tsx` - Pie chart for termination reasons
  - `RewardCategoryStatsCard.tsx` - Bar chart for reward distribution
  - `ToolReturnStatsCard.tsx` - Tool return success/failure stats
  - `ProcessRewardCorrelationCard.tsx` - Scatter plot for process-reward correlation
  - `UnexpectedToolContextsView.tsx` - Failed tool calls viewer

**Backend Structure:**
- `/backend/routes/analysis_stats.py` - Current analysis endpoints (no grouping support)
- `/backend/services/analysis_stats_service.py` - Statistics logic using pandas + scipy.stats
- `/backend/repositories/trajectory.py` - LanceDB data access with filtering support

**Data Model (DbTrajectory):**
- `training_id: str` - Training run identifier
- `epoch_id: int` - Epoch number
- `iteration_id: int` - Iteration number
- `sample_id: int` - Sample number
- `reward: float` - Final reward
- `termination_reason: str` - Why trajectory ended
- `steps_json: str` - JSON encoded steps with actions/observations
- `agent_name: str` - Agent identifier

**Critical Gaps Identified:**
1. No grouped statistics by `training_id`/`epoch_id` - All current APIs work on entire dataset
2. No epoch-over-epoch progression charts
3. No training comparison views
4. No failure case deep-dive interface
5. No advanced filtering UI (current filter is basic text-based)

---

## Work Objectives

### Core Objective
Create a comprehensive RL training analysis interface that enables researchers to track agent performance across epochs, compare training runs, and deeply analyze failure cases.

### Deliverables
1. Enhanced backend APIs with grouping support
2. New "Training Progress" tab with epoch-over-epoch charts
3. New "Training Comparison" tab for cross-training comparison
4. New "Failure Analysis" tab with structured failure categorization
5. Enhanced filtering UI components
6. Preserved backward compatibility with existing functionality

### Definition of Done
- All existing tests pass
- New APIs return correct grouped statistics
- Frontend tabs render without errors
- Charts display real data from the database
- Filters work as expected
- No breaking changes to existing APIs

---

## Must Have / Must NOT Have

### Must Have
- Pass@1/Pass@K calculation per epoch
- Line charts showing metric progression over epochs
- Side-by-side comparison of different training runs
- Failure case categorization by termination reason
- Filter by reward range, termination reason, tool usage
- All existing functionality preserved

### Must NOT Have
- Breaking changes to existing API endpoints
- Data export functionality (explicitly not needed per requirements)
- Direct database access from frontend components
- Hard-coded training_id values (must be discovered dynamically)

---

## Task Flow and Dependencies

```
Phase 1: Backend Foundation (Parallel Tasks)
    |
    +-- Task 1.1: Training/Education Discovery API
    |
    +-- Task 1.2: Grouped Statistics Service Methods
    |
    +-- Task 1.3: New Analysis Endpoints
    |
    +-- Task 1.4: Pass@K Calculation Service
    |
Phase 2: Frontend Components (After Phase 1)
    |
    +-- Task 2.1: Training Progress Components
    |
    +-- Task 2.2: Training Comparison Components
    |
    +-- Task 2.3: Failure Analysis Components
    |
    +-- Task 2.4: Enhanced Filtering UI
    |
Phase 3: Integration (After Phase 2)
    |
    +-- Task 3.1: AnalysisView Redesign
    |
    +-- Task 3.2: Route Registration & Testing
    |
Phase 4: Verification (After Phase 3)
    |
    +-- Task 4.1: Backend Testing
    |
    +-- Task 4.2: Frontend Testing
    |
    +-- Task 4.3: Integration Testing
```

---

## Detailed TODOs

### Phase 1: Backend Foundation

#### Task 1.1: Training/Education Discovery API
**File:** `backend/routes/analysis_stats.py` (new endpoint)
**Purpose:** Allow frontend to discover available training runs and epochs

**Acceptance Criteria:**
- `GET /api/analysis-stats/training-list` returns list of unique `training_id` values
- Each training includes metadata: count, epoch range, date range
- `GET /api/analysis-stats/epoch-list?training_id={id}` returns epochs for a training
- Response includes trajectory count per epoch

**Implementation:**
```python
@router.get("/training-list")
async def get_training_list():
    # Returns: [{"training_id": str, "trajectory_count": int, "epoch_range": [min, max]}]

@router.get("/epoch-list")
async def get_epoch_list(training_id: Optional[str] = None):
    # Returns: [{"epoch_id": int, "trajectory_count": int, "avg_reward": float}]
```

---

#### Task 1.2: Grouped Statistics Service Methods
**File:** `backend/services/analysis_stats_service.py`
**Purpose:** Add methods that support grouping by training_id/epoch_id

**Acceptance Criteria:**
- `get_termination_stats(group_by="training_id", training_id=None, epoch_id=None)`
- `get_tool_return_stats(group_by="training_id", training_id=None, epoch_id=None)`
- `get_reward_category_stats(group_by="training_id", training_id=None, epoch_id=None)`
- When `group_by` is specified, returns dict with keys as group IDs
- Backward compatible: `group_by=None` returns existing format

**Implementation:**
```python
def get_termination_stats(self, group_by: str = None, training_id: str = None, epoch_id: int = None):
    # Apply filters to DataFrame before aggregation
    df = self._apply_filters(self.repo.tbl.search().limit(100000).to_pandas(), training_id, epoch_id)

    if group_by:
        # Group by specified column and return dict
        return {group_id: self._compute_termination_stats(group_df) for group_id, group_df in df.groupby(group_by)}
    else:
        # Existing behavior
        return self._compute_termination_stats(df)
```

---

#### Task 1.3: New Analysis Endpoints
**File:** `backend/routes/analysis_stats.py`
**Purpose:** New endpoints for epoch progression and training comparison

**Acceptance Criteria:**
- `GET /api/analysis-stats/epoch-progression?training_id={id}` - Returns metrics per epoch
- `GET /api/analysis-stats/training-comparison?training_ids={id1,id2}` - Compares two trainings
- `GET /api/analysis-stats/failure-cases?training_id={id}&epoch_id={n}` - Returns failed trajectories

**Implementation:**
```python
@router.get("/epoch-progression")
async def get_epoch_progression(training_id: str):
    """
    Returns:
    {
        "training_id": str,
        "epochs": [
            {
                "epoch_id": int,
                "pass_at_1": float,
                "pass_at_k": float,
                "avg_reward": float,
                "termination_stats": {...},
                "reward_distribution": {...}
            }
        ]
    }
    """

@router.get("/training-comparison")
async def get_training_comparison(training_ids: List[str]):
    """
    Returns:
    {
        "trainings": [
            {
                "training_id": str,
                "pass_at_1": float,
                "pass_at_k": float,
                "avg_reward": float,
                "termination_stats": {...}
            }
        ]
    }
    """

@router.get("/failure-cases")
async def get_failure_cases(
    training_id: Optional[str] = None,
    epoch_id: Optional[int] = None,
    termination_reason: Optional[str] = None,
    reward_max: float = 0.5,
    limit: int = 100
):
    """
    Returns failed trajectories with detailed context
    """
```

---

#### Task 1.4: Pass@K Calculation Service
**File:** `backend/services/analysis_stats_service.py` (new method)
**Purpose:** Calculate Pass@1 and Pass@K metrics per group

**Acceptance Criteria:**
- `compute_pass_at_k(df, k_values=[1, 5, 10])` returns pass rates
- Groups by `data_id` (question) and finds best reward per question
- Returns dict: `{k: pass_rate}`
- Supports filtering by training_id, epoch_id

**Implementation:**
```python
def compute_pass_at_k(self, df: pd.DataFrame, k_values: List[int] = [1, 5, 10]) -> Dict[int, float]:
    """
    For each unique data_id (question), sort trajectories by reward descending.
    Pass@K = (questions with reward > 0 in top K) / total questions
    """
    results = {}
    for k in k_values:
        # Group by data_id, take top K, check if any has reward > 0
        pass_count = 0
        for data_id, group in df.groupby('data_id'):
            top_k = group.nlargest(min(k, len(group)), 'reward')
            if (top_k['reward'] > 0).any():
                pass_count += 1
        results[k] = pass_count / df['data_id'].nunique()
    return results
```

---

### Phase 2: Frontend Components

#### Task 2.1: Training Progress Components
**Files:**
- `frontend/src/components/analysis/TrainingProgressTab.tsx` (new)
- `frontend/src/components/analysis/EpochProgressionChart.tsx` (new)
- `frontend/src/components/analysis/PassAtKChart.tsx` (new)

**Acceptance Criteria:**
- `EpochProgressionChart` displays line chart of avg_reward over epochs
- `PassAtKChart` displays multiple lines (Pass@1, Pass@5, Pass@10) over epochs
- Components accept `training_id` prop and fetch data from `/api/analysis-stats/epoch-progression`
- Loading states and error handling
- Empty state when no data available

**Implementation:**
```tsx
// EpochProgressionChart.tsx
interface EpochProgressionChartProps {
  trainingId: string;
}

// Uses Recharts LineChart
// X-axis: epoch_id
// Y-axis: avg_reward
// Multiple series: pass_at_1, pass_at_k, termination rates
```

---

#### Task 2.2: Training Comparison Components
**Files:**
- `frontend/src/components/analysis/TrainingComparisonTab.tsx` (new)
- `frontend/src/components/analysis/TrainingComparisonChart.tsx` (new)
- `frontend/src/components/analysis/TrainingSelector.tsx` (new)

**Acceptance Criteria:**
- `TrainingSelector` allows selecting 2+ training runs from available list
- `TrainingComparisonChart` displays side-by-side bar charts
- Compares: Pass@1, Pass@K, avg_reward, termination distribution
- Fetches from `/api/analysis-stats/training-comparison`

**Implementation:**
```tsx
// TrainingComparisonTab.tsx
interface TrainingComparisonTabProps {
  // No props - manages its own state for selected trainings
}

// TrainingComparisonChart.tsx
interface TrainingComparisonChartProps {
  trainingIds: string[];
  comparisonData: TrainingComparisonData;
}
```

---

#### Task 2.3: Failure Analysis Components
**Files:**
- `frontend/src/components/analysis/FailureAnalysisTab.tsx` (new)
- `frontend/src/components/analysis/FailureCaseList.tsx` (new)
- `frontend/src/components/analysis/FailureCategoryChart.tsx` (new)

**Acceptance Criteria:**
- `FailureCategoryChart` displays breakdown of failures by termination reason
- `FailureCaseList` displays paginated list of failed trajectories
- Each failure shows: trajectory_id, question, termination_reason, reward, steps preview
- Click to view full trajectory details
- Filters: training_id, epoch_id, reward_max, termination_reason

**Implementation:**
```tsx
// FailureAnalysisTab.tsx
interface FailureAnalysisTabProps {
  trainingId?: string;
}

// FailureCategoryChart.tsx
// Pie chart showing failure categories
// Filters: training_id, epoch_id

// FailureCaseList.tsx
interface FailureCaseListProps {
  filters: FailureFilters;
}
```

---

#### Task 2.4: Enhanced Filtering UI
**Files:**
- `frontend/src/components/analysis/AnalysisFilters.tsx` (new)
- `frontend/src/components/analysis/TrainingEpochSelector.tsx` (new)

**Acceptance Criteria:**
- `TrainingEpochSelector` dropdowns for training_id and epoch_id
- `AnalysisFilters` includes:
  - Reward range slider (min/max)
  - Termination reason multi-select
  - Tool usage pattern selector
  - Reset filters button
- Filters apply to all analysis components

**Implementation:**
```tsx
// TrainingEpochSelector.tsx
interface TrainingEpochSelectorProps {
  onTrainingChange: (trainingId: string | null) => void;
  onEpochChange: (epochId: number | null) => void;
  value?: { trainingId?: string; epochId?: number };
}

// AnalysisFilters.tsx
interface AnalysisFiltersProps {
  onFiltersChange: (filters: AnalysisFilterState) => void;
}
```

---

### Phase 3: Integration

#### Task 3.1: AnalysisView Redesign
**File:** `frontend/src/views/AnalysisView.tsx`

**Acceptance Criteria:**
- Update tab types to: `'overview' | 'progress' | 'comparison' | 'failures' | 'tool-contexts'`
- Add shared filter state passed to all tabs
- Layout: Filter bar at top, tabs below, content area
- All existing tabs preserved and functional

**Implementation:**
```tsx
type TabType = 'overview' | 'progress' | 'comparison' | 'failures' | 'tool-contexts';

interface FilterState {
  trainingId?: string;
  epochId?: number;
  rewardMin?: number;
  rewardMax?: number;
  terminationReasons?: string[];
}

export default function AnalysisView() {
  const [filters, setFilters] = useState<FilterState>({});

  return (
    <div>
      <FilterBar filters={filters} onChange={setFilters} />
      <Tabs activeTab={activeTab} onChange={setActiveTab} />
      <TabContent>
        {activeTab === 'overview' && <OverviewTab filters={filters} />}
        {activeTab === 'progress' && <TrainingProgressTab filters={filters} />}
        {activeTab === 'comparison' && <TrainingComparisonTab />}
        {activeTab === 'failures' && <FailureAnalysisTab filters={filters} />}
        {activeTab === 'tool-contexts' && <UnexpectedToolContextsView />}
      </TabContent>
    </div>
  );
}
```

---

#### Task 3.2: Route Registration & Testing
**File:** `backend/main.py`

**Acceptance Criteria:**
- New routes registered in main.py
- All endpoints return proper JSON responses
- Error handling for invalid parameters
- CORS headers properly configured

**Implementation:**
```python
# In backend/main.py
from backend.routes import analysis_stats  # Already imported

# No changes needed - routes are auto-included from analysis_stats.router
```

---

### Phase 4: Verification

#### Task 4.1: Backend Testing
**File:** `tests/test_analysis_stats_enhanced.py` (new)

**Acceptance Criteria:**
- Test `/api/analysis-stats/training-list` returns valid training IDs
- Test `/api/analysis-stats/epoch-list` returns epochs for training
- Test `/api/analysis-stats/epoch-progression` returns data per epoch
- Test `/api/analysis-stats/training-comparison` compares two trainings
- Test `/api/analysis-stats/failure-cases` returns failed trajectories
- Test Pass@K calculation accuracy

---

#### Task 4.2: Frontend Testing
**File:** `frontend/src/components/analysis/__tests__/` (new directory)

**Acceptance Criteria:**
- Component tests for new chart components
- Filter interaction tests
- API integration tests with mocked responses
- Tab navigation tests

---

#### Task 4.3: Integration Testing
**File:** Manual test plan

**Acceptance Criteria:**
- Load analysis view with sample data
- Navigate between all tabs
- Apply filters and verify data updates
- Select training and epoch combinations
- Verify charts display correctly
- Check no console errors

---

## Implementation Order (Prioritized by Value)

### Priority 1: High Value, Low Complexity
1. **Task 1.1: Training/Education Discovery API** - Enables all other features
2. **Task 1.4: Pass@K Calculation Service** - Core metric user requested
3. **Task 3.1: AnalysisView Redesign** - Foundation for new tabs

### Priority 2: High Value, Medium Complexity
4. **Task 1.3: New Analysis Endpoints** - Epoch progression API
5. **Task 2.1: Training Progress Components** - Visual epoch-over-epoch
6. **Task 2.3: Failure Analysis Components** - Deep dive into failures

### Priority 3: Medium Value, Medium Complexity
7. **Task 1.2: Grouped Statistics Service Methods** - Reusability
8. **Task 2.2: Training Comparison Components** - Cross-training view
9. **Task 2.4: Enhanced Filtering UI** - Better UX

### Priority 4: Quality Assurance
10. **Task 3.2: Route Registration & Testing** - Ensure connectivity
11. **Task 4.1: Backend Testing** - Validate APIs
12. **Task 4.2: Frontend Testing** - Validate components
13. **Task 4.3: Integration Testing** - End-to-end validation

---

## API Endpoint Specifications

### New Endpoints

#### GET /api/analysis-stats/training-list
**Description:** List all available training runs

**Query Parameters:** None

**Response:**
```json
{
  "trainings": [
    {
      "training_id": "run_001",
      "trajectory_count": 1500,
      "epoch_range": [0, 10],
      "agent_name": "AgentName",
      "created_at": 1704067200.0
    }
  ]
}
```

---

#### GET /api/analysis-stats/epoch-list
**Description:** List epochs for a training run

**Query Parameters:**
- `training_id` (optional): Filter by training ID

**Response:**
```json
{
  "epochs": [
    {
      "epoch_id": 0,
      "trajectory_count": 150,
      "avg_reward": 0.65,
      "pass_at_1": 0.45,
      "pass_at_k": 0.72
    }
  ]
}
```

---

#### GET /api/analysis-stats/epoch-progression
**Description:** Get metric progression over epochs

**Query Parameters:**
- `training_id` (required): Training run ID
- `metrics` (optional): Comma-separated list of metrics (default: all)

**Response:**
```json
{
  "training_id": "run_001",
  "epochs": [
    {
      "epoch_id": 0,
      "pass_at_1": 0.45,
      "pass_at_k": 0.72,
      "avg_reward": 0.65,
      "termination_stats": {
        "success": {"count": 68, "ratio": 0.45},
        "timeout": {"count": 30, "ratio": 0.20},
        "truncation": {"count": 52, "ratio": 0.35}
      },
      "reward_distribution": {
        "perfect_score": {"count": 20, "ratio": 0.13},
        "partial_success": {"count": 80, "ratio": 0.53},
        "complete_failure": {"count": 50, "ratio": 0.33}
      }
    }
  ]
}
```

---

#### GET /api/analysis-stats/training-comparison
**Description:** Compare multiple training runs

**Query Parameters:**
- `training_ids` (required): Comma-separated training IDs

**Response:**
```json
{
  "trainings": [
    {
      "training_id": "run_001",
      "pass_at_1": 0.45,
      "pass_at_k": 0.72,
      "avg_reward": 0.65,
      "termination_stats": {...},
      "reward_distribution": {...}
    },
    {
      "training_id": "run_002",
      "pass_at_1": 0.52,
      "pass_at_k": 0.78,
      "avg_reward": 0.71,
      "termination_stats": {...},
      "reward_distribution": {...}
    }
  ]
}
```

---

#### GET /api/analysis-stats/failure-cases
**Description:** Get failed trajectory details

**Query Parameters:**
- `training_id` (optional): Filter by training ID
- `epoch_id` (optional): Filter by epoch ID
- `termination_reason` (optional): Filter by reason
- `reward_max` (optional): Max reward (default 0.5)
- `limit` (optional): Max results (default 100)

**Response:**
```json
{
  "total": 50,
  "filters_applied": {
    "training_id": "run_001",
    "epoch_id": 0,
    "reward_max": 0.5
  },
  "data": [
    {
      "trajectory_id": "traj_00001",
      "data_id": "q_001",
      "question": "Question text...",
      "reward": 0.0,
      "termination_reason": "timeout",
      "step_count": 15,
      "agent_name": "AgentName",
      "steps_preview": [
        {"step_id": 1, "action": "search", "observation": "..."}
      ]
    }
  ]
}
```

---

## Component Architecture

### Frontend Component Hierarchy

```
AnalysisView.tsx
|
+-- FilterBar.tsx (shared filter state)
|   +-- TrainingEpochSelector.tsx
|   +-- RewardRangeFilter.tsx
|   +-- TerminationReasonFilter.tsx
|
+-- TabNavigation.tsx
|
+-- TabContent
    |
    +-- OverviewTab.tsx (existing cards, with filters)
    |   +-- TerminationStatsCard.tsx (existing)
    |   +-- RewardCategoryStatsCard.tsx (existing)
    |   +-- ToolReturnStatsCard.tsx (existing)
    |   +-- ProcessRewardCorrelationCard.tsx (existing)
    |
    +-- TrainingProgressTab.tsx (new)
    |   +-- EpochProgressionChart.tsx (new)
    |   +-- PassAtKChart.tsx (new)
    |   +-- TerminationProgressionChart.tsx (new)
    |
    +-- TrainingComparisonTab.tsx (new)
    |   +-- TrainingSelector.tsx (new)
    |   +-- TrainingComparisonChart.tsx (new)
    |
    +-- FailureAnalysisTab.tsx (new)
    |   +-- FailureCategoryChart.tsx (new)
    |   +-- FailureCaseList.tsx (new)
    |   +-- FailureDetailModal.tsx (new)
    |
    +-- UnexpectedToolContextsView.tsx (existing)
```

---

## Testing Strategy

### Backend Tests
1. **Unit Tests** (`tests/test_analysis_stats_enhanced.py`)
   - Test each new service method
   - Test Pass@K calculation with known data
   - Test grouping logic

2. **API Tests**
   - Test each endpoint with valid parameters
   - Test error handling (invalid training_id, etc.)
   - Test response formats

### Frontend Tests
1. **Component Tests**
   - Render tests for each new component
   - Prop validation
   - User interaction tests

2. **Integration Tests**
   - API call mocking
   - Filter state propagation
   - Tab navigation

### Manual Testing
1. Load sample data and verify all tabs work
2. Test filter combinations
3. Verify chart data accuracy
4. Check responsive design

---

## Risk Assessment

### High Risk
| Risk | Impact | Mitigation |
|------|--------|------------|
| LanceDB performance with grouping | High - slow queries | Add indexes, use limit, consider caching |
| Breaking existing APIs | High - regression | Add backward compatibility, run existing tests |

### Medium Risk
| Risk | Impact | Mitigation |
|------|--------|------------|
| Incorrect Pass@K calculation | Medium - wrong metrics | Validate with known test data |
| Frontend state management complexity | Medium - bugs | Use proper state management, test thoroughly |

### Low Risk
| Risk | Impact | Mitigation |
|------|--------|------------|
| UI layout issues | Low - cosmetic | Responsive design testing |
| Missing edge cases in filters | Low - partial data | Add validation, test edge cases |

---

## Success Criteria

1. All existing tests pass
2. New backend tests pass (90%+ coverage)
3. Frontend components render without errors
4. Charts display accurate data from database
5. Filters correctly subset data
6. No console errors in browser
7. Response time < 2 seconds for all endpoints
8. Pass@1/Pass@K values match manual calculation on test data

---

## Next Steps

Once plan is confirmed:
1. Run `/oh-my-claudecode:start-work rl-training-analysis-enhancement`
2. Implementation will follow the task order specified above
3. Each phase will be verified before moving to the next
4. Final integration test will confirm all requirements met
