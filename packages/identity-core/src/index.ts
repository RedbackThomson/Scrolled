export type {
  IdentityProvider,
  LoginOptions,
  SessionListener,
  SessionMode,
  Unsubscribe,
  UserSession,
} from './types';
export { ANONYMOUS_SESSION } from './types';
export { createAnonymousProvider } from './anonymous';
export { IdentityError, IdentityLoginError, IdentityUnsupportedError } from './errors';

// The React context/hooks live on the `@scrolled/identity-core/react` subpath so
// non-React consumers (e.g. the cloud provider) can depend on the contract
// without pulling JSX into their compile.
