/**
 * sleep in millisecond
 * @param timeout
 */
export function asyncSleep(timeout: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

export const bytesToHex = (bytes: Uint8Array): string =>
  `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;

export function genRandomHex(size: number): string {
  return (
    "0x" +
    [...Array(size)]
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join("")
  );
}
