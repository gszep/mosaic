import { useState, useCallback, type FormEvent } from "react";

const EXPECTED_HASH = "c6c55bcabd3ef494417c2c326b9ab4d6171eca5f0f4086ab57d5db74a0151303";

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hasToken(): boolean {
  return new URLSearchParams(window.location.search).has("token");
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem("mosaic-authed") === "true" && hasToken()
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const firstName = (fd.get("firstName") as string).trim();
    const password = (fd.get("password") as string).trim();

    if (!firstName) {
      setError("Please enter your first name.");
      return;
    }

    const hash = await sha256(password);
    if (hash !== EXPECTED_HASH) {
      setError("Incorrect password.");
      return;
    }

    const token = firstName.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!token) {
      setError("Name must contain at least one letter or number.");
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("token", token);
    window.history.replaceState(null, "", url.toString());

    sessionStorage.setItem("mosaic-authed", "true");
    setAuthed(true);
  }, []);

  if (authed) return <>{children}</>;

  return (
    <form onSubmit={handleSubmit} className="password-gate">
      <div className="nes-container is-dark is-rounded" style={{ textAlign: "center" }}>
        <h2 style={{ marginTop: 0 }}>Welcome!</h2>
        <div className="nes-field" style={{ marginBottom: "1rem" }}>
          <label htmlFor="firstName" style={{ textAlign: "left" }}>Your first name:</label>
          <input type="text" name="firstName" id="firstName" autoFocus className="nes-input is-dark"
            defaultValue={new URLSearchParams(window.location.search).get("token") ?? ""} />
        </div>
        <div className="nes-field" style={{ marginBottom: "1rem" }}>
          <label htmlFor="password" style={{ textAlign: "left" }}>Password:</label>
          <input type="password" name="password" id="password" className="nes-input is-dark" />
        </div>
        <button type="submit" className="nes-btn is-primary">Enter</button>
        {error && <p style={{ color: "#e76e55", marginTop: "0.5rem" }}>{error}</p>}
      </div>
    </form>
  );
}
