"use client";

import type * as React from "react";

import { OverlayFrame } from "./overlay-frame";

export interface ScaleOverlayProps {
	title?: string;
	children: React.ReactNode;
	onClose: () => void;
}

export function ScaleOverlay({
	title = "Báscula por cable",
	children,
	onClose,
}: ScaleOverlayProps) {
	return (
		<OverlayFrame title={title} onClose={onClose}>
			<div className="mx-auto w-full max-w-3xl p-6">{children}</div>
		</OverlayFrame>
	);
}
