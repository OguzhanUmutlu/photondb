const fs = require("fs");

const columnSplitter = 0;
const generalSplitter = 1;
const tableSplitter = 2;
const backslash = 3;
const VERSION = 103;

const chr = n => String.fromCharCode(n);

// TODO: every error message should have dot at end

// [ U_VERSION TABLE_NAME U_2 (ROW_NAME U_2 U_ROW_PRIMARY_ROW_TYPE).join(U_2) U_1 (VALUE).join(U_1) ].join(U_3)
// TYPES: number, string

const stringEncoder = str => str.toString()
    .replaceAll(chr(backslash), chr(backslash).repeat(2))
    .replaceAll(chr(columnSplitter), chr(backslash) + chr(columnSplitter))
    .replaceAll(chr(generalSplitter), chr(backslash) + chr(generalSplitter))
    .replaceAll(chr(tableSplitter), chr(backslash) + chr(tableSplitter));
const encoder = tables => chr(VERSION) + tables.map(table => `${stringEncoder(table[0])}${chr(generalSplitter)}${table[1].map(row => `${row[0]}${chr(generalSplitter)}${chr(row[1] * 100 + row[2] * 10 + row[3])}`).join("")}${chr(columnSplitter)}${table[2].map(col => col.map(stringEncoder).join(chr(columnSplitter))).join(chr(columnSplitter))}`).join(chr(tableSplitter));

const decoder = content => {
    content += chr(tableSplitter);
    const tables = [];
    let cancel = false;
// reset all these at the end of every table
    let name = "";
    let nameDone = false;
    let rows = [];
    let rowName = "";
    let rowDone = false;
    let columns = [];
    let columnName = "";
    let columnGroup = [];
    let columnDone = false;
    let columnIndex = 0;

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
        } else if (!rowDone) {
            if (!cancel && code === generalSplitter) {
                if (!content[i + 1]) throw new Error("Invalid BDB format. Expected a character after the row ending. Error code: #1");
                const next = content[i + 1].charCodeAt(0).toString().padStart(3, "0").split("");
                if (content[i + 2] && content[i + 2].charCodeAt(0) === columnSplitter) {
                    rowDone = true;
                    i++;
                }
                rows.push([rowName, next[0] * 1, next[1] * 1, next[2] * 1]);
                rowName = "";
                i++;
                continue;
            }
            rowName += c;
        } else if (!columnDone) {
            if (!cancel && (code === columnSplitter || code === tableSplitter)) {
                const rowType = rows[columnIndex][3];
                columnIndex++;
                if (rowType === 0) columnName *= 1;
                columnGroup.push(columnName);
                if (columnGroup.length >= rows.length) {
                    columns.push(columnGroup);
                    columnGroup = [];
                    columnIndex = 0;
                }
                if (code === tableSplitter) {
                    tables.push([name, rows, columns]);
                    name = "";
                    nameDone = false;
                    rows = [];
                    rowName = "";
                    rowDone = false;
                    columns = [];
                    columnGroup = [];
                    columnDone = false;
                    columnIndex = 0;
                }
                columnName = "";
                continue;
            }
            columnName += c;
            //process.stdout.write((code < 20 ? "U_" + code : c) + " ");
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
    let str2 = str;
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
                str2 = str2.substring(0, str_start) + str2.substring(i + 1);
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
    return [str, str2, strings];
}

function removeExtraWhitespace(str) {
    while (str.includes("  ")) str = str.replace("  ", " ");
    return str;
}

const tables = new Map;

const tick = () => {
    tables.forEach(t => t());
    tables.clear();
    setTimeout(tick);
};

tick();

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
    if (FILE_VERSION > VERSION) return err("Selected BDB file's version is v" + FILE_VERSION + " which is higher than the parser's version(v" + VERSION + ")");
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
            // TODO: update row, add row, remove row

            // TODO: make key/unique property actually work

            if (cmd("create table")) {
                // create-table myTable id key auto-increment, name, age int
                // TODO: "default" property
                const tableName = args.slice(0, 3).join(" ").toLowerCase() === "if not exists" ? args[3] : args[0];
                const exists = current.some(i => i[0] === tableName);
                if (args.slice(0, 3).join(" ").toLowerCase() === "if not exists") {
                    args = args.slice(3);
                    if (exists) return false;
                }
                if (exists) return err("Table called '" + tableName + "' already exists");
                const rows = [];
                const r = removeExtraWhitespace(args.slice(1).join(" ")).split(",").map(i => i.trim().split(" "));
                if (r.some(i => !i[0])) return err("Syntax: CREATE TABLE <table> <row-name> <row-properties>, <row-name> <row-properties>, ...");
                for (let i = 0; i < r.length; i++) {
                    const row = r[i];
                    const row2 = row.join(" ").toLowerCase();
                    if (row2.includes("text") && row2.includes("number")) return err("A row can't have multiple types.");
                    if ((row2.includes("auto-increment") || row2.includes("autoincrement")) && row2.includes("text")) return err("A row can't have both auto-increment and str properties.");
                    rows.push([row[0], (row2.includes("key") || row2.includes("unique")) * 1, (row2.includes("auto-increment") || row2.includes("autoincrement")) * 1, row2.includes("number") || (row2.includes("auto-increment") || row2.includes("autoincrement")) ? 0 : 1]);
                }
                current.push([tableName, rows, []]);
            } else if (cmd("delete table")) {
                const tableName = args[0] || "";
                if (!current.some(i => i[0] === tableName)) {
                    if (!tableName) return err("Syntax: DELETE TABLE <table>");
                    return err("Couldn't find the table called '" + tableName + "'");
                }
                current.splice(current.findIndex(i => i[0] === tableName), 1);
            } else if (cmd("insert into")) { // TODO: change all "column"s to "row" and "row"s to "column" 💀
                // insert-column myTable name "Alex", age 10
                const tableName = args[0];
                const table = current.find(i => i[0] === tableName);
                if (!table) return err("Couldn't find a table called '" + tableName + "'");
                const givenStr = args.slice(1).join(" ");
                const detectedStrings = detectStrings(givenStr, thr);
                if (typeof detectedStrings === "string") return detectedStrings;
                const [newStr, checkStr, strings] = detectedStrings;
                if (checkStr.includes("$")) return err("Unexpected dollar sign");
                const split = newStr.split(",").map(i => removeExtraWhitespace(i.trim()).split(" "));
                const unexpected = split.filter(i => i.length !== 2);
                if (unexpected.length) return err("Syntax: INSERT INTO <table> <row-name> <row-value>, <row-name> <row-value>, ...");
                if (split.every(i => i[0])) {
                    const invalid = split.filter(i => !table[1].some(j => j[0] === i[0]));
                    if (invalid.length) return err("Invalid row name" + (invalid.length > 1 ? "s" : "") + " for table '" + tableName + "': " + invalid.map(i => "'" + i[0] + "'").join(", "));
                }
                const def = table[1].filter(i => !i[2] && !split.some(j => j[0] === i[0]));
                if (def.length) return err("Couldn't get a default value for the row" + (def.length > 1 ? "s" : "") + " " + def.map(i => "'" + i[0] + "'").join(", "));
                const column = [];
                for (let i = 0; i < table[1].length; i++) {
                    const row = table[1][i];
                    let val = split.find(i => i[0] === row[0]);
                    if (val) {
                        val = val[1];
                        if (val.startsWith("$")) val = strings[val.substring(1)];
                        else val *= 1;
                        if (typeof val !== ["number", "string"][row[3]]) return err("Row type '" + ["number", "string"][row[3]] + "' expected, got '" + typeof val + "'");
                    } else val = ((table[2].slice(0).reverse()[0] || [])[i] || 0) + 1; // TODO: if you delete the last entry, the new entry will have its id
                    column.push(val);
                }
                table[2].push(column);
            } else if (cmd("delete from")) {
                // delete-column myTable name "Alex", age 10
                const tableName = args[0];
                if (!tableName) return err("Syntax: DELETE FROM <table> WHERE <condition>");
                const table = current.find(i => i[0] === tableName);
                if (!table) return err("Couldn't find a table called '" + tableName + "'");
                if ((args[1] || "").toLowerCase() !== "where") return err("Syntax: DELETE FROM <table> WHERE <condition>");
                const givenStr = args.slice(2).join(" ");
                const [newStr, checkStr, strings] = detectStrings(givenStr);
                if (checkStr.includes("$")) return err("Unexpected dollar sign");
                const split = newStr.split(",").map(i => removeExtraWhitespace(i.trim()).split(" "));
                const unexpected = split.filter(i => i.length !== 2);
                if (unexpected.length) return err("Syntax: DELETE FROM <table> WHERE <condition>");
                if (split.every(i => i[0])) {
                    const invalid = split.filter(i => !table[1].some(j => j[0] === i[0]));
                    if (invalid.length) return err("Invalid row name" + (invalid.length > 1 ? "s" : "") + " for table '" + tableName + "': " + invalid.map(i => "'" + i[0] + "'").join(", "));
                }
                const requirements = [];
                for (let i = 0; i < table[1].length; i++) {
                    const row = table[1][i];
                    let val = split.find(i => i[0] === row[0]);
                    if (val) {
                        val = val[1];
                        if (val.startsWith("$")) val = strings[val.substring(1)];
                        else val *= 1;
                        if (typeof val !== ["number", "string"][row[3]]) return err("Row type '" + ["number", "string"][row[3]] + "' expected, got '" + typeof val + "'");
                        requirements.push([i, val]);
                    }
                }
                const columns = table[2].filter(i => requirements.every(j => i[j[0]] === j[1]));
                columns.forEach(i => table[2].splice(table[2].indexOf(i), 1));
                return columns;
            } else if (cmd("select from")) {
                const tableName = args[0];
                if (!tableName) return err("Syntax: SELECT FROM <table> WHERE <condition>");
                const table = current.find(i => i[0] === tableName);
                if (!table) return err("Couldn't find a table called '" + tableName + "'");
                if ((args[1] || "").toLowerCase() !== "where" && args.length > 1) return err("Syntax: SELECT FROM <table> WHERE <condition>");
                let requirements = [];
                if (args.length > 1) {
                    const givenStr = args.slice(2).join(" ");
                    const [newStr, checkStr, strings] = detectStrings(givenStr);
                    if (checkStr.includes("$")) return err("Unexpected dollar sign");
                    const split = newStr.split(",").map(i => removeExtraWhitespace(i.trim()).split(" "));
                    const unexpected = split.filter(i => i.length !== 2);
                    if (unexpected.length) return err("Syntax: SELECT FROM <table> WHERE <condition>");
                    if (split.every(i => i[0])) {
                        const invalid = split.filter(i => !table[1].some(j => j[0] === i[0]));
                        if (invalid.length) return err("Invalid row name" + (invalid.length > 1 ? "s" : "") + " for table '" + tableName + "': " + invalid.map(i => "'" + i[0] + "'").join(", "));
                    }
                    for (let i = 0; i < table[1].length; i++) {
                        const row = table[1][i];
                        let val = split.find(i => i[0] === row[0]);
                        if (val) {
                            val = val[1];
                            if (val.startsWith("$")) val = strings[val.substring(1)];
                            else val *= 1;
                            if (typeof val !== ["number", "string"][row[3]]) return err("Row type '" + ["number", "string"][row[3]] + "' expected, got '" + typeof val + "'");
                            requirements.push([i, val]);
                        }
                    }
                }
                return table[2].filter(i => requirements.every(j => i[j[0]] === j[1]));
            } else if (cmd("update from")) {
                const tableName = args[0];
                if (!tableName) return err("Syntax: UPDATE FROM <table> WHERE <condition> SET <values>");
                const table = current.find(i => i[0] === tableName);
                if (!table) return err("Couldn't find a table called '" + tableName + "'");

                const givenStr = args.slice(1).join(" ");
                const [newStr, checkStr, strings] = detectStrings(givenStr);
                if (checkStr.includes("$")) return err("Unexpected dollar sign");

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
                } else return err("Expected a 'where' or 'set' expression");
                whereSplit = whereSplit.join(" ").split(",").map(i => i.split(" ").filter(i => i)).filter(i => i[0]);
                setSplit = setSplit.join(" ").split(",").map(i => i.split(" ").filter(i => i)).filter(i => i[0]);
                /*const splitA = newStr.split(",").map(i => removeExtraWhitespace(i.trim()).split(" "));
                if (!splitA.some(i => i.some(j => j.toLowerCase() === "set"))) return err("Syntax: UPDATE FROM <table> WHERE <condition> SET <values>");
                const splitInd = splitA.findIndex(i => i.some(j => j.toLowerCase() === "set"));
                const split = splitA.slice(0, splitInd + 1);
                const splitB = [split[split.length - 1].slice(3), ...splitA.slice(splitInd + 1)];
                split[split.length - 1] = split[split.length - 1].slice(0, 2);*/
                if (whereSplit.some(i => i.length !== 2)) return err("Every where expression should have a row name and a value");
                if (setSplit.some(i => i.length !== 2)) return err("Every set expression should have a row name and a value");
                const invalid = [...whereSplit, ...setSplit].filter(i => !table[1].some(j => j[0] === i[0])).map(i => i[0]);
                if (invalid.length) return err("Invalid row" + (invalid.length > 1 ? "s" : "") + " for table '" + tableName + "': " + invalid.join(", "));
                const requirements = [];
                for (let i = 0; i < table[1].length; i++) {
                    const row = table[1][i];
                    let val = whereSplit.find(i => i[0] === row[0]);
                    if (val) {
                        val = val[1];
                        if (val.startsWith("$")) val = strings[val.substring(1)];
                        else val *= 1;
                        if (typeof val !== ["number", "string"][row[3]]) return err("Row type '" + ["number", "string"][row[3]] + "' expected, got '" + typeof val + "'");
                        requirements.push([i, val]);
                    }
                }
                const setting = [];
                for (let i = 0; i < table[1].length; i++) {
                    const row = table[1][i];
                    let val = setSplit.find(i => i[0] === row[0]);
                    if (val) {
                        val = val[1];
                        if (val.startsWith("$")) val = strings[val.substring(1)];
                        else val *= 1;
                        if (typeof val !== ["number", "string"][row[3]]) return err("Row type '" + ["number", "string"][row[3]] + "' expected, got '" + typeof val + "'");
                        setting.push([i, val]);
                    }
                }
                const columns = table[2].filter(i => requirements.every(j => i[j[0]] === j[1]));
                columns.forEach(i => setting.forEach(j => i[j[0]] = j[1]));
            } else return err("Invalid command");
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