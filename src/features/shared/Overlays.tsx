import type { AppApi } from "../../app-api";
import { formatFileSize } from "../../utils";
import { Icon } from "./ui";

export function AlertOverlay({ api }: { api: AppApi }) {
  const alert = api.alert;
  const icon = alert?.type === "error" ? "alert" : alert?.type === "info" ? "envelope" : "check";
  return (
    <div id="alertOverlay" className="alert-overlay" hidden={!alert}>
      <div className="alert-card" role="alertdialog" aria-modal="true" aria-labelledby="alertTitle" aria-describedby="alertMessage">
        <span id="alertIcon" className="alert-icon"><Icon name={icon} /></span>
        <div className="alert-copy"><h2 id="alertTitle">{alert?.type === "error" ? "Something went wrong" : alert?.type === "info" ? "Notice" : "Done"}</h2><p id="alertMessage">{alert?.message}</p></div>
        <button id="alertOk" className="btn primary" type="button" onClick={api.actions.closeAlert}>OK</button>
      </div>
    </div>
  );
}

export function FileLightbox({ api }: { api: AppApi }) {
  const lightbox = api.lightbox;
  return (
    <div id="fileLightbox" className="file-lightbox" hidden={!lightbox} aria-label="File preview" role="dialog" aria-modal="true">
      <button id="lightboxClose" className="lightbox-close" type="button" aria-label="Close preview" onClick={api.actions.closeLightbox}><Icon name="close" /></button>
      <figure className="lightbox-figure">
        <img id="lightboxImage" className="lightbox-image" alt={lightbox?.name || ""} src={lightbox?.url || "data:image/gif;base64,R0lGODlhAQABAAAAACw="} />
        <figcaption className="lightbox-caption">
          <strong id="lightboxName">{lightbox?.name}</strong>
          <span id="lightboxMeta">{lightbox ? formatFileSize(lightbox.size) : ""}</span>
          <a id="lightboxDownload" className="btn ghost" href={lightbox?.url || "#"} download={lightbox?.name}>Download</a>
        </figcaption>
      </figure>
    </div>
  );
}
