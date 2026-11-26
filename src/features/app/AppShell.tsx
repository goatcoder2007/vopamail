import {
  AlertOverlay,
  AuthScreen,
  ComposePanel,
  DetailPane,
  DemoBanner,
  FileLightbox,
  ListPane,
  Sidebar,
  Sprite,
  Topbar
} from "../../components";
import { RouteBridge } from "../../RouteBridge";
import { useAppApi } from "./app-context";

export function AppShell() {
  const api = useAppApi();
  const profile = api.state.profile;

  return (
    <>
      <Sprite />
      <RouteBridge api={api} />
      <DemoBanner api={api} />
      {!profile ? <AuthScreen api={api} /> : null}
      <div
        id="appShell"
        className={`app-shell${profile?.role === "teacher" ? " teacher-shell" : ""}`}
        data-view={api.state.view}
        hidden={!profile}
      >
        <Sidebar api={api} />
        <main className="mail-main">
          <Topbar api={api} />
          <div className="mail-content">
            <ListPane api={api} />
            <DetailPane api={api} />
          </div>
        </main>
      </div>
      <ComposePanel api={api} />
      <AlertOverlay api={api} />
      <FileLightbox api={api} />
    </>
  );
}
