import { PublicClientApplication, InteractionRequiredAuthError, type AccountInfo } from "@azure/msal-browser";

export const msal = new PublicClientApplication({
  auth: {
    clientId: import.meta.env.VITE_AAD_CLIENT_ID as string,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AAD_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: { cacheLocation: "localStorage" },
});

const scopes = (import.meta.env.VITE_AAD_SCOPES as string | undefined)?.split(",") || ["Sites.ReadWrite.All"];

// Handle login/consent redirects and set the active account
export async function handleRedirect(): Promise<void> {
  try {
    const result = await msal.handleRedirectPromise();
    if (result?.account) {
      msal.setActiveAccount(result.account);
      return;
    }
    const accounts = msal.getAllAccounts();
    if (accounts.length && !msal.getActiveAccount()) {
      msal.setActiveAccount(accounts[0]!);
    }
  } catch (e) {
    // Surface but do not crash app
    console.warn("MSAL handleRedirect failed:", e);
  }
}

export async function getAccount(): Promise<AccountInfo | null> {
  const accounts = msal.getAllAccounts();
  if (accounts.length) return accounts[0];
  return null;
}

export async function login(): Promise<void> {
  await msal.loginRedirect({ scopes });
}

export async function acquireGraphToken(): Promise<string> {
  let account = await getAccount();
  if (!account) {
    await login();
    // control will return on redirect
    throw new Error("Redirecting for login");
  }
  try {
    const r = await msal.acquireTokenSilent({ account, scopes });
    return r.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      await msal.acquireTokenRedirect({ account, scopes });
      throw new Error("Redirecting for consent");
    }
    throw e;
  }
}
