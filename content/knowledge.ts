export type CompetencyScore = { correct: number; total: number };
export type KnowledgeProfile = {
 id: string; score: number; total: number; percentage: number; scores: Record<string, CompetencyScore>;
 completedAt: string; version: number; questionSet: string; comparisonGroup: string | null;
 classification: 'pre_learning' | 'late_baseline' | 'historical_unverified' | null;
 competencies: { key: string; correct: number; total: number; percentage: number }[]; reviewAreas: string[];
};
export type LearningPriority = { key: string; correct: number; total: number; available: boolean; completedLessons: number; reason: string };
export type KnowledgeJourney = {
 required: boolean; legacy: boolean; baseline: KnowledgeProfile | null; final: KnowledgeProfile | null;
 finalAvailable: boolean; priorities: LearningPriority[];
 comparison: { available: boolean; comparable: boolean; correctDifference: number | null; percentagePointDifference: number | null; limitation: string };
};
export function competencyFeedback(score: CompetencyScore) {
 if (score.correct === score.total) return 'You answered all sampled questions correctly.';
 if (score.correct === 0) return 'Start with a foundational review of this topic.';
 if (score.correct / score.total < 0.5) return 'Additional support and practice may help in this topic.';
 return 'You demonstrated some understanding; revisit the questions you missed.';
}
export function signed(value: number) { return `${value > 0 ? '+' : ''}${value}`; }
