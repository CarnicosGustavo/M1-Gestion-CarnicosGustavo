/** postgres-js a menudo devuelve count(*) como texto; comparar tras Number(). */
export function countIsEmpty(count: unknown): boolean {
	return Number(count) === 0;
}
