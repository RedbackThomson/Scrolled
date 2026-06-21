/** Base class for identity failures, so callers can `instanceof`-narrow. */
export class IdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdentityError';
  }
}

/** A login/logout/token call was made against a provider that does not support it. */
export class IdentityUnsupportedError extends IdentityError {
  constructor(action: string) {
    super(`Identity action "${action}" is not supported by the active provider.`);
    this.name = 'IdentityUnsupportedError';
  }
}

/** Sign-in failed at the provider (cancelled, network, misconfiguration, …). */
export class IdentityLoginError extends IdentityError {
  constructor(message: string) {
    super(message);
    this.name = 'IdentityLoginError';
  }
}
