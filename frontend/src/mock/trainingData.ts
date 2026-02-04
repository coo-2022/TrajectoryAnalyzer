// Mock training data for RL training analysis interface

export interface TrainingEpoch {
  epoch: number;
  pass_at_1: number;
  pass_at_k: number;
  avg_reward: number;
  success_rate: number;
}

export interface TrainingRun {
  training_id: string;
  era: number;
  epochs: TrainingEpoch[];
}

export interface FailureCase {
  case_id: string;
  reason: 'timeout' | 'truncation' | 'unexpected_tool' | 'other';
  reward: number;
  epoch: number;
  timestamp: string;
  tools: string[];
  training_id: string;
}

export interface FailureStats {
  total: number;
  by_reason: Record<string, number>;
  by_reward_range: Record<string, number>;
  by_tool: Record<string, number>;
  failure_trend: Array<{
    epoch: number;
    failures: number;
    failure_rate: number;
  }>;
}

// Generate 4 training runs with 10 epochs each
export const trainingRuns: TrainingRun[] = [
  {
    training_id: 'train_1',
    era: 1,
    epochs: Array.from({ length: 10 }, (_, i) => ({
      epoch: i + 1,
      pass_at_1: 0.30 + i * 0.015 + (Math.random() - 0.5) * 0.02,
      pass_at_k: 0.50 + i * 0.02 + (Math.random() - 0.5) * 0.03,
      avg_reward: 2.5 + i * 0.5 + (Math.random() - 0.5) * 0.5,
      success_rate: 0.60 + i * 0.025 + (Math.random() - 0.5) * 0.03
    }))
  },
  {
    training_id: 'train_2',
    era: 1,
    epochs: Array.from({ length: 10 }, (_, i) => ({
      epoch: i + 1,
      pass_at_1: 0.32 + i * 0.018 + (Math.random() - 0.5) * 0.02,
      pass_at_k: 0.52 + i * 0.022 + (Math.random() - 0.5) * 0.03,
      avg_reward: 2.7 + i * 0.55 + (Math.random() - 0.5) * 0.5,
      success_rate: 0.62 + i * 0.028 + (Math.random() - 0.5) * 0.03
    }))
  },
  {
    training_id: 'train_3',
    era: 2,
    epochs: Array.from({ length: 10 }, (_, i) => ({
      epoch: i + 1,
      pass_at_1: 0.35 + i * 0.012 + (Math.random() - 0.5) * 0.02,
      pass_at_k: 0.55 + i * 0.018 + (Math.random() - 0.5) * 0.03,
      avg_reward: 3.0 + i * 0.45 + (Math.random() - 0.5) * 0.5,
      success_rate: 0.65 + i * 0.02 + (Math.random() - 0.5) * 0.03
    }))
  },
  {
    training_id: 'train_4',
    era: 2,
    epochs: Array.from({ length: 10 }, (_, i) => ({
      epoch: i + 1,
      pass_at_1: 0.38 + i * 0.01 + (Math.random() - 0.5) * 0.02,
      pass_at_k: 0.58 + i * 0.015 + (Math.random() - 0.5) * 0.03,
      avg_reward: 3.2 + i * 0.4 + (Math.random() - 0.5) * 0.5,
      success_rate: 0.68 + i * 0.018 + (Math.random() - 0.5) * 0.03
    }))
  }
];

// Generate failure cases (127 total)
const failureReasons: Array<'timeout' | 'truncation' | 'unexpected_tool' | 'other'> =
  ['timeout', 'truncation', 'unexpected_tool', 'other'];
const tools = [
  'search', 'bash', 'browser', 'python_repl', 'text_editor',
  'read_file', 'write_file', 'list_directory', 'execute_command'
];

export const failureCases: FailureCase[] = Array.from({ length: 127 }, (_, i) => {
  const reason = failureReasons[Math.floor(Math.random() * failureReasons.length)];
  const reward = Math.random() < 0.3
    ? Math.random() * 1 // 0-1 range
    : Math.random() < 0.6
    ? 1 + Math.random() * 2 // 1-3 range
    : Math.random() < 0.85
    ? 3 + Math.random() * 2 // 3-5 range
    : 5 + Math.random() * 5; // 5+ range

  const numTools = Math.floor(Math.random() * 5) + 1;
  const caseTools = Array.from({ length: numTools }, () =>
    tools[Math.floor(Math.random() * tools.length)]
  );

  return {
    case_id: `case_${i + 1}`,
    reason,
    reward: parseFloat(reward.toFixed(2)),
    epoch: Math.floor(Math.random() * 10) + 1,
    timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    tools: caseTools,
    training_id: `train_${Math.floor(Math.random() * 4) + 1}`
  };
});

// Failure statistics
export const failureStats: FailureStats = {
  total: 127,
  by_reason: {
    'Timeout': 42,
    'Truncation': 35,
    'Unexpected Tool': 28,
    'Other': 22
  },
  by_reward_range: {
    '0-1': 18,
    '1-3': 45,
    '3-5': 38,
    '5+': 26
  },
  by_tool: {
    'bash': 78,
    'browser': 65,
    'python_repl': 52,
    'search': 48,
    'text_editor': 41
  },
  failure_trend: [
    { epoch: 1, failures: 18, failure_rate: 0.36 },
    { epoch: 2, failures: 16, failure_rate: 0.32 },
    { epoch: 3, failures: 15, failure_rate: 0.30 },
    { epoch: 4, failures: 14, failure_rate: 0.28 },
    { epoch: 5, failures: 13, failure_rate: 0.26 },
    { epoch: 6, failures: 12, failure_rate: 0.24 },
    { epoch: 7, failures: 11, failure_rate: 0.22 },
    { epoch: 8, failures: 11, failure_rate: 0.22 },
    { epoch: 9, failures: 10, failure_rate: 0.20 },
    { epoch: 10, failures: 7, failure_rate: 0.14 }
  ]
};

// Training metadata
export const trainingMetadata = trainingRuns.map(run => {
  const lastEpoch = run.epochs[run.epochs.length - 1];
  const firstEpoch = run.epochs[0];

  return {
    training_id: run.training_id,
    era: run.era,
    total_epochs: run.epochs.length,
    final_pass_at_1: lastEpoch.pass_at_1,
    final_pass_at_k: lastEpoch.pass_at_k,
    final_avg_reward: lastEpoch.avg_reward,
    final_success_rate: lastEpoch.success_rate,
    delta_pass_at_1: ((lastEpoch.pass_at_1 - firstEpoch.pass_at_1) * 100).toFixed(1),
    delta_pass_at_k: ((lastEpoch.pass_at_k - firstEpoch.pass_at_k) * 100).toFixed(1),
    delta_avg_reward: (lastEpoch.avg_reward - firstEpoch.avg_reward).toFixed(2),
    delta_success_rate: ((lastEpoch.success_rate - firstEpoch.success_rate) * 100).toFixed(1)
  };
});

// Era groupings
export const eras = [1, 2];

// Training options for dropdowns
export const trainingOptions = trainingRuns.map(run => ({
  value: run.training_id,
  label: `Training ${run.training_id} (Era ${run.era})`
}));

// Era options
export const eraOptions = eras.map(era => ({
  value: era.toString(),
  label: `Era ${era}`
}));
