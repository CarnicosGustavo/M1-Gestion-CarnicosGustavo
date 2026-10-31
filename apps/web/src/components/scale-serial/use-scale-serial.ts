"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
	CaptureArming,
	DEFAULT_CAPTURE_CONFIG,
} from "@/lib/scale/webserial/capture";
import {
	type ConnectionStatus,
	ScaleConnection,
} from "@/lib/scale/webserial/connection";
import {
	GRAMS_PER_UNIT,
	parseFrame,
	resolveStable,
	SoftStability,
	toHex,
	type WeightUnit,
} from "@/lib/scale/webserial/parser";
import {
	DEFAULT_SCALE_SETTINGS,
	loadScaleSettings,
	type ScaleSettings,
	saveScaleSettings,
} from "@/lib/scale/webserial/settings";
import { isWebSerialSupported } from "@/lib/scale/webserial/types";

export interface LiveReading {
	weightG: number | null;
	weight: number;
	unit: WeightUnit | null;
	stable: boolean;
	overload: boolean;
	net: boolean | null;
	raw: string;
	at: number;
}

export type CapturedReading = LiveReading & {
	weightG: number;
};

export interface DiagnosticFrame {
	at: number;
	text: string;
	hex: string;
	parsed: boolean;
}

type AutoCaptureHandler = (reading: CapturedReading) => void;

const FRAME_LIMIT = 30;
const UPDATE_INTERVAL_MS = 100;

export function useScaleSerial() {
	const [settings, setSettingsState] = useState<ScaleSettings>(
		DEFAULT_SCALE_SETTINGS,
	);
	const [supported, setSupported] = useState<boolean | null>(null);
	const [status, setStatus] = useState<ConnectionStatus>("idle");
	const [statusDetail, setStatusDetail] = useState<string | null>(null);
	const [live, setLive] = useState<LiveReading | null>(null);
	const [frames, setFrames] = useState<DiagnosticFrame[]>([]);
	const [armed, setArmed] = useState(true);

	const connectionRef = useRef<ScaleConnection | null>(null);
	const settingsRef = useRef(settings);
	const softStabilityRef = useRef(
		new SoftStability({ stepG: settings.resolutionG }),
	);
	const armingRef = useRef(new CaptureArming(DEFAULT_CAPTURE_CONFIG));
	const onAutoCaptureRef = useRef<AutoCaptureHandler | null>(null);
	const lastUpdateRef = useRef(0);
	const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingUpdateRef = useRef<LiveReading | null>(null);
	const pendingFramesRef = useRef<DiagnosticFrame[]>([]);
	const mountedRef = useRef(true);
	const liveRef = useRef<LiveReading | null>(null);
	const armedRef = useRef(true);

	const flushUpdate = useCallback(() => {
		updateTimerRef.current = null;
		lastUpdateRef.current = Date.now();

		const nextLive = pendingUpdateRef.current;
		const nextFrames = pendingFramesRef.current;
		pendingUpdateRef.current = null;
		pendingFramesRef.current = [];

		if (!mountedRef.current) {
			return;
		}

		if (nextLive) {
			liveRef.current = nextLive;
			setLive(nextLive);
		}

		if (nextFrames.length > 0) {
			setFrames((current) => [...nextFrames, ...current].slice(0, FRAME_LIMIT));
		}
	}, []);

	const scheduleUpdate = useCallback(
		(nextLive: LiveReading | null, nextFrame?: DiagnosticFrame) => {
			pendingUpdateRef.current = nextLive;
			if (nextFrame) {
				pendingFramesRef.current = [...pendingFramesRef.current, nextFrame];
			}

			const elapsed = Date.now() - lastUpdateRef.current;
			if (elapsed >= UPDATE_INTERVAL_MS) {
				if (updateTimerRef.current) {
					clearTimeout(updateTimerRef.current);
				}
				flushUpdate();
				return;
			}

			if (!updateTimerRef.current) {
				updateTimerRef.current = setTimeout(
					flushUpdate,
					UPDATE_INTERVAL_MS - elapsed,
				);
			}
		},
		[flushUpdate],
	);

	const updateArmed = useCallback((nextArmed: boolean) => {
		if (armedRef.current === nextArmed) {
			return;
		}

		armedRef.current = nextArmed;
		setArmed(nextArmed);
	}, []);

	useEffect(() => {
		mountedRef.current = true;
		const loadedSettings = loadScaleSettings();
		settingsRef.current = loadedSettings;
		setSettingsState(loadedSettings);
		softStabilityRef.current = new SoftStability({
			stepG: loadedSettings.resolutionG,
		});
		setSupported(isWebSerialSupported());
	}, []);

	useEffect(() => {
		const connection = new ScaleConnection(settingsRef.current, {
			onStatus: (nextStatus, detail) => {
				if (!mountedRef.current) {
					return;
				}
				setStatus(nextStatus);
				setStatusDetail(detail ?? null);
			},
			onLine: (line, receivedAt) => {
				const currentSettings = settingsRef.current;
				const frame = parseFrame(line, currentSettings.defaultUnit);
				const diagnosticFrame: DiagnosticFrame = {
					at: receivedAt,
					text: line,
					hex: toHex(line),
					parsed: frame !== null,
				};

				if (!frame) {
					scheduleUpdate(null, diagnosticFrame);
					return;
				}

				if (frame.overload) {
					const overloadReading: LiveReading = {
						weightG: null,
						weight: 0,
						unit: frame.unit ?? currentSettings.defaultUnit,
						stable: false,
						overload: true,
						net: frame.net,
						raw: frame.raw,
						at: receivedAt,
					};

					liveRef.current = overloadReading;
					scheduleUpdate(overloadReading, diagnosticFrame);
					return;
				}

				if (frame.weightG === null) {
					scheduleUpdate(null, diagnosticFrame);
					return;
				}

				const stable = resolveStable(
					frame,
					softStabilityRef.current,
					receivedAt,
				);
				const unit = frame.unit ?? currentSettings.defaultUnit;
				const weight = frame.weightG / GRAMS_PER_UNIT[unit];
				const nextLive: LiveReading = {
					weightG: frame.weightG,
					weight,
					unit,
					stable,
					overload: false,
					net: frame.net,
					raw: frame.raw,
					at: receivedAt,
				};

				liveRef.current = nextLive;

				const armingResult = armingRef.current.onReading({
					weightG: frame.weightG,
					stable,
				});

				scheduleUpdate(nextLive, diagnosticFrame);
				updateArmed(armingRef.current.isArmed);

				if (armingResult === "capture") {
					onAutoCaptureRef.current?.({
						...nextLive,
						weightG: frame.weightG,
					});
				}
			},
		});

		connectionRef.current = connection;

		if (settingsRef.current.simulator || isWebSerialSupported()) {
			void connection.autoReconnect();
		}

		return () => {
			mountedRef.current = false;
			if (updateTimerRef.current) {
				clearTimeout(updateTimerRef.current);
			}
			void connection.disconnect();
			connectionRef.current = null;
		};
	}, [scheduleUpdate, updateArmed]);

	const setSettings = useCallback((partial: Partial<ScaleSettings>) => {
		const nextSettings = {
			...settingsRef.current,
			...partial,
		};
		settingsRef.current = nextSettings;
		saveScaleSettings(nextSettings);
		setSettingsState(nextSettings);
		connectionRef.current?.updateSettings(nextSettings);

		if (partial.resolutionG !== undefined) {
			softStabilityRef.current = new SoftStability({
				stepG: nextSettings.resolutionG,
			});
		}
	}, []);

	const connect = useCallback(() => {
		void connectionRef.current?.connectWithPicker();
	}, []);

	const disconnect = useCallback(() => {
		void connectionRef.current?.disconnect();
	}, []);

	const clearFrames = useCallback(() => {
		setFrames([]);
	}, []);

	const setOnAutoCapture = useCallback((handler: AutoCaptureHandler | null) => {
		onAutoCaptureRef.current = handler;
	}, []);

	const captureNow = useCallback((): CapturedReading | null => {
		const currentLive = liveRef.current;
		if (
			!currentLive ||
			currentLive.overload ||
			currentLive.weightG === null ||
			currentLive.weightG < 1
		) {
			return null;
		}

		armingRef.current.markManualCapture();
		updateArmed(armingRef.current.isArmed);

		return {
			...currentLive,
			weightG: currentLive.weightG,
		};
	}, [updateArmed]);

	return {
		supported,
		status,
		statusDetail,
		connect,
		disconnect,
		live,
		frames,
		clearFrames,
		armed,
		setOnAutoCapture,
		captureNow,
		settings,
		setSettings,
	};
}
