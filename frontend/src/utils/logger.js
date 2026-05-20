export function reportError(message, error) {
  if (import.meta.env.DEV) {
    console.error(message, error);
  }
}
