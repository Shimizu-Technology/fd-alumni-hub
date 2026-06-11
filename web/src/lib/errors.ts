export function mutationErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}
