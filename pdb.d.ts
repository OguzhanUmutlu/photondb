// column description: NAME HAS_DEFAULT IS_UNIQUE WILL_INCREMENT TYPE DEFAULT_VALUE INCREMENT_VALUE

type Column = [string, 0 | 1, 0 | 1, 0 | 1, 0 | 1, string | number | null, number | null];
type Row = (string | number)[]; // values of the columns, example: name = "Jack", age = 10 will be looking like ["Jack", 10]

type QueryGetResult = Row[];
type QueryResult = string | QueryGetResult | true | false;
// string -> error as string
// true -> can save
// false -> no need for anything to be done(example: if you create a table with 'if not exists' tag and if it exists it will return false)
type Table = [string, Column[], Row[]];

type PhotonDB = {
    update: () => boolean,
    save: () => void,
    saveAsync: () => Promise<void>,
    query: (input: string) => QueryResult,
    queryAsync: (input: string) => Promise<QueryResult>,
    queryInternal: (input: string, success: Function) => QueryResult,
    readonly version: number,
    readonly versionCurrent: number,
    readonly all: Table[]
};

export default function (file: string, shouldThrow?: boolean): PhotonDB;

export function encoder(tables: Table[]): string;

export function decoder(content: string): Table[];