import {
  getBusinessVerticalPreset,
  getAllBusinessVerticalsSummary,
  resolveVerticalKey,
} from './verticals/verticals.registry';
import type { BusinessVerticalDefinition, BusinessVerticalId } from './types/verticals.types';

export {
  getBusinessVerticalPreset,
  getAllBusinessVerticalsSummary,
  resolveVerticalKey,
  resolveVerticalKey as resolveVerticalSeedKey,
};

export type { BusinessVerticalDefinition, BusinessVerticalId };
