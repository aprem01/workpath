"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Plus,
  Check,
  Pencil,
  Trash2,
  X,
  User,
} from "lucide-react";
import {
  getProfilesState,
  addProfile,
  switchProfile,
  updateProfile,
  deleteProfile,
  type SkillData,
  type SkillProfile,
} from "@/lib/profiles";

interface ProfileSelectorProps {
  currentSkills: SkillData[];
  onProfileSwitch: (skills: SkillData[]) => void;
  onEditSkills: () => void;
}

export default function ProfileSelector({
  currentSkills,
  onProfileSwitch,
  onEditSkills,
}: ProfileSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [profiles, setProfiles] = useState<SkillProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isNaming, setIsNaming] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshState = () => {
    const state = getProfilesState();
    setProfiles(state.profiles);
    setActiveId(state.activeProfileId);
  };

  useEffect(() => {
    refreshState();
  }, []);

  useEffect(() => {
    if ((isNaming || renamingId) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isNaming, renamingId]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsNaming(false);
        setRenamingId(null);
        setDeletingId(null);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const activeProfile = profiles.find((p) => p.id === activeId);

  const handleSaveNew = () => {
    const name = nameInput.trim() || `Profile ${profiles.length + 1}`;
    const state = addProfile(name, currentSkills);
    setProfiles(state.profiles);
    setActiveId(state.activeProfileId);
    setIsNaming(false);
    setNameInput("");
  };

  const handleRename = (id: string) => {
    if (!nameInput.trim()) return;
    const state = updateProfile(id, { name: nameInput.trim() });
    setProfiles(state.profiles);
    setRenamingId(null);
    setNameInput("");
  };

  const handleSwitch = (id: string) => {
    const state = switchProfile(id);
    setProfiles(state.profiles);
    setActiveId(state.activeProfileId);
    const profile = state.profiles.find((p) => p.id === id);
    if (profile) onProfileSwitch(profile.skills);
    setIsOpen(false);
  };

  const handleDelete = (id: string) => {
    const state = deleteProfile(id);
    setProfiles(state.profiles);
    setActiveId(state.activeProfileId);
    setDeletingId(null);
    if (state.activeProfileId) {
      const active = state.profiles.find((p) => p.id === state.activeProfileId);
      if (active) onProfileSwitch(active.skills);
    } else {
      onProfileSwitch([]);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 hover:border-gray-300 transition-colors"
      >
        <User size={14} className="text-gray-500" />
        <span className="text-gray-700 max-w-[120px] truncate">
          {activeProfile?.name || "My Skills"}
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-72 bg-white rounded-xl border border-gray-200 shadow-lg z-30 overflow-hidden animate-fade-in">
          <div className="p-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Skill Profiles
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {profiles.map((profile) => (
              <div key={profile.id}>
                {/* Delete confirmation */}
                {deletingId === profile.id ? (
                  <div className="p-3 bg-red-50 border-b border-red-100">
                    <p className="text-sm text-red-800 mb-2">
                      Delete &quot;{profile.name}&quot;?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(profile.id)}
                        className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-3 py-1.5 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : renamingId === profile.id ? (
                  /* Rename form */
                  <div className="p-3 border-b border-gray-100">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRename(profile.id);
                      }}
                      className="flex gap-2"
                    >
                      <input
                        ref={inputRef}
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder={profile.name}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-teal-primary focus:ring-1 focus:ring-teal-primary/20 outline-none"
                      />
                      <button
                        type="submit"
                        className="px-2 py-1.5 bg-teal-primary text-white rounded-lg hover:bg-teal-700"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(null);
                          setNameInput("");
                        }}
                        className="px-2 py-1.5 text-gray-400 hover:text-gray-600"
                      >
                        <X size={14} />
                      </button>
                    </form>
                  </div>
                ) : (
                  /* Normal row */
                  <div
                    className={`flex items-center gap-3 p-3 border-b border-gray-50 cursor-pointer transition-colors ${
                      activeId === profile.id
                        ? "bg-teal-primary/5"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className="flex-1 min-w-0"
                      onClick={() => handleSwitch(profile.id)}
                    >
                      <div className="flex items-center gap-2">
                        {activeId === profile.id && (
                          <Check size={14} className="text-teal-primary shrink-0" />
                        )}
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {profile.name}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {profile.skills.length} skill
                        {profile.skills.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setRenamingId(profile.id);
                          setNameInput(profile.name);
                          setDeletingId(null);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                        title="Rename"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (activeId === profile.id) {
                            onEditSkills();
                            setIsOpen(false);
                          } else {
                            handleSwitch(profile.id);
                            setTimeout(() => {
                              onEditSkills();
                              setIsOpen(false);
                            }, 100);
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-teal-primary hover:bg-teal-primary/10 rounded-md transition-colors"
                        title="Edit skills"
                      >
                        <Plus size={13} />
                      </button>
                      {profiles.length > 1 && (
                        <button
                          onClick={() => {
                            setDeletingId(profile.id);
                            setRenamingId(null);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Save new / Create new */}
          <div className="p-3 border-t border-gray-100">
            {isNaming ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveNew();
                }}
                className="flex gap-2"
              >
                <input
                  ref={inputRef}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Profile name..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-teal-primary focus:ring-1 focus:ring-teal-primary/20 outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-teal-primary text-white text-sm font-semibold rounded-lg hover:bg-teal-700"
                >
                  Save
                </button>
              </form>
            ) : (
              <button
                onClick={() => {
                  setIsNaming(true);
                  setNameInput("");
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-teal-primary border border-teal-primary/30 rounded-lg hover:bg-teal-primary/5 transition-colors"
              >
                <Plus size={14} /> Save as new profile
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
