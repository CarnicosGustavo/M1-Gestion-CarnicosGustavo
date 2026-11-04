export interface LineCaptureLike {
	weightG: number;
	tareG: number | null;
	pieceCount: number | null;
}

export interface LineTotals {
	count: number;
	pieces: number;
	grossG: number;
	tareG: number;
	netG: number;
}

export function captureNetG(c: {
	weightG: number;
	tareG: number | null;
}): number {
	return Math.max(0, c.weightG - (c.tareG ?? 0));
}

export function computeLineTotals(
	captures: readonly LineCaptureLike[],
): LineTotals {
	let count = 0;
	let pieces = 0;
	let grossG = 0;
	let tareG = 0;
	let netG = 0;

	for (const capture of captures) {
		count += 1;
		pieces += capture.pieceCount ?? 0;
		grossG += capture.weightG;
		tareG += capture.tareG ?? 0;
		netG += captureNetG(capture);
	}

	return {
		count,
		pieces,
		grossG,
		tareG,
		netG,
	};
}

export const EMPTY_LINE_TOTALS: LineTotals = {
	count: 0,
	pieces: 0,
	grossG: 0,
	tareG: 0,
	netG: 0,
};
