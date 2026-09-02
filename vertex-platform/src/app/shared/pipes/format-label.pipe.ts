import { Pipe, type PipeTransform } from '@angular/core';

/**
 * Formatea valores de detalle con un criterio uniforme y estético:
 * - versiones (vX.Y.Z) se mantienen tal cual;
 * - slugs/ids técnicos (guiones/bajo) pasan a "Title Case" legible (ej. 'lobo-suelto' → 'Lobo Suelto');
 * - texto plano se capitaliza por palabra ('stable' → 'Stable', 'ropa de hombre' → 'Ropa De Hombre').
 */
@Pipe({ name: 'formatLabel', standalone: true })
export class FormatLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    const text = String(value).trim();
    // Versiones o valores que ya empiezan con v + dígito: no tocar.
    if (/^v?\d+\.\d+(\.\d+)?/.test(text)) {
      return text;
    }
    // IDs técnicos con guiones/bajo → separar y capitalizar.
    return text
      .replace(/[-_]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(' ');
  }
}
