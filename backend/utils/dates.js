/**
 * UKOMBOZINI Date Utility
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Calculates the next occurrence of a given weekday.
 * @param {string} meetingDay - e.g. "Monday"
 * @returns {string} - YYYY-MM-DD
 */
function calculateNextMeeting(meetingDay) {
    if (!meetingDay) return "TBD";

    const targetDay = DAYS.indexOf(meetingDay.charAt(0).toUpperCase() + meetingDay.slice(1).toLowerCase());
    if (targetDay === -1) return "TBD";

    const now = new Date();
    let daysUntil = (targetDay - now.getDay() + 7) % 7;

    // If it's today, but we want the NEXT meeting (assuming today's session is handled)
    // we can either return today or the next week. Typically, "Next Meeting" implies next week.
    if (daysUntil === 0) daysUntil = 7;

    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + daysUntil);

    return nextDate.toISOString().split('T')[0];
}

/**
 * Detects if the current date falls within a festive season and returns a greeting.
 * @returns {string} - Empty string or festive greeting.
 */
function getSeasonalGreeting() {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-indexed
    const day = now.getDate();

    // 1. Christmas Season (Dec 15 - Dec 26)
    if (month === 12 && day >= 15 && day <= 26) {
        return " 🎄 Merry Xmas!";
    }

    // 2. New Year Season (Dec 27 - Jan 5)
    if ((month === 12 && day >= 27) || (month === 1 && day <= 5)) {
        return " 🥳 Happy New Year!";
    }

    return "";
}

module.exports = {
    calculateNextMeeting,
    getSeasonalGreeting
};
