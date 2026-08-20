import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { ShardReadiness, ShardReadinessReason } from '@core/services/stores';

@Component({
  selector: 'app-shard-status-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shard-status-modal.html',
  styleUrl: './shard-status-modal.scss',
})
export class ShardStatusModal {
  readonly shard = input<ShardReadiness | null>(null);
  readonly environment = input<'development' | 'production'>('development');
  readonly closed = output<void>();

  readonly copied = signal(false);

  readonly MASTER_CLIENT_ID =
    '988454979046-jnb1sj6boknturojkohr8peha3lgevtr.apps.googleusercontent.com';

  masterProject(): string {
    return this.environment() === 'production' ? 'ecommerce-vertex' : 'ecommerce-vertex-dev';
  }

  envShort(): string {
    return this.environment() === 'production' ? 'prod' : 'dev';
  }

  consoleUrl(): string {
    return `https://console.cloud.google.com/apis/credentials?project=${this.masterProject()}`;
  }

  title(reason: ShardReadinessReason): string {
    switch (reason) {
      case 'redirect_uri':
        return 'Redirect URI sin registrar';
      case 'billing':
        return 'Billing no vinculado';
      case 'status':
        return 'Estado no utilizable';
      default:
        return reason;
    }
  }

  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      /* clipboard no disponible */
    }
  }
}
