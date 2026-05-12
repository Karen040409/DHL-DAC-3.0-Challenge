export default function LoginPage() {
  return (
    <section className="page">
      <h1>Secured access</h1>
      <p className="page-lead">
        Placeholder for authentication. Phase 1 focuses on schema, API, and navigation
        shell; credentials and session handling will plug in here.
      </p>
      <form className="card" onSubmit={(e) => e.preventDefault()}>
        <label className="field">
          <span>Username</span>
          <input type="text" name="username" autoComplete="username" disabled />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" name="password" autoComplete="current-password" disabled />
        </label>
        <button type="submit" className="btn-primary" disabled>
          Sign in (coming soon)
        </button>
      </form>
    </section>
  )
}
