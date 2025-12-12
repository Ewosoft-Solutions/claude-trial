"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { ChartAreaInteractive } from '@workspace/ui/custom/charts/chart-area-interactive';
import { DataTable } from '@workspace/ui/custom/tables/data-table';
import { SectionCards } from '@workspace/ui/custom/sections/section-cards';
import data from '../../data.json';
import { apiFetch } from '../../../lib/api';

type DashboardMetrics = {
  students: number;
  classes: number;
  assessments: number;
  messages: number;
  announcements: number;
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch('/reports/dashboard');
        if (!res.ok) throw new Error('Failed to load dashboard');
        const json = await res.json();
        setMetrics(json);
      } catch (err: any) {
        setError(err?.message || 'Failed to load dashboard');
      }
    };
    load();
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Students</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {metrics.students}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Classes</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {metrics.classes}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Assessments</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {metrics.assessments}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Messages</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {metrics.messages}
              </CardContent>
            </Card>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {error ?? 'Loading dashboard...'}
          </p>
        )}
      </div>

      <SectionCards />
      <div className="px-0 lg:px-0">
        <ChartAreaInteractive />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sample Data</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable data={data} />
        </CardContent>
      </Card>
    </div>
  );
}

