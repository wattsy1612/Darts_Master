import { useOffline } from './offline';
import ActionButton from './ui/ActionButton';
export function OfflineIndicator() {
  const offline = useOffline();
  return (
    <>
      {!offline.online && (
        <span className="offline-indicator" role="status">
          Offline · local play
        </span>
      )}
      {offline.update && (
        <p className="update-notice" role="status">
          Update ready. Finish your visit, then close all app tabs to apply it.
        </p>
      )}
    </>
  );
}
export function OfflineSettings() {
  const offline = useOffline();
  return (
    <section className="panel data-panel">
      <div className="section-label">PLAY WITHOUT A CONNECTION</div>
      <h2>
        {offline.ready
          ? 'Ready for offline play.'
          : 'Prepare this device for offline play.'}
      </h2>
      <p className="muted">
        {offline.ready
          ? 'This app’s playing screens are saved on this device. You can reopen them offline and keep scoring locally.'
          : 'Open the app online and allow its files to finish saving before relying on offline reopen.'}{' '}
        Online rooms, sync and live media will require a connection when
        available.
      </p>
      <p className="muted">
        Unsubmitted visits are saved separately in this tab for up to seven
        days. On refresh, you choose whether to restore them. They are not
        included in exported match backups. Closing a tab may remove its draft
        link; record the visit before closing it.
      </p>
      <p className="muted">
        Browser data clearing or storage removal also removes offline files and
        saved matches. Keep a downloaded backup separately.
      </p>
      {offline.problem && <p className="notice">{offline.problem}</p>}
      {!import.meta.env.PROD && (
        <p className="muted">
          Offline reopen is enabled in the built app. This development preview
          needs its local server to reopen.
        </p>
      )}
      {offline.installed ? (
        <p className="notice">App installed on this device.</p>
      ) : (
        offline.install && (
          <ActionButton
            variant="secondary"
            onClick={() => void offline.installApp()}
          >
            Install on this device
          </ActionButton>
        )
      )}
      {!offline.installed && !offline.install && (
        <p className="muted">
          If your browser offers “Install app” or “Add to Home Screen”, you can
          use it to create a shortcut.
        </p>
      )}
      {offline.update && (
        <p className="notice">
          A new version is ready. It waits until all app tabs are closed so it
          cannot interrupt a match.
        </p>
      )}
    </section>
  );
}
