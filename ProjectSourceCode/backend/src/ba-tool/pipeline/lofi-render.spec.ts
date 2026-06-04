import { inferScreenType, renderLoFi } from './lofi-render';

describe('lofi-render (v9 Track GG)', () => {
  describe('inferScreenType', () => {
    it('classifies auth screens', () => {
      expect(inferScreenType('Login')).toBe('auth');
      expect(inferScreenType('Guest Registration')).toBe('auth');
      expect(inferScreenType('Host Registration / KYC Onboarding')).toBe('auth');
    });
    it('classifies checkout/payment screens', () => {
      expect(inferScreenType('Booking Checkout')).toBe('checkout');
      expect(inferScreenType('Payment')).toBe('checkout');
    });
    it('classifies dashboard / landing screens', () => {
      expect(inferScreenType('Landing / Home Page')).toBe('dashboard');
      expect(inferScreenType('CHRO Analytics Hub')).toBe('dashboard');
    });
    it('classifies list / search screens', () => {
      expect(inferScreenType('Search & Discovery')).toBe('list');
      expect(inferScreenType('Employee Directory')).toBe('list');
    });
    it('classifies detail / status screens', () => {
      expect(inferScreenType('Listing Detail')).toBe('detail');
      expect(inferScreenType('Host KYC Status')).toBe('detail');
    });
    it('classifies form / settings screens', () => {
      expect(inferScreenType('Create Listing')).toBe('form');
      expect(inferScreenType('Notification Settings')).toBe('form');
    });
    it('falls back to generic', () => {
      expect(inferScreenType('Zxqw Panel')).toBe('generic');
    });
    it('uses annotation titles as a hint', () => {
      expect(inferScreenType('Untitled', ['Search bar', 'Filter chips'])).toBe('list');
    });
  });

  describe('renderLoFi', () => {
    it('produces a self-contained doc with the type tag, tokens, and callouts', () => {
      const html = renderLoFi(
        'Login',
        'Login screen for guests.',
        [{ marker: 1, title: 'Email field', description: 'enter email', prdRef: '§6 FR-AUTH-001' }],
      );
      expect(html).toContain('<!doctype html>');
      expect(html).toContain(':root'); // tokensToCss applied
      expect(html).toContain('Auth · lo-fi'); // type tag
      expect(html).toContain('§6 FR-AUTH-001'); // callout preserved
      expect(html).toContain('class="card"'); // auth skeleton present
    });

    it('renders structurally different skeletons per type', () => {
      const list = renderLoFi('Search', '', []);
      const dash = renderLoFi('Dashboard', '', []);
      expect(list).toContain('searchbar');
      expect(dash).toContain('kpis');
      expect(list).not.toEqual(dash);
    });
  });
});
