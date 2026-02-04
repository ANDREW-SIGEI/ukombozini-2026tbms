const db = require('../db');
const bcrypt = require('bcryptjs');

const registerGroupAndOfficials = async () => {
    const groupName = "TORET MOI WOMEN GROUP";
    const officials = [
        { name: "Sharo Bett", role: "Chairperson", email: "sharo@ukombozi.com", phone: "0720000001" },
        { name: "Winny Chelangat", role: "Treasurer", email: "winny@ukombozi.com", phone: "0720000002" },
        { name: "Hilda Sigei", role: "Secretary", email: "hilda@ukombozi.com", phone: "0720000003" } // Assuming Hilda is also an official for this group
    ];

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // 1. Create Group
        db.run("INSERT INTO groups (name, status) VALUES (?, 'active')", [groupName], function (err) {
            if (err) {
                console.error("Failed to create group:", err);
                db.run("ROLLBACK");
                return;
            }
            const groupId = this.lastID;
            console.log(`Group Created: ${groupName} (ID: ${groupId})`);

            // 2. Register/Link Officials
            const defaultPassword = bcrypt.hashSync("password123", 10);

            // 2. Register Members & Link Officials
            const termStart = new Date().toISOString().split('T')[0];
            const termEnd = new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0];

            officials.forEach(official => {
                // Register as MEMBER first (required for group officials)
                db.run("INSERT INTO members (name, phone, group_id, status) VALUES (?, ?, ?, 'active')",
                    [official.name, official.phone, groupId], function (err) {
                        if (err) {
                            console.error(`Failed to register member ${official.name}:`, err);
                            return;
                        }
                        const memberId = this.lastID;
                        console.log(`Member Registered: ${official.name} (ID: ${memberId})`);

                        // Assign Role
                        db.run("INSERT INTO group_officials (group_id, member_id, role, term_start, term_end, status) VALUES (?, ?, ?, ?, ?, 'active')",
                            [groupId, memberId, official.role, termStart, termEnd], (err) => {
                                if (err) console.log(`Failed to assign ${official.name}: ${err.message}`);
                                else console.log(`Assigned ${official.name} as ${official.role}`);
                            });
                    });
            });

            db.run("COMMIT", () => {
                console.log("Registration Sequence Completed Successfully within 2 seconds.");
            });
        });
    });
};

registerGroupAndOfficials();
