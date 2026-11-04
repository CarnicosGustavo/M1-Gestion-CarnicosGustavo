export interface SerialOpenOptions {
	baudRate: number;
	dataBits?: 7 | 8;
	stopBits?: 1 | 2;
	parity?: "none" | "even" | "odd";
	flowControl?: "none" | "hardware";
}

export interface SerialPortInfo {
	usbVendorId?: number;
	usbProductId?: number;
}

export interface SerialPortLike {
	readable: ReadableStream<Uint8Array> | null;
	writable: WritableStream<Uint8Array> | null;
	open(options: SerialOpenOptions): Promise<void>;
	close(): Promise<void>;
	getInfo?(): SerialPortInfo;
	addEventListener?(type: "disconnect", listener: (event: Event) => void): void;
	removeEventListener?(
		type: "disconnect",
		listener: (event: Event) => void,
	): void;
}

export interface SerialFilter {
	name?: string;
	usbVendorId?: number;
	usbProductId?: number;
}

export interface SerialRequestOptions {
	filters?: SerialFilter[];
}

export interface SerialLike {
	requestPort(options?: SerialRequestOptions): Promise<SerialPortLike>;
	getPorts(): Promise<SerialPortLike[]>;
	addEventListener(
		type: "connect" | "disconnect",
		listener: (event: Event) => void,
	): void;
	removeEventListener(
		type: "connect" | "disconnect",
		listener: (event: Event) => void,
	): void;
}

export function getSerial(): SerialLike | null {
	if (typeof navigator === "undefined") {
		return null;
	}

	const candidate = (navigator as Navigator & { serial?: SerialLike }).serial;
	return candidate ?? null;
}

export function isWebSerialSupported(): boolean {
	return getSerial() !== null;
}
