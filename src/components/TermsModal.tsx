import React from 'react';
import { X, ShieldCheck, FileText } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

export const TermsModal: React.FC<TermsModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  showAcceptButton = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#15171a] text-slate-900 dark:text-white rounded-3xl border border-white/80 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden neumorphic-card">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 dark:bg-sky-400/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-inner">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-quantum font-black tracking-tight text-slate-900 dark:text-white">
                Terms of Service & Privacy Policy
              </h2>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-semibold">
                LERGON • ZAR LABS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full neumorphic-circle border border-white/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer bg-slate-100 dark:bg-slate-800 shadow-sm"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans scrollbar-thin">
          <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 text-[11px] text-sky-900 dark:text-sky-200 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <FileText size={14} />
              <span>Official Regulatory & Operational Agreement</span>
            </div>
            <p>
              Please read these Terms of Service and Privacy Policy carefully. By creating an account or using LERGON, you agree to be legally bound by these terms.
            </p>
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">1. Introduction</h3>
            <p>
              Welcome to LERGON (&ldquo;LERGON,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), a multi-tenant business and inventory management platform provided by ZAR LABS to retail and small-to-medium enterprises (&ldquo;Businesses,&rdquo; &ldquo;Organizations,&rdquo; or &ldquo;you&rdquo;). These Terms of Service and Privacy Policy (together, the &ldquo;Terms&rdquo;) govern your access to and use of the LERGON web and mobile application (the &ldquo;App&rdquo;), including all features such as inventory management, sales tracking, multi-user roles, and the AI assistant &ldquo;RICHARD.&rdquo;
            </p>
            <p>
              By creating an account, accessing, or using LERGON, you agree to be bound by these Terms. If you do not agree, do not use the App.
            </p>
            <div className="text-xs bg-slate-100 dark:bg-slate-900/70 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
              <p><strong>Data Controller:</strong> ZAR LABS / LERGON</p>
              <p><strong>Contact:</strong> support@zarlabs.io</p>
              <p><strong>Location:</strong> Ghana</p>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">2. Definitions</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>&ldquo;Account&rdquo;</strong> means the registered workspace created by an Organization within LERGON.</li>
              <li><strong>&ldquo;Admin&rdquo;</strong> means a user assigned Role 2, with elevated administrative privileges over an Organization&rsquo;s Account.</li>
              <li><strong>&ldquo;Attendant&rdquo;</strong> means a user assigned Role 5, with restricted operational access.</li>
              <li><strong>&ldquo;Business Data&rdquo;</strong> means all data an Organization inputs into or generates through LERGON, including inventory records, sales transactions, pricing, supplier information, and staff records.</li>
              <li><strong>&ldquo;Personal Data&rdquo;</strong> means any information relating to an identified or identifiable natural person, as defined under Ghana&rsquo;s Data Protection Act, 2012 (Act 843) and, where applicable, the EU GDPR.</li>
              <li><strong>&ldquo;Sub-processor&rdquo;</strong> means a third-party service provider engaged by LERGON to process data on our behalf (see Section 7).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">3. Eligibility and Account Registration</h3>
            <p>3.1. You must be at least 18 years old, or the age of legal majority in your jurisdiction, to register an Organization Account.</p>
            <p>3.2. Organizations onboard Attendants via an invite-PIN mechanism. The Admin is responsible for the accuracy of information provided and for managing Attendant access within their Organization.</p>
            <p>3.3. Each Organization operates as an isolated tenant. LERGON implements reasonable technical safeguards to logically separate one Organization&rsquo;s Business Data from another&rsquo;s, but no system can guarantee absolute isolation, and you acknowledge this as an inherent risk of multi-tenant software.</p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">4. What Data We Collect</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>4.1 Account & Identity Data:</strong> Name, email, phone number, business name, role (Admin/Attendant), and authentication credentials.</li>
              <li><strong>4.2 Business Data:</strong> Inventory records, product listings, pricing, sales and transaction history, supplier details, and other operational records.</li>
              <li><strong>4.3 Usage & Device Data:</strong> Log data, device identifiers, IP address, app interaction data, and diagnostic/crash data, collected automatically to maintain and improve the App.</li>
              <li><strong>4.4 AI Interaction Data:</strong> Prompts, queries, and responses exchanged with the RICHARD AI assistant, which may include Business Data referenced in those interactions.</li>
              <li><strong>4.5 Payment Data (if applicable):</strong> Where subscription payments apply, billing details are processed via licensed third-party processors; LERGON does not directly store full payment card numbers.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">5. Legal Basis and Purpose of Processing</h3>
            <p>We process Personal Data on the following legal bases, consistent with Ghana&rsquo;s Data Protection Act, 2012 (Act 843) and GDPR Article 6:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Consent</strong> — where you have explicitly agreed to specific processing.</li>
              <li><strong>Contractual necessity</strong> — to provide the core services of the App, including account provisioning, inventory tracking, and reporting.</li>
              <li><strong>Legitimate interest</strong> — for fraud prevention, service security, product improvement, and analytics.</li>
              <li><strong>Legal obligation</strong> — where processing is required to comply with applicable law, tax, or regulatory requirements.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">6. Our Commitment: No Sale or Disclosure of Your Data</h3>
            <p className="font-semibold text-slate-900 dark:text-white">
              We do not sell, rent, or trade your Business Data or Personal Data to any third party. We do not disclose your data to other Organizations, advertisers, or data brokers for their own independent purposes.
            </p>
            <p>
              Business Data belongs to the Organization that created it. LERGON accesses Business Data only: (a) as strictly necessary to operate and support the App; (b) with your explicit permission; or (c) where required by a valid legal order.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">7. Sub-processors (Important Disclosure)</h3>
            <p>
              To operate LERGON, we rely on trusted infrastructure providers who process data strictly on our behalf under contractual confidentiality and data protection obligations:
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-900 font-bold">
                  <tr>
                    <th className="p-2.5 border-b border-slate-200 dark:border-slate-800">Category</th>
                    <th className="p-2.5 border-b border-slate-200 dark:border-slate-800">Purpose</th>
                    <th className="p-2.5 border-b border-slate-200 dark:border-slate-800">Example Provider</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td className="p-2.5">Database & Backend Hosting</td>
                    <td className="p-2.5">Secure storage of Business & Account Data</td>
                    <td className="p-2.5 font-mono">Supabase</td>
                  </tr>
                  <tr>
                    <td className="p-2.5">AI Processing</td>
                    <td className="p-2.5">Powering RICHARD AI assistant responses</td>
                    <td className="p-2.5 font-mono">Google (Gemini API)</td>
                  </tr>
                  <tr>
                    <td className="p-2.5">Application Deployment</td>
                    <td className="p-2.5">Serving the web and mobile app</td>
                    <td className="p-2.5 font-mono">Vercel</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">8. International Data Transfers</h3>
            <p>
              Where Sub-processors process data outside Ghana, transfers are conducted in compliance with Act 843 (Section 18) and GDPR Chapter V, utilizing standard contractual clauses and rigorous technical protections.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">9. Data Retention and Deletion</h3>
            <p>9.1. We retain Business Data for as long as your Organization Account remains active, and for a reasonable recovery period thereafter.</p>
            <p>9.2. Upon account termination and a written deletion request, we will delete or anonymize Personal Data and Business Data within 30 to 90 days, except where statutory retention is required (e.g. tax records).</p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">10. Your Rights as a Data Subject</h3>
            <p>Under Act 843 (Sections 34–39) and applicable GDPR regulations, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access, correct, or request erasure of your Personal Data;</li>
              <li>Restrict or object to specific processing;</li>
              <li>Request structured data portability;</li>
              <li>Withdraw consent at any time;</li>
              <li>Lodge a complaint with Ghana&rsquo;s Data Protection Commission (DPC).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">11. Data Security</h3>
            <p>
              We implement industry-standard technical measures including encryption in transit, role-based access controls (Admin vs. Attendant), and authentication safeguards. In the event of a security breach, affected Organizations and the Data Protection Commission will be notified without undue delay.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">12. AI Assistant (RICHARD) Disclosure</h3>
            <p>
              RICHARD processes queries and business context to generate insights. Outputs are automated and may occasionally contain inaccuracies. Users must independently verify AI recommendations before relying on them for material business decisions.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">13. Limitation of Liability</h3>
            <p>
              LERGON is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. To the maximum extent permitted by Ghanaian and applicable law, LERGON, ZAR LABS, and its developers disclaim liability for indirect, consequential, or punitive damages, including operational decisions made based on reports or AI suggestions, third-party internet or provider outages, and acts of force majeure.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">14. Organization Responsibilities</h3>
            <p>
              Where you input data of your customers, suppliers, or staff into LERGON, you act as the data controller and LERGON acts as a data processor. You must ensure you have lawful basis and required notices under Act 843.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">15. Governing Law & Contact</h3>
            <p>
              These Terms are governed by the laws of the Republic of Ghana. For queries, contact us at <strong>support@zarlabs.io</strong>.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Data Protection Commission (Ghana): <a href="https://www.dataprotection.org.gh" target="_blank" rel="noreferrer" className="text-sky-600 dark:text-sky-400 underline">www.dataprotection.org.gh</a>
            </p>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl neumorphic-btn border border-white/80 dark:border-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white transition cursor-pointer"
          >
            Close
          </button>
          {showAcceptButton && (
            <button
              type="button"
              onClick={() => {
                onAccept?.();
                onClose();
              }}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-extrabold text-xs shadow-md hover:from-sky-600 hover:to-blue-700 transition cursor-pointer"
            >
              I Understand & Agree
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default TermsModal;
