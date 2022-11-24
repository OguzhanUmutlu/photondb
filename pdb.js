const fs = require("fs");

const rowSplitter = 0;
const generalSplitter = 1;
const tableSplitter = 2;
const backslash = 3;
const columnSplitter = 4;
const VERSION = 106;

const chr = n => String.fromCharCode(n);

// column description: NAME HAS_DEFAULT IS_UNIQUE WILL_INCREMENT TYPE DEFAULT_VALUE INCREMENT_VALUE

// [ U_VERSION TABLE_NAME U_1 (COLUMN_NAME U_1 U_COLUMN_DEFAULT_PRIMARY_INCREMENT_TYPE U_4 DEFAULT U_4 INCREMENT).join(U_2) U_1 (VALUE).join(U_1) ].join(U_3)
// TYPES: number, string

const stringEncoder = str => str.toString()
    .replaceAll(chr(backslash), chr(backslash).repeat(2))
    .replaceAll(chr(rowSplitter), chr(backslash) + chr(rowSplitter))
    .replaceAll(chr(generalSplitter), chr(backslash) + chr(generalSplitter))
    .replaceAll(chr(tableSplitter), chr(backslash) + chr(tableSplitter));

const encoder = tables => chr(VERSION) + tables.map(table => `${stringEncoder(table[0])}${chr(generalSplitter)}${table[1].map((column, k, l) => `${column[0]}${chr(generalSplitter)}${chr(column[1] * 8 + column[2] * 4 + column[3] * 2 + column[4])}${[...(column[1] ? [`${column[5]}`] : []), ...(column[3] ? [`${column[6]}`] : [])].map((i, m, n) => i + (m === n.length - 1 && k === l.length - 1 ? `` : `${chr(generalSplitter)}`)).join("")}`).join("")}${chr(columnSplitter)}${table[2].map(r => r.map(stringEncoder).join(chr(rowSplitter))).join(chr(rowSplitter))}`).join(chr(tableSplitter));

const decoder = content => {
    content += chr(tableSplitter);
    const tables = [];
    let cancel = false;
    let name = "";
    let nameDone = false;
    let columns = [];
    let columnName = "";
    let columnDefault = "";
    let columnIncrement = "";
    let columnStart = true;
    let columnDefaultDone = true;
    let columnIncrementDone = true;
    let columnNext = null;
    let columnDone = false;
    let rows = [];
    let rowName = "";
    let rowGroup = [];
    let rowDone = false;
    let rowIndex = 0;
    let rowChar = 0;

    for (let i = 1; i < content.length; i++) {
        const c = content[i];
        const code = c.charCodeAt(0);
        if (code === backslash) {
            if (cancel) {
                cancel = false;
            } else {
                cancel = true;
                continue;
            }
        }
        if (!nameDone) {
            if (!cancel && code === generalSplitter) {
                nameDone = true;
                continue;
            }
            name += c;
        } else if (!columnDone) {
            // column name 1 101 column name 1 1111 DEF 1 INC 1 column name 1 1111 DEF 1 INC     4 COLUMN 0 COLUMN 2
            if (!cancel && (code === generalSplitter || code === columnSplitter)) {
                let st = false;
                if (columnStart) {
                    columnStart = false;
                    st = true;
                    if (!content[i + 1]) throw new Error("Invalid BDB format. Expected a character after the column ending.");
                    columnNext = content[i + 1].charCodeAt(0).toString(2).padStart(4, "0").split("").map(i => i * 1);
                    if (columnNext[0]) columnDefaultDone = false;
                    if (columnNext[2]) columnIncrementDone = false;
                    i++;
                }
                if (!st) {
                    if (!columnDefaultDone) {
                        columnDefaultDone = true;
                    } else if (!columnIncrementDone) {
                        columnIncrementDone = true;
                    }
                }
                if (columnDefaultDone && columnIncrementDone) {
                    columnIncrement *= 1;
                    const col = [columnName, columnNext[0], columnNext[1], columnNext[2], columnNext[3]];
                    if (columnNext[0]) {
                        if (columnNext[3] === 0) {
                            if (isNaN(columnDefault * 1)) throw new Error("Expected a valid number for default value of column '" + columnName + "'.");
                            columnDefault *= 1;
                        }
                        col.push(columnDefault);
                    } else col.push(null);
                    if (columnNext[2]) {
                        if (isNaN(columnIncrement * 1)) throw new Error("Expected a valid number for auto-increment value of column '" + columnName + "'.");
                        columnIncrement *= 1;
                        col.push(columnIncrement);
                    } else col.push(null);
                    columns.push(col);
                    columnStart = true;
                    columnName = "";
                    columnDefault = "";
                    columnIncrement = "";
                    columnDefaultDone = true;
                    columnIncrementDone = true;
                    columnNext = null;
                }
                if (code === columnSplitter) {
                    columnDone = true;
                    i--; // because it skips the column splitter
                }
                continue;
            }

            if (!columnDefaultDone) columnDefault += c;
            else if (!columnIncrementDone) columnIncrement += c;
            else columnName += c;
        } else if (!rowDone) {
            rowChar++;
            if (!cancel && (code === rowSplitter || code === tableSplitter)) {
                const columnType = columns[rowIndex][4];
                rowIndex++;
                if (columnType === 0) rowName *= 1;
                if (rowChar > 2) rowGroup.push(rowName);
                if (rowGroup.length >= columns.length) {
                    rows.push(rowGroup);
                    rowGroup = [];
                    rowIndex = 0;
                }
                if (code === tableSplitter) {
                    tables.push([name, columns, rows]);
                    name = "";
                    nameDone = false;
                    columns = [];
                    columnName = "";
                    columnDefault = "";
                    columnIncrement = "";
                    columnDefaultDone = true;
                    columnIncrementDone = true;
                    columnNext = null;
                    columnDone = false;
                    rows = [];
                    rowGroup = [];
                    rowDone = false;
                    rowIndex = 0;
                    rowChar = 0;
                }
                rowName = "";
                continue;
            }
            if (rowChar !== 1) rowName += c;
        }
        if (code !== backslash) cancel = false;
    }
    return tables;
};

function detectStrings(str, thr = true) {
    const strings = [];
    let str_on = null;
    let str_start = null;
    let str_index = 0;
    let cancel = false;
    for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (c === "\\" && str_on !== null) {
            if (cancel) {
                cancel = false; // got from the decoder
            } else {
                cancel = true;
                continue;
            }
        }
        if (str_on !== null) {
            if (!cancel && c === "\"") {
                strings.push(str_on);
                str = str.substring(0, str_start) + "$" + (str_index++) + str.substring(i + 1);
                str_on = null;
                continue;
            }
            str_on += c;
        }
        if (str_on === null && c === "\"") {
            str_on = "";
            str_start = i;
        }
        if (c !== "\\") cancel = false;
    }
    if (str_on) {
        const err = "Unexpected end of expression. Expected \" at the end of the string.";
        if (thr) throw new Error(err);
        else return err;
    }
    return [str, strings];
}

function removeExtraWhitespace(str) {
    while (str.includes("  ")) str = str.replace("  ", " ");
    return str;
}

const tables = new Map;

const tick = t => {
    tables.forEach(t => t());
    tables.clear();
    if (!t) setTimeout(tick);
};

tick();

["SIGINT", "SIGTERM"].forEach(ev => process.on(ev, (a, b) => {
    tick(true);
    process.exit();
}));

let _tid = 0;

const photon = (file, thr = true) => {
    const err = str => {
        if (thr) throw new Error(str);
        else return str;
    }
    if (!fs.existsSync(file)) return err("Failed to open file.");
    const chr = n => String.fromCharCode(n);
    let content = fs.readFileSync(file, "utf8");
    if (!content) content = chr(VERSION);
    let FILE_VERSION = content[0].charCodeAt(0);
    if (FILE_VERSION > VERSION) return err("Selected BDB file's version is v" + FILE_VERSION.toString().padStart(3, "0").split("").join(".") + " which is higher than the parser's version(v" + VERSION.toString().padStart(3, "0").split("").join(".") + ").");
    const current = decoder(content);
    let tid = _tid++;
    const res = {
        update: () => {
            if (FILE_VERSION >= VERSION) return false;
            FILE_VERSION = VERSION;
            content = chr(VERSION) + content.substring(1);
            res.save();
            return true;
        },
        save: () => fs.writeFileSync(file, encoder(current)),
        saveAsync: () => new Promise(r => fs.writeFile(file, encoder(current), () => r())),
        query: input => res.queryInternal(input, () => res.save()),
        queryAsync: input => new Promise((r, rej) => {
            try {
                const l = res.queryInternal(input, null, () => res.saveAsync().then(() => r(l)).catch(() => rej()));
            } catch (e) {
                rej(e);
            }
        }),
        queryInternal: (input, saveTick, saveInstant) => {
            let args = input.split(" ");
            const cmd = str => {
                if (input.toLowerCase().startsWith(str)) {
                    args = input.substring(str.length).trim().split(" ");
                    return true;
                }
                return false;
            };
            // TODO: update column, add column, remove column

            if (cmd("create table")) {
                const tableName = args.slice(0, 3).join(" ").toLowerCase() === "if not exists" ? args[3] : args[0];
                const exists = current.some(i => i[0] === tableName);
                if (args.slice(0, 3).join(" ").toLowerCase() === "if not exists") {
                    args = args.slice(3);
                    if (exists) return false;
                }
                if (exists) return err("Table called '" + tableName + "' already exists.");
                const columns = [];
                const detectedStrings = detectStrings(removeExtraWhitespace(args.slice(1).join(" ")), thr);
                if (typeof detectedStrings === "string") return detectedStrings;
                let [newStr, strings] = detectedStrings;
                newStr = newStr.replaceAll("\n", "");
                if (newStr.split("").filter(i => i === "$").length !== strings.length) return err("Unexpected dollar sign.");
                const r = newStr.split(",").map(i => i.trim().split(" "));
                if (r.some(i => !i[0])) return err("Syntax: CREATE TABLE <table> <column-name> <column-properties>, <column-name> <column-properties>, ...");
                for (let i = 0; i < r.length; i++) {
                    const column = r[i];
                    if (columns.some(i => i[0] === column[0])) return err("Table has more than one columns called '" + column[0] + "'.");
                    const column2 = column.join(" ").toLowerCase();
                    if (column2.includes("text") && column2.includes("number")) return err("A column can't have multiple types.");
                    if ((column2.includes("auto-increment") || column2.includes("autoincrement")) && column2.includes("text")) return err("A column can't have both auto-increment and str properties.");
                    let def = column2.split(" ").find(i => i.toLowerCase().startsWith("default=") || i.toLowerCase().startsWith("def="));
                    const col = [column[0], !!def, (column2.includes("key") || column2.includes("unique")) * 1, (column2.includes("auto-increment") || column2.includes("autoincrement")) * 1, column2.includes("number") || (column2.includes("auto-increment") || column2.includes("autoincrement")) ? 0 : 1];
                    if (def) {
                        def = def.split("=")[1];
                        if (col[4] === 0) {
                            if (isNaN(def * 1)) return err("Column's default value should be a number type since the '" + col[0] + "' column's type is a number.");
                            def *= 1;
                        } else if (col[4] === 1) {
                            if (!def.startsWith("$")) return err("Column's default should should be a text type since the '" + col[0] + "' column's type is a text.");
                            def = strings[def.substring(1)];
                        }
                        col.push(def);
                    } else col.push(null);
                    if (col[3]) {
                        let inc = 0;
                        if (col[1]) inc = col[5];
                        col.push(inc);
                    } else col.push(null);
                    columns.push(col);
                }
                current.push([tableName, columns, []]);
            } else if (cmd("delete table")) {
                const tableName = args[0] || "";
                if (!current.some(i => i[0] === tableName)) {
                    if (!tableName) return err("Syntax: DELETE TABLE <table>");
                    return err("Couldn't find the table called '" + tableName + "'.");
                }
                current.splice(current.findIndex(i => i[0] === tableName), 1);
            } else if (cmd("insert into")) {
                const tableName = args[0];
                const table = current.find(i => i[0] === tableName);
                if (!table) return err("Couldn't find a table called '" + tableName + "'.");
                const givenStr = args.slice(1).join(" ");
                const detectedStrings = detectStrings(givenStr, thr);
                if (typeof detectedStrings === "string") return detectedStrings;
                let [newStr, strings] = detectedStrings;
                newStr = newStr.replaceAll("\n", "");
                if (newStr.split("").filter(i => i === "$").length !== strings.length) return err("Unexpected dollar sign.");
                let split = newStr.split(",").map(i => removeExtraWhitespace(i.trim()).split(" "));
                if (split.length === 1 && split[0].length === 1 && !split[0][0]) split = [];
                const unexpected = split.filter(i => i.length !== 2);
                if (unexpected.length) return err("Syntax: INSERT INTO <table> <column-name> <column-value>, <column-name> <column-value>, ...");
                if (split.every(i => i[0])) {
                    const invalid = split.filter(i => !table[1].some(j => j[0] === i[0]));
                    if (invalid.length) return err("Invalid column name" + (invalid.length > 1 ? "s" : "") + " for table '" + tableName + "': " + invalid.map(i => "'" + i[0] + "'").join(", ") + ".");
                }
                const def = table[1].filter(i => !i[3] && !i[1] && !split.some(j => j[0] === i[0]));
                if (def.length) return err("Couldn't get a default value for the column" + (def.length > 1 ? "s" : "") + " " + def.map(i => "'" + i[0] + "'").join(", ") + ".");
                const row = [];
                for (let i = 0; i < table[1].length; i++) {
                    const column = table[1][i];
                    let val = split.find(i => i[0] === column[0]);
                    if (val) {
                        val = val[1];
                        if (val.startsWith("$")) val = strings[val.substring(1)];
                        else val *= 1;
                        if (column[2] && table[2].some(j => j[i] === val)) return err("Column named '" + column[0] + "' should be unique.");
                        if (typeof val !== ["number", "string"][column[4]]) return err("Column type '" + ["number", "string"][column[3]] + "' expected, got '" + typeof val + "'.");
                    } else {
                        if (column[4] === 0) val = column[1] ? column[5] * 1 : ++column[6];
                        else if (column[4] === 1) val = column[5];
                    }
                    row.push(val);
                }
                table[2].push(row);
            } else if (cmd("delete from")) {
                const tableName = args[0];
                if (!tableName) return err("Syntax: DELETE FROM <table> WHERE <condition>");
                const table = current.find(i => i[0] === tableName);
                if (!table) return err("Couldn't find a table called '" + tableName + "'.");
                if ((args[1] || "").toLowerCase() !== "where") return err("Syntax: DELETE FROM <table> WHERE <condition>");
                const givenStr = args.slice(2).join(" ");
                let [newStr, strings] = detectStrings(givenStr);
                if (newStr.split("").filter(i => i === "$").length !== strings.length) return err("Unexpected dollar sign.");
                newStr = newStr.replaceAll("\n", "");
                const split = newStr.split(",").map(i => removeExtraWhitespace(i.trim()).split(" "));
                const unexpected = split.filter(i => i.length !== 2);
                if (unexpected.length) return err("Syntax: DELETE FROM <table> WHERE <condition>");
                if (split.every(i => i[0])) {
                    const invalid = split.filter(i => !table[1].some(j => j[0] === i[0]));
                    if (invalid.length) return err("Invalid column name" + (invalid.length > 1 ? "s" : "") + " for table '" + tableName + "': " + invalid.map(i => "'" + i[0] + "'").join(", ") + ".");
                }
                const requirements = [];
                for (let i = 0; i < table[1].length; i++) {
                    const column = table[1][i];
                    let val = split.find(i => i[0] === column[0]);
                    if (val) {
                        val = val[1];
                        if (val.startsWith("$")) val = strings[val.substring(1)];
                        else val *= 1;
                        if (typeof val !== ["number", "string"][column[4]]) return err("Column type '" + ["number", "string"][column[3]] + "' expected, got '" + typeof val + "'.");
                        requirements.push([i, val]);
                    }
                }
                const rows = table[2].filter(i => requirements.every(j => i[j[0]] === j[1]));
                rows.forEach(i => table[2].splice(table[2].indexOf(i), 1));
            } else if (cmd("select from")) {
                const tableName = args[0];
                if (!tableName) return err("Syntax: SELECT FROM <table> WHERE <condition>");
                const table = current.find(i => i[0] === tableName);
                if (!table) return err("Couldn't find a table called '" + tableName + "'.");
                if ((args[1] || "").toLowerCase() !== "where" && args.length > 1) return err("Syntax: SELECT FROM <table> WHERE <condition>");
                let requirements = [];
                if (args.length > 1) {
                    const givenStr = args.slice(2).join(" ");
                    let [newStr, strings] = detectStrings(givenStr);
                    if (newStr.split("").filter(i => i === "$").length !== strings.length) return err("Unexpected dollar sign.");
                    newStr = newStr.replaceAll("\n", "");
                    const split = newStr.split(",").map(i => removeExtraWhitespace(i.trim()).split(" "));
                    const unexpected = split.filter(i => i.length !== 2);
                    if (unexpected.length) return err("Syntax: SELECT FROM <table> WHERE <condition>");
                    if (split.every(i => i[0])) {
                        const invalid = split.filter(i => !table[1].some(j => j[0] === i[0]));
                        if (invalid.length) return err("Invalid column name" + (invalid.length > 1 ? "s" : "") + " for table '" + tableName + "': " + invalid.map(i => "'" + i[0] + "'").join(", ") + ".");
                    }
                    for (let i = 0; i < table[1].length; i++) {
                        const column = table[1][i];
                        let val = split.find(i => i[0] === column[0]);
                        if (val) {
                            val = val[1];
                            if (val.startsWith("$")) val = strings[val.substring(1)];
                            else val *= 1;
                            if (typeof val !== ["number", "string"][column[4]]) return err("Column type '" + ["number", "string"][column[3]] + "' expected, got '" + typeof val + "'.");
                            requirements.push([i, val]);
                        }
                    }
                }
                return table[2].filter(i => requirements.every(j => i[j[0]] === j[1]));
            } else if (cmd("update from")) {
                const tableName = args[0];
                if (!tableName) return err("Syntax: UPDATE FROM <table> WHERE <condition> SET <values>");
                const table = current.find(i => i[0] === tableName);
                if (!table) return err("Couldn't find a table called '" + tableName + "'.");

                const givenStr = args.slice(1).join(" ");
                let [newStr, strings] = detectStrings(givenStr);
                newStr = newStr.replaceAll("\n", "");
                if (newStr.split("").filter(i => i === "$").length !== strings.length) return err("Unexpected dollar sign.");

                const words = newStr.split(" ");
                let whereSplit = [];
                let setSplit = [];
                if (words[0].toLowerCase() === "where") {
                    const setIndex = words.findIndex(i => i.toLowerCase() === "set");
                    whereSplit = words.slice(1, setIndex === -1 ? words.length : setIndex);
                    if (setIndex !== -1) setSplit = words.slice(setIndex + 1);
                } else if (words[0].toLowerCase() === "set") {
                    const whereIndex = words.findIndex(i => i.toLowerCase() === "where");
                    setSplit = words.slice(1, whereIndex === -1 ? words.length : whereIndex);
                    if (whereIndex !== -1) whereSplit = words.slice(whereIndex + 1);
                } else return err("Expected a 'where' or 'set' expression.");
                whereSplit = whereSplit.join(" ").split(",").map(i => i.split(" ").filter(i => i)).filter(i => i[0]);
                setSplit = setSplit.join(" ").split(",").map(i => i.split(" ").filter(i => i)).filter(i => i[0]);
                /*const splitA = newStr.split(",").map(i => removeExtraWhitespace(i.trim()).split(" "));
                if (!splitA.some(i => i.some(j => j.toLowerCase() === "set"))) return err("Syntax: UPDATE FROM <table> WHERE <condition> SET <values>");
                const splitInd = splitA.findIndex(i => i.some(j => j.toLowerCase() === "set"));
                const split = splitA.slice(0, splitInd + 1);
                const splitB = [split[split.length - 1].slice(3), ...splitA.slice(splitInd + 1)];
                split[split.length - 1] = split[split.length - 1].slice(0, 2);*/
                if (whereSplit.some(i => i.length !== 2)) return err("Every where expression should have a column name and a value.");
                if (setSplit.some(i => i.length !== 2)) return err("Every set expression should have a column name and a value.");
                const invalid = [...whereSplit, ...setSplit].filter(i => !table[1].some(j => j[0] === i[0])).map(i => i[0]);
                if (invalid.length) return err("Invalid column" + (invalid.length > 1 ? "s" : "") + " for table '" + tableName + "': " + invalid.join(", ") + ".");
                const requirements = [];
                for (let i = 0; i < table[1].length; i++) {
                    const column = table[1][i];
                    let val = whereSplit.find(i => i[0] === column[0]);
                    if (val) {
                        val = val[1];
                        if (val.startsWith("$")) val = strings[val.substring(1)];
                        else val *= 1;
                        if (typeof val !== ["number", "string"][column[4]]) return err("Column type '" + ["number", "string"][column[3]] + "' expected, got '" + typeof val + "'.");
                        requirements.push([i, val]);
                    }
                }
                const setting = [];
                for (let i = 0; i < table[1].length; i++) {
                    const column = table[1][i];
                    let val = setSplit.find(i => i[0] === column[0]);
                    if (val) {
                        val = val[1];
                        if (val.startsWith("$")) val = strings[val.substring(1)];
                        else val *= 1;
                        if (column[2] && table[2].some(j => j[i] === val)) return err("Column named '" + column[0] + "' should be unique.");
                        if (typeof val !== ["number", "string"][column[4]]) return err("Column type '" + ["number", "string"][column[3]] + "' expected, got '" + typeof val + "'.");
                        setting.push([i, val]);
                    }
                }
                const rows = table[2].filter(i => requirements.every(j => i[j[0]] === j[1]));
                rows.forEach(i => setting.forEach(j => i[j[0]] = j[1]));
            } else return err("Invalid command.");
            if (saveInstant) saveInstant();
            if (saveTick) tables.set(tid, saveTick);
            return true;
        }
    };
    Object.defineProperty(res, "version", {
        get: () => FILE_VERSION
    });
    Object.defineProperty(res, "versionCurrent", {
        get: () => VERSION
    });
    Object.defineProperty(res, "all", {
        get: () => current
    });
    Object.defineProperty(res, "id", {
        get: () => tid
    });
    return res;
};

module.exports = photon;
module.exports.encoder = encoder;
module.exports.decoder = decoder;