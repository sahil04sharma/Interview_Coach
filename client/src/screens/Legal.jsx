import { Link } from 'react-router-dom';
import { Page, PageHeader, Panel } from '../components/ui.jsx';

export function Privacy() {
  return (
    <Page className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Legal" title="Privacy" subtitle="How Interview Grove handles your practice data." />
      <Panel className="space-y-3 text-sm leading-relaxed text-[var(--color-muted)]">
        <p>We store your account email, profile, resume text, and interview transcripts to power coaching feedback.</p>
        <p>Audio used for transcription is processed to text and is not kept as a long-term media archive in this MVP.</p>
        <p>Shared report links expose only the finished session summary you choose to share.</p>
        <p>Contact: hello@interviewgrove.app</p>
      </Panel>
    </Page>
  );
}

export function Terms() {
  return (
    <Page className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Legal" title="Terms" subtitle="Simple terms for using Interview Grove." />
      <Panel className="space-y-3 text-sm leading-relaxed text-[var(--color-muted)]">
        <p>Interview Grove is a practice tool. Feedback is coaching guidance, not hiring decisions or certified assessment.</p>
        <p>Do not use the product to cheat in live interviews. Practice honestly.</p>
        <p>Accounts are personal. Keep your credentials private.</p>
        <p>
          Back to <Link to="/" className="font-semibold text-[var(--color-amber)] underline">home</Link>.
        </p>
      </Panel>
    </Page>
  );
}
