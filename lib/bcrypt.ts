import * as bcrypt from "bcryptjs";

export const compareAsync = (plain: string, hash: string) =>
  new Promise<boolean>((resolve, reject) =>
    bcrypt.compare(plain, hash, (err, same) => (err ? reject(err) : resolve(same)))
  );

export const hashAsync = (plain: string, rounds = 10) =>
  new Promise<string>((resolve, reject) =>
    bcrypt.hash(plain, rounds, (err, hashed) => (err ? reject(err) : resolve(hashed)))
  );
