export default function UploadPage() {
  return (
    <section className="page">
      <h1>Upload console</h1>
      <p className="page-lead">
        Submit raw operational content (chat exports, email threads, notes, slides) for
        conversion into structured knowledge base articles. File ingestion and AI
        extraction will connect to this console in a later phase.
      </p>
      <div className="card upload-grid">
        <label className="field">
          <span>Paste unstructured text</span>
          <textarea rows={8} placeholder="Paste MS Teams, email, or note text…" readOnly />
        </label>
        <div className="field">
          <span>Files</span>
          <div className="dropzone" aria-disabled="true">
            PDF and DOCX upload — wiring to backend processing next.
          </div>
        </div>
        <button type="button" className="btn-primary" disabled>
          Queue for processing (placeholder)
        </button>
      </div>
    </section>
  )
}
