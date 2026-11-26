import { useState } from "react";
import type { AppApi } from "../../app-api";
import { hasKeys } from "../../backend";
import { Icon } from "../shared/ui";

export function DemoBanner({ api }: { api: AppApi }) {
  const [dismissed, setDismissed] = useState(false);
  return (
    <div id="demoBanner" className="demo-banner" hidden={!api.demoMode || dismissed}>
      <Icon name="alert" />
      <span>
        <strong>Demo mode.</strong> Messages stay on this device. {hasKeys ? <>Remove <code>?demo=1</code> to use your class connection.</> : <>Add your Supabase keys in <code>supabase-config.js</code> to share with students.</>}
      </span>
      <button id="dismissDemoBanner" className="banner-close" type="button" aria-label="Dismiss demo notice" onClick={() => setDismissed(true)}>
        <Icon name="close" />
      </button>
    </div>
  );
}
