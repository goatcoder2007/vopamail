import { createContext, useContext } from "react";
import type { AppApi } from "../../app-api";

export const AppContext = createContext<AppApi | null>(null);

export function useAppApi() {
  const api = useContext(AppContext);
  if (!api) throw new Error("Vopa Mail app context is missing.");
  return api;
}
