// noinspection InfiniteLoopJS

const photon = require("./pdb");
const stdin = require("readline").createInterface(process.stdin);
const file = process.argv[2];

(async () => {
    const db = photon(file, false);
    if (typeof db === "string") {
        console.log(db);
        process.exit();
    }
    const semantic = num => num.toString().padStart(3, "0").split("").join(".");
    console.log("PhotonDB v" + semantic(db.version) + (db.version !== db.versionCurrent ? ", current: " + semantic(db.versionCurrent) : ""));
    if (db.version < db.versionCurrent) {
        console.log("WARNING: Editing an old versioned photon file!");
        process.stdout.write("Do you want to update this photon file? (y/n): ");
        const p = await new Promise(r => stdin.question("", r));
        if (p === "y") {
            db.update();
            console.log("Successfully updated.");
        }
    }
    while (true) {
        process.stdout.write("> ");
        const input = await new Promise(r => stdin.question("", r));
        const res = db.query(input.toString());
        if (typeof res === "object") console.log(JSON.stringify(res));
        else if (typeof res === "string") console.log(res);
    }
})();