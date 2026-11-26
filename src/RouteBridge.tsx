import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { AppApi } from "./app-api";
import { buildRoute, parseRoute, routeFromState } from "./routing";

export function RouteBridge({ api }: { api: AppApi }) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { applyRoute } = api.actions;
  const locationKey = pathname + search;
  const lastApplied = useRef("");
  const desired = buildRoute(routeFromState(api.state, api.demoMode));

  useEffect(() => {
    if (!api.state.profile || locationKey === lastApplied.current) return;
    lastApplied.current = locationKey;
    applyRoute(parseRoute(pathname, search));
  }, [api.state.profile, applyRoute, locationKey, pathname, search]);

  useEffect(() => {
    if (!api.state.profile || api.state.pendingOpenMessageId || desired === locationKey) return;
    navigate(desired, { replace: true });
  }, [api.state.pendingOpenMessageId, api.state.profile, desired, locationKey, navigate]);

  return null;
}
