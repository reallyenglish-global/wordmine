import { useEffect, useState } from 'react';
import { ContractValidationError, type ActivityDocument, type ContractIssue } from '../contract';
import type { ContentSource } from './source';

export type ActivityLoadState =
  | { status: 'loading' }
  | { status: 'ready'; document: ActivityDocument }
  | { status: 'error'; message: string; issues: ContractIssue[] };

export function useActivityDocument(source: ContentSource): ActivityLoadState {
  const [state, setState] = useState<ActivityLoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    source
      .load()
      .then((document) => active && setState({ status: 'ready', document }))
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ContractValidationError) {
          setState({ status: 'error', message: 'The activity document does not match the v0 contract.', issues: error.issues });
        } else {
          setState({ status: 'error', message: error instanceof Error ? error.message : String(error), issues: [] });
        }
      });
    return () => {
      active = false;
    };
  }, [source]);

  return state;
}
