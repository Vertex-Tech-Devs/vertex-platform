import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { ShardReadiness, ShardReadinessReason } from '@core/services/stores';

@Component({
  selector: 'app-shard-status-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shard(); as shard) {
      <div class="modal-backdrop" (click)="closed.emit()">
        <div class="modal-card" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="modal-card__header">
            <div>
              <h2 class="modal-card__title">
                <i
                  class="bi"
                  [class.bi-check-circle-fill]="shard.ready"
                  [class.bi-exclamation-triangle-fill]="!shard.ready"
                ></i>
                {{ shard.ready ? 'Shard listo' : 'Shard incompleto' }}
              </h2>
              <p class="modal-card__sub">
                <code>{{ shard.id }}</code> · GCP Project
                <code>{{ shard.projectId }}</code>
              </p>
            </div>
            <button class="modal-card__close" aria-label="Cerrar" (click)="closed.emit()">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>

          @if (shard.ready) {
            <div class="ready-box">
              <i class="bi bi-check-circle-fill"></i>
              <div>
                <strong>Todo configurado.</strong>
                <p>
                  Redirect URI registrado, billing vinculado y estado utilizable. Puede recibir
                  tiendas nuevas sin configuración.
                </p>
              </div>
            </div>
          } @else {
            <p class="modal-card__intro">
              Este shard le falta lo siguiente para poder recibir tiendas sin configuración:
            </p>

            <div class="issue-list">
              @for (reason of shard.missing; track reason) {
                <section class="issue">
                  <h3 class="issue__title">
                    <i class="bi bi-x-circle-fill"></i>
                    {{ title(reason) }}
                  </h3>

                  @if (reason === 'redirect_uri') {
                    <p class="issue__desc">
                      El redirect URI de este shard <strong>no está registrado</strong> en el client
                      OAuth del master. El login con Google de la primera tienda que caiga en este
                      shard fallará con <code>redirect_uri_mismatch</code>. Es el único paso manual
                      (Google no expone API), una vez por shard.
                    </p>
                    <ol class="issue__steps">
                      <li>
                        Abrí
                        <a [href]="consoleUrl()" target="_blank" rel="noopener noreferrer">
                          Google Cloud Console → Credenciales
                        </a>
                        (proyecto {{ masterProject() }}).
                      </li>
                      <li>
                        Client OAuth: <code>{{ MASTER_CLIENT_ID }}</code
                        >.
                      </li>
                      <li>
                        <strong>Authorized redirect URIs</strong> → “Agregar URI” → pegá:
                        <div class="copy-row">
                          <code class="copy-row__uri">{{ shard.redirectUri }}</code>
                          <button class="copy-row__btn" (click)="copy(shard.redirectUri)">
                            {{ copied() ? 'Copiado ✓' : 'Copiar' }}
                          </button>
                        </div>
                      </li>
                      <li>Guardar.</li>
                      <li>
                        Verificá con
                        <code>npx tsx scripts/audit-shards.ts --env {{ envShort() }}</code> y
                        presioná “Verificar” en el panel.
                      </li>
                    </ol>
                  }

                  @if (reason === 'billing') {
                    <p class="issue__desc">
                      Este shard <strong>no tiene billing vinculado</strong>
                      {{ shard.billingAccountId ? '' : ' (sin billingAccountId)' }}. Sin billing
                      queda en el plan Spark: el deploy de las Cloud Functions del storefront
                      (checkout, Mercado Pago) fallará.
                    </p>
                    <ol class="issue__steps">
                      <li>
                        Verificá la cuota de la billing account: GCP permite por defecto
                        <strong>5 proyectos por billing account</strong>. Si está al límite, pedí el
                        aumento:
                        <a
                          href="https://support.google.com/code/contact/billing_quota_increase"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          soporte de Google (billing quota increase)
                        </a>
                        .
                      </li>
                      <li>
                        Vinculá el proyecto:
                        <code
                          >gcloud billing projects link {{ shard.projectId }} --billing-account
                          TU_ACCOUNT_ID</code
                        >
                        (o en la consola: Billing → proyecto → Vincular).
                      </li>
                      <li>
                        Actualizá la atribución en la plataforma:
                        <code
                          >npx tsx scripts/complete-shards.ts --env
                          {{ envShort() }} --backfill-billing</code
                        >
                      </li>
                    </ol>
                  }

                  @if (reason === 'status') {
                    <p class="issue__desc">
                      El shard está en estado <strong>{{ shard.status }}</strong> (no es
                      WARMUP_READY ni ACTIVE).
                    </p>
                    <ul class="issue__steps issue__steps--ul">
                      @if (shard.status === 'WARMUP_PROVISIONING') {
                        <li>
                          Está en provisioning: el scheduler lo completa en el próximo ciclo (cada
                          6h) o con
                          <code
                            >npx tsx scripts/provision-shards.ts --target 10 --env
                            {{ envShort() }}</code
                          >.
                        </li>
                      } @else if (shard.status === 'FULL') {
                        <li>
                          Está lleno: vuelve a ACTIVE automáticamente al liberar cupo (deleteStore /
                          activateStore).
                        </li>
                      } @else {
                        <li>Revisá su estado en la consola de GCP o el scheduler del platform.</li>
                      }
                    </ul>
                  }
                </section>
              }
            </div>
          }

          <div class="modal-card__footer">
            <button class="btn btn-secondary btn--sm" (click)="closed.emit()">Cerrar</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
      }
      .modal-card {
        background: #1e1e2e;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        max-width: 620px;
        width: 100%;
        max-height: 86vh;
        overflow-y: auto;
        padding: 1.25rem;
      }
      .modal-card__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 0.75rem;
      }
      .modal-card__title {
        font-size: 1.05rem;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .modal-card__title .bi-check-circle-fill {
        color: #10b981;
      }
      .modal-card__title .bi-exclamation-triangle-fill {
        color: #f59e0b;
      }
      .modal-card__sub {
        margin: 0.25rem 0 0;
        font-size: 0.8rem;
        color: #94a3b8;
      }
      .modal-card__close {
        background: none;
        border: none;
        color: #94a3b8;
        font-size: 1rem;
        cursor: pointer;
      }
      .modal-card__intro {
        font-size: 0.88rem;
        color: #cbd5e1;
      }
      .ready-box {
        display: flex;
        gap: 0.75rem;
        background: rgba(16, 185, 129, 0.08);
        border: 1px solid rgba(16, 185, 129, 0.25);
        border-radius: 8px;
        padding: 0.9rem;
        color: #d1fae5;
      }
      .ready-box .bi {
        color: #10b981;
        font-size: 1.2rem;
      }
      .ready-box p {
        margin: 0.2rem 0 0;
        font-size: 0.85rem;
      }
      .issue-list {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }
      .issue {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(245, 158, 11, 0.25);
        border-left: 3px solid #f59e0b;
        border-radius: 8px;
        padding: 0.9rem;
      }
      .issue__title {
        margin: 0 0 0.4rem;
        font-size: 0.92rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .issue__title .bi {
        color: #f59e0b;
      }
      .issue__desc {
        font-size: 0.84rem;
        color: #cbd5e1;
        line-height: 1.5;
        margin: 0 0 0.5rem;
      }
      .issue__steps {
        margin: 0;
        padding-left: 1.2rem;
        font-size: 0.84rem;
        color: #cbd5e1;
        line-height: 1.6;
      }
      .issue__steps li {
        margin-bottom: 0.35rem;
      }
      .issue__steps code,
      .modal-card code {
        background: rgba(255, 255, 255, 0.08);
        padding: 0.1rem 0.35rem;
        border-radius: 4px;
        font-size: 0.78rem;
        word-break: break-all;
      }
      .copy-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.35rem;
      }
      .copy-row__uri {
        flex: 1;
      }
      .copy-row__btn {
        background: #2563eb;
        border: none;
        color: #fff;
        border-radius: 6px;
        padding: 0.25rem 0.6rem;
        font-size: 0.75rem;
        cursor: pointer;
        white-space: nowrap;
      }
      .modal-card__footer {
        margin-top: 1rem;
        display: flex;
        justify-content: flex-end;
      }
      a {
        color: #60a5fa;
      }
    `,
  ],
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
