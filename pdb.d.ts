type RowName = string;
type IsKey = 0 | 1;
type IsAutoIncrement = 0 | 1;
type RowType = 0 | 1; // number, string

type Row = [RowName, IsKey, IsAutoIncrement, RowType];
type Column = (string | number)[]; // values of the rows, example: name = "Jack", age = 10 will be looking like ["Jack", 10]

type QueryGetResult = Column[];
type QueryResult = string | QueryGetResult | true | false;
// string -> error as string
// true -> can save
// false -> no need for anything to be done(example: if you create a table with 'if not exists' tag and if it exists it will return false)
type Table = [string, Row[], Column[]];

type PhotonDB = {
    save: () => void,
    saveAsync: () => Promise<void>,
    query: (input: string) => QueryResult,
    queryAsync: (input: string) => Promise<QueryResult>,
    queryInternal: (input: string, success: Function) => QueryResult,
    readonly version: number,
    readonly all: Table[]
};

export default function (file: string, shouldThrow?: boolean): PhotonDB;

export function encoder(tables: Table[]): string;

export function decoder(content: string): Table[];