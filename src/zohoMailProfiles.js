/**
 * Zoho Mail is a mailbox product — each Hub tab needs its own cookie jar,
 * like Gmail. Older builds put every Zoho Mail instance on one shared profile
 * (same as CRM/Books workspace SSO), so KYC + Compliance logged in/out together.
 */

/**
 * Split extra Zoho Mail instances off a shared profile onto dedicated profiles.
 * The first instance on each profile keeps the existing login; extras get a
 * fresh empty partition and must sign in again.
 *
 * @param {object} settings
 * @param {{ makeProfile: (name: string) => { id: string, name: string, partition: string } }} deps
 */
export function isolateSharedZohoMailProfiles(settings, { makeProfile } = {}) {
  const next = settings && typeof settings === 'object' ? settings : {};
  if (next.isolateZohoMailProfilesV1) return next;
  if (typeof makeProfile !== 'function') {
    return { ...next, isolateZohoMailProfilesV1: true };
  }

  const instances = Array.isArray(next.serviceInstances)
    ? next.serviceInstances
    : [];
  const labels = next.serviceLabels && typeof next.serviceLabels === 'object'
    ? next.serviceLabels
    : {};
  const profiles = Array.isArray(next.profiles) ? [...next.profiles] : [];

  const groups = new Map();
  for (const inst of instances) {
    if (inst?.appId !== 'zoho-mail') continue;
    const pid = String(inst.profileId || 'primary');
    if (!groups.has(pid)) groups.set(pid, []);
    groups.get(pid).push(inst);
  }

  const reassigned = new Map();
  for (const group of groups.values()) {
    group.forEach((inst, index) => {
      if (index === 0) return;
      const label =
        String(labels[inst.id]?.name || '').trim() ||
        `Zoho Mail ${Math.max(1, Number(inst.slot) || index + 1)}`;
      const profile = makeProfile(label);
      profiles.push(profile);
      reassigned.set(inst.id, profile.id);
    });
  }

  const serviceInstances = instances.map((inst) => {
    const profileId = reassigned.get(inst.id);
    if (!profileId) return inst;
    return { ...inst, profileId };
  });

  return {
    ...next,
    isolateZohoMailProfilesV1: true,
    profiles,
    serviceInstances,
  };
}
