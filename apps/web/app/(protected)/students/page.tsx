"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { DataTable, schema } from '@workspace/ui/custom/tables/data-table';
import { z } from 'zod';
import { apiFetch } from '../../../lib/api';



interface UserTenant {
  id: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface Student {
  id: string;
  studentNumber: string;
  gradeLevel: string;
  enrollmentStatus: string;
  userTenant: UserTenant;
}



export default function StudentsPage() {
  const [rows, setRows] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/students?limit=10');
        if (!res.ok) throw new Error('Failed to load students');
        const json = await res.json();
        setRows(
          json?.data?.map((s: Student) => ({
            id: s.id,
            studentNumber: s.studentNumber,
            gradeLevel: s.gradeLevel,
            enrollmentStatus: s.enrollmentStatus,
            email: s.userTenant?.user?.email,
            name: `${s.userTenant?.user?.firstName ?? ''} ${s.userTenant?.user?.lastName ?? ''}`,
          })) ?? [],
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load students');
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
            <DataTable data={rows as unknown as z.infer<typeof schema>[]} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

