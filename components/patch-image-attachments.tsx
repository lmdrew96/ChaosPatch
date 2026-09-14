"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

/**
 * PUT a file with upload progress. fetch() can't report upload progress, so
 * this uses XHR. CORS is unchanged: a PUT with an image Content-Type was
 * already preflighted under fetch.
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (fraction: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () =>
      reject(new Error("Upload failed — check your connection"));
    xhr.send(file);
  });
}

/**
 * Two-step direct-to-R2 upload: ask the server to mint a presigned PUT URL
 * (auth + ownership checked there), then PUT the file straight to R2 so the
 * bytes never pass through our server.
 */
async function uploadToR2(
  file: File,
  patchId: string | undefined,
  onProgress: (fraction: number) => void
): Promise<PendingImage> {
  const startRes = await fetch("/api/blob/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: safeUploadName(file.name),
      contentType: file.type,
      size: file.size,
      patchId,
    }),
  });
  if (!startRes.ok) {
    const body = await startRes.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error ?? "Failed to start upload");
  }
  const { uploadUrl, key, url } = (await startRes.json()) as {
    uploadUrl: string;
    key: string;
    url: string;
  };

  await putWithProgress(uploadUrl, file, onProgress);

  return { url, pathname: key, contentType: file.type || null, size: file.size ?? null };
}

type Props =
  | {
      // Add-patch form: the patch doesn't exist yet, so images live in parent
      // state and are persisted when the patch is created.
      mode: "pending";
      images: PendingImage[];
      // Functional updater (a React state setter fits) so adds that land
      // mid-batch never overwrite removals made in the meantime.
      onChange: (update: (prev: PendingImage[]) => PendingImage[]) => void;
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
  // Which file of the batch is uploading, and how far along it is.
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    percent: number;
  } | null>(null);
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

    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));

    try {
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const step = { current: i + 1, total: images.length };
        setProgress({ ...step, percent: 0 });
        try {
          const meta = await uploadToR2(
            file,
            props.mode === "saved" ? props.patchId : undefined,
            (fraction) =>
              setProgress({ ...step, percent: Math.round(fraction * 100) })
          );
          // Surface each image as soon as it lands, not after the whole batch.
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
            router.refresh();
          } else {
            props.onChange((prev) => [...prev, meta]);
          }
        } catch (err) {
          // Keep going with the rest of the batch; name the file that failed.
          const reason = err instanceof Error ? err.message : "Upload failed";
          setError(`${file.name}: ${reason}`);
        }
      }
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removePending(url: string) {
    if (props.mode !== "pending") return;
    const removed = props.images.find((i) => i.url === url);
    props.onChange((prev) => prev.filter((i) => i.url !== url));
    // Fire-and-forget storage cleanup — no DB row exists yet.
    if (removed) {
      fetch("/api/blob/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathname: removed.pathname }),
      }).catch(() => {});
    }
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
          disabled={progress !== null}
          className="text-xs text-muted-foreground/60 hover:text-foreground/70 disabled:opacity-50 transition-colors"
        >
          {hasItems ? "+ Add image" : "+ Attach image"}
        </button>
        {progress && (
          <span aria-live="polite" className="text-[10px] tabular-nums text-muted-foreground">
            {progress.total > 1
              ? `Uploading ${progress.current} of ${progress.total}… ${progress.percent}%`
              : `Uploading… ${progress.percent}%`}
          </span>
        )}
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
