import type { ReactNode } from "react";
import { ClipboardList, MailOpen, MessageSquare } from "lucide-react";

type AuthLayoutProps = {
  title: string;
  description?: string;
  children: ReactNode;
  clientSignIn?: boolean;
};

function ClientSignInLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <main className="rt-auth-workspace rt-client-sign-in flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b bg-card px-5 py-4 sm:px-8 lg:px-12">
        <img src="/right-tracker-logo.png" alt="Right Tracker" className="h-11 w-auto rounded-md bg-white object-contain sm:h-12" />
        <p className="hidden border-l pl-3 text-xs text-muted-foreground sm:block">Customer support portal</p>
      </header>

      <div className="grid flex-1 grid-rows-[auto_1fr] md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:grid-rows-1">
        <section className="row-start-1 flex items-center px-5 py-8 sm:px-8 md:col-start-2 lg:px-12 lg:py-12">
          <div className="mx-auto w-full max-w-md">
            <header className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
              {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
            </header>
            {children}
          </div>
        </section>

        <section className="rt-client-sign-in-guide row-start-2 flex flex-col justify-center gap-8 md:gap-12 bg-[var(--rt-nav-bg)] px-5 py-6 text-[var(--rt-nav-text)] sm:px-8 md:col-start-1 md:row-start-1 lg:px-14 lg:py-12" aria-label="Portal guide">
          <div className="mx-auto hidden w-full max-w-md md:block">
            <h2 className="max-w-[14ch] text-3xl font-semibold leading-tight tracking-tight text-white lg:text-5xl">Support for your projects</h2>
            <ul className="mt-7 space-y-4 text-sm">
              <li className="flex items-center gap-3"><ClipboardList className="size-5 shrink-0 text-[var(--rt-nav-active-text)]" aria-hidden="true" /> Submit and track requests</li>
              <li className="flex items-center gap-3"><MessageSquare className="size-5 shrink-0 text-[var(--rt-nav-active-text)]" aria-hidden="true" /> Reply to your support team</li>
            </ul>
          </div>
          <div className="mx-auto flex w-full max-w-md items-start gap-3 md:rounded-xl md:border md:border-white/15 md:bg-black/10 md:p-4">
            <MailOpen className="mt-0.5 size-5 shrink-0 text-[var(--rt-nav-active-text)]" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-white">First time here?</h2>
              <p className="mt-1 text-sm leading-relaxed">Open your invitation email to set your password. Need an invitation? Ask your Right Tracker administrator.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function AuthLayout({ title, description, children, clientSignIn = false }: AuthLayoutProps) {
  if (clientSignIn) return <ClientSignInLayout title={title} description={description}>{children}</ClientSignInLayout>;

  return (
    <main className="rt-auth-workspace min-h-dvh bg-background text-foreground md:grid md:grid-cols-[minmax(0,44%)_minmax(0,1fr)]">
      <section aria-label="Right Tracker" className="flex flex-col bg-[var(--rt-nav-bg)] px-6 py-6 text-[var(--rt-nav-text)] md:px-10 md:py-9 xl:px-14">
        <img src="/right-tracker-logo.png" alt="Right Tracker" className="h-12 w-auto self-start rounded-md bg-white object-contain md:h-14" />
        <div className="hidden flex-1 items-center py-12 md:flex">
          <div className="max-w-sm">
            <p className="text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">Staff support workspace</p>
            <p className="mt-4 max-w-[29ch] text-base leading-relaxed text-[var(--rt-nav-muted)]">
              Review requests, assign tickets, and follow each issue through to resolution.
            </p>
          </div>
        </div>
      </section>
      <section className="flex items-center justify-center px-4 py-8 sm:px-8 md:py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <header className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
              {description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>}
            </header>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
