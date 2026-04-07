'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { Settings as SettingsIcon, Save, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface SettingsData {
  rateLimit: number;
  maxFileSizeMB: number;
  aiModel: string;
  aiTemperature: number;
  maxConcurrentUsers: number;
  uptimeTarget: number;
}

const DEFAULTS: SettingsData = {
  rateLimit: 20,
  maxFileSizeMB: 20,
  aiModel: 'gpt-4.5-preview',
  aiTemperature: 0.4,
  maxConcurrentUsers: 15,
  uptimeTarget: 90,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get<SettingsData>('/settings')
      .then(({ data }) => setSettings(data))
      .catch(() => setSettings(DEFAULTS))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/settings', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto" data-testid="settings-page">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Admin Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <CardTitle>System Configuration</CardTitle>
          <CardDescription>System-wide settings applied to all users. Changes take effect immediately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Rate Limit (parses/hour)</label>
              <input
                type="number"
                value={settings.rateLimit}
                onChange={(e) => updateField('rateLimit', Number(e.target.value))}
                min={1}
                max={100}
                className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="setting-rate-limit"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Max File Size (MB)</label>
              <input
                type="number"
                value={settings.maxFileSizeMB}
                onChange={(e) => updateField('maxFileSizeMB', Number(e.target.value))}
                min={1}
                max={100}
                className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="setting-max-file-size"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">AI Model</label>
              <input
                type="text"
                value={settings.aiModel}
                onChange={(e) => updateField('aiModel', e.target.value)}
                className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="setting-ai-model"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">AI Temperature</label>
              <input
                type="number"
                value={settings.aiTemperature}
                onChange={(e) => updateField('aiTemperature', Number(e.target.value))}
                min={0}
                max={2}
                step={0.1}
                className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="setting-ai-temp"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Max Concurrent Users</label>
              <input
                type="number"
                value={settings.maxConcurrentUsers}
                onChange={(e) => updateField('maxConcurrentUsers', Number(e.target.value))}
                min={1}
                max={1000}
                className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="setting-concurrent"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Uptime Target (%)</label>
              <input
                type="number"
                value={settings.uptimeTarget}
                onChange={(e) => updateField('uptimeTarget', Number(e.target.value))}
                min={50}
                max={100}
                className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="setting-uptime"
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} data-testid="btn-save-settings">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save Settings
          </Button>
          {saved && <p className="text-sm text-green-600">Settings saved successfully.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
