import type { Metadata } from "next";
import { LEGAL, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        {LEGAL.entity} (&ldquo;{LEGAL.business}&rdquo;, &ldquo;we&rdquo;), company number {LEGAL.companyNumber},{" "}
        {LEGAL.address}, is the data controller for your account data. We are registered with the Information
        Commissioner&apos;s Office under number {LEGAL.icoNumber}. Contact us about your data at {LEGAL.email}.
      </p>
      <p>
        For data you put into our services about <strong>other people</strong> (your CRM contacts, callers, booking
        customers, landlords and agents in Deal Pro), you are the controller and we process it on your behalf, only to
        provide the service. You are responsible for having a lawful basis to hold that data.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account details: email address, name, company name and password (stored hashed by our auth provider).</li>
        <li>Billing details: handled by Stripe. We never see or store your full card number.</li>
        <li>
          Service content: what you enter into the CRM, AI Reception (call transcripts and summaries),
          Booking System and Deal Pro (deals, due diligence notes, landlord and sourcer contact details).
        </li>
        <li>Usage records needed to run the service, such as Deal Pro credit usage.</li>
      </ul>

      <h2>Why, and our lawful basis</h2>
      <ul>
        <li>To provide the services you subscribe to: performance of our contract with you.</li>
        <li>To take payment and keep accounting records: contract and legal obligation.</li>
        <li>To keep the service secure and prevent abuse: legitimate interests.</li>
      </ul>
      <p>We do not sell your data and we do not use it for advertising.</p>

      <h2>Who processes it for us</h2>
      <ul>
        <li>Supabase: database and authentication.</li>
        <li>Netlify: hosting.</li>
        <li>Stripe: payments and subscriptions.</li>
        <li>Twilio: phone numbers and calls for AI Reception.</li>
        <li>
          Anthropic: AI processing for AI Reception and Deal Pro. When you use Deal Pro&apos;s advert import or AI
          research, the advert text and your deal&apos;s details (name, area, rents and rates) are sent to Anthropic to
          produce the result. The landlord and sourcer contact details on the &ldquo;Send to sourcer&rdquo; tab are not
          sent.
        </li>
      </ul>
      <p>
        Some of these providers process data outside the UK. Where they do, transfers rely on the UK International Data
        Transfer Addendum, standard contractual clauses or UK adequacy regulations.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and service content while your account is open. Deleting a record in the app deletes it
        from our database. If you ask us to close your account, we delete your content within 30 days, except billing
        records we must keep for up to 6 years for tax purposes.
      </p>

      <h2>Cookies</h2>
      <p>
        We only use cookies that are strictly necessary to keep you signed in and remember your &ldquo;Remember
        me&rdquo; choice. We use no analytics or advertising cookies, so we don&apos;t ask for cookie consent.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask for a copy of your data, or ask us to correct, delete, restrict or transfer it, or object to how we
        use it. Email {LEGAL.email}; we reply within one month. You can also complain to the Information
        Commissioner&apos;s Office at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a>.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit (HTTPS) and at rest. Each account can only access its own records, enforced in the
        database itself. Telephony credentials are additionally encrypted. No system is perfectly secure; if a breach
        affects your data we will tell you and the ICO as the law requires.
      </p>
    </LegalPage>
  );
}
