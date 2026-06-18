import bcrypt from "bcrypt";

export const compareAsync = (plain: string, hash: string) =>
	bcrypt.compare(plain, hash);

export const hashAsync = (plain: string, rounds = 10) =>
	bcrypt.hash(plain, rounds);
