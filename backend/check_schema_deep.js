const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./ukombozi.sqlite');

db.serialize(() => {
    console.log("--- MEMBER SCHEMA CHECK ---");
    db.get("SELECT * FROM members LIMIT 1", [], (err, row) => {
        if (err) console.error(err);
        else console.log("MEMBER_ROW_JSON:" + JSON.stringify(row));
    });

    console.log("--- PROJECT REGISTRATION CHECK ---");
    db.get("SELECT * FROM project_registrations LIMIT 1", [], (err, row) => {
        if (err) console.error(err);
        else console.log("PROJ_REG_ROW_JSON:" + JSON.stringify(row));
    });

    console.log("--- PROJECT SAVINGS CHECK ---");
    db.get("SELECT * FROM project_savings LIMIT 1", [], (err, row) => {
        if (err) console.error(err);
        else console.log("PROJ_SAV_ROW_JSON:" + JSON.stringify(row));
    });
});
