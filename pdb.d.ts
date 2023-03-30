// column description: NAME HAS_DEFAULT IS_UNIQUE WILL_INCREMENT TYPE DEFAULT_VALUE INCREMENT_VALUE

type RawColumn = [string, 0 | 1, 0 | 1, 0 | 1, 0 | 1, string | number | null, number | null];
type RawRow = (string | number)[]; // values of the columns, example: name = "Jack", age = 10 will be looking like ["Jack", 10]

type RawQueryGetResult = RawRow[];
type RawQueryResult = RawQueryGetResult | true | false;
// true -> can save
// false -> no need for anything to be done(example: if you create a table with 'if not exists' tag and if it exists it will return false)
type Table = [string, RawColumn[], RawRow[]];

type PColumn<T, Q> = {
    name: string,
    type: Q,
    default?: T,
    unique?: boolean,
    autoIncrement?: boolean
};
type PStringColumn = PColumn<string, "string">;
type PNumberColumn = PColumn<number, "number">;
type PAnyColumn = PStringColumn | PNumberColumn;
type PReadAnyColumn = PAnyColumn & {
    readonly increment: number
};

type PRow = Record<string, string | number>;

type PhotonDB = {
    updateFileVersion(): boolean,
    save(callback?: () => void): void,
    saveAsync(): Promise<void>,
    createTable(table: { name: string, columns: PAnyColumn[] }): void,
    deleteTable(tableName: string): void,
    getTables(): string[],
    insert(tableName: string, values: PRow): void,
    update(tableName: string, rowIndex: number, values: PRow): void,
    delete(tableName: string, rowIndex: number): void,
    getRows(tableName: string): readonly PRow[],
    getColumns(tableName: string): readonly PReadAnyColumn[],
    getTable(tableName: string): {
        readonly rows: readonly PRow[],
        readonly columns: readonly PReadAnyColumn[],
    },

    query(input: string): RawQueryResult,
    queryAsync(input: string): Promise<RawQueryResult>,
    queryInternal(input: string, success: Function): RawQueryResult,
    readonly version: number,
    readonly versionCurrent: number,
    readonly all: Table[]
};

export default function (file: string, savePeriod?: number): PhotonDB;

export function encoder(tables: Table[]): string;

export function decoder(content: string): Table[];