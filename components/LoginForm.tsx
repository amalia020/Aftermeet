"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { ArrowRight, Loader2, Mail, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/auth/browser";
import appIcon from "@/logo/Icon.png";

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
    <section className="login-screen">
      <div className="login-device">
        <div className="login-brand">
          <Image alt="" className="login-brand-icon" priority src={appIcon} />
          <span>Aftermeet</span>
        </div>
        <div className="login-hero">
          <p className="screen-kicker">Mobile relationship command</p>
          <h1>Walk in with context. Walk out with next moves.</h1>
          <p>
            Private follow-up memory for founders, operators, and anyone whose work
            depends on remembering the right person at the right time.
          </p>
        </div>
        <form className="login-form" onSubmit={submit}>
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
            className="primary-action login-submit"
            disabled={!configured || !email.trim() || status === "loading"}
            type="submit"
          >
            {status === "loading" ? <Loader2 className="spin-icon" size={18} /> : <Mail size={18} />}
            <span>{status === "loading" ? "Sending" : "Send magic link"}</span>
            {status === "loading" ? null : <ArrowRight size={18} />}
          </button>
          {!configured ? (
            <p className="quiet-note">Supabase env is missing. Configure it before public deploy.</p>
          ) : null}
          {message ? (
            <p className={status === "error" ? "analysis-alert" : "quiet-note"}>{message}</p>
          ) : null}
        </form>
        <div className="login-trust">
          <ShieldCheck size={17} />
          <span>No password. Session stored by Supabase Auth. Rate limits reset automatically.</span>
        </div>
      </div>
    </section>
  );
}
