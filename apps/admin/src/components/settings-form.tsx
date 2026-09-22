'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '../lib/auth-context';

import { MediaSelect } from './media/media-select';

interface SettingsDetail {
  siteName: string;
  siteTagline: string | null;
  homeHeroVideoMediaId: string | null;
  homeHeroImageMediaId: string | null;
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
  homeHeroEyebrow: string | null;
  homeHeroHeadline: string | null;
  homeHeroSubheadline: string | null;
  homeClosingHeadline: string | null;
  homeClosingSubheadline: string | null;
  homeShowIdentities: boolean;
  homeShowShows: boolean;
  homeShowDiscography: boolean;
  homeShowResidencies: boolean;
  homeShowVenues: boolean;
  homeShowGallery: boolean;
  homeShowVideos: boolean;
  homeShowServices: boolean;
  homeShowTestimonials: boolean;
}

type BooleanField =
  | 'maintenanceMode'
  | 'bookingFormEnabled'
  | 'homeShowIdentities'
  | 'homeShowShows'
  | 'homeShowDiscography'
  | 'homeShowResidencies'
  | 'homeShowVenues'
  | 'homeShowGallery'
  | 'homeShowVideos'
  | 'homeShowServices'
  | 'homeShowTestimonials'
;

type Values = Record<keyof Omit<SettingsDetail, BooleanField>, string> &
  Record<BooleanField, boolean>;

const EMPTY: Values = {
  siteName: '',
  siteTagline: '',
  homeHeroVideoMediaId: '',
  homeHeroImageMediaId: '',
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
  homeHeroEyebrow: '',
  homeHeroHeadline: '',
  homeHeroSubheadline: '',
  homeClosingHeadline: '',
  homeClosingSubheadline: '',
  homeShowIdentities: true,
  homeShowShows: true,
  homeShowDiscography: true,
  homeShowResidencies: true,
  homeShowVenues: true,
  homeShowGallery: true,
  homeShowVideos: true,
  homeShowServices: true,
  homeShowTestimonials: true,
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
          homeHeroVideoMediaId: settings.homeHeroVideoMediaId ?? '',
          homeHeroImageMediaId: settings.homeHeroImageMediaId ?? '',
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
          homeHeroEyebrow: settings.homeHeroEyebrow ?? '',
          homeHeroHeadline: settings.homeHeroHeadline ?? '',
          homeHeroSubheadline: settings.homeHeroSubheadline ?? '',
          homeClosingHeadline: settings.homeClosingHeadline ?? '',
          homeClosingSubheadline: settings.homeClosingSubheadline ?? '',
          homeShowIdentities: settings.homeShowIdentities,
          homeShowShows: settings.homeShowShows,
          homeShowDiscography: settings.homeShowDiscography,
          homeShowResidencies: settings.homeShowResidencies,
          homeShowVenues: settings.homeShowVenues,
          homeShowGallery: settings.homeShowGallery,
          homeShowVideos: settings.homeShowVideos,
          homeShowServices: settings.homeShowServices,
          homeShowTestimonials: settings.homeShowTestimonials,
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
          homeHeroVideoMediaId: values.homeHeroVideoMediaId || null,
          homeHeroImageMediaId: values.homeHeroImageMediaId || null,
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
          // `|| null`, not `|| undefined`: clearing a headline has to send an
          // explicit null so it falls back to the built-in copy. `undefined`
          // means "leave untouched" on a PATCH, which would make a cleared
          // field un-clearable.
          homeHeroEyebrow: values.homeHeroEyebrow || null,
          homeHeroHeadline: values.homeHeroHeadline || null,
          homeHeroSubheadline: values.homeHeroSubheadline || null,
          homeClosingHeadline: values.homeClosingHeadline || null,
          homeClosingSubheadline: values.homeClosingSubheadline || null,
          homeShowIdentities: values.homeShowIdentities,
          homeShowShows: values.homeShowShows,
          homeShowDiscography: values.homeShowDiscography,
          homeShowResidencies: values.homeShowResidencies,
          homeShowVenues: values.homeShowVenues,
          homeShowGallery: values.homeShowGallery,
          homeShowVideos: values.homeShowVideos,
          homeShowServices: values.homeShowServices,
          homeShowTestimonials: values.homeShowTestimonials,
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

        <MediaSelect
          label="Homepage hero background video"
          value={values.homeHeroVideoMediaId}
          onChange={(value) => {
            setField('homeHeroVideoMediaId', value);
          }}
          mediaType="VIDEO"
          hint="An optional looping, muted background clip for the homepage hero — upload an MP4 on the Media library page first, then pick it here. Leave empty to keep the generated colour background. The homepage isn't tied to one persona, so this is the one place to set it (a persona's own page uses that persona's own hero video field instead)."
        />

        <MediaSelect
          label="Homepage hero background image"
          value={values.homeHeroImageMediaId}
          onChange={(value) => {
            setField('homeHeroImageMediaId', value);
          }}
          mediaType="IMAGE"
          hint="A static fallback for the homepage hero, shown when there's no hero video set above (or for visitors on a reduced-motion / low-power view, which never plays video). Leave empty to keep the generated colour background."
        />

        {/* Homepage.

            The homepage is the product - most booking enquiries come from
            people who never open a second page - so its headings and which
            sections appear belong to the artist, not to a deploy.

            Visibility and copy only, deliberately: section *order* is a
            design decision that the page's flow depends on, so it is not
            exposed as a drag-and-drop list that could be rearranged into
            something that reads badly. A section also hides itself
            automatically when it has no content, so switching one off here
            is for "I have photos but don't want them on the front page",
            not for "I have no photos yet". */}
        <fieldset className="border-border rounded-md border p-4">
          <legend className="text-fg-strong px-2 text-sm font-medium">Homepage</legend>

          <div className="space-y-4">
            {(
              [
                ['homeHeroEyebrow', 'Hero eyebrow', 'Bengaluru · India'],
                ['homeHeroHeadline', 'Hero headline', 'One artist. Four sounds.'],
                ['homeHeroSubheadline', 'Hero subheading', ''],
                ['homeClosingHeadline', 'Closing headline', 'Ready to experience premium audio?'],
                ['homeClosingSubheadline', 'Closing subheading', ''],
              ] as const
            ).map(([name, label, placeholder]) => (
              <div key={name}>
                <label htmlFor={name} className="text-fg-strong text-sm font-medium">
                  {label}
                </label>
                <input
                  id={name}
                  type="text"
                  value={values[name]}
                  placeholder={placeholder || 'Leave blank for the default'}
                  onChange={(event) => {
                    setField(name, event.target.value);
                  }}
                  className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
                />
              </div>
            ))}

            <p className="text-fg-muted pt-2 text-xs">
              Leave any of these blank to use the built-in wording.
            </p>

            <div className="border-border border-t pt-4">
              <p className="text-fg-strong text-sm font-medium">Sections shown on the homepage</p>
              <p className="text-fg-muted mt-1 mb-3 text-xs">
                A section with no content is hidden automatically, whatever these say.
              </p>
              <Toggle
                name="homeShowIdentities"
                label="Musical identities"
                checked={values.homeShowIdentities}
                onChange={(next) => { setField('homeShowIdentities', next); }}
              />
              <Toggle
                name="homeShowShows"
                label="Shows &amp; flyers"
                checked={values.homeShowShows}
                onChange={(next) => { setField('homeShowShows', next); }}
              />
              <Toggle
                name="homeShowDiscography"
                label="Discography"
                checked={values.homeShowDiscography}
                onChange={(next) => { setField('homeShowDiscography', next); }}
              />
              <Toggle
                name="homeShowResidencies"
                label="Residencies"
                checked={values.homeShowResidencies}
                onChange={(next) => { setField('homeShowResidencies', next); }}
              />
              <Toggle
                name="homeShowVenues"
                label="Recently played venues"
                checked={values.homeShowVenues}
                onChange={(next) => { setField('homeShowVenues', next); }}
              />
              <Toggle
                name="homeShowGallery"
                label="Photo gallery"
                checked={values.homeShowGallery}
                onChange={(next) => { setField('homeShowGallery', next); }}
              />
              <Toggle
                name="homeShowVideos"
                label="Videos"
                checked={values.homeShowVideos}
                onChange={(next) => { setField('homeShowVideos', next); }}
              />
              <Toggle
                name="homeShowServices"
                label="What I do (services)"
                checked={values.homeShowServices}
                onChange={(next) => { setField('homeShowServices', next); }}
              />
              <Toggle
                name="homeShowTestimonials"
                label="Stats &amp; testimonials"
                checked={values.homeShowTestimonials}
                onChange={(next) => { setField('homeShowTestimonials', next); }}
              />
            </div>
          </div>
        </fieldset>

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

/** One labelled checkbox. Nine of these in a row is worth not repeating. */
function Toggle({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 py-1">
      <input
        id={name}
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="h-4 w-4"
      />
      <label htmlFor={name} className="text-fg-secondary text-sm">
        {label}
      </label>
    </div>
  );
}
