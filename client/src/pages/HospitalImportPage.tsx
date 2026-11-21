import { useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { api, describeApiError } from '../lib/api';

interface Dataset {
  totalBeds: number;
  freeBeds: number;
  bloodStock: { group: string; units: number }[];
  medicineStock: { medicine: string; units: number }[];
}

const TEMPLATE_CSV = `type,name,value
beds,total,120
beds,free,8
blood,O+,6
blood,A+,4
medicine,Adrenaline,25
medicine,Tetanus Toxoid,18
`;

const TEMPLATE_JSON = JSON.stringify(
  {
    totalBeds: 120,
    freeBeds: 8,
    bloodStock: [{ group: 'O+', units: 6 }],
    medicineStock: [{ medicine: 'Adrenaline', units: 25 }],
  },
  null,
  2,
);

function parseCsv(text: string): { dataset: Dataset; errors: string[] } {
  const dataset: Dataset = {
    totalBeds: 0,
    freeBeds: 0,
    bloodStock: [],
    medicineStock: [],
  };
  const errors: string[] = [];
  let sawBeds = false;

  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .forEach((line, index) => {
      const cells = line.split(',').map((cell) => cell.trim());
      if (index === 0 && cells[0]?.toLowerCase() === 'type') return;
      if (cells.length !== 3) {
        errors.push(`Line ${index + 1}: expected three columns (type,name,value).`);
        return;
      }
      const [type, name, rawValue] = cells as [string, string, string];
      const value = Number(rawValue);
      if (!Number.isFinite(value)) {
        errors.push(`Line ${index + 1}: "${rawValue}" is not a number.`);
        return;
      }

      if (type.toLowerCase() === 'beds') {
        if (name.toLowerCase() === 'total') {
          dataset.totalBeds = value;
          sawBeds = true;
        } else if (name.toLowerCase() === 'free') {
          dataset.freeBeds = value;
          sawBeds = true;
        } else {
          errors.push(`Line ${index + 1}: bed row must be "beds,total" or "beds,free".`);
        }
      } else if (type.toLowerCase() === 'blood') {
        dataset.bloodStock.push({ group: name.toUpperCase(), units: value });
      } else if (type.toLowerCase() === 'medicine') {
        dataset.medicineStock.push({ medicine: name, units: value });
      } else {
        errors.push(`Line ${index + 1}: unknown type "${type}".`);
      }
    });

  if (!sawBeds) errors.push('The CSV must include beds,total and beds,free rows.');
  return { dataset, errors };
}

export function HospitalImportPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'CSV' | 'JSON'>('CSV');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsvText(await file.text());
    setError(null);
  };

  const downloadTemplate = () => {
    const blob = new Blob([tab === 'CSV' ? TEMPLATE_CSV : TEMPLATE_JSON], {
      type: tab === 'CSV' ? 'text/csv' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = tab === 'CSV' ? 'goldenhour-dataset.csv' : 'goldenhour-dataset.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importDataset = async () => {
    setError(null);
    setFieldErrors([]);
    setSuccess(null);

    let dataset: Dataset;
    if (tab === 'CSV') {
      if (!csvText.trim()) {
        setError('Choose a CSV file or paste its contents first.');
        return;
      }
      const parsed = parseCsv(csvText);
      if (parsed.errors.length > 0) {
        setFieldErrors(parsed.errors);
        return;
      }
      dataset = parsed.dataset;
    } else {
      try {
        dataset = JSON.parse(jsonText) as Dataset;
      } catch {
        setError('The JSON could not be parsed.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = await api.post<{ message: string }>(
        '/hospital/resources/import',
        dataset,
      );
      setSuccess(response.data.message);
      setTimeout(() => navigate('/hospital/resources'), 1200);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Import hospital dataset"
      subtitle="Load beds, blood and medicine from CSV or JSON"
    >
      <Link
        to="/hospital/resources"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition hover:text-brand-600"
      >
        <ArrowLeft size={14} /> Back to beds & resources
      </Link>

      <PageHeader
        eyebrow="Data onboarding"
        title="Import your full dataset"
        description="The import replaces this hospital's current beds, blood groups and medicines in one transaction. After the first import you can update or add individual values on the resources page."
        action={
          <button type="button" className="btn-secondary !px-4 !py-2" onClick={downloadTemplate}>
            <Download size={15} /> Download {tab} template
          </button>
        }
      />

      {success ? (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <span>{success} Opening resources…</span>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Dataset"
            subtitle="One file or document covering beds, blood and medicine"
            icon={tab === 'CSV' ? FileSpreadsheet : FileJson}
          />
          <div className="card-pad space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-ink-100 p-1">
              {(['CSV', 'JSON'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setTab(option);
                    setError(null);
                    setFieldErrors([]);
                  }}
                  aria-pressed={tab === option}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition ${
                    tab === option
                      ? 'bg-white text-ink-900 shadow-sm'
                      : 'text-ink-500 hover:text-ink-700'
                  }`}
                >
                  {option === 'CSV' ? <FileSpreadsheet size={14} /> : <FileJson size={14} />}
                  {option === 'CSV' ? 'CSV upload' : 'JSON paste'}
                </button>
              ))}
            </div>

            {tab === 'CSV' ? (
              <>
                <label
                  htmlFor="csvFile"
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 bg-canvas/60 px-4 py-8 text-center transition hover:border-brand-300"
                >
                  <Upload size={22} className="text-ink-400" />
                  <span className="text-[12.5px] font-semibold text-ink-700">
                    {fileName || 'Choose a CSV file'}
                  </span>
                  <span className="text-[11px] text-ink-400">
                    Columns: type,name,value - or paste below
                  </span>
                  <input
                    id="csvFile"
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(event) => void readFile(event)}
                  />
                </label>
                <textarea
                  className="input min-h-[180px] font-mono text-[11.5px]"
                  value={csvText}
                  onChange={(event) => setCsvText(event.target.value)}
                  placeholder={TEMPLATE_CSV}
                  aria-label="CSV contents"
                />
              </>
            ) : (
              <textarea
                className="input min-h-[320px] font-mono text-[11.5px]"
                value={jsonText}
                onChange={(event) => setJsonText(event.target.value)}
                placeholder={TEMPLATE_JSON}
                aria-label="JSON dataset"
              />
            )}

            {error ? (
              <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-700">
                <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {error}
              </div>
            ) : null}

            {fieldErrors.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11.5px] text-amber-800">
                <p className="font-semibold">Fix these rows:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {fieldErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              type="button"
              className="btn-primary"
              onClick={() => void importDataset()}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Importing…
                </>
              ) : (
                <>
                  <Upload size={15} /> Import dataset
                </>
              )}
            </button>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="CSV format" subtitle="One row per value" icon={FileSpreadsheet} />
            <div className="card-pad space-y-3">
              <pre className="overflow-x-auto rounded-lg bg-ink-900 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-emerald-200">
{TEMPLATE_CSV}
              </pre>
              <ul className="list-disc space-y-1 pl-4 text-[11.5px] leading-relaxed text-ink-600">
                <li>`beds,total` and `beds,free` are required.</li>
                <li>Blood group must be one of the eight standard groups.</li>
                <li>Medicine names are free text; each is created on import.</li>
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader title="What gets replaced" icon={TriangleAlert} />
            <div className="card-pad text-[11.5px] leading-relaxed text-ink-600">
              <p>
                The import is authoritative. Blood groups and medicines that are not in
                the file are removed, so keep every row you still stock. It runs in one
                transaction: if any row fails validation, nothing changes.
              </p>
              <p className="mt-2">
                Prefer small changes? Use the individual add and edit controls on{' '}
                <Link to="/hospital/resources" className="font-semibold text-brand-700">
                  Beds &amp; resources
                </Link>
                .
              </p>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
