import type { Metadata } from "next";
import { LEGAL, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms are between you and {LEGAL.entity} ({LEGAL.business}), company number {LEGAL.companyNumber},{" "}
        {LEGAL.address}. By creating an account or subscribing you agree to them. Our services are for business use;
        you confirm you are using them for your trade, business or profession.
      </p>

      <h2>Subscriptions and billing</h2>
      <ul>
        <li>Each service is a separate monthly subscription, billed in advance through Stripe.</li>
        <li>You can cancel any time from Billing. You keep access until the end of the period you have paid for.</li>
        <li>We don&apos;t refund part-months, except where the law requires it.</li>
        <li>We give at least 30 days&apos; notice of any price change, by email.</li>
      </ul>

      <h2>Your account and your data</h2>
      <ul>
        <li>Keep your password secure; you are responsible for activity on your account.</li>
        <li>
          You own the content you put in. You give us permission to store and process it only to provide the services
          (see our <a href="/privacy">privacy policy</a>).
        </li>
        <li>
          You must have the right to use any personal data you add about other people, and must not upload anything
          unlawful.
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        Don&apos;t try to access other accounts&apos; data, probe or disrupt the service, get around usage limits or
        credits, resell access, or use AI Reception for unsolicited marketing calls. We may suspend accounts that do.
      </p>

      <h2>Deal Pro</h2>
      <ul>
        <li>
          <strong>Deal Pro is an analysis tool, not advice.</strong> Figures are illustrative models based on the
          numbers and assumptions you enter. They are not forecasts, valuations, or financial, investment, tax, legal
          or planning advice.
        </li>
        <li>
          <strong>AI findings are drafts.</strong> AI research and advert import can be incomplete or wrong. You must
          check every finding against the original source and the landlord&apos;s documents before relying on it or
          passing it to anyone else.
        </li>
        <li>
          <strong>You are responsible for your own compliance.</strong> If you source, introduce or market property
          deals, that includes, where they apply to you: membership of a government-approved property redress scheme,
          anti-money-laundering supervision (for example by HMRC), consumer protection and advertising rules, data
          protection registration, planning rules (including the London 90-night limit), licensing, and the landlord,
          lender and freeholder permissions a deal needs. Deal packs and Deal Notices are templates; have your own
          agreements reviewed by a solicitor.
        </li>
        <li>
          Credits are included with the subscription each month, have no cash value and don&apos;t roll over.
        </li>
      </ul>

      <h2>Availability</h2>
      <p>
        We work to keep the services available and secure, but they are provided &ldquo;as is&rdquo; and may sometimes
        be unavailable for maintenance or reasons outside our control.
      </p>

      <h2>Liability</h2>
      <p>
        Nothing in these terms limits liability for death or personal injury caused by negligence, fraud, or anything
        else that cannot be limited by law. Otherwise, we are not liable for loss of profit, business, deals or
        opportunities, or for decisions you make using the services, and our total liability in any 12 months is
        limited to the subscription fees you paid us in that period.
      </p>

      <h2>Ending the agreement</h2>
      <p>
        You can close your account at any time by emailing {LEGAL.email}. We may end or suspend your account for
        serious or repeated breach of these terms. After closure we delete your content as described in the privacy
        policy.
      </p>

      <h2>Changes and governing law</h2>
      <p>
        We may update these terms; we&apos;ll email you about material changes at least 30 days before they apply.
        These terms are governed by the law of England and Wales, and the courts of England and Wales have exclusive
        jurisdiction.
      </p>
    </LegalPage>
  );
}
