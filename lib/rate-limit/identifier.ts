import "server-only";

import { createHash } from "node:crypto";

interface RateLimitIdentifierOptions {
  isVercel?: boolean;
}

const getFirstForwardedAddress = (value: string | null) => {
  const address = value?.split(",", 1)[0]?.trim();

  if (
    !address ||
    address.length > 128 ||
    /[\u0000-\u001f\u007f]/.test(address)
  ) {
    return undefined;
  }

  return address;
};

const hashIdentifier = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export const getRateLimitIdentifier = (
  request: Request,
  { isVercel = process.env.VERCEL === "1" }: RateLimitIdentifierOptions = {},
) => {
  if (!isVercel) {
    return "anonymous:local";
  }

  const clientAddress =
    getFirstForwardedAddress(request.headers.get("x-vercel-forwarded-for")) ??
    getFirstForwardedAddress(request.headers.get("x-forwarded-for"));

  if (!clientAddress) {
    return "anonymous:shared";
  }

  return `ip:${hashIdentifier(clientAddress)}`;
};
