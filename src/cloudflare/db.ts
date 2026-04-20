export interface SqlResultSet<T = Record<string, unknown>> {
  toArray(): Array<Record<string, unknown>>;
  one(): Record<string, unknown> | undefined;
}

export interface SqlStorage {
  exec<T = Record<string, unknown>>(sql: string, ...params: unknown[]): SqlResultSet<T>;
}

export interface TransactionalSqlStorage {
  sql: SqlStorage;
  transactionSync<T>(callback: () => T): T;
}

export interface PreparedStatement<T = Record<string, unknown>> {
  run(...params: unknown[]): { changes?: number; lastInsertRowid?: number | string };
  get(...params: unknown[]): T | undefined;
  all(...params: unknown[]): T[];
}

export interface AppDatabase {
  prepare<T = Record<string, unknown>>(sql: string): PreparedStatement<T>;
  exec(sql: string): void;
  transaction<T extends (...args: any[]) => any>(fn: T): T;
  pragma(_: string): void;
  close(): void;
}

export class DurableSqlDatabase implements AppDatabase {
  constructor(private readonly storage: TransactionalSqlStorage) {}

  prepare<T = Record<string, unknown>>(statement: string): PreparedStatement<T> {
    return new DurablePreparedStatement<T>(this.storage.sql, statement);
  }

  exec(sql: string): void {
    this.storage.sql.exec(sql);
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => this.storage.transactionSync(() => fn(...args))) as T;
  }

  pragma(_: string): void {}

  close(): void {}
}

class DurablePreparedStatement<T = Record<string, unknown>> implements PreparedStatement<T> {
  constructor(
    private readonly sql: SqlStorage,
    private readonly statement: string
  ) {}

  run(...params: unknown[]): { changes?: number; lastInsertRowid?: number | string } {
    this.sql.exec(this.statement, ...params);
    return { changes: 0, lastInsertRowid: 0 };
  }

  get(...params: unknown[]): T | undefined {
    const rows = this.sql.exec<T>(this.statement, ...params).toArray();
    return (rows[0] as T | undefined) ?? undefined;
  }

  all(...params: unknown[]): T[] {
    return this.sql.exec<T>(this.statement, ...params).toArray() as T[];
  }
}
