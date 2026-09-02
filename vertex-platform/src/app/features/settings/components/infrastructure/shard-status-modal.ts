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

  masterClientId(): string {
    return this.environment() === 'production'
      ? '488126647984-lfcabruobbobh65p2eqijncfs30g3m4l.apps.googleusercontent.com'
      : '988454979046-jnb1sj6boknturojkohr8peha3lgevtr.apps.googleusercontent.com';
  }

  masterProject(): string {
    return this.environment() === 'production' ? 'ecommerce-vertex' : 'ecommerce-vertex-dev';
  }

  envShort(): string {
    return this.environment() === 'production' ? 'prod' : 'dev';
  }

  consoleUrl(): string {
    return `https://console.cloud.google.com/apis/credentials/oauthclient/${this.masterClientId()}?project=${this.masterProject()}`;
  }

  title(reason: ShardReadinessReason): string {
    switch (reason) {
      case 'redirect_uri':
        return 'Redirect URI sin registrar';
      case 'billing':
        return 'Billing no vinculado';
      case 'status':
        return 'Estado no utilizable';
    }
  }

  copy(value: string | undefined): void {
    if (!value) {
      return;
    }
    void navigator.clipboard.writeText(value);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
