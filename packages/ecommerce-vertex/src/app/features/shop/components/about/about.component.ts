import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Observable } from 'rxjs';
import type { AboutUsData } from '@core/models/about-us.model';
import { AboutUsService } from '@core/services/about-us.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent {
  private aboutUsService = inject(AboutUsService);

  data$: Observable<AboutUsData | undefined>;

  constructor() {
    this.data$ = this.aboutUsService.getAboutUsData();
  }
}
