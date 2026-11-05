import { initiativeFeedModal } from '../browser/initiative-feed-modal';
import { initiativePickerModal } from '../browser/initiative-picker-modal';

export const initiativesBrowserContributions = {
  modalDefs: [initiativePickerModal, initiativeFeedModal],
} as const;
