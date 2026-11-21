/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { prepareImage } from "@/lib/prepareImage";

type Profile = { id: string; name: string; photo?: string };
const STORAGE_KEY = "dripverse.profiles";

function isProfile(value: unknown): value is Profile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<Profile>;
  return typeof profile.id === "string" && typeof profile.name === "string"
    && (profile.photo === undefined || (typeof profile.photo === "string" && profile.photo.startsWith("data:image/jpeg;base64,")));
}

export default function Profiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [draft, setDraft] = useState<Profile>({ id: "", name: "" });
  const [file, setFile] = useState<File>();
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (!Array.isArray(saved) || !saved.every(isProfile)) throw new Error();
      setProfiles(saved);
      setReady(true);
    } catch {
      setMessage("Saved profiles couldn’t be loaded in this browser.");
    }
  }, []);

  function edit(profile: Profile = { id: "", name: "" }) {
    setDraft(profile);
    setFile(undefined);
    setMessage("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      setMessage("Enter a display name.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      let photo = draft.photo;
      if (file) {
        const blob = await prepareImage(file, { photo: true, maxEdge: 320 });
        photo = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Couldn’t read the profile photo."));
          reader.readAsDataURL(blob);
        });
      }

      const profile = { id: draft.id || crypto.randomUUID(), name, photo };
      const next = draft.id
        ? profiles.map((existing) => existing.id === draft.id ? profile : existing)
        : [...profiles, profile];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        throw new Error("Couldn’t save the profile. This browser may be out of storage.");
      }
      setProfiles(next);
      edit(profile);
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn’t save the profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="profiles" className="profilePanel" aria-labelledby="profiles-heading">
      <h2 id="profiles-heading">Profiles</h2>
      <p className="note">Profiles and photos are saved in this browser.</p>
      <fieldset disabled={!ready || saving}>
        {profiles.length > 0 && (
          <ul className="profileList" aria-label="Saved profiles">
            {profiles.map((profile) => (
              <li key={profile.id}>
                <button type="button" className="profileChoice" aria-pressed={draft.id === profile.id} onClick={() => edit(profile)}>
                  {profile.photo && <img src={profile.photo} alt="" />}
                  {profile.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {draft.id && <button type="button" className="linkBtn" onClick={() => edit()}>New profile</button>}
        <form key={draft.id} onSubmit={save}>
          <label htmlFor="profile-name">Display name</label>
          <input id="profile-name" className="text" value={draft.name} maxLength={40} required onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <label htmlFor="profile-photo">Profile photo (optional)</label>
          <input key={draft.photo ?? "no-photo"} id="profile-photo" className="text" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0])} />
          {(draft.photo || file) && (
            <button type="button" className="linkBtn" onClick={() => {
              setDraft({ ...draft, photo: undefined });
              setFile(undefined);
              const input = document.getElementById("profile-photo");
              if (input instanceof HTMLInputElement) input.value = "";
            }}>Remove photo</button>
          )}
          <button className="pill" type="submit">{saving ? "Saving…" : draft.id ? "Save profile" : "Create profile"}</button>
        </form>
      </fieldset>
      {message && <p className="note" role="status">{message}</p>}
    </section>
  );
}
