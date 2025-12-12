"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { DataTable } from '@workspace/ui/custom/tables/data-table';
import { apiFetch } from '../../../lib/api';

export default function StudentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/students?limit=10');
        if (!res.ok) throw new Error('Failed to load students');
        const json = await res.json();
        setRows(
          json?.data?.map((s: any) => ({
            id: s.id,
            studentNumber: s.studentNumber,
            gradeLevel: s.gradeLevel,
            enrollmentStatus: s.enrollmentStatus,
            email: s.userTenant?.user?.email,
            name: `${s.userTenant?.user?.firstName ?? ''} ${s.userTenant?.user?.lastName ?? ''}`,
          })) ?? [],
        );
      } catch (err: any) {
        setError(err?.message || 'Failed to load students');
      }
    };
    load();
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <DataTable data={rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

