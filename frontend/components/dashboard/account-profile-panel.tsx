"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { fetchWithAuth } from "@/lib/api";
import { authClient } from "@/lib/auth";
import {
  useConsoleViewer,
  useConsoleViewerActions,
} from "@/components/console/console-viewer-context";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function getInitials(displayName: string | null, email: string | null): string {
  if (displayName) {
    return displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? "U";
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.crossOrigin = "anonymous";
    image.src = url;
  });
}

async function getCroppedBlob(imageSrc: string, cropArea: Area, outputSize = 256): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas context unavailable.");
  context.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, outputSize, outputSize);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Crop failed."))), "image/jpeg", 0.9);
  });
}

export function AccountProfilePanel() {
  const viewer = useConsoleViewer();
  const { updateViewer } = useConsoleViewerActions();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(viewer.displayName ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(viewer.image);
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setName(viewer.displayName ?? "");
    setAvatarPreview(viewer.image);
    setPendingAvatarUrl(null);
  }, [viewer.displayName, viewer.image]);

  function onCropComplete(_: Area, croppedAreaPixels: Area) {
    setCroppedArea(croppedAreaPixels);
  }

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null); setSuccess(null);
    const mimeType = (file.type || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) { setError("Use JPEG, PNG, or WebP."); return; }
    if (file.size > MAX_AVATAR_BYTES) { setError("Max 2 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { setRawImage(reader.result as string); setCrop({ x: 0, y: 0 }); setZoom(1); };
    reader.readAsDataURL(file);
  }

  async function handleCropConfirm() {
    if (!rawImage || !croppedArea) return;
    setUploading(true); setError(null); setSuccess(null);
    try {
      const blob = await getCroppedBlob(rawImage, croppedArea, 256);
      const formData = new FormData();
      formData.append("file", blob, "avatar.jpg");
      const result = await fetchWithAuth<{ url: string }>("/dashboard/user/avatar", { method: "POST", body: formData });
      setPendingAvatarUrl(result.url);
      setAvatarPreview(result.url);
      setRawImage(null);
      setSuccess("Avatar uploaded. Save to apply.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Upload failed.");
    } finally { setUploading(false); }
  }

  async function handleSave() {
    const trimmedName = name.trim();
    const nextName = trimmedName || viewer.displayName || "";
    const hasNameChange = Boolean(trimmedName && trimmedName !== (viewer.displayName ?? ""));
    const hasAvatarChange = pendingAvatarUrl !== null && pendingAvatarUrl !== viewer.image;
    if (!hasNameChange && !hasAvatarChange) return;

    setSaving(true); setError(null); setSuccess(null);
    try {
      const updates: { name?: string; image?: string } = {};
      if (hasNameChange) updates.name = nextName;
      if (hasAvatarChange && pendingAvatarUrl) updates.image = pendingAvatarUrl;
      const result = await authClient.updateUser(updates);
      if (result.error) throw result.error;
      updateViewer({ displayName: updates.name ?? viewer.displayName, image: updates.image ?? viewer.image });
      setPendingAvatarUrl(null);
      setSuccess("Profile updated.");
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Save failed.");
    } finally { setSaving(false); }
  }

  const trimmedName = name.trim();
  const hasPendingChanges =
    (Boolean(trimmedName) && trimmedName !== (viewer.displayName ?? ""))
    || (pendingAvatarUrl !== null && pendingAvatarUrl !== viewer.image);
  const initials = getInitials(trimmedName || viewer.displayName, viewer.email);

  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-white/60 px-5 py-5">
      {/* Cropper overlay */}
      {rawImage && (
        <div className="mb-5 rounded-[14px] border border-[var(--border)] bg-[#111827] p-3">
          <div className="relative mx-auto h-56 overflow-hidden rounded-[12px]">
            <Cropper
              image={rawImage}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-white/50">Zoom</span>
            <input type="range" min={1} max={3} step={0.05} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[var(--brand-bright)]" />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setRawImage(null)} className="button-secondary text-xs">Cancel</button>
            <button type="button" onClick={() => void handleCropConfirm()} disabled={uploading} className="button-primary text-xs">
              {uploading ? "Uploading..." : "Confirm"}
            </button>
          </div>
        </div>
      )}

      {/* Profile form */}
      <div className="flex items-start gap-5">
        {/* Avatar */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-white/80 transition hover:border-[var(--border-strong)]"
        >
          {avatarPreview ? (
            <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url("${avatarPreview}")` }} />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-[var(--foreground-secondary)]">{initials}</span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
            Edit
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileSelect} />

        {/* Fields */}
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <label className="text-[11px] text-[var(--foreground-tertiary)]">Display name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="mt-1 h-9 w-full rounded-[10px] border border-[var(--border)] bg-white/82 px-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--foreground-tertiary)] focus:border-[var(--border-brand)]"
            />
          </div>
          <div>
            <label className="text-[11px] text-[var(--foreground-tertiary)]">Email</label>
            <div className="mt-1 rounded-[10px] border border-[var(--border)] bg-white/60 px-3 py-2 text-sm text-[var(--foreground-secondary)]">
              {viewer.email ?? "No email on file"}
            </div>
          </div>

          {error && <p className="text-sm text-[var(--error)]">{error}</p>}
          {success && <p className="text-sm text-[var(--success)]">{success}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={() => void handleSave()} disabled={!hasPendingChanges || saving || uploading || rawImage !== null} className="button-primary h-9 px-4 text-sm">
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setName(viewer.displayName ?? ""); setAvatarPreview(viewer.image); setPendingAvatarUrl(null); setRawImage(null); setError(null); setSuccess(null); }}
              disabled={saving || uploading}
              className="button-secondary h-9 px-4 text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
