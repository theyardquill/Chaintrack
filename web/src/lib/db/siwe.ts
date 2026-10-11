import { Web3 } from "web3";

// Pure crypto helpers — no provider needed, so this runs safely on the server.
const web3 = new Web3();

const SIWE_SUFFIX = " wants you to sign in with your Ethereum account:";

export interface SiweFields {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version: string;
  chainId: string;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources: string[];
}

export interface CreateSiweInput {
  domain: string;
  address: string;
  uri: string;
  chainId: string;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  statement?: string;
}

export function createSiweMessage(input: CreateSiweInput): string {
  const lines: string[] = [`${input.domain}${SIWE_SUFFIX}`, input.address, ""];
  if (input.statement) lines.push(input.statement, "");
  lines.push(
    `URI: ${input.uri}`,
    "Version: 1",
    `Chain ID: ${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
  );
  if (input.expirationTime) lines.push(`Expiration Time: ${input.expirationTime}`);
  return lines.join("\n");
}

export function parseSiweMessage(message: string): SiweFields {
  const lines = message.split("\n");
  const header = lines[0] ?? "";
  if (!header.endsWith(SIWE_SUFFIX)) throw new Error("Not a SIWE (EIP-4361) message");

  const domain = header.slice(0, -SIWE_SUFFIX.length);
  const address = (lines[1] ?? "").trim();

  // After the address line: blank, then an OPTIONAL statement, then blank.
  // Skip blanks and only treat the next line as the statement when it is not
  // already a field line (e.g. "URI: https://…").
  let i = 2;
  while (i < lines.length && lines[i] === "") i += 1;
  let statement: string | undefined;
  if (i < lines.length && !/^[A-Za-z][A-Za-z0-9 /-]*: /.test(lines[i])) {
    statement = lines[i];
    i += 1;
  }
  while (i < lines.length && lines[i] === "") i += 1;

  const fields: Record<string, string> = {};
  const resources: string[] = [];
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    if (line.startsWith("- ")) {
      resources.push(line.slice(2));
      continue;
    }
    const sep = line.indexOf(": ");
    if (sep === -1) continue;
    fields[line.slice(0, sep)] = line.slice(sep + 2);
  }

  for (const key of ["URI", "Version", "Chain ID", "Nonce", "Issued At"]) {
    if (!fields[key]) throw new Error(`SIWE message is missing "${key}"`);
  }

  return {
    domain,
    address,
    statement,
    uri: fields.URI,
    version: fields.Version,
    chainId: fields["Chain ID"],
    nonce: fields.Nonce,
    issuedAt: fields["Issued At"],
    expirationTime: fields["Expiration Time"],
    notBefore: fields["Not Before"],
    requestId: fields["Request ID"],
    resources,
  };
}

export function recoverSiweAddress(message: string, signature: string): string {
  return web3.eth.accounts.recover(message, signature);
}

export function hashSiweMessage(message: string): string {
  return web3.utils.keccak256(message);
}
