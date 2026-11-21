/**
 * Turns a fresh (or already set up) dev Home Assistant into a ready instance: onboarding, a
 * long-lived token for scripts and tests, and the Later integration added through its config
 * flow, as the "Add integration" dialog does. Safe to re-run. Usage: `pnpm hass:bootstrap`.
 */
import {
  type AuthTokens,
  CLIENT_ID,
  DEV_USER,
  exchangeAuthCode,
  getJson,
  HASS_URL,
  HassSocket,
  isObject,
  loginWithPassword,
  postJson,
  readToken,
  TOKEN_FILE,
  waitForHttp,
  waitForRunning,
  writeToken,
} from "../src/hass.ts";

async function pendingOnboardingSteps(): Promise<Set<string>> {
  const response = await fetch(`${HASS_URL}/api/onboarding`);
  if (response.status === 404) {
    return new Set();
  }
  const steps: unknown = await response.json();
  if (!Array.isArray(steps)) {
    throw new Error(`Unexpected onboarding status: ${JSON.stringify(steps)}`);
  }
  return new Set(
    steps.flatMap((step) =>
      isObject(step) && step.done === false && typeof step.step === "string" ? [step.step] : []
    )
  );
}

async function createOwner(): Promise<AuthTokens> {
  const result = await postJson("/api/onboarding/users", {
    client_id: CLIENT_ID,
    name: DEV_USER.name,
    username: DEV_USER.username,
    password: DEV_USER.password,
    language: "en",
  });
  if (!isObject(result) || typeof result.auth_code !== "string") {
    throw new Error(`Onboarding did not return an auth code: ${JSON.stringify(result)}`);
  }
  return exchangeAuthCode(result.auth_code);
}

const remainingSteps: Record<string, Record<string, string>> = {
  core_config: {},
  analytics: {},
  integration: { client_id: CLIENT_ID, redirect_uri: CLIENT_ID },
};

async function onboard(): Promise<AuthTokens> {
  const pending = await pendingOnboardingSteps();
  const tokens = pending.has("user") ? await createOwner() : await loginWithPassword();
  await Object.entries(remainingSteps)
    .filter(([step]) => pending.has(step))
    .reduce(
      (previous, [step, body]) =>
        previous.then(() => postJson(`/api/onboarding/${step}`, body, tokens.access_token)),
      Promise.resolve<unknown>(null)
    );
  console.warn(pending.size ? `Onboarded: ${[...pending].join(", ")}` : "Already onboarded");
  return tokens;
}

async function tokenStillValid(): Promise<boolean> {
  try {
    await getJson("/api/", await readToken());
    return true;
  } catch {
    return false;
  }
}

async function ensureLongLivedToken(socket: HassSocket): Promise<void> {
  if (await tokenStillValid()) {
    return;
  }
  const token = await socket.call({
    type: "auth/long_lived_access_token",
    client_name: `later e2e ${new Date().toISOString()}`,
    lifespan: 3650,
  });
  if (typeof token !== "string") {
    throw new Error(`Unexpected long-lived token response: ${JSON.stringify(token)}`);
  }
  await writeToken(token);
  console.warn(`Wrote a long-lived token to ${TOKEN_FILE}`);
}

/** Adds Later through its config flow unless an entry exists. */
async function ensureLaterEntry(token: string): Promise<void> {
  const entries = await getJson("/api/config/config_entries/entry?domain=later", token);
  if (Array.isArray(entries) && entries.length > 0) {
    console.warn("Later is already set up");
    return;
  }
  const flow = await postJson("/api/config/config_entries/flow", { handler: "later" }, token);
  if (!isObject(flow) || typeof flow.flow_id !== "string") {
    throw new Error(`Later config flow did not start: ${JSON.stringify(flow)}`);
  }
  const result = await postJson(`/api/config/config_entries/flow/${flow.flow_id}`, {}, token);
  if (!isObject(result) || result.type !== "create_entry") {
    throw new Error(`Later config flow did not create an entry: ${JSON.stringify(result)}`);
  }
  console.warn("Added the Later integration");
}

async function main() {
  console.warn(`Waiting for Home Assistant at ${HASS_URL} ...`);
  await waitForHttp();
  const tokens = await onboard();
  await waitForRunning(tokens.access_token);
  const socket = await HassSocket.connect(tokens.access_token);
  try {
    await ensureLongLivedToken(socket);
  } finally {
    socket.close();
  }
  await ensureLaterEntry(await readToken());
  console.warn(
    `\nHome Assistant is ready at ${HASS_URL}\n  user: ${DEV_USER.username}\n  password: ${DEV_USER.password}\n`
  );
}

await main();
