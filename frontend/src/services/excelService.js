import * as XLSX from 'xlsx';

/**
 * HIGH STANDARD EXCEL REPORTING SERVICE
 * Professional Excel exports with Safaricom branding logic and strict metadata.
 */
const ExcelService = {

    /**
     * Export data to Professional Excel File
     * @param {Array} data - Array of objects to export
     * @param {Array} columns - Column definitions [{ header: 'Name', key: 'name' }]
     * @param {string} title - Report Title
     * @param {string} fileName - Output filename (without extension)
     * @param {Object} metadata - Optional key-value metadata to add to header
     */
    exportToExcel(data, columns, title, fileName, metadata = {}) {
        // 1. Prepare Workbook
        const wb = XLSX.utils.book_new();
        wb.Props = {
            Title: title,
            Subject: "Ukombozi TBMS Report",
            Author: "Ukombozi System",
            CreatedDate: new Date()
        };

        // 2. Prepare Data Structure
        // We manually build the array of arrays to control layout
        const wsData = [];

        // --- BRAND HEADER SECTION ---
        // Row 1: System Name (Merged later)
        wsData.push(["UKOMBOZI TABLE BANKING SYSTEM"]);
        // Row 2: Report Title (Merged later)
        wsData.push([title.toUpperCase()]);
        // Row 3: Generation Info
        wsData.push([`Generated On: ${new Date().toLocaleString()}`]);

        // Metadata Rows
        Object.entries(metadata).forEach(([key, value]) => {
            wsData.push([`${key}: ${value}`]);
        });

        // Blank Row
        wsData.push([]);

        // --- TABLE HEADERS ---
        const headerRow = columns.map(c => c.header);
        wsData.push(headerRow);

        // --- DATA ROWS ---
        data.forEach(item => {
            const row = columns.map(col => {
                // Handle nested keys safely (e.g., 'member.name')
                const keys = col.key.split('.');
                let value = item;
                keys.forEach(k => {
                    value = (value && value[k] !== undefined) ? value[k] : null;
                });

                // Format if formatter provided
                if (col.formatter) {
                    return col.formatter(value, item);
                }
                return value || '-';
            });
            wsData.push(row);
        });

        // 3. Create Worksheet
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // 4. Styling & Merges
        // Merge Title Rows
        // Note: 'xlsx' Community Edition (which is likely what is installed) doesn't support comprehensive styling (colors/fonts)
        // out of the box without Pro version, but we can do Merges and Column Widths.
        const mergeRange = columns.length > 1 ? columns.length - 1 : 1;

        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: mergeRange } }, // Merge Row 1 (System Name)
            { s: { r: 1, c: 0 }, e: { r: 1, c: mergeRange } }  // Merge Row 2 (Title)
        ];

        // 5. Column Width Auto-Fit
        // Simple logic to set width based on header length and some data sample
        const colWidths = columns.map(col => ({ wch: Math.max(col.header.length + 5, 15) }));
        ws['!cols'] = colWidths;

        // 6. Append and Save
        XLSX.utils.book_append_sheet(wb, ws, "Report");

        const timestamp = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `${fileName}_${timestamp}.xlsx`);
    }
};

export default ExcelService;
