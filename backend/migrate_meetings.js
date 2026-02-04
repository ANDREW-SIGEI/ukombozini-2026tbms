const db = require('./db');

db.serialize(() => {
    console.log("Starting manual migration...");

    db.run("ALTER TABLE meeting_sessions ADD COLUMN venue TEXT", (err) => {
        if (err) console.log("Venue column might already exist or error:", err.message);
        else console.log("Added venue column");
    });

    db.run("ALTER TABLE meeting_sessions ADD COLUMN agenda TEXT", (err) => {
        if (err) console.log("Agenda column might already exist or error:", err.message);
        else console.log("Added agenda column");
    });

    db.run("ALTER TABLE meeting_sessions ADD COLUMN meeting_type TEXT DEFAULT 'Routine'", (err) => {
        if (err) console.log("Meeting Type column might already exist or error:", err.message);
        else console.log("Added meeting_type column");
    });

    db.run("ALTER TABLE meeting_sessions ADD COLUMN expected_attendance INTEGER", (err) => {
        if (err) console.log("Expected Attendance column might already exist or error:", err.message);
        else console.log("Added expected_attendance column");
    });

    console.log("Migration script finished processing.");
});
