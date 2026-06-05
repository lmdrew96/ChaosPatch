"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { X } from "lucide-react";
import type { PatchAttachment } from "@/lib/queries";

export type PendingImage = {
  url: string;
  pathname: string;
  contentType: string | null;
  size: number | null;
};

/**
 * Sanitize a filename into a signing-safe blob pathname. Raw filenames can
 * contain spaces, parentheses, and exotic whitespace (macOS screenshots use a
 * narrow no-break space, U+202F) that the Blob SDK normalizes inconsistently
 * between issuing and presigning a token — which breaks signed-URL reads. A
 * clean key sidesteps all of that; the random suffix keeps uploads unique.
 */
function safeUploadName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = (dot >= 0 ? filename.slice(dot + 1) : "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
  const base =
    (dot >= 0 ? filename.slice(0, dot) : filename)
      .normalize("NFKD")
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "image";
  return ext ? `${base}.${ext}` : base;
}

type Props =
  | {
      // Add-patch form: the patch doesn't exist yet, so images live in parent
      // state and are persisted when the patch is created.
      mode: "pending";
      images: PendingImage[];
      onChange: (images: PendingImage[]) => void;
    }
  | {
      // Existing patch: upload → POST attachment → refresh server data.
      mode: "saved";
      patchId: string;
      attachments: PatchAttachment[];
    };

export function PatchImageAttachments(props: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");

  const items: {
    key: string;
    url: string;
    pathname: string;
    name: string;
    id?: string;
  }[] =
    props.mode === "pending"
      ? props.images.map((img) => ({
          key: img.url,
          url: img.url,
          pathname: img.pathname,
          name: img.pathname,
        }))
      : props.attachments.map((a) => ({
          key: a.id,
          url: a.url,
          pathname: a.pathname,
          name: a.pathname,
          id: a.id,
        }));

  // Private blobs aren't publicly readable — load them through the auth-gated
  // signing proxy instead of their raw url.
  const viewUrl = (pathname: string) =>
    `/api/blob/view?pathname=${encodeURIComponent(pathname)}`;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    const clientPayload =
      props.mode === "saved"
        ? JSON.stringify({ patchId: props.patchId })
        : "{}";

    const added: PendingImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      setUploading((n) => n + 1);
      try {
        const blob = await upload(safeUploadName(file.name), file, {
          access: "private",
          handleUploadUrl: "/api/blob/upload",
          clientPayload,
        });
        const meta: PendingImage = {
          url: blob.url,
          pathname: blob.pathname,
          contentType: file.type || null,
          size: file.size ?? null,
        };
        if (props.mode === "saved") {
          const res = await fetch(
            `/api/patches/${props.patchId}/attachments`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(meta),
            }
          );
          if (!res.ok) throw new Error("Failed to attach image");
        } else {
          added.push(meta);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading((n) => n - 1);
      }
    }

    if (props.mode === "pending" && added.length > 0) {
      props.onChange([...props.images, ...added]);
    } else if (props.mode === "saved") {
      router.refresh();
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function removePending(url: string) {
    if (props.mode !== "pending") return;
    props.onChange(props.images.filter((i) => i.url !== url));
    // Fire-and-forget blob cleanup — no DB row exists yet.
    fetch("/api/blob/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => {});
  }

  async function removeSaved(id: string) {
    const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  const hasItems = items.length > 0;

  return (
    <div className="space-y-2">
      {hasItems && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <div key={item.key} className="relative">
              <a
                href={viewUrl(item.pathname)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={viewUrl(item.pathname)}
                  alt={item.name}
                  className="h-16 w-16 rounded-md border border-border object-cover"
                />
              </a>
              <button
                type="button"
                onClick={() =>
                  props.mode === "pending"
                    ? removePending(item.url)
                    : removeSaved(item.id!)
                }
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-80 transition-colors hover:text-red-400"
                aria-label="Remove image"
                title="Remove image"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading > 0}
          className="text-xs text-muted-foreground/60 hover:text-foreground/70 disabled:opacity-50 transition-colors"
        >
          {uploading > 0
            ? "Uploading…"
            : hasItems
            ? "+ Add image"
            : "+ Attach image"}
        </button>
        {error && <span className="text-[10px] text-red-400">{error}</span>}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
