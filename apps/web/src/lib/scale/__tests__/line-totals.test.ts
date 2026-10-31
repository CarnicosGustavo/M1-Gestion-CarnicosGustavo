import { describe, expect, test } from "bun:test";
import {
	captureNetG,
	computeLineTotals,
	EMPTY_LINE_TOTALS,
} from "@/lib/scale/webserial/line-totals";

describe("totales de línea de báscula", () => {
	test("calcula el neto por captura con recipientes mezclados", () => {
		const captures = [
			{
				weightG: 3000,
				tareG: 0,
				pieceCount: 1,
			},
			{
				weightG: 2200,
				tareG: 1200,
				pieceCount: 2,
			},
			{
				weightG: 3500,
				tareG: 2500,
				pieceCount: 1,
			},
		];

		expect(computeLineTotals(captures)).toEqual({
			count: 3,
			pieces: 4,
			grossG: 8700,
			tareG: 3700,
			netG: 5000,
		});
	});

	test("conserva la tara de cada captura al cambiar de recipiente", () => {
		const captures = [
			{
				weightG: 3000,
				tareG: 2500,
				pieceCount: 1,
			},
			{
				weightG: 4000,
				tareG: 2500,
				pieceCount: 1,
			},
			{
				weightG: 5000,
				tareG: 2500,
				pieceCount: 1,
			},
			{
				weightG: 1000,
				tareG: 0,
				pieceCount: 1,
			},
			{
				weightG: 1500,
				tareG: 0,
				pieceCount: 1,
			},
		];

		expect(computeLineTotals(captures)).toEqual({
			count: 5,
			pieces: 5,
			grossG: 14500,
			tareG: 7500,
			netG: 7000,
		});
		expect(computeLineTotals(captures).netG).not.toBe(14500 - 4 * 2500);
	});

	test("aplica el piso de cero por captura sin afectar las demás", () => {
		const captures = [
			{
				weightG: 1000,
				tareG: 1200,
				pieceCount: 1,
			},
			{
				weightG: 2000,
				tareG: 1200,
				pieceCount: 1,
			},
			{
				weightG: 3000,
				tareG: 0,
				pieceCount: 1,
			},
		];

		expect(captureNetG(captures[0])).toBe(0);
		expect(computeLineTotals(captures)).toEqual({
			count: 3,
			pieces: 3,
			grossG: 6000,
			tareG: 2400,
			netG: 3800,
		});
	});

	test("trata una tara nula como cero", () => {
		expect(captureNetG({ weightG: 2500, tareG: null })).toBe(2500);
		expect(
			computeLineTotals([
				{
					weightG: 2500,
					tareG: null,
					pieceCount: 2,
				},
			]),
		).toEqual({
			count: 1,
			pieces: 2,
			grossG: 2500,
			tareG: 0,
			netG: 2500,
		});
	});

	test("devuelve totales vacíos para una lista vacía", () => {
		expect(computeLineTotals([])).toEqual(EMPTY_LINE_TOTALS);
	});
});
