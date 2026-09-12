'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '../lib/auth-context';

interface SettingsDetail {
  siteName: string;
  siteTagline: string | null;
  contactEmail: string;
  bookingEmail: string | null;
  contactPhone: string | null;
  whatsappNumber: string | null;
  addressCity: string | null;
  addressRegion: string | null;
  serviceAreaText: string | null;
  responseTimePromise: string | null;
  maintenanceMode: boolean;
  bookingFormEnabled: boolean;
}

type Values = Record<keyof Omit<SettingsDetail, 'maintenanceMode' | 'bookingFormEnabled'>, string> & {
  maintenanceMode: boolean;
  bookingFormEnabled: boolean;
};

const EMPTY: Values = {
  siteName: '',
  siteTagline: '',
  contactEmail: '',
  bookingEmail: '',
  contactPhone: '',
  whatsappNumber: '',
  addressCity: '',
  addressRegion: '',
  serviceAreaText: '',
  responseTimePromise: '',
  maintenanceMode: false,
  bookingFormEnabled: true,
};

/**
 * The one singleton screen — no list, no create, no delete. The masterplan
 * calls for the full theme/SEO/integration surface; this pass covers the
 * fields an admin actually touches day to day (contact info, WhatsApp,
 * maintenance mode). The rest (default SEO title/description, accent
 * color, feature flags beyond booking) is readable via `GET admin/settings`
 * already and can be added the same way — this is a config addition, not a
 * new screen.
 */
export function SettingsForm(): React.JSX.Element {
  const { request } = useAuth();
  const [values, setValues] = useState<Values>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    request<SettingsDetail>('admin/settings')
      .then((settings) => {
        setValues({
          siteName: settings.siteName,
          siteTagline: settings.siteTagline ?? '',
          contactEmail: settings.contactEmail,
          bookingEmail: settings.bookingEmail ?? '',
          contactPhone: settings.contactPhone ?? '',
          whatsappNumber: settings.whatsappNumber ?? '',
          addressCity: settings.addressCity ?? '',
          addressRegion: settings.addressRegion ?? '',
          serviceAreaText: settings.serviceAreaText ?? '',
          responseTimePromise: settings.responseTimePromise ?? '',
          maintenanceMode: settings.maintenanceMode,
          bookingFormEnabled: settings.bookingFormEnabled,
        });
      })
      .catch(() => {
        setError('Could not load settings.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [request]);

  function setField(name: keyof Values, value: string | boolean): void {
    setValues((current) => ({ ...current, [name]: value }));
    setSaved(false);
  }

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await request('admin/settings', {
        method: 'PATCH',
        body: {
          siteName: values.siteName,
          siteTagline: values.siteTagline || undefined,
          contactEmail: values.contactEmail,
          bookingEmail: values.bookingEmail || undefined,
          contactPhone: values.contactPhone || undefined,
          whatsappNumber: values.whatsappNumber || undefined,
          addressCity: values.addressCity || undefined,
          addressRegion: values.addressRegion || undefined,
          serviceAreaText: values.serviceAreaText || undefined,
          responseTimePromise: values.responseTimePromise || undefined,
          maintenanceMode: values.maintenanceMode,
          bookingFormEnabled: values.bookingFormEnabled,
        },
      });
      setSaved(true);
    } catch {
      setError('Could not save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-fg-muted text-sm">Loading…</p>;

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-h2 text-fg-strong">Settings</h1>
      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        className="mt-6 space-y-4"
      >
        {(
          [
            ['siteName', 'Site name', 'text'],
            ['siteTagline', 'Tagline', 'text'],
            ['contactEmail', 'Contact email', 'email'],
            ['bookingEmail', 'Booking email', 'email'],
            ['contactPhone', 'Contact phone', 'tel'],
            ['whatsappNumber', 'WhatsApp number', 'tel'],
            ['addressCity', 'City', 'text'],
            ['addressRegion', 'Region / state', 'text'],
            ['serviceAreaText', 'Service area (public text)', 'text'],
            ['responseTimePromise', 'Response time promise', 'text'],
          ] as const
        ).map(([name, label, type]) => (
          <div key={name}>
            <label htmlFor={name} className="text-fg-strong text-sm font-medium">
              {label}
            </label>
            <input
              id={name}
              type={type}
              value={values[name]}
              onChange={(event) => {
                setField(name, event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            />
          </div>
        ))}

        <div className="flex items-center gap-2">
          <input
            id="bookingFormEnabled"
            type="checkbox"
            checked={values.bookingFormEnabled}
            onChange={(event) => {
              setField('bookingFormEnabled', event.target.checked);
            }}
            className="h-4 w-4"
          />
          <label htmlFor="bookingFormEnabled" className="text-fg-strong text-sm font-medium">
            Booking form enabled
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="maintenanceMode"
            type="checkbox"
            checked={values.maintenanceMode}
            onChange={(event) => {
              setField('maintenanceMode', event.target.checked);
            }}
            className="h-4 w-4"
          />
          <label htmlFor="maintenanceMode" className="text-fg-strong text-sm font-medium">
            Maintenance mode
          </label>
        </div>

        {error ? (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : null}
        {saved ? <p className="text-sm text-fg-secondary">Saved.</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="bg-accent text-on-accent rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </div>
  );
}
