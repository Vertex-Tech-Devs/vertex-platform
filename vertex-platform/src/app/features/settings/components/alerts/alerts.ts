import { Component, signal, type OnDestroy, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { getFirestore, collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface PlatformAlert {
  key: string;
  severity: 'warning' | 'critical';
  kind: string;
  storeId?: string;
  title: string;
  message: string;
  link?: string;
  status: 'open' | 'resolved';
  count?: number;
  firstSeen?: { toMillis(): number } | { seconds: number } | null;
  lastSeen?: { toMillis(): number } | { seconds: number } | null;
}

function tsToDate(t?: unknown): Date | null {
  if (!t) {
    return null;
  }
  const anyT = t as { toMillis?: () => number; seconds?: number };
  if (typeof anyT.toMillis === 'function') {
    return new Date(anyT.toMillis());
  }
  if (typeof anyT.seconds === 'number') {
    return new Date(anyT.seconds * 1000);
  }
  return null;
}

@Component({
  selector: 'app-alerts-center',
  imports: [DatePipe],
  templateUrl: './alerts.html',
  styleUrl: './alerts.scss',
})
export class AlertsCenter implements OnDestroy {
  private readonly db = getFirestore();
  private readonly unsub: () => void;

  readonly alerts = signal<PlatformAlert[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly filter = signal<'open' | 'resolved' | 'all'>('open');
  readonly filterOptions: Array<'open' | 'resolved' | 'all'> = ['open', 'resolved', 'all'];
  readonly resolvingKey = signal<string | null>(null);

  readonly visibleAlerts = computed(() => {
    const f = this.filter();
    return this.alerts()
      .filter((a) => f === 'all' || a.status === f)
      .sort((a, b) => (tsToDate(b.lastSeen)?.getTime() || 0) - (tsToDate(a.lastSeen)?.getTime() || 0));
  });

  readonly openCount = computed(() => this.alerts().filter((a) => a.status === 'open').length);

  constructor() {
    this.unsub = onSnapshot(
      collection(this.db, 'alerts'),
      (snap) => {
        const list: PlatformAlert[] = [];
        snap.forEach((d) => {
          const data = d.data() as PlatformAlert;
          list.push({ ...data, key: d.id });
        });
        this.alerts.set(list);
        this.loading.set(false);
      },
      (err) => {
        this.error.set('No se pudieron cargar las alertas: ' + (err?.message || 'error'));
        this.loading.set(false);
      },
    );
  }

  setFilter(f: 'open' | 'resolved' | 'all'): void {
    this.filter.set(f);
  }

  async resolve(key: string): Promise<void> {
    this.resolvingKey.set(key);
    try {
      await updateDoc(doc(this.db, 'alerts', key), {
        status: 'resolved',
        resolvedAt: serverTimestamp(),
      });
    } finally {
      this.resolvingKey.set(null);
    }
  }


  tsDate(t?: unknown): Date | null {
    return tsToDate(t);
  }
  alertTone(sev: string): string {
    return sev === 'critical' ? 'alert-tone alert-tone--critical' : 'alert-tone alert-tone--warning';
  }

  ngOnDestroy(): void {
    this.unsub();
  }
}
