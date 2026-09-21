import { ImportWizard } from "./ImportWizard";

export default function ImportPage() {
  return (
    <>
      <div className="card">
        <p className="stat-caption">
          Upload a bank CSV export to bring real transactions into this account. Every row gets a
          suggested category automatically — nothing here is final, everything can be corrected
          afterwards from the Dashboard.
        </p>
      </div>
      <ImportWizard />
    </>
  );
}
