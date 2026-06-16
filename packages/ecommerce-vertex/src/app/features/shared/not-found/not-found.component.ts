import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="not-found-container">
      <h1>404</h1>
      <p>La página que buscás no existe.</p>
      <a routerLink="/shop">Volver a la tienda</a>
    </div>
  `,
  styles: [
    `
      .not-found-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60vh;
        gap: 1rem;
        text-align: center;
      }
      h1 {
        font-size: 6rem;
        font-weight: 700;
        margin: 0;
      }
      p {
        font-size: 1.25rem;
        color: #64748b;
      }
      a {
        padding: 0.75rem 1.5rem;
        background: var(--color-primary, #ea580c);
        color: #fff;
        border-radius: 0.5rem;
        text-decoration: none;
        font-weight: 600;
      }
    `,
  ],
})
export class NotFoundComponent {}
