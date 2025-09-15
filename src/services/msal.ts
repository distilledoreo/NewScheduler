type Nullable<T> = T | null;

interface AccountInfo {
  readonly homeAccountId: string;
  readonly username?: string;
  readonly name?: string;
}

interface AuthenticationResult {
  readonly accessToken: string;
  readonly account: AccountInfo | null;
}

interface PublicClientApplication {
  getAllAccounts(): AccountInfo[];
  setActiveAccount(account: AccountInfo | null): void;
  getActiveAccount(): AccountInfo | null;
  loginPopup(request: { scopes: string[] }): Promise<AuthenticationResult>;
  acquireTokenSilent(request: { scopes: string[]; account: AccountInfo }): Promise<AuthenticationResult>;
  acquireTokenPopup(request: { scopes: string[]; account: AccountInfo }): Promise<AuthenticationResult>;
}

type PublicClientApplicationConstructor = new (config: {
  auth: {
    clientId: string;
    authority?: string;
    redirectUri?: string;
  };
  cache?: {
    cacheLocation?: string;
    storeAuthStateInCookie?: boolean;
  };
}) => PublicClientApplication;

declare global {
  interface Window {
    msal?: {
      PublicClientApplication?: PublicClientApplicationConstructor;
    };
  }
}

let msalInstance: Nullable<PublicClientApplication> = null;
let loginInFlight: Promise<AccountInfo> | null = null;

function getMsalConstructor(): PublicClientApplicationConstructor {
  if (typeof window === "undefined") {
    throw new Error("MSAL requires a browser environment.");
  }
  const ctor = window.msal?.PublicClientApplication;
  if (!ctor) {
    throw new Error(
      "MSAL browser script not found. Include msal-browser or install @azure/msal-browser to enable authentication.",
    );
  }
  return ctor;
}

function getClientId(): string | undefined {
  const value = import.meta.env.VITE_AZURE_CLIENT_ID;
  return value && value.length ? value : undefined;
}

function getAuthority(): string | undefined {
  const authority = import.meta.env.VITE_AZURE_AUTHORITY;
  if (authority && authority.length) return authority;
  const tenantId = import.meta.env.VITE_AZURE_TENANT_ID;
  if (tenantId && tenantId.length) {
    return `https://login.microsoftonline.com/${tenantId}`;
  }
  return undefined;
}

function getRedirectUri(): string | undefined {
  const redirect = import.meta.env.VITE_AZURE_REDIRECT_URI;
  if (redirect && redirect.length) return redirect;
  if (typeof window !== "undefined" && window.location) {
    return window.location.origin;
  }
  return undefined;
}

export function isMsalConfigured(): boolean {
  return Boolean(getClientId());
}

export function getMsalInstance(): PublicClientApplication {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error("MSAL is not configured. Set VITE_AZURE_CLIENT_ID in the environment.");
  }
  if (!msalInstance) {
    const MsalCtor = getMsalConstructor();
    msalInstance = new MsalCtor({
      auth: {
        clientId,
        authority: getAuthority(),
        redirectUri: getRedirectUri(),
      },
      cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
      },
    });
  }
  return msalInstance;
}

export async function ensureMsalLogin(scopes: string[] = ["User.Read"]): Promise<AccountInfo> {
  const instance = getMsalInstance();
  const accounts = instance.getAllAccounts();
  if (accounts.length > 0) {
    const account = accounts[0]!;
    instance.setActiveAccount(account);
    return account;
  }

  if (!loginInFlight) {
    loginInFlight = instance.loginPopup({ scopes }).then((result) => {
      if (!result.account) {
        throw new Error("MSAL login did not return an account.");
      }
      instance.setActiveAccount(result.account);
      return result.account;
    }).finally(() => {
      loginInFlight = null;
    });
  }

  return loginInFlight;
}

export async function acquireMsalToken(scopes: string[]): Promise<string> {
  const instance = getMsalInstance();
  const account = instance.getActiveAccount() ?? (await ensureMsalLogin(scopes));

  try {
    const response = await instance.acquireTokenSilent({ scopes, account });
    if (!response.accessToken) {
      throw new Error("MSAL silent token acquisition returned no access token.");
    }
    return response.accessToken;
  } catch (error) {
    console.warn("MSAL silent token acquisition failed; falling back to popup.", error);
    const response = await instance.acquireTokenPopup({ scopes, account });
    if (!response.accessToken) {
      throw new Error("MSAL popup token acquisition returned no access token.");
    }
    return response.accessToken;
  }
}
