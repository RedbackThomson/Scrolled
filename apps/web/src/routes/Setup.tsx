import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { WizardLayout, type WizardStep } from '@/components/wizard/WizardLayout';
import { StepVersion } from '@/components/wizard/StepVersion';
import { StepFiles, type WizardFile } from '@/components/wizard/StepFiles';
import { StepReview } from '@/components/wizard/StepReview';
import { StepRun } from '@/components/wizard/StepRun';
import { buildPlan } from '@/components/wizard/plan';
import type { WzMapleVersionName } from '@/parser';

const STEPS: WizardStep[] = [
  { id: 'version', label: 'Version' },
  { id: 'files', label: 'Files' },
  { id: 'review', label: 'Review' },
  { id: 'run', label: 'Run' },
];

export default function Setup() {
  const [stepId, setStepId] = useState<(typeof STEPS)[number]['id']>('version');
  const [version, setVersion] = useState<WzMapleVersionName>('GMS');
  const [files, setFiles] = useState<WizardFile[]>([]);

  const filesReady = files.length > 0 && files.every((f) => f.hashPhase === 'done');
  const someIncluded = files.some((f) => f.include);
  const canProceedFromFiles = filesReady && someIncluded;

  const plan = useMemo(() => buildPlan(files), [files]);
  const planIsRunnable = plan.willRun.length > 0 && plan.missingDeps.length === 0;

  function goPrev() {
    const idx = STEPS.findIndex((s) => s.id === stepId);
    if (idx > 0) setStepId(STEPS[idx - 1].id);
  }
  function goNext() {
    const idx = STEPS.findIndex((s) => s.id === stepId);
    if (idx < STEPS.length - 1) setStepId(STEPS[idx + 1].id);
  }

  let body: React.ReactNode;
  if (stepId === 'version') body = <StepVersion value={version} onChange={setVersion} />;
  else if (stepId === 'files') body = <StepFiles files={files} onChange={setFiles} />;
  else if (stepId === 'review') body = <StepReview version={version} files={files} />;
  else body = <StepRun version={version} files={files} onComplete={() => {}} />;

  const footer =
    stepId === 'run' ? (
      <div className="text-muted-foreground text-xs">
        <Link to="/" className="hover:underline">
          Cancel and return home
        </Link>
      </div>
    ) : (
      <>
        <Button variant="ghost" size="sm" onClick={goPrev} disabled={stepId === STEPS[0].id}>
          Back
        </Button>
        <div className="flex items-center gap-2">
          {stepId === 'files' && !canProceedFromFiles && (
            <span className="text-muted-foreground text-xs">
              {files.length === 0
                ? 'Add at least one .wz file'
                : files.some((f) => f.hashPhase === 'queued' || f.hashPhase === 'hashing')
                  ? 'Hashing…'
                  : 'Include at least one file'}
            </span>
          )}
          {stepId === 'review' && !planIsRunnable && (
            <span className="text-muted-foreground text-xs">
              {plan.missingDeps.length > 0
                ? 'Add the missing required files'
                : 'Nothing to extract'}
            </span>
          )}
          <Button
            size="sm"
            onClick={goNext}
            disabled={
              (stepId === 'files' && !canProceedFromFiles) ||
              (stepId === 'review' && !planIsRunnable)
            }
          >
            {stepId === 'review' ? 'Start' : 'Continue'}
          </Button>
        </div>
      </>
    );

  return (
    <WizardLayout
      title="Set up your wiki"
      subtitle="Load your WZ files once. They stay on this device; nothing is uploaded."
      steps={STEPS}
      currentStepId={stepId}
      footer={footer}
    >
      {body}
    </WizardLayout>
  );
}
