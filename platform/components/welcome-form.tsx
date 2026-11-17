import Link from "next/link";
import { saveSchoolSetup } from "@/app/teacher/actions";
import type { School } from "@/lib/types";

const COUNTRIES: [string, string][] = [
  ["QA", "Qatar"],
  ["AE", "United Arab Emirates"],
  ["SA", "Saudi Arabia"],
  ["BH", "Bahrain"],
  ["KW", "Kuwait"],
  ["OM", "Oman"],
  ["GB", "United Kingdom"],
  ["FR", "France"],
  ["AU", "Australia"],
  ["US", "United States"],
];

const JOB_TITLES = [
  "Principal or Head of School",
  "Head of Primary or Deputy Head",
  "ECA or co-curricular coordinator",
  "Head of Digital Learning or Innovation",
  "Teacher",
  "Other",
];

type Props = {
  school: Pick<School, "name" | "city" | "country"> | null;
  displayName: string | null;
  jobTitle: string | null;
  email: string | null;
  editing: boolean;
  error?: string;
};

/** The admin's welcome screen: confirm the school and who they are. */
export function WelcomeForm({ school, displayName, jobTitle, email, editing, error }: Props) {
  const countryKnown = COUNTRIES.some(([code]) => code === school?.country);
  return (
    <main className="page welcome-page">
      <div className="page-head">
        <div className="page-intro">
          {editing ? (
            <p className="section-label">
              <Link href="/teacher/school">School</Link> · Details
            </p>
          ) : (
            <p className="section-label">Welcome to Candide</p>
          )}
          <h1>{editing ? "School details" : `Let’s get ${school?.name ?? "your school"} ready`}</h1>
          <p className="page-sub">
            {editing
              ? "Your school’s name and city appear on the club descriptions for parents."
              : "Two things before you start: confirm your school and tell us who you are. Next, you’ll create your club groups, choose who runs each one and when each one starts."}
          </p>
        </div>
      </div>

      <form action={saveSchoolSetup} className="card card-pad stack" style={{ gap: 22 }}>
        <input type="hidden" name="editing" value={editing ? "1" : "0"} />
        {error === "missing" && (
          <div className="notice notice-error">
            <span>The school name and your name are needed.</span>
          </div>
        )}

        <fieldset className="stack" style={{ gap: 14, border: 0, padding: 0, margin: 0 }}>
          <legend className="section-label" style={{ marginBottom: 10 }}>
            1 · Your school
          </legend>
          <div className="field">
            <label className="label" htmlFor="school_name">
              School name
            </label>
            <input className="input" id="school_name" name="school_name" required maxLength={120} defaultValue={school?.name ?? ""} />
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="city">
                City
              </label>
              <input className="input" id="city" name="city" maxLength={80} placeholder="Doha" defaultValue={school?.city ?? ""} />
            </div>
            <div className="field">
              <label className="label" htmlFor="country">
                Country
              </label>
              <select className="input" id="country" name="country" defaultValue={school?.country ?? ""}>
                <option value="">Select</option>
                {COUNTRIES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
                {school?.country && !countryKnown && <option value={school.country}>{school.country}</option>}
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="stack" style={{ gap: 14, border: 0, padding: 0, margin: 0 }}>
          <legend className="section-label" style={{ marginBottom: 10 }}>
            2 · You
          </legend>
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="display_name">
                Your name
              </label>
              <input className="input" id="display_name" name="display_name" required maxLength={60} placeholder="Ms Khan" defaultValue={displayName ?? ""} />
            </div>
            <div className="field">
              <label className="label" htmlFor="job_title">
                Your role
              </label>
              <select className="input" id="job_title" name="job_title" defaultValue={jobTitle ?? ""}>
                <option value="">Select</option>
                {JOB_TITLES.map((title) => (
                  <option key={title}>{title}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="caption">You sign in as {email}. You&rsquo;re the school admin: you create the clubs and choose who runs them.</p>
        </fieldset>

        <div className="actions">
          <button className="btn btn-primary" type="submit">
            {editing ? "Save details" : "Continue"}
          </button>
          {editing && (
            <Link className="btn" href="/teacher/school">
              Cancel
            </Link>
          )}
        </div>
      </form>
    </main>
  );
}
