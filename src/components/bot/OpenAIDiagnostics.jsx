import React from 'react';

const fields = [
  ['model', 'Model'],
  ['toolChoice', 'Tool choice'],
  ['webSearchActuallyUsed', 'Web search used'],
  ['responseTimeMs', 'Response time'],
  ['sourceCount', 'Sources'],
  ['parseStatus', 'Parse status'],
  ['jsonSchemaMode', 'JSON schema'],
  ['errorMessage', 'Error'],
];

function displayValue(key, value) {
  if (key === 'responseTimeMs') return `${value ?? 0}ms`;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined || value === '') return 'None';
  return String(value);
}

export function getOpenAIDiagnostics(data = {}) {
  return Object.fromEntries(fields.map(([key]) => [key, data[key] ?? null]));
}

export default function OpenAIDiagnostics({ data }) {
  const diagnostics = getOpenAIDiagnostics(data);
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
      {fields.map(([key, label]) => (
        <div key={key} className="min-w-0">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-mono text-foreground break-words">{displayValue(key, diagnostics[key])}</dd>
        </div>
      ))}
    </dl>
  );
}