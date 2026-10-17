import { fileURLToPath } from "node:url";

export async function hostModule(relative) {
  return import(new URL(relative, import.meta.resolve("@earendil-works/pi-coding-agent")));
}
export function hostPath(relative) {
  return fileURLToPath(new URL(relative, import.meta.resolve("@earendil-works/pi-coding-agent")));
}
