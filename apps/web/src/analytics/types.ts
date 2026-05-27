export interface AnalyticsProvider {
  /** Stable identifier — matches the value of `VITE_ANALYTICS_PROVIDER`. */
  readonly name: string;
  /**
   * Called once after all gating checks pass. The provider takes it from
   * here — beacon injection, SPA route tracking, anything else it needs.
   */
  init(): void;
}
