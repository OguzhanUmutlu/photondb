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
    console.log("PhotonDB v" + db.version.toString().padStart(3, "0").split("").join("."));
    while (true) {
        process.stdout.write("> ");
        const input = await new Promise(r => stdin.question("", r));
        const res = db.query(input.toString());
        if (typeof res === "object") console.log(JSON.stringify(res));
        else if (typeof res === "string") console.log(res);
    }
})();