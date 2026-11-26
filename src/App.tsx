import { AppProvider } from "./features/app/AppContext";
import { AppShell } from "./features/app/AppShell";
import { useVopaApp } from "./features/app/useVopaApp";

export default function App() {
  const api = useVopaApp();
  return (
    <AppProvider value={api}>
      <AppShell />
    </AppProvider>
  );
}
