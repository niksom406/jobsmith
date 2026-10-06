import { expect, test } from "vitest";
import { base64ToBytes, bytesToBase64 } from "./bytes";

test("round-trips bytes through base64", () => {
  const bytes = new Uint8Array([0, 1, 255, 32, 127]);
  expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
});
