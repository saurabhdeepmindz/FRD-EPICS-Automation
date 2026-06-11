import { moduleFromMeta } from './wireframe-navigator.service';

describe('moduleFromMeta (navigator grouping)', () => {
  it('prefers an explicit module label over everything else', () => {
    expect(moduleFromMeta({ module: 'Auth & Entry', frRefs: ['FR-GUEST-001'], uploaded: true })).toEqual({
      key: 'AUTH-ENTRY',
      label: 'Auth & Entry',
    });
  });

  it('trims the explicit label and normalizes the grouping key', () => {
    expect(moduleFromMeta({ module: '  Host Flow  ' })).toEqual({ key: 'HOST-FLOW', label: 'Host Flow' });
  });

  it('ignores a blank/whitespace-only module and falls through', () => {
    expect(moduleFromMeta({ module: '   ', uploaded: true })).toEqual({ key: 'UPLOADED', label: 'Uploaded' });
  });

  it('derives the module from the first §6 FR-ID when no explicit label', () => {
    expect(moduleFromMeta({ frRefs: ['FR-AUTH-001', 'FR-GUEST-002'] })).toEqual({ key: 'AUTH', label: 'Auth' });
  });

  it('falls back to Uploaded for uploaded screens with no module or FR refs', () => {
    expect(moduleFromMeta({ uploaded: true })).toEqual({ key: 'UPLOADED', label: 'Uploaded' });
  });

  it('falls back to General for generated screens with no grouping signal', () => {
    expect(moduleFromMeta({})).toEqual({ key: 'GENERAL', label: 'General' });
    expect(moduleFromMeta(null)).toEqual({ key: 'GENERAL', label: 'General' });
    expect(moduleFromMeta(undefined)).toEqual({ key: 'GENERAL', label: 'General' });
  });
});
