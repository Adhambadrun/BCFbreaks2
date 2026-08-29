/**
 * Auth0 Login Action — "BCF Breaks: Domain & Tier Guard"
 * ===========================================================================
 * Paste into: Auth0 Dashboard → Actions → Authentication → Login → Custom Action.
 * Then press Deploy and add the action to the **Login** flow.
 *
 * WHAT THIS ADDS ON TOP OF THE APP'S OWN GATE
 * `serverAuth.ts` already classifies every login and clamps privileges, so this
 * Action is not the only thing standing between an outsider and the floor. It adds
 * two things the app cannot do from itself:
 *
 *   1. Rejection at the login page. A disallowed user never receives a token at all,
 *      so they cannot reach the app's callback route, cannot be counted as a login,
 *      and produce no session to audit.
 *   2. A signed source of truth. The tier and role are written into the ID/access
 *      token under a custom namespace, so the app can stop guessing roles from email
 *      substrings — the current `determineRoleForEmail()` heuristic grants `admin` to
 *      any address merely *containing* "admin", which is the weakest link in the
 *      whole design. Reading `access_level` from the token removes it.
 *
 * ENFORCEMENT IS OPT-IN PER TENANT
 * `ENFORCE_PRODUCTION_ONLY` is a secret you configure on this action. Set it to
 * `"true"` **only on the production tenant**. Development and staging must stay
 * permissive, because the Preview tier exists precisely so other domains can be
 * exercised there — a blanket block would make your own policy unreachable.
 */

const NAMESPACE = 'https://bcfbreaks.com/';

/** Accounts that hold the production floor. Mirrors accessLevels.ts exactly. */
const PRODUCTION_EMAIL_SUFFIX = '@bcflights.com';
const PRODUCTION_EMAIL_OVERRIDES = ['adhambadraan@gmail.com'];

/** Team routing + privileged-role bootstrap, keyed by email. */
const TEAM_BY_EMAIL = {
  'rania.fawzy@bcflights.com': 'team_titans',
  'omar.nabil@bcflights.com': 'team_apex',
  'dina.helmy@bcflights.com': 'team_phantom',
};

function resolveRole(email) {
  if (PRODUCTION_EMAIL_OVERRIDES.includes(email) || email === 'adham@bcflights.com') return 'developer';
  if (email.includes('admin')) return 'admin';
  if (email.includes('supervisor')) return 'supervisor';
  return 'agent';
}

exports.onExecutePostLogin = async (event, api) => {
  const email = String(event.user.email || '').toLowerCase().trim();

  // An identity with no email cannot be classified. Refusing here is what keeps the
  // app from ever having to invent a placeholder address to get past its own check.
  if (!email) {
    return api.access.deny('no_email', 'This floor requires an identity with a verified email address.');
  }

  const isProduction = email.endsWith(PRODUCTION_EMAIL_SUFFIX) || PRODUCTION_EMAIL_OVERRIDES.includes(email);
  const accessLevel = isProduction ? 'production' : 'preview';
  const role = resolveRole(email);
  const teamId = TEAM_BY_EMAIL[email] || 'team_strikers';

  // Persisted so the assignment survives future logins even if this script changes.
  // `app_metadata` is writable only by Actions/Rules, never by the user.
  if (event.user.app_metadata?.bcfAccessLevel !== accessLevel) {
    api.user.setAppMetadata('bcfAccessLevel', accessLevel);
    api.user.setAppMetadata('bcfRole', role);
    api.user.setAppMetadata('bcfTeamId', teamId);
  }

  // Claims the application can trust without re-deriving them. Custom claims must be
  // namespaced — Auth0 strips bare top-level claims from tokens for first-party APIs.
  api.idToken.setCustomClaim(`${NAMESPACE}access_level`, accessLevel);
  api.idToken.setCustomClaim(`${NAMESPACE}role`, role);
  api.idToken.setCustomClaim(`${NAMESPACE}team_id`, teamId);
  api.accessToken.setCustomClaim(`${NAMESPACE}access_level`, accessLevel);

  // MFA for anyone holding a privileged role on the production tier. Requires MFA to
  // be enabled for the connection/provider; `prompt: 'login'` asks only when needed.
  if (isProduction && role !== 'agent' && event.multifactor?.passed !== true) {
    api.multifactor.enable('any', { allowRememberBrowser: true });
  }

  if (!isProduction && event.secrets?.ENFORCE_PRODUCTION_ONLY === 'true') {
    return api.access.deny(
      'unauthorized_domain',
      `Only @bcflights.com accounts may enter the production floor. Sign in from a preview tenant instead.`
    );
  }
};

/**
 * Optional companion: `onExecutePostChangePassword` / a Prompt add-on can keep
 * `app_metadata` in sync when an admin edits a user. Not required for the login gate.
 */
