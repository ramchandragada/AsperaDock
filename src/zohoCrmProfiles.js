/**
 * Zoho CRM needs isolated profiles per Hub tab when TLs run two org accounts.
 * Older builds reused the first CRM profile for every CRM tab (shared SSO).
 */

/**
 * Split extra Zoho CRM instances off a shared profile onto dedicated profiles.
 * The first instance on each profile keeps the existing login; extras get a
 * fresh empty partition and must sign in again (typically the second org).
 *
 * @param {object} settings
 * @param {{ makeProfile: (name: string) => { id: string, name: string, partition: string } }} deps
 */
export function isolateSharedZohoCrmProfiles(settings, { makeProfile } = {}) {
  const next = settings && typeof settings === 'object' ? settings : {};
  if (next.isolateZohoCrmProfilesV1) return next;
  if (typeof makeProfile !== 'function') {
    return { ...next, isolateZohoCrmProfilesV1: true };
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
    if (inst?.appId !== 'zoho-crm') continue;
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
        `CRM ${Math.max(1, Number(inst.slot) || index + 1)}`;
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
    isolateZohoCrmProfilesV1: true,
    profiles,
    serviceInstances,
  };
}
