"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/auth/browser";
import { getMagicLinkErrorMessage } from "@/lib/auth/demo";
import appIcon from "@/logo/Icon.png";

export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [demoStatus, setDemoStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);

  const submitMagicLink = async (event: FormEvent<HTMLFormElement>) => {
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
      setMessage(getMagicLinkErrorMessage(error.message));
      return;
    }

    setStatus("sent");
    setMessage("Check your email for the login link.");
  };

  const submitDemo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured || !passcode) return;
    setDemoStatus("loading");
    setDemoMessage(null);

    const response = await fetch("/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    const body = await response.json() as { destination?: string; message?: string };

    if (!response.ok || !body.destination) {
      setDemoStatus("error");
      setDemoMessage(body.message ?? "Demo access failed.");
      return;
    }

    router.replace(body.destination);
    router.refresh();
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
        <form className="login-form login-demo-form" onSubmit={submitDemo}>
          <label>
            <span>Demo passcode</span>
            <input
              autoComplete="one-time-code"
              disabled={!configured || demoStatus === "loading"}
              name="passcode"
              onChange={(event) => setPasscode(event.target.value)}
              placeholder="Enter demo passcode"
              type="password"
              value={passcode}
            />
          </label>
          <button
            className="primary-action login-submit"
            disabled={!configured || !passcode || demoStatus === "loading"}
            type="submit"
          >
            {demoStatus === "loading" ? <Loader2 className="spin-icon" size={18} /> : <KeyRound size={18} />}
            <span>{demoStatus === "loading" ? "Opening demo" : "Continue demo"}</span>
            {demoStatus === "loading" ? null : <ArrowRight size={18} />}
          </button>
          {!configured ? (
            <p className="quiet-note">Supabase env is missing. Configure it before public deploy.</p>
          ) : null}
          {demoMessage ? <p className="analysis-alert">{demoMessage}</p> : null}
        </form>
        <div className="login-divider"><span>Real account</span></div>
        <form className="login-form login-email-form" onSubmit={submitMagicLink}>
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
          <span>Demo avoids email limits. Sessions still use Supabase Auth and private rows.</span>
        </div>
      </div>
    </section>
  );
}
