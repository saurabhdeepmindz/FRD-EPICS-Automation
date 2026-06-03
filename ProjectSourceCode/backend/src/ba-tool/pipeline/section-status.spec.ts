import {
  computeSectionStatuses,
  computeReviewProgress,
  emptyReviewMap,
} from './section-status';

describe('computeSectionStatuses', () => {
  it('marks an empty/absent section NOT_STARTED', () => {
    const r = computeSectionStatuses({ '1': { productName: '', objective: '' } });
    expect(r['1']).toBe('NOT_STARTED');
    expect(r['2']).toBe('NOT_STARTED'); // absent
  });

  it('marks a partially filled section IN_PROGRESS', () => {
    const r = computeSectionStatuses({ '1': { productName: 'X', objective: '' } });
    expect(r['1']).toBe('IN_PROGRESS');
  });

  it('marks a fully filled section COMPLETE', () => {
    const r = computeSectionStatuses({ '1': { productName: 'X', objective: 'Y' } });
    expect(r['1']).toBe('COMPLETE');
  });

  it('handles legacy flat [AI] values (prefix is not "empty")', () => {
    const r = computeSectionStatuses({ '2': { scope: '[AI] something' } });
    expect(r['2']).toBe('COMPLETE');
  });

  it('handles structured fields', () => {
    const r = computeSectionStatuses({ '3': { excluded: { aiContent: 'x' }, deferred: { editedContent: '' } } });
    expect(r['3']).toBe('IN_PROGRESS');
  });

  describe('§6 FRD', () => {
    it('NOT_STARTED when no modules', () => {
      expect(computeSectionStatuses({ '6': {} })['6']).toBe('NOT_STARTED');
    });
    it('COMPLETE when every module has a feature with name + description', () => {
      const body = {
        '6.1_moduleId': 'MOD-01',
        '6.1_moduleName': 'Auth',
        '6.1_features': [{ featureId: 'FR-1', featureName: 'Login', description: '[AI] do login' }],
        '6.2_moduleName': 'Pay',
        '6.2_features': [{ featureId: 'FR-2', featureName: 'Pay', description: 'pay flow' }],
      };
      expect(computeSectionStatuses({ '6': body })['6']).toBe('COMPLETE');
    });
    it('IN_PROGRESS when a module lacks a complete feature', () => {
      const body = {
        '6.1_moduleName': 'Auth',
        '6.1_features': [{ featureId: 'FR-1', featureName: 'Login', description: 'ok' }],
        '6.2_moduleName': 'Pay',
        '6.2_features': [{ featureId: 'FR-2', featureName: '', description: '' }],
      };
      expect(computeSectionStatuses({ '6': body })['6']).toBe('IN_PROGRESS');
    });
  });

  it('always returns all 22 keys', () => {
    const r = computeSectionStatuses({});
    expect(Object.keys(r)).toHaveLength(22);
  });
});

describe('computeReviewProgress', () => {
  it('counts unset keys as pending (22 total)', () => {
    expect(computeReviewProgress({})).toEqual({ accepted: 0, edited: 0, skipped: 0, pending: 22 });
  });
  it('rolls up a mixed review map', () => {
    const review = { '1': 'accepted', '2': 'edited', '3': 'skipped', '4': 'accepted' };
    expect(computeReviewProgress(review)).toEqual({ accepted: 2, edited: 1, skipped: 1, pending: 18 });
  });
});

describe('emptyReviewMap', () => {
  it('is all pending across 22 keys', () => {
    const m = emptyReviewMap();
    expect(Object.keys(m)).toHaveLength(22);
    expect(Object.values(m).every((v) => v === 'pending')).toBe(true);
  });
});
