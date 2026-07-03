/**
 * Safely extracts a human-readable error message from an unknown error value.
 * Returns the fallback string if no message can be derived.
 */
export function errorMessage(err: unknown, fallback = 'Ha ocurrido un error.'): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as Record<string, unknown>)['message']);
  }
  return fallback;
}
