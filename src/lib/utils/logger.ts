/**
 * Logger - Centralized logging for PC Editor.
 *
 * When enabled, logs informational messages to the console.
 * When disabled, only errors are logged.
 * Controlled via EditorOptions.enableLogging or Logger.setEnabled().
 */

let _enabled = false;

export const Logger = {
  /** Enable or disable logging. When disabled, only errors are logged. */
  setEnabled(enabled: boolean): void {
    _enabled = enabled;
  },

  /** Check if logging is enabled. */
  isEnabled(): boolean {
    return _enabled;
  },

  /** Log an informational message. Only outputs when logging is enabled. */
  log(...args: unknown[]): void {
    if (_enabled) {
      console.log(...args);
    }
  },

  /** Log a warning. Only outputs when logging is enabled. */
  warn(...args: unknown[]): void {
    if (_enabled) {
      console.warn(...args);
    }
  },

  /** Log an error. Always outputs regardless of logging state. */
  error(...args: unknown[]): void {
    console.error(...args);
  }
};
