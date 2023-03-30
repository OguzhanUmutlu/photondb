// noinspection InfiniteLoopJS

const photon = require("./pdb");
const stdin = require("readline").createInterface(process.stdin);
const file = process.argv[2];

(async () => {
    if (!file) {
        console.log("No file was provided. Example: cli ./data.pdb")
        process.exit();
    }
    const db = photon(file, false);
    if (typeof db === "string") {
        console.log(db);
        process.exit();
    }
    const semantic = num => num.toString().padStart(3, "0").split("").join(".");
    console.log("PhotonDB v" + semantic(db.version) + (db.version !== db.versionCurrent ? ", current: v" + semantic(db.versionCurrent) : ""));
    if (db.version < db.versionCurrent) {
        console.log("WARNING: Editing an old versioned photon file!");
        process.stdout.write("Do you want to update this photon file? We recommend backing up your file (y/n): ");
        const p = await new Promise(r => stdin.question("", r));
        if (p === "y") {
            db.updateFileVersion();
            console.log("Successfully updated.");
        }
    }
    console.log(db.all)
    while (true) {
        process.stdout.write("> ");
        const input = await new Promise(r => stdin.question("", r));
        let res;
        try {
             res = db.query(input.toString());
        } catch (e) {
            res = e;
        }
        if (typeof res === "string") console.log(res);
        else console.log(res);
    }
})();