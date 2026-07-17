'use client';

import * as React from 'react';

import type { StepUpOperation } from '@/lib/step-up';
import { StepUpPrompt } from './step-up-prompt';

interface StepUpActionConfig {
  operation: StepUpOperation;
  title: string;
  description: string;
}

interface PendingStepUpAction extends StepUpActionConfig {
  run: (challengeId: string) => void | Promise<void>;
}

/** Queue a sensitive client action behind the shared, policy-aware prompt. */
export function useStepUpAction() {
  const [pending, setPending] = React.useState<PendingStepUpAction | null>(
    null,
  );

  const requestStepUp = React.useCallback(
    (config: StepUpActionConfig, run: PendingStepUpAction['run']): void => {
      setPending({ ...config, run });
    },
    [],
  );

  const stepUpPrompt = pending ? (
    <StepUpPrompt
      open
      operation={pending.operation}
      title={pending.title}
      description={pending.description}
      onCancel={() => setPending(null)}
      onVerified={(challengeId) => {
        const run = pending.run;
        setPending(null);
        void run(challengeId);
      }}
    />
  ) : null;

  return { requestStepUp, stepUpPrompt };
}
