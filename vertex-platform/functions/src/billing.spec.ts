import { describe, expect, it } from 'vitest';
import { countLinkedProjects } from './billing';

describe('countLinkedProjects', () => {
  it('cuenta los proyectos vinculados (projectBillingInfo, no projects)', () => {
    expect(
      countLinkedProjects({
        projectBillingInfo: [
          { billingEnabled: true },
          { billingEnabled: true },
          { billingEnabled: false },
        ],
      }),
    ).toBe(2);
  });

  it('responde 0 ante payload sin projectBillingInfo o vacío', () => {
    expect(countLinkedProjects({})).toBe(0);
    expect(countLinkedProjects({ projectBillingInfo: [] })).toBe(0);
    // payload legacy con projects (no debe romper)
    expect(countLinkedProjects({ projects: [{ name: 'x' }] } as never)).toBe(0);
  });

  it('cuenta entradas sin campo billingEnabled como vinculadas', () => {
    expect(countLinkedProjects({ projectBillingInfo: [{}] })).toBe(1);
  });
});
