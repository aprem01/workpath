export interface SkillData {
  normalizedTerm: string;
  category: string;
  proficiencyLevel: string;
  rawInput: string;
  isAISuggested: boolean;
}

export interface SkillProfile {
  id: string;
  name: string;
  skills: SkillData[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfilesState {
  activeProfileId: string | null;
  profiles: SkillProfile[];
}

const PROFILES_KEY = "workpath_profiles";
const SKILLS_KEY = "workpath_skills";

export function getProfilesState(): ProfilesState {
  if (typeof window === "undefined") return { activeProfileId: null, profiles: [] };
  const raw = localStorage.getItem(PROFILES_KEY);
  if (!raw) return { activeProfileId: null, profiles: [] };
  try {
    return JSON.parse(raw);
  } catch {
    return { activeProfileId: null, profiles: [] };
  }
}

export function saveProfilesState(state: ProfilesState): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(state));
}

export function createProfile(name: string, skills: SkillData[]): SkillProfile {
  return {
    id: crypto.randomUUID(),
    name,
    skills,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function addProfile(name: string, skills: SkillData[]): ProfilesState {
  const state = getProfilesState();
  const profile = createProfile(name, skills);
  state.profiles.push(profile);
  state.activeProfileId = profile.id;
  saveProfilesState(state);
  localStorage.setItem(SKILLS_KEY, JSON.stringify(skills));
  return state;
}

export function updateProfile(
  id: string,
  updates: { name?: string; skills?: SkillData[] }
): ProfilesState {
  const state = getProfilesState();
  const idx = state.profiles.findIndex((p) => p.id === id);
  if (idx === -1) return state;
  if (updates.name) state.profiles[idx].name = updates.name;
  if (updates.skills) state.profiles[idx].skills = updates.skills;
  state.profiles[idx].updatedAt = new Date().toISOString();
  saveProfilesState(state);
  // If updating the active profile's skills, sync to workpath_skills
  if (updates.skills && state.activeProfileId === id) {
    localStorage.setItem(SKILLS_KEY, JSON.stringify(updates.skills));
  }
  return state;
}

export function deleteProfile(id: string): ProfilesState {
  const state = getProfilesState();
  state.profiles = state.profiles.filter((p) => p.id !== id);
  if (state.activeProfileId === id) {
    state.activeProfileId = state.profiles[0]?.id || null;
    if (state.activeProfileId) {
      const active = state.profiles.find((p) => p.id === state.activeProfileId);
      if (active) {
        localStorage.setItem(SKILLS_KEY, JSON.stringify(active.skills));
      }
    } else {
      localStorage.removeItem(SKILLS_KEY);
    }
  }
  saveProfilesState(state);
  return state;
}

export function switchProfile(id: string): ProfilesState {
  const state = getProfilesState();
  const profile = state.profiles.find((p) => p.id === id);
  if (!profile) return state;
  state.activeProfileId = id;
  saveProfilesState(state);
  localStorage.setItem(SKILLS_KEY, JSON.stringify(profile.skills));
  return state;
}

export function syncCurrentSkillsToActiveProfile(): void {
  const state = getProfilesState();
  if (!state.activeProfileId) return;
  const raw = localStorage.getItem(SKILLS_KEY);
  if (!raw) return;
  const skills: SkillData[] = JSON.parse(raw);
  const idx = state.profiles.findIndex((p) => p.id === state.activeProfileId);
  if (idx === -1) return;
  state.profiles[idx].skills = skills;
  state.profiles[idx].updatedAt = new Date().toISOString();
  saveProfilesState(state);
}

export function migrateIfNeeded(): ProfilesState {
  const state = getProfilesState();
  if (state.profiles.length > 0) return state;
  const raw = localStorage.getItem(SKILLS_KEY);
  if (!raw) return state;
  try {
    const skills: SkillData[] = JSON.parse(raw);
    if (skills.length > 0) {
      return addProfile("My Skills", skills);
    }
  } catch {
    // ignore
  }
  return state;
}
