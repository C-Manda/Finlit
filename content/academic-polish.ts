import { academicPolishData } from './academic-polish-data';
import type { LessonContent } from './learning';
import { sources, type SourceReference } from './sources';

// Pure authoring transform. Runtime lessons remain authoritative in Supabase.
export function polishLesson(lesson: LessonContent): LessonContent {
  if (lesson.academicAudit?.reviewedOn === '2026-11-03') return lesson;
  const patch = academicPolishData[lesson.id as keyof typeof academicPolishData];
  if (!patch || patch.details.length !== lesson.concept.definitions.length) {
    throw new Error('Academic patch does not match lesson ' + lesson.id);
  }
  const references: SourceReference[] = lesson.references.map(ref => ({ ...ref }));
  for (const source of ['nsfe', patch.source] as const) {
    if (!references.some(ref => ref.source === source)) {
      references.push({ source, section: sources[source].section, concept: sources[source].role });
    }
  }
  for (const ref of references) {
    const source = sources[ref.source];
    Object.assign(ref, { title: source.title, year: source.year, url: source.url, evidenceRole: source.role });
    if (ref.source === 'nsfe') {
      Object.assign(ref, { location: '§1.4, printed p.7; §2.2.2, printed pp.9–10', printedPages: '7, 9–10', pdfPages: '19, 21–22', locatorVerified: true });
    } else if (ref.source === patch.source) {
      Object.assign(ref, { location: patch.section, printedPages: patch.printedPages, pdfPages: patch.pdfPages, locatorVerified: patch.source !== 'boz' });
      if (patch.source === 'boz') ref.verificationNotes = 'The cited directive could not be retrieved from the regulator during this pass. Section locator and current applicability require regulator confirmation.';
      if (patch.source === 'sec') ref.verificationNotes = '2023 warning checked on 2026-11-03; verify current authorisation with SEC. This is not a legal currency certification.';
    } else {
      ref.locatorVerified = false;
      ref.verificationNotes = 'Supporting reference retained; no precise page locator verified in this focused pass.';
    }
  }
  const genericTitle = lesson.concept.title === 'Understand the decision';
  return {
    ...lesson, version: lesson.version + 1, sourceStatus: 'desk-reviewed', references,
    citations: Array.from(new Set([...lesson.citations, ...references.map(ref => ref.source)])),
    concept: { ...lesson.concept, title: genericTitle ? patch.concept : lesson.concept.title,
      definitions: lesson.concept.definitions.map((definition, i) => ({ ...definition, detail: patch.details[i] })) },
    example: { ...lesson.example, title: genericTitle ? patch.example : lesson.example.title },
    summaryTitle: genericTitle ? patch.summary : lesson.summaryTitle,
    practice: { ...lesson.practice, context: lesson.practice.context === 'Use the information in the situation. Choose a response, then examine its consequences.' ? patch.context : lesson.practice.context },
    academicAudit: {
      status: 'desk reviewed; external expert and student pilot pending', reviewedOn: '2026-11-03',
      coreSource: patch.source, coreSection: patch.section, corePrintedPages: patch.printedPages, corePdfPages: patch.pdfPages,
      policy: 'NSFE II §1.4 p.7; §2.2.2 pp.9–10',
      scope: 'selected NSFE financial-education competencies, not comprehensive coverage',
      duration: '10 minutes is an intended estimate, not a measured completion time',
    },
  };
}
