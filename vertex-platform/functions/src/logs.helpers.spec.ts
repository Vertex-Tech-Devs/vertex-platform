import { describe, expect, it } from 'vitest';
import {
  resolveDateRange,
  mapOrderToLog,
  mapAuditToLog,
  consolidateAndSortLogs,
} from './logs.helpers';

describe('resolveDateRange', () => {
  it('defaults to 48 hours when nothing is provided', () => {
    const r = resolveDateRange();
    expect(r.isAll).toBe(false);
    expect(r.fromDate).toBeInstanceOf(Date);
    const elapsed = Date.now() - (r.fromDate as Date).getTime();
    expect(elapsed).toBeGreaterThan(47 * 60 * 60_000);
    expect(elapsed).toBeLessThan(49 * 60 * 60_000);
  });

  it('marks isAll when sinceMinutes is 0 or "all"', () => {
    expect(resolveDateRange(0).isAll).toBe(true);
    expect(resolveDateRange('all' as unknown as number).isAll).toBe(true);
  });

  it('parses custom ISO start and end dates', () => {
    const start = '2026-09-01T00:00:00.000Z';
    const end = '2026-09-08T00:00:00.000Z';
    const r = resolveDateRange(undefined, start, end);
    expect(r.isAll).toBe(false);
    expect(r.fromDate?.toISOString()).toBe(start);
    expect(r.toDate?.toISOString()).toBe(end);
  });
});

describe('mapOrderToLog', () => {
  it('maps a successful order to INFO with structured message', () => {
    const e = mapOrderToLog('abc123', {
      orderNumber: '1001',
      total: 2500,
      status: 'approved',
      createdAt: new Date('2026-09-01T12:00:00Z'),
    });
    expect(e.source).toBe('orders');
    expect(e.severity).toBe('INFO');
    expect(e.id).toBe('order_abc123');
    expect(e.message).toContain('#1001');
    expect(e.message).toContain('$2500');
    expect(e.message).toContain('(approved)');
  });

  it('marks rejected/cancelled orders as WARN and handles missing fields', () => {
    const w = mapOrderToLog('xyz', { status: 'rejected' });
    expect(w.severity).toBe('WARN');
    expect(w.message).toContain('#xyz');
    expect(w.message).toContain('$0');
    const c = mapOrderToLog('xyz', { status: 'cancelled' });
    expect(c.severity).toBe('WARN');
  });
});

describe('mapAuditToLog', () => {
  it('maps audit events to source system', () => {
    const e = mapAuditToLog('aud1', {
      message: 'Tienda creada',
      timestamp: '2026-09-01T10:00:00.000Z',
    });
    expect(e.source).toBe('system');
    expect(e.id).toBe('system_aud1');
    expect(e.message).toBe('Tienda creada');
  });
});

describe('consolidateAndSortLogs', () => {
  it('dedupes by id, sorts desc and applies limit', () => {
    const logs = [
      {
        id: 'a',
        timestamp: '2026-09-01T10:00:00.000Z',
        severity: 'INFO' as const,
        message: 'x',
        source: 'orders' as const,
      },
      {
        id: 'b',
        timestamp: '2026-09-03T10:00:00.000Z',
        severity: 'INFO' as const,
        message: 'y',
        source: 'cloud' as const,
      },
      {
        id: 'a',
        timestamp: '2026-09-02T10:00:00.000Z',
        severity: 'WARN' as const,
        message: 'x-detallado',
        source: 'orders' as const,
      },
    ];
    const out = consolidateAndSortLogs(logs, 2);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe('b');
    expect(out.find((l) => l.id === 'a')?.message).toBe('x-detallado');
  });
});
