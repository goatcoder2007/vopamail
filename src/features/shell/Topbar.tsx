import type { AppApi } from "../../app-api";
import { initials } from "../../utils";
import { Icon } from "../shared/ui";

export function Topbar({ api }: { api: AppApi }) {
  const { state, derived } = api;
  if (!state.profile) return null;
  return (
    <header className="mail-topbar">
      <button id="menuBtn" className="icon-btn menu-btn" type="button" aria-label="Open menu" onClick={api.actions.openSidebar}>
        <Icon name="menu" />
      </button>
      <div className="search-wrap">
        <Icon name="search" />
        <label className="sr-only" htmlFor="searchInput">Search mail</label>
        <input id="searchInput" type="search" placeholder="Search mail" autoComplete="off" value={state.query} onChange={(event) => api.actions.setQuery(event.target.value)} />
        <button id="clearSearch" className="clear-search" type="button" aria-label="Clear search" hidden={!state.query} onClick={() => api.actions.setQuery("")}>
          <Icon name="close" />
        </button>
      </div>
      <button id="refreshBtn" className="icon-btn refresh-btn" type="button" title="Refresh" aria-label="Refresh" onClick={api.actions.refresh}>
        <Icon name="refresh" />
      </button>
      <div id="topbarUser" className="topbar-user">{initials(derived.classmates.length ? state.profile.name : state.profile.name)}</div>
    </header>
  );
}
