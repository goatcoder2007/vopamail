import type { ReactNode } from "react";
import type { AppApi } from "../../app-api";
import { AppContext } from "./app-context";

export function AppProvider({ value, children }: { value: AppApi; children: ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
