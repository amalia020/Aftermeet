"use client";

import { FormEvent, useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/auth/browser";

export function LoginForm({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured || !email.trim()) return;
    setStatus("loading");
    setMessage(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Check your email for the login link.");
  };

  return (
    <section className="screen login-screen">
      <div className="screen-kicker">Aftermeet</div>
      <h1>Log in</h1>
      <p className="screen-intro">
        Use your email to enter your private relationship workspace.
      </p>
      <form className="objective-form login-form" onSubmit={submit}>
        <label>
          <span>Email</span>
          <input
            autoComplete="email"
            disabled={!configured || status === "loading"}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </label>
        <button
          className="primary-action objective-save"
          disabled={!configured || !email.trim() || status === "loading"}
          type="submit"
        >
          {status === "loading" ? <Loader2 className="spin-icon" size={17} /> : <Mail size={17} />}
          Send login link
        </button>
        {!configured ? (
          <p className="quiet-note">Supabase env is missing. Configure it before public deploy.</p>
        ) : null}
        {message ? (
          <p className={status === "error" ? "analysis-alert" : "quiet-note"}>{message}</p>
        ) : null}
      </form>
    </section>
  );
}
