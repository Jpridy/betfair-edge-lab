import React from 'react';
import { useApp } from '@/lib/AppContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function ValueCell({ value }) {
  return <span className="font-mono text-xs">{JSON.stringify(value)}</span>;
}

export default function EffectiveSettingsTable() {
  const { effectiveSettings } = useApp();
  const rows = effectiveSettings?.linkage || [];

  return (
    <div className="overflow-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Setting</TableHead>
            <TableHead>Stored</TableHead>
            <TableHead>Effective</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Engine consumers</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(item => {
            const status = item.validationError
              ? item.validationError
              : item.deprecated
                ? 'DEPRECATED'
                : item.linked
                  ? 'LINKED'
                  : 'UNLINKED';
            const tone = item.validationError
              ? 'text-danger'
              : item.deprecated
                ? 'text-warning'
                : item.linked
                  ? 'text-success'
                  : 'text-muted-foreground';

            return (
              <TableRow key={`${item.source}.${item.settingKey}`}>
                <TableCell>{item.displayName}</TableCell>
                <TableCell><ValueCell value={item.storedValue} /></TableCell>
                <TableCell><ValueCell value={item.effectiveValue} /></TableCell>
                <TableCell>{item.unit}</TableCell>
                <TableCell>{item.source}</TableCell>
                <TableCell className="text-xs">{item.engineConsumers.join(', ')}</TableCell>
                <TableCell className={`text-xs font-semibold ${tone}`}>{status}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
