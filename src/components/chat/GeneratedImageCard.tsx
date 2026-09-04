"use client";

import Image from "next/image";
import { DownloadIcon } from "@/components/ui/Icons";
import type { GeneratedImageInfo } from "@/lib/images/types";

export function GeneratedImageCard({ image }: { image: GeneratedImageInfo }) {
  const caption = image.revisedPrompt || image.prompt;

  return (
    <figure className="my-1 max-w-2xl overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-sm">
      <a
        href={image.url}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden bg-[var(--surface-app)]"
        title="Open generated image"
      >
        <Image
          src={image.url}
          alt={caption}
          width={image.width}
          height={image.height}
          sizes="(max-width: 768px) 100vw, 672px"
          className="h-auto w-full object-contain transition-transform duration-300 hover:scale-[1.01]"
          unoptimized
        />
      </a>
      <figcaption className="flex items-start justify-between gap-3 px-3.5 py-3">
        <p className="line-clamp-2 min-w-0 text-xs leading-relaxed text-[var(--text-secondary)]">
          {caption}
        </p>
        <a
          href={`${image.url}?download=1`}
          download
          className="flex-shrink-0 rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          title="Download generated image"
          aria-label="Download generated image"
        >
          <DownloadIcon size={17} />
        </a>
      </figcaption>
    </figure>
  );
}
