export function isDemoPasscodeConfigured(): boolean {
  return Boolean(process.env.AFTERMEET_DEMO_PASSCODE);
}

export function isDemoPasscodeValid(passcode: string): boolean {
  const expected = process.env.AFTERMEET_DEMO_PASSCODE;
  if (!expected) return false;
  return passcode === expected;
}

export function getMagicLinkErrorMessage(message: string): string {
  if (/rate|limit|too many/i.test(message)) {
    return "Email login is cooling down. Use demo access now, or try magic link again later.";
  }
  return message;
}
