/**
 * Zoho workspace apps (CRM, Books, One, WorkDrive) used to reuse the first
 * instance's profile for every catalog add. Each app now gets its own profile.
 */

const WORKSPACE_APP_IDS = ['zoho-crm', 'zoho-books', 'zoho-one', 'zoho-workdrive'];

const DEFAULT_LABEL = {
  'zoho-crm': 'CRM',
  'zoho-books': 'Books',
  'zoho-one': 'Zoho One',
  'zoho-workdrive': 'Drive',
};

/**
 * Split extra Zoho workspace instances off a shared profile onto dedicated
 * profiles. The first instance on each profile keeps the existing login.
 *
 * @param {object} settings
 * @param {{ makeProfile: (name: string) => { id: string, name: string, partition: string } }} deps
 */
export function isolateSharedZohoWorkspaceProfiles(settings, { makeProfile } = {}) {
  const next = settings && typeof settings === 'object' ? settings : {};
  if (next.isolateZohoWorkspaceProfilesV1) return next;
  if (typeof makeProfile !== 'function') {
    return { ...next, isolateZohoWorkspaceProfilesV1: true };
  }

  const instances = Array.isArray(next.serviceInstances)
    ? next.serviceInstances
    : [];
  const labels = next.serviceLabels && typeof next.serviceLabels === 'object'
    ? next.serviceLabels
    : {};
  const profiles = Array.isArray(next.profiles) ? [...next.profiles] : [];

  const reassigned = new Map();

  for (const appId of WORKSPACE_APP_IDS) {
    const groups = new Map();
    for (const inst of instances) {
      if (inst?.appId !== appId) continue;
      const pid = String(inst.profileId || 'primary');
      if (!groups.has(pid)) groups.set(pid, []);
      groups.get(pid).push(inst);
    }

    const prefix = DEFAULT_LABEL[appId] || appId;
    for (const group of groups.values()) {
      group.forEach((inst, index) => {
        if (index === 0) return;
        const label =
          String(labels[inst.id]?.name || '').trim() ||
          `${prefix} ${Math.max(1, Number(inst.slot) || index + 1)}`;
        const profile = makeProfile(label);
        profiles.push(profile);
        reassigned.set(inst.id, profile.id);
      });
    }
  }

  const serviceInstances = instances.map((inst) => {
    const profileId = reassigned.get(inst.id);
    if (!profileId) return inst;
    return { ...inst, profileId };
  });

  return {
    ...next,
    isolateZohoWorkspaceProfilesV1: true,
    isolateZohoCrmProfilesV1: true,
    profiles,
    serviceInstances,
  };
}

/** @deprecated Use isolateSharedZohoWorkspaceProfiles */
export function isolateSharedZohoCrmProfiles(settings, deps) {
  return isolateSharedZohoWorkspaceProfiles(settings, deps);
}
