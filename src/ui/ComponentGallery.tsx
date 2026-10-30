import ActionButton from './ActionButton';
import StatusNotice from './StatusNotice';
export default function ComponentGallery() {
  return (
    <section className="panel component-gallery">
      <div className="section-label">DEVELOPMENT / UI FOUNDATION</div>
      <h2>Interface components</h2>
      <p className="muted">
        Provisional tokens and reusable states. This gallery is available only
        in the development build.
      </p>
      <h3>Actions</h3>
      <div className="gallery-row">
        <ActionButton>Record score</ActionButton>
        <ActionButton variant="secondary">Correct visit</ActionButton>
        <ActionButton variant="danger">Discard draft</ActionButton>
        <ActionButton disabled>Unavailable</ActionButton>
        <ActionButton pending>Saving…</ActionButton>
      </div>
      <h3>Feedback</h3>
      <StatusNotice>Ready to record your visit.</StatusNotice>
      <StatusNotice tone="success">
        Your match is saved on this device.
      </StatusNotice>
      <StatusNotice tone="warning">
        Connection lost. Local play is still available.
      </StatusNotice>
      <StatusNotice tone="error">
        This result could not be saved. Keep the page open and export it.
      </StatusNotice>
      <h3>Surfaces and text</h3>
      <div className="gallery-swatches">
        <div className="swatch page">Page</div>
        <div className="swatch surface">Surface</div>
        <div className="swatch accent">Primary action</div>
        <div className="swatch ink">Score surface</div>
      </div>
      <p>Body text for instructions and recovery actions.</p>
      <p className="muted">
        Supporting information stays readable and is never the only way to
        understand an error.
      </p>
    </section>
  );
}
