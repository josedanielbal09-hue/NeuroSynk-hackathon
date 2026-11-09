export type PreFocusStage =
  | 'IDLE'
  | 'CONTEXT_PROBING'
  | 'STUDIO_WORKSPACE'
  | 'SURVEY_CALIBRATION'
  | 'READY_TO_LAUNCH';

export type InputModality = 'voice_dump' | 'keyboard_precision';

export interface ContextChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modality?: InputModality;
  timestamp: number;
  suggestedChips?: string[];
  targetField?: 'whatGoal' | 'howMethod' | 'mainBlocker' | 'ready';
  artifact?: StudioArtifactItem;
}

export interface ExtractedContextState {
  whatGoal: string | null;
  howMethod: string | null;
  mainBlocker: string | null;
  completenessScore: number; // 0 to 100
  rawVoiceDumps: string[];
  chatHistory: ContextChatMessage[];
}

export type BrianTracyCategory =
  | 'quick_win'
  | 'pareto_20'
  | 'unblocker'
  | 'creative_leap';

export interface BrianTracyIdeaItem {
  id: number;
  text: string;
  category: BrianTracyCategory;
  effort: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  selected?: boolean;
}

export interface TaskFlowNode {
  id: string;
  label: string;
  detail: string;
  phase: 'root' | 'preparation' | 'execution' | 'unblocker' | 'deliverable';
  estimatedMinutes: number;
}

export interface TaskFlowEdge {
  from: string;
  to: string;
  label?: string;
}

export interface TaskFlowDiagramData {
  title: string;
  nodes: TaskFlowNode[];
  edges: TaskFlowEdge[];
  criticalPath: string[];
}

export interface ContextProbeResult {
  reply: string;
  extracted: {
    whatGoal: string | null;
    howMethod: string | null;
    mainBlocker: string | null;
    isComplete: boolean;
    completenessScore: number;
    nextTargetField: 'whatGoal' | 'howMethod' | 'mainBlocker' | 'ready';
  };
  suggestedKeyboardChips: string[];
}

export type StudioArtifactType =
  | 'BRIAN_TRACY_50'
  | 'MINDMAP_FLOW'
  | 'CALIBRATION_QUIZ'
  | 'MICRO_STEPS_TABLE'
  | 'AUDIO_BRIEF';

export interface StudioArtifactItem {
  id: string;
  type: StudioArtifactType;
  title: string;
  subtitle?: string;
  createdAt: number;
  status: 'generating' | 'ready' | 'error';
  progressPct: number;
  progressStageLabel?: string;
  data: any;
}

